import type { SettingPrimitive } from '../../types/conversation'
import type {
  NormalizedImageItem,
  NormalizedImageRequest,
  NormalizedImageResult,
  NormalizedResumeResult,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderError,
  ProviderErrorCode,
  ProviderSourceImage,
} from '../../types/provider'
import { isTimeoutError } from '../fetchWithTimeout'
import { runWithImageRequestLimit } from '../imageRequestLimiter'
import { getComputedPresetResolution, normalizeSizeTier } from '../imageSizing'
import { emitImageChainTrace, summarizeImagePayload, summarizeString } from '../imageChainTrace'
import { isInsufficientBalanceMessage } from '../../utils/insufficientBalance'
import { buildBrowserUnsupportedDetail, buildBrowserUnsupportedMessage } from './browserSupport'
import { discoverOpenAICompatibleModelEntries } from './openaiCompatible/modelDiscovery'
import {
  createProviderErrorFactory,
  normalizeBaseUrl,
  readString,
} from './providerShared'

interface RawImageItem {
  url?: unknown
  b64_json?: unknown
  error?: unknown
}

function buildGenerationUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl)
  const lower = normalized.toLowerCase()

  if (lower.endsWith('/api/v3/images/generations')) {
    return normalized
  }
  if (lower.endsWith('/api/v3/images')) {
    return `${normalized}/generations`
  }
  if (lower.endsWith('/api/v3')) {
    return `${normalized}/images/generations`
  }
  return `${normalized}/api/v3/images/generations`
}

function getStringParam(
  paramValues: Record<string, SettingPrimitive>,
  key: string,
  fallback: string,
): string {
  const value = paramValues[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function getBooleanParam(paramValues: Record<string, SettingPrimitive>, key: string): boolean | undefined {
  const value = paramValues[key]
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return undefined
}

function getNumberParam(paramValues: Record<string, SettingPrimitive>, key: string): number | undefined {
  const value = paramValues[key]
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function isPixelSize(value: string): boolean {
  return /^\d+x\d+$/i.test(value.trim())
}

function isRatioSize(value: string): boolean {
  return /^\d+:\d+$/.test(value.trim())
}

function toPixelSize(rawSize: string, aspectRatio: string): string {
  if (isPixelSize(rawSize)) {
    return rawSize
  }
  if (isRatioSize(rawSize)) {
    return getComputedPresetResolution(rawSize, '1K') ?? '1024x1024'
  }
  return getComputedPresetResolution(aspectRatio, normalizeSizeTier(rawSize)) ?? '1024x1024'
}

function supportsResolutionToken(modelId: string): boolean {
  const normalized = modelId.trim().toLowerCase()
  return normalized === 'seedream-5.0-lite' || normalized === 'seedream-4.5' || normalized === 'seedream-4.0'
}

function supportsSequentialImageGeneration(modelId: string): boolean {
  return supportsResolutionToken(modelId)
}

function supportsOutputFormat(modelId: string): boolean {
  return modelId.trim().toLowerCase() === 'seedream-5.0-lite'
}

function supportsGuidanceScale(modelId: string): boolean {
  const normalized = modelId.trim().toLowerCase()
  return normalized === 'seedream-3.0-t2i' || normalized === 'seededit-3.0-i2i'
}

function supportsSeed(modelId: string): boolean {
  return supportsGuidanceScale(modelId)
}

function supportsImageInput(modelId: string): boolean {
  return modelId.trim().toLowerCase() !== 'seedream-3.0-t2i'
}

async function sourceImageToDataUrl(image: ProviderSourceImage): Promise<string> {
  const type = image.mimeType?.trim() || image.blob.type || 'image/png'
  const bytes = new Uint8Array(await image.blob.arrayBuffer())
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return `data:${type};base64,${btoa(binary)}`
}

function toImageSrc(item: RawImageItem): string | null {
  const url = readString(item.url)
  if (url) {
    return url
  }
  const payload = readString(item.b64_json)
  return payload ? `data:image/jpeg;base64,${payload}` : null
}

function toItemError(item: RawImageItem): string | null {
  if (!item.error || typeof item.error !== 'object') {
    return null
  }
  const raw = item.error as { code?: unknown; message?: unknown }
  const code = readString(raw.code)
  const message = readString(raw.message)
  if (code && message) {
    return `${code}: ${message}`
  }
  return message ?? code ?? null
}

const createProviderError = createProviderErrorFactory('byteplus-ark')

function isBrowserNetworkBlockedError(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return normalized.includes('failed to fetch')
    || normalized.includes('networkerror')
    || normalized.includes('load failed')
    || normalized.includes('cors')
    || normalized.includes('access-control-allow-origin')
}

function toProviderErrorCode(status?: number, detail?: string): ProviderErrorCode {
  if (isInsufficientBalanceMessage(detail)) return 'insufficient_balance'
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  if (status === 400) return 'unsupported_param'
  if (status === 451) return 'rejected'
  if (typeof status === 'number' && status >= 500) return 'provider_unavailable'
  if ((detail ?? '').toLowerCase().includes('sensitive')) return 'rejected'
  return 'unknown'
}

function buildRequestBody(input: {
  modelId: string
  prompt: string
  paramValues: Record<string, SettingPrimitive>
  responseFormat: 'url' | 'b64_json'
  forceDisableSequential: boolean
  encodedImages: string[]
}): Record<string, unknown> {
  const aspectRatio = getStringParam(input.paramValues, 'aspectRatio', '1:1')
  const defaultSize = input.modelId.trim().toLowerCase() === 'seededit-3.0-i2i' ? 'adaptive' : '2K'
  const rawSize = getStringParam(input.paramValues, 'size', defaultSize)
  const watermark = getBooleanParam(input.paramValues, 'watermark')
  const stream = getBooleanParam(input.paramValues, 'stream')
  const seed = getNumberParam(input.paramValues, 'seed')
  const guidanceScale = getNumberParam(input.paramValues, 'guidanceScale')
  const optimizePromptMode = getStringParam(input.paramValues, 'optimizePromptMode', 'standard')
  const outputFormat = getStringParam(input.paramValues, 'outputFormat', 'jpeg').toLowerCase()
  const sequentialMode = input.forceDisableSequential
    ? 'disabled'
    : getStringParam(input.paramValues, 'sequentialImageGeneration', 'disabled')
  const sequentialMaxImages = getNumberParam(input.paramValues, 'sequentialMaxImages')

  const body: Record<string, unknown> = {
    model: input.modelId,
    prompt: input.prompt,
    response_format: input.responseFormat,
    ...(typeof watermark === 'boolean' ? { watermark } : {}),
  }

  if (supportsImageInput(input.modelId) && input.encodedImages.length > 0) {
    body.image = input.encodedImages.length === 1 ? input.encodedImages[0] : input.encodedImages
  }

  if (supportsResolutionToken(input.modelId) && ['1K', '2K', '3K', '4K'].includes(rawSize)) {
    body.size = rawSize
  } else {
    body.size = rawSize === 'adaptive' ? 'adaptive' : toPixelSize(rawSize, aspectRatio)
  }

  if (supportsSeed(input.modelId) && typeof seed === 'number') {
    body.seed = Math.max(-1, Math.min(2_147_483_647, Math.floor(seed)))
  }
  if (supportsGuidanceScale(input.modelId) && typeof guidanceScale === 'number') {
    body.guidance_scale = Math.max(1, Math.min(10, guidanceScale))
  }
  if (supportsSequentialImageGeneration(input.modelId)) {
    body.sequential_image_generation = sequentialMode === 'auto' ? 'auto' : 'disabled'
    if (body.sequential_image_generation === 'auto' && typeof sequentialMaxImages === 'number') {
      body.sequential_image_generation_options = {
        max_images: Math.max(1, Math.min(15, Math.floor(sequentialMaxImages))),
      }
    }
    if (typeof stream === 'boolean') {
      body.stream = stream
    }
    if (optimizePromptMode === 'standard' || optimizePromptMode === 'fast') {
      body.optimize_prompt_options = { mode: optimizePromptMode }
    }
  }
  if (supportsOutputFormat(input.modelId) && (outputFormat === 'jpeg' || outputFormat === 'png')) {
    body.output_format = outputFormat
  }

  return body
}

const capabilities: ProviderCapabilities = {
  endpointStyle: 'openai-compatible',
  auth: 'bearer',
  browserInvocation: 'requires-proxy',
  supportsModelDiscovery: true,
  supportsTaskResume: false,
  modelTag: 'byteplus',
  defaultImageParamSchema: [
    { key: 'responseFormat', label: '返回格式', type: 'enum', default: 'b64_json', options: ['url', 'b64_json'] },
    {
      key: 'size',
      label: '尺寸',
      type: 'enum',
      surface: 'shared-settings',
      default: '2K',
      options: ['adaptive', '1K', '2K', '3K', '4K', '1024x1024', '2048x2048'],
    },
    {
      key: 'aspectRatio',
      label: '宽高比',
      type: 'enum',
      surface: 'shared-settings',
      default: '1:1',
      options: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
    },
    { key: 'watermark', label: '水印', type: 'boolean', default: true },
    { key: 'sequentialImageGeneration', label: '关联批量出图', type: 'enum', default: 'disabled', options: ['disabled', 'auto'] },
    { key: 'sequentialMaxImages', label: '批量上限', type: 'number', default: 4, min: 1, max: 15 },
    { key: 'stream', label: '流式出图', type: 'boolean', default: false },
    { key: 'guidanceScale', label: '提示词强度', type: 'number', default: 2.5, min: 1, max: 10 },
    { key: 'seed', label: '随机种子', type: 'number', default: -1, min: -1, max: 2_147_483_647 },
    { key: 'outputFormat', label: '输出格式', type: 'enum', default: 'jpeg', options: ['jpeg', 'png'] },
    { key: 'optimizePromptMode', label: '提示词优化', type: 'enum', default: 'standard', options: ['standard', 'fast'] },
  ],
}

export const byteplusArkAdapter: ProviderAdapter = {
  id: 'byteplus-ark',
  displayName: 'BytePlus Ark',
  capabilities,
  async discoverModels(channel) {
    try {
      const entries = await discoverOpenAICompatibleModelEntries({
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
      })
      return entries.map((entry) => entry.id)
    } catch (error) {
      throw byteplusArkAdapter.normalizeError(error)
    }
  },
  async discoverModelEntries(channel) {
    try {
      return await discoverOpenAICompatibleModelEntries({
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
      })
    } catch (error) {
      throw byteplusArkAdapter.normalizeError(error)
    }
  },
  async generateImages(input) {
    const runRequest = input.runWithRequestLimit ?? runWithImageRequestLimit
    const responseFormat = getStringParam(input.request.paramValues, 'responseFormat', 'b64_json') === 'url' ? 'url' : 'b64_json'
    const forceDisableSequential = input.request.imageCount > 1
    const normalizedSourceImages = supportsImageInput(input.request.modelId)
      ? (Array.isArray(input.request.sourceImages) ? input.request.sourceImages.slice(0, 14) : [])
      : []
    const encodedImages = await Promise.all(normalizedSourceImages.map((item) => sourceImageToDataUrl(item)))
    const requestUrl = buildGenerationUrl(input.channel.baseUrl)

    const batches = await Promise.all(
      Array.from({ length: input.request.imageCount }, async (_, index) => {
        const response = await runRequest(async () =>
          fetch(requestUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${input.channel.apiKey}`,
            },
            body: JSON.stringify(
              buildRequestBody({
                modelId: input.request.modelId,
                prompt: input.request.prompt,
                paramValues: input.request.paramValues,
                responseFormat,
                forceDisableSequential,
                encodedImages,
              }),
            ),
            signal: input.request.signal,
          }),
        )

        if (!response.ok) {
          let detail = ''
          try {
            detail = (await response.text()).trim()
          } catch {
            detail = ''
          }
          throw createProviderError({
            message: `HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
            code: toProviderErrorCode(response.status, detail),
            status: response.status,
            detail,
            retriable: response.status === 429 || response.status >= 500,
          })
        }

        const payload = (await response.json()) as { data?: unknown }
        const data = Array.isArray(payload.data) ? (payload.data as RawImageItem[]) : []
        emitImageChainTrace({
          file: 'src/services/providers/byteplusArkAdapter.ts',
          module: 'byteplusArkAdapter',
          fn: 'generateImages.batch',
          stage: 'provider_response_json_parsed',
          traceId: input.request.timing?.traceId,
          detail: {
            requestUrl: summarizeString(requestUrl),
            httpStatus: response.status,
            itemCount: data.length,
            firstItem: data[0]
              ? {
                  url: summarizeImagePayload(data[0].url),
                  b64_json: summarizeImagePayload(data[0].b64_json),
                }
              : null,
          },
        })
        if (data.length === 0) {
          throw createProviderError({ message: 'No usable image returned.', code: 'unknown' })
        }

        return data.map((item, itemIndex): NormalizedImageItem => {
          const src = toImageSrc(item)
          const error = toItemError(item)
          emitImageChainTrace({
            file: 'src/services/providers/byteplusArkAdapter.ts',
            module: 'byteplusArkAdapter',
            fn: 'generateImages.batch.mapItem',
            stage: 'provider_image_field_extracted',
            traceId: input.request.timing?.traceId,
            seq: forceDisableSequential ? index + 1 : itemIndex + 1,
            detail: {
              requestUrl: summarizeString(requestUrl),
              src: summarizeImagePayload(src),
              error: summarizeString(error),
            },
          })
          return {
            seq: forceDisableSequential ? index + 1 : itemIndex + 1,
            requestUrl,
            ...(src ? { src } : {}),
            ...(!src ? { error: error ?? 'No usable image returned.' } : {}),
          }
        })
      }),
    )

    const items = batches.flat()
    for (const item of items) {
      input.onImageCompleted?.(item)
    }
    return { items }
  },
  async resumeImageTask() {
    return { state: 'failed', error: 'byteplus-ark does not support task resume in this client.' }
  },
  async streamImageTask() {
    return { state: 'unsupported' as const }
  },
  async streamText() {
    throw createProviderError({
      message: 'BytePlus Ark text streaming is not supported in this client.',
      code: 'unsupported_param',
    })
  },
  normalizeError(error) {
    if (error && typeof error === 'object' && 'code' in error && 'providerId' in error) {
      return error as ProviderError
    }
    const message = error instanceof Error ? error.message : 'unknown provider error'
    if (isInsufficientBalanceMessage(message)) {
      return createProviderError({ message, code: 'insufficient_balance' })
    }
    if (isTimeoutError(error) || message.toLowerCase().includes('timed out')) {
      return createProviderError({ message, code: 'timeout', retriable: true })
    }
    if (isBrowserNetworkBlockedError(message)) {
      return createProviderError({
        message: `${buildBrowserUnsupportedMessage('BytePlus Ark')} ${buildBrowserUnsupportedDetail()}`,
        code: 'browser_unsupported',
      })
    }
    return createProviderError({ message, code: 'unknown' })
  },
}

export type { NormalizedImageRequest, NormalizedImageResult, NormalizedResumeResult }
