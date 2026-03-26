import type {
  ImageTaskStreamEvent,
  NormalizedImageItem,
  NormalizedImageRequest,
  NormalizedImageResult,
  NormalizedResumeResult,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderError,
  StreamImageTaskResult,
} from '../../types/provider'
import { isTimeoutError } from '../fetchWithTimeout'
import { runWithImageRequestLimit } from '../imageRequestLimiter'
import { isInsufficientBalanceMessage } from '../../utils/insufficientBalance'
import { discoverOpenAICompatibleModelEntries } from './openaiCompatible/modelDiscovery'
import { streamOpenAICompatibleText } from './openaiCompatible/textStream'
import { emitImageTaskDebug, summarizeProviderPayload } from '../imageTaskDebug'
import {
  emitImageChainTrace,
  summarizeImagePayload,
  summarizeString,
} from '../imageChainTrace'
import {
  summarizeRawImageCandidates,
  toImageSrc,
  type RawImageItem,
} from './openaiCompatible/imagePayloadParser'
import {
  buildEditUrlCandidates,
  buildGenerationUrlCandidates,
  buildChatCompletionsUrl,
} from './openaiCompatible/urlBuilders'
import {
  getModelCandidates,
  getStringParam,
  isKlingModel,
} from './openaiCompatible/paramResolvers'
import { buildEditsFormData, buildRequestBody } from './openaiCompatible/requestBuilders'
import {
  hasAcceptedAsyncHandle,
  isPendingTaskPayload,
  parseJsonSafely,
  parseSseDataBlocks,
  parseTaskRegistration,
  resolveResumeResultFromPayload,
  resolveResumeUrl,
} from './openaiCompatible/taskRegistrationParser'
import {
  buildUnsupportedModelMessage,
  buildUnsupportedSizeMessage,
  createProviderError,
  isAbortError,
  isEndpointMismatchError,
  isSensitiveContentError,
  isUnsupportedModelError,
  isUnsupportedSizeError,
} from './openaiCompatible/providerErrors'

const capabilities: ProviderCapabilities = {
  endpointStyle: 'openai-compatible',
  auth: 'bearer',
  browserInvocation: 'supported',
  supportsModelDiscovery: true,
  supportsTaskResume: true,
  modelTag: 'openai',
  defaultImageParamSchema: [
    {
      key: 'responseFormat',
      label: '返回格式',
      type: 'enum',
      default: 'b64_json',
      options: ['url', 'b64_json'],
    },
    {
      key: 'size',
      label: '尺寸',
      type: 'enum',
      surface: 'shared-settings',
      default: '1K',
      options: ['0.5K', '1K', '2K', '4K', '1024x1024'],
    },
    {
      key: 'aspectRatio',
      label: '宽高比',
      type: 'enum',
      surface: 'shared-settings',
      default: '1:1',
      options: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    },
  ],
}

export const openAICompatibleAdapter: ProviderAdapter = {
  id: 'openai-compatible',
  displayName: 'OpenAI Compatible',
  capabilities,
  async discoverModels(channel) {
    try {
      const entries = await discoverOpenAICompatibleModelEntries({
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
      })
      return entries.map((entry) => entry.id)
    } catch (error) {
      const reason = error instanceof Error ? error.message : '读取模型列表失败'
      throw createProviderError({
        message: reason,
        code: 'provider_unavailable',
        retriable: true,
      })
    }
  },
  async discoverModelEntries(channel) {
    try {
      return await discoverOpenAICompatibleModelEntries({
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : '读取模型列表失败'
      throw createProviderError({
        message: reason,
        code: 'provider_unavailable',
        retriable: true,
      })
    }
  },
  async generateImages(input) {
    const { channel, request, onTaskRegistered, onImageCompleted } = input
    const runRequest = input.runWithRequestLimit ?? runWithImageRequestLimit
    const { modelId, prompt, imageCount, paramValues, sourceImages, signal } = request
    const normalizedSourceImages = Array.isArray(sourceImages) ? sourceImages : []
    const hasSourceImages = normalizedSourceImages.length > 0
    const modelCandidates = getModelCandidates(modelId)
    const endpointCandidates = (() => {
      const candidates = hasSourceImages
        ? buildEditUrlCandidates(channel.baseUrl)
        : buildGenerationUrlCandidates(channel.baseUrl)
      if (!isKlingModel(modelId)) {
        return candidates
      }
      const klingFirst = candidates
        .filter((item) => item.toLowerCase().includes('/kling/'))
        .concat(candidates.filter((item) => !item.toLowerCase().includes('/kling/')))
      return Array.from(new Set(klingFirst))
    })()

    async function doRequest(url: string, requestModelId: string, requestSignal?: AbortSignal): Promise<NormalizedImageItem> {
      const response = await runRequest(async () => {
        if (hasSourceImages) {
          const formData = buildEditsFormData(requestModelId, prompt, paramValues, normalizedSourceImages)
          return fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${channel.apiKey}`,
            },
            body: formData,
            signal: requestSignal,
          })
        }
        const body = buildRequestBody(requestModelId, prompt, paramValues)
        return fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${channel.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: requestSignal,
        })
      })

      if (!response.ok) {
        let detail = ''
        try {
          detail = (await response.text()).trim()
        } catch {
          detail = ''
        }

        if (isUnsupportedSizeError(response.status, detail)) {
          const selectedSize = getStringParam(paramValues, 'size', '1024x1024')
          throw createProviderError({
            message: buildUnsupportedSizeMessage(selectedSize),
            code: 'unsupported_param',
            status: response.status,
            detail,
          })
        }

        if (isSensitiveContentError(response.status, detail)) {
          throw createProviderError({
            message: '提示词有敏感内容，被拒绝了。',
            code: 'rejected',
            status: response.status,
            detail,
          })
        }

        throw createProviderError({
          message: `HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
          code:
            isInsufficientBalanceMessage(detail)
              ? 'insufficient_balance'
              : response.status === 401 || response.status === 403
              ? 'auth'
              : response.status === 429
                ? 'rate_limit'
                : response.status >= 500
                  ? 'provider_unavailable'
                  : 'unknown',
          status: response.status,
          detail,
          retriable: response.status === 429 || response.status >= 500,
        })
      }

      const payload = (await response.json()) as { data?: unknown }
      const taskRegistration = parseTaskRegistration({
        baseUrl: channel.baseUrl,
        requestUrl: url,
        payload,
        response,
      })
      const payloadRecord = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
      const items = Array.isArray(payload.data) ? (payload.data as RawImageItem[]) : []
      const traceId = request.timing?.traceId
      const first = (
        items.map((item) => toImageSrc(item)).find((value): value is string => Boolean(value))
        ?? toImageSrc(payloadRecord as RawImageItem)
      )
      emitImageChainTrace({
        file: 'src/services/providers/openaiCompatibleAdapter.ts',
        module: 'openaiCompatibleAdapter',
        fn: 'generateImages.doRequest',
        stage: 'provider_response_json_parsed',
        traceId,
        detail: {
          requestUrl: summarizeString(url),
          httpStatus: response.status,
          itemCount: items.length,
          payloadShape: summarizeProviderPayload(payload),
          firstItemCandidates: summarizeRawImageCandidates(items[0]),
          rootCandidates: summarizeRawImageCandidates(payloadRecord),
        },
      })
      emitImageTaskDebug({
        stage: 'provider_first_response_raw',
        provider: 'openai-compatible',
        model: requestModelId,
        responseSummary: summarizeProviderPayload(payload),
        parsed: {
          requestUrl: url,
          httpStatus: response.status,
          providerTaskStatus: taskRegistration.providerTaskStatus,
          serverTaskId: taskRegistration.serverTaskId,
          serverTaskMeta: taskRegistration.serverTaskMeta,
          detectedSrc: first,
        },
        branch:
          first
            ? 'url_or_base64_detected'
            : taskRegistration.serverTaskId || taskRegistration.serverTaskMeta
              ? 'task_handle_detected'
              : 'empty_or_unknown_payload',
      })
      emitImageChainTrace({
        file: 'src/services/providers/openaiCompatibleAdapter.ts',
        module: 'openaiCompatibleAdapter',
        fn: 'generateImages.doRequest',
        stage: 'provider_image_field_extracted',
        traceId,
        branch:
          first
            ? 'url_or_base64_detected'
            : taskRegistration.serverTaskId || taskRegistration.serverTaskMeta
              ? 'task_handle_detected'
              : 'empty_or_unknown_payload',
        detail: {
          requestUrl: summarizeString(url),
          extractedSrc: summarizeImagePayload(first),
          providerTaskStatus: taskRegistration.providerTaskStatus ?? null,
          serverTaskId: summarizeString(taskRegistration.serverTaskId),
          serverTaskMeta: summarizeProviderPayload(taskRegistration.serverTaskMeta),
        },
      })

      if (first) {
        return { seq: 0, requestUrl: url, src: first, ...taskRegistration }
      }
      if (isPendingTaskPayload({
        payload,
        response,
        taskId: taskRegistration.serverTaskId,
        taskMeta: taskRegistration.serverTaskMeta,
      })) {
        return { seq: 0, requestUrl: url, ...taskRegistration }
      }

      throw createProviderError({
        message: 'No usable image returned (url).',
        code: 'unknown',
      })
    }

    const requests = Array.from({ length: imageCount }, (_, index) => (async (): Promise<NormalizedImageItem> => {
      const seq = index + 1
      let lastError: unknown = null
      let lastRequestUrl: string | undefined = undefined

      for (const candidate of modelCandidates) {
        for (const endpointUrl of endpointCandidates) {
          try {
            lastRequestUrl = endpointUrl
            const result = await doRequest(endpointUrl, candidate, signal)
            if (hasAcceptedAsyncHandle({
              taskId: result.serverTaskId,
              taskMeta: result.serverTaskMeta,
              providerTaskStatus: result.providerTaskStatus,
            })) {
              onTaskRegistered?.({
                seq,
                requestUrl: result.requestUrl,
                providerTaskStatus: result.providerTaskStatus,
                serverTaskId: result.serverTaskId,
                serverTaskMeta: result.serverTaskMeta,
              })
            }
            if (result.src) {
              const successItem: NormalizedImageItem = {
                seq,
                requestUrl: result.requestUrl,
                src: result.src,
                providerTaskStatus: result.providerTaskStatus,
                serverTaskId: result.serverTaskId,
                serverTaskMeta: result.serverTaskMeta,
              }
              onImageCompleted?.(successItem)
              return successItem
            }
            return {
              seq,
              requestUrl: result.requestUrl,
              providerTaskStatus: result.providerTaskStatus,
              serverTaskId: result.serverTaskId,
              serverTaskMeta: result.serverTaskMeta,
            }
          } catch (error) {
            lastError = error
            if (signal?.aborted || isAbortError(error)) {
              break
            }
            if (isEndpointMismatchError(error)) {
              continue
            }
            break
          }
        }

        if (signal?.aborted || isAbortError(lastError)) {
          break
        }

        if (!isUnsupportedModelError(lastError)) {
          const failedMessage = lastError instanceof Error ? lastError.message : 'Image generation failed.'
          const failedItem: NormalizedImageItem = { seq, requestUrl: lastRequestUrl, error: failedMessage }
          onImageCompleted?.(failedItem)
          return failedItem
        }
      }

      if (signal?.aborted || isAbortError(lastError)) {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' })
      }

      if (isUnsupportedModelError(lastError)) {
        const failedItem: NormalizedImageItem = {
          seq,
          requestUrl: lastRequestUrl,
          error: buildUnsupportedModelMessage(channel.baseUrl, modelId, modelCandidates, lastError),
        }
        onImageCompleted?.(failedItem)
        return failedItem
      }

      const failedItem: NormalizedImageItem = {
        seq,
        requestUrl: lastRequestUrl,
        error: lastError instanceof Error ? lastError.message : 'Image generation failed.',
      }
      onImageCompleted?.(failedItem)
      return failedItem
    })())

    return { items: await Promise.all(requests) }
  },
  async resumeImageTask(input) {
    const runRequest = input.runWithRequestLimit ?? runWithImageRequestLimit
    const resumeUrl = resolveResumeUrl(input.channel.baseUrl, input.taskId, input.taskMeta)
    if (!resumeUrl) {
      return { state: 'failed', error: 'missing resume url' }
    }

    try {
      const response = await runRequest(() => fetch(resumeUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${input.channel.apiKey}`,
        },
        signal: input.signal,
      }))
      const payload = await parseJsonSafely(response)
      return resolveResumeResultFromPayload({
        channelBaseUrl: input.channel.baseUrl,
        taskId: input.taskId,
        taskMeta: input.taskMeta,
        response,
        payload,
      })
    } catch {
      return {
        state: 'pending',
        serverTaskId: input.taskId,
        serverTaskMeta: input.taskMeta,
      }
    }
  },
  async streamImageTask(input): Promise<StreamImageTaskResult> {
    const resumeUrl = resolveResumeUrl(input.channel.baseUrl, input.taskId, input.taskMeta)
    if (!resumeUrl) {
      return { state: 'unsupported' }
    }

    try {
      const response = await fetch(resumeUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream, application/json',
          Authorization: `Bearer ${input.channel.apiKey}`,
        },
        signal: input.signal,
      })
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
      if (!response.body || !contentType.includes('text/event-stream')) {
        const payload = await parseJsonSafely(response)
        input.onEvent(resolveResumeResultFromPayload({
          channelBaseUrl: input.channel.baseUrl,
          taskId: input.taskId,
          taskMeta: input.taskMeta,
          response,
          payload,
        }) as ImageTaskStreamEvent)
        return { state: 'completed' }
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let emittedTerminal = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          buffer += decoder.decode()
          break
        }
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      }

      const blocks = parseSseDataBlocks(buffer)
      if (blocks.length === 0) {
        return { state: 'unsupported' }
      }

      for (const payloadText of blocks) {
        if (!payloadText || payloadText === '[DONE]') {
          continue
        }
        let parsed: unknown = null
        try {
          parsed = JSON.parse(payloadText) as unknown
        } catch {
          continue
        }
        const event = resolveResumeResultFromPayload({
          channelBaseUrl: input.channel.baseUrl,
          taskId: input.taskId,
          taskMeta: input.taskMeta,
          response,
          payload: parsed,
        })
        input.onEvent(event as ImageTaskStreamEvent)
        if (event.state === 'success' || event.state === 'failed') {
          emittedTerminal = true
          break
        }
      }

      return emittedTerminal ? { state: 'completed' } : { state: 'unsupported' }
    } catch (error) {
      if (isAbortError(error)) {
        return { state: 'aborted' }
      }
      return { state: 'unsupported' }
    }
  },
  async streamText(input) {
    return streamOpenAICompatibleText({
      url: buildChatCompletionsUrl(input.channel.baseUrl),
      apiKey: input.channel.apiKey,
      request: input.request,
      onDelta: input.onDelta,
      onDone: input.onDone,
      onError: input.onError,
      isAbortError,
      createProviderError,
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
    if (message.toLowerCase().includes('abort')) {
      return createProviderError({ message, code: 'timeout', retriable: true })
    }
    return createProviderError({ message, code: 'unknown' })
  },
}

export type {
  NormalizedImageItem,
  NormalizedImageRequest,
  NormalizedImageResult,
  NormalizedResumeResult,
}
