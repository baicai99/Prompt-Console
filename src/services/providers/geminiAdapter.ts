import type {
  NormalizedImageItem,
  NormalizedImageRequest,
  NormalizedImageResult,
  NormalizedResumeResult,
  NormalizedTextMessage,
  NormalizedTextRequest,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderError,
  ProviderErrorCode,
  ProviderModelEntry,
} from '../../types/provider'
import { isInsufficientBalanceMessage } from '../../utils/insufficientBalance'
import {
  createProviderErrorFactory,
  normalizeBaseUrl,
  readString as readTrimmedString,
} from './providerShared'

type GeminiModelItem = {
  name?: unknown
  displayName?: unknown
  supportedGenerationMethods?: unknown
}

type GeminiModelListPayload = {
  models?: unknown
  data?: unknown
  nextPageToken?: unknown
}

type GeminiInlineData = {
  mimeType?: unknown
  data?: unknown
}

function trimModelName(modelId: string): string {
  return modelId.trim().replace(/^models\//i, '')
}

function encodeModelPath(modelId: string): string {
  return encodeURIComponent(trimModelName(modelId))
}

function buildModelsUrl(baseUrl: string, pageToken?: string): string {
  const normalized = normalizeBaseUrl(baseUrl)
  const lower = normalized.toLowerCase()
  const path = (() => {
    if (lower.endsWith('/v1beta/models') || lower.endsWith('/v1/models') || lower.endsWith('/models')) {
      return normalized
    }
    if (lower.endsWith('/v1beta') || lower.endsWith('/v1')) {
      return `${normalized}/models`
    }
    return `${normalized}/v1beta/models`
  })()

  try {
    const url = new URL(path)
    if (!url.searchParams.has('pageSize')) {
      url.searchParams.set('pageSize', '200')
    }
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }
    return url.toString()
  } catch {
    return path
  }
}

function buildOpenAIModelsUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl)
  const lower = normalized.toLowerCase()
  const path = (() => {
    if (lower.endsWith('/v1/models') || lower.endsWith('/models')) {
      return normalized
    }
    if (lower.endsWith('/v1')) {
      return `${normalized}/models`
    }
    return `${normalized}/v1/models`
  })()

  try {
    return new URL(path).toString()
  } catch {
    return path
  }
}

function isOfficialGeminiBaseUrl(baseUrl: string): boolean {
  try {
    return new URL(normalizeBaseUrl(baseUrl)).hostname.toLowerCase() === 'generativelanguage.googleapis.com'
  } catch {
    return normalizeBaseUrl(baseUrl).toLowerCase().includes('generativelanguage.googleapis.com')
  }
}

function buildModelActionUrl(
  baseUrl: string,
  modelId: string,
  action: ':generateContent' | ':streamGenerateContent',
): string {
  const normalized = normalizeBaseUrl(baseUrl)
  const lower = normalized.toLowerCase()
  const modelPath = encodeModelPath(modelId)
  const path = (() => {
    if (lower.endsWith('/v1beta/models') || lower.endsWith('/v1/models') || lower.endsWith('/models')) {
      return `${normalized}/${modelPath}${action}`
    }
    if (lower.endsWith('/v1beta') || lower.endsWith('/v1')) {
      return `${normalized}/models/${modelPath}${action}`
    }
    return `${normalized}/v1beta/models/${modelPath}${action}`
  })()

  if (action !== ':streamGenerateContent') {
    return path
  }

  try {
    const url = new URL(path)
    url.searchParams.set('alt', 'sse')
    return url.toString()
  } catch {
    return path.includes('?') ? `${path}&alt=sse` : `${path}?alt=sse`
  }
}

const createProviderError = createProviderErrorFactory('gemini-api')

function toProviderErrorCode(status?: number, detail?: string): ProviderErrorCode {
  if (isInsufficientBalanceMessage(detail)) {
    return 'insufficient_balance'
  }
  if (status === 401 || status === 403) {
    return 'auth'
  }
  if (status === 429) {
    return 'rate_limit'
  }
  if (typeof status === 'number' && status >= 500) {
    return 'provider_unavailable'
  }
  return 'unknown'
}

function readString(value: unknown): string | null {
  return readTrimmedString(value) ?? null
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    return (await response.text()).trim()
  } catch {
    return ''
  }
}

function toDiscoveredModelId(item: GeminiModelItem): string | null {
  const rawName = readString(item.name)
  if (rawName) {
    return rawName.replace(/^models\//i, '')
  }
  const rawId = readString((item as { id?: unknown }).id)
  if (rawId) {
    return rawId.replace(/^models\//i, '')
  }
  const rawModel = readString((item as { model?: unknown }).model)
  return rawModel ? rawModel.replace(/^models\//i, '') : null
}

function supportsContentGeneration(item: GeminiModelItem): boolean {
  const methods = item.supportedGenerationMethods
  if (!Array.isArray(methods) || methods.length === 0) {
    return true
  }

  return methods.some((method) => {
    const value = readString(method)
    return value === 'generateContent' || value === 'streamGenerateContent'
  })
}

async function discoverGeminiModelEntries(input: {
  baseUrl: string
  apiKey: string
  fetchFn?: typeof fetch
}): Promise<ProviderModelEntry[]> {
  const fetchFn = input.fetchFn ?? fetch
  const tryDiscover = async (mode: 'gemini-header' | 'gemini-query' | 'openai-header' | 'openai-query'): Promise<ProviderModelEntry[]> => {
    const entries: ProviderModelEntry[] = []
    const seen = new Set<string>()
    let pageToken: string | undefined

    for (let page = 0; page < 20; page += 1) {
      const baseUrl = mode.startsWith('openai') ? buildOpenAIModelsUrl(input.baseUrl) : buildModelsUrl(input.baseUrl, pageToken)
      const requestUrl = (() => {
        if (!mode.endsWith('query')) {
          return baseUrl
        }
        try {
          const url = new URL(baseUrl)
          url.searchParams.set('key', input.apiKey)
          return url.toString()
        } catch {
          return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}key=${encodeURIComponent(input.apiKey)}`
        }
      })()

      const response = await fetchFn(requestUrl, {
        method: 'GET',
        headers: mode.endsWith('header')
          ? {
              'x-goog-api-key': input.apiKey,
            }
          : undefined,
      })

      if (!response.ok) {
        const detail = await readErrorDetail(response)
        throw createProviderError({
          message: `读取模型列表失败（HTTP ${response.status}${detail ? `: ${detail}` : ''}）`,
          code: toProviderErrorCode(response.status, detail),
          status: response.status,
          detail,
          retriable: response.status === 429 || response.status >= 500,
        })
      }

      const payload = (await response.json()) as GeminiModelListPayload
      const rawItems = Array.isArray(payload.models)
        ? payload.models
        : Array.isArray(payload.data)
          ? payload.data
          : []

      for (const item of rawItems) {
        if (!item || typeof item !== 'object') {
          continue
        }
        const record = item as GeminiModelItem
        const id = toDiscoveredModelId(record)
        if (!id || seen.has(id) || !supportsContentGeneration(record)) {
          continue
        }
        seen.add(id)
        entries.push({
          id,
          metadata: record as Record<string, unknown>,
        })
      }

      if (mode.startsWith('openai')) {
        break
      }

      const nextPageToken = readString(payload.nextPageToken)
      if (!nextPageToken) {
        break
      }
      pageToken = nextPageToken
    }

    return entries
  }

  const attempts: Array<'gemini-header' | 'gemini-query' | 'openai-header' | 'openai-query'> = isOfficialGeminiBaseUrl(input.baseUrl)
    ? ['gemini-header', 'gemini-query']
    : ['gemini-header', 'gemini-query', 'openai-header', 'openai-query']

  let firstGeminiError: ProviderError | null = null
  let lastOpenAIError: ProviderError | null = null
  for (const attempt of attempts) {
    try {
      const entries = await tryDiscover(attempt)
      if (entries.length > 0) {
        return entries
      }
    } catch (error) {
      const providerError = error as ProviderError
      if (attempt.startsWith('gemini')) {
        firstGeminiError ??= providerError
      } else {
        lastOpenAIError = providerError
      }
    }
  }

  if (firstGeminiError) {
    throw firstGeminiError
  }
  if (lastOpenAIError) {
    throw lastOpenAIError
  }
  return []
}

function buildTextPayload(messages: NormalizedTextMessage[]): {
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>
  systemInstruction?: { parts: Array<{ text: string }> }
} {
  const systemMessages: string[] = []
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []

  for (const message of messages) {
    const text = message.content.trim()
    if (!text) {
      continue
    }
    if (message.role === 'system') {
      systemMessages.push(text)
      continue
    }
    contents.push({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text }],
    })
  }

  return {
    contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: '' }] }],
    ...(systemMessages.length > 0
      ? {
          systemInstruction: {
            parts: [{ text: systemMessages.join('\n\n') }],
          },
        }
      : {}),
  }
}

function buildGenerationConfig(request: Pick<NormalizedTextRequest, 'temperature' | 'topP' | 'maxTokens'>): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  if (typeof request.temperature === 'number' && Number.isFinite(request.temperature)) {
    config.temperature = request.temperature
  }
  if (typeof request.topP === 'number' && Number.isFinite(request.topP)) {
    config.topP = request.topP
  }
  if (typeof request.maxTokens === 'number' && Number.isFinite(request.maxTokens)) {
    config.maxOutputTokens = Math.max(1, Math.floor(request.maxTokens))
  }
  return config
}

function extractTextFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates)) {
    return ''
  }

  const textParts: string[] = []
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }
    const content = (candidate as { content?: unknown }).content
    if (!content || typeof content !== 'object') {
      continue
    }
    const parts = (content as { parts?: unknown }).parts
    if (!Array.isArray(parts)) {
      continue
    }
    for (const part of parts) {
      if (!part || typeof part !== 'object') {
        continue
      }
      const text = readString((part as { text?: unknown }).text)
      if (text) {
        textParts.push(text)
      }
    }
  }

  return textParts.join('')
}

function toDataUrl(inlineData: GeminiInlineData): string | null {
  const data = readString(inlineData.data)
  if (!data) {
    return null
  }
  const mimeType = readString(inlineData.mimeType) ?? 'image/png'
  return `data:${mimeType};base64,${data}`
}

function extractImagesFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates)) {
    return []
  }

  const images: string[] = []
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }
    const content = (candidate as { content?: unknown }).content
    if (!content || typeof content !== 'object') {
      continue
    }
    const parts = (content as { parts?: unknown }).parts
    if (!Array.isArray(parts)) {
      continue
    }
    for (const part of parts) {
      if (!part || typeof part !== 'object') {
        continue
      }
      const record = part as { inlineData?: GeminiInlineData; inline_data?: GeminiInlineData }
      const dataUrl = toDataUrl(record.inlineData ?? record.inline_data ?? {})
      if (dataUrl) {
        images.push(dataUrl)
      }
    }
  }

  return images
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return btoa(binary)
}

async function buildImageBody(request: NormalizedImageRequest): Promise<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = []
  for (const sourceImage of request.sourceImages ?? []) {
    parts.push({
      inlineData: {
        mimeType: sourceImage.mimeType || sourceImage.blob.type || 'image/png',
        data: await blobToBase64(sourceImage.blob),
      },
    })
  }

  parts.push({ text: request.prompt })

  return {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      candidateCount: Math.max(1, Math.min(4, Math.floor(request.imageCount || 1))),
      responseModalities: ['IMAGE', 'TEXT'],
    },
  }
}

const capabilities: ProviderCapabilities = {
  endpointStyle: 'openai-compatible',
  auth: 'api-key',
  browserInvocation: 'supported',
  supportsModelDiscovery: true,
  supportsTaskResume: false,
  modelTag: 'google',
  defaultImageParamSchema: [
    {
      key: 'responseFormat',
      label: '返回格式',
      type: 'enum',
      default: 'b64_json',
      options: ['b64_json'],
    },
    {
      key: 'size',
      label: '尺寸',
      type: 'enum',
      surface: 'shared-settings',
      default: '1K',
      options: ['0.5K', '1K', '2K'],
    },
  ],
}

export const geminiAdapter: ProviderAdapter = {
  id: 'gemini-api',
  displayName: 'Gemini API',
  capabilities,
  async discoverModels(channel) {
    const entries = await discoverGeminiModelEntries({
      baseUrl: channel.baseUrl,
      apiKey: channel.apiKey,
    })
    return entries.map((entry) => entry.id)
  },
  async discoverModelEntries(channel) {
    return discoverGeminiModelEntries({
      baseUrl: channel.baseUrl,
      apiKey: channel.apiKey,
    })
  },
  async generateImages(input) {
    const response = await fetch(buildModelActionUrl(input.channel.baseUrl, input.request.modelId, ':generateContent'), {
      method: 'POST',
      headers: buildHeaders(input.channel.apiKey),
      body: JSON.stringify(await buildImageBody(input.request)),
      signal: input.request.signal,
    })

    if (!response.ok) {
      const detail = await readErrorDetail(response)
      throw createProviderError({
        message: `HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
        code: toProviderErrorCode(response.status, detail),
        status: response.status,
        detail,
        retriable: response.status === 429 || response.status >= 500,
      })
    }

    const payload = (await response.json()) as unknown
    const images = extractImagesFromPayload(payload)
    if (images.length === 0) {
      const detail = extractTextFromPayload(payload) || '上游未返回图片数据。'
      return {
        items: Array.from({ length: Math.max(1, input.request.imageCount) }, (_, index): NormalizedImageItem => ({
          seq: index + 1,
          error: detail,
        })),
      }
    }

    return {
      items: images.slice(0, Math.max(1, input.request.imageCount)).map((src, index) => ({
        seq: index + 1,
        src,
      })),
    } satisfies NormalizedImageResult
  },
  async resumeImageTask(): Promise<NormalizedResumeResult> {
    throw createProviderError({
      message: 'Gemini 渠道暂不支持任务恢复。',
      code: 'unsupported_param',
    })
  },
  async streamImageTask() {
    return { state: 'unsupported' as const }
  },
  async streamText(input) {
    const response = await fetch(buildModelActionUrl(input.channel.baseUrl, input.request.modelId, ':streamGenerateContent'), {
      method: 'POST',
      headers: buildHeaders(input.channel.apiKey),
      body: JSON.stringify({
        ...buildTextPayload(input.request.messages),
        generationConfig: buildGenerationConfig(input.request),
      }),
      signal: input.request.signal,
    })

    if (!response.ok) {
      const detail = await readErrorDetail(response)
      throw createProviderError({
        message: `HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
        code: toProviderErrorCode(response.status, detail),
        status: response.status,
        detail,
        retriable: response.status === 429 || response.status >= 500,
      })
    }

    if (!response.body) {
      throw createProviderError({
        message: 'stream response body is empty',
      })
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let previousText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
      } else {
        buffer += decoder.decode(value, { stream: true })
      }

      buffer = buffer.replace(/\r\n/g, '\n')
      let splitIndex = buffer.indexOf('\n\n')
      while (splitIndex >= 0) {
        const block = buffer.slice(0, splitIndex)
        buffer = buffer.slice(splitIndex + 2)
        splitIndex = buffer.indexOf('\n\n')

        const payloadText = block
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n')

        if (!payloadText) {
          continue
        }

        let payload: unknown
        try {
          payload = JSON.parse(payloadText) as unknown
        } catch {
          continue
        }

        const text = extractTextFromPayload(payload)
        if (!text) {
          continue
        }

        if (text.startsWith(previousText)) {
          const delta = text.slice(previousText.length)
          if (delta) {
            input.onDelta(delta)
          }
        } else {
          input.onDelta(text)
        }
        previousText = text
      }

      if (done) {
        break
      }
    }

    input.onDone?.()
  },
  normalizeError(error) {
    if (error && typeof error === 'object' && 'code' in error && 'providerId' in error) {
      return error as ProviderError
    }
    if (error instanceof Error && isInsufficientBalanceMessage(error.message)) {
      return createProviderError({
        message: error.message,
        code: 'insufficient_balance',
      })
    }
    return createProviderError({
      message: error instanceof Error ? error.message : 'Gemini 请求失败',
    })
  },
}
