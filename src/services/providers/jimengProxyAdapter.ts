import type {
  NormalizedImageItem,
  NormalizedImageResult,
  NormalizedResumeResult,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderError,
  ProviderModelEntry,
  StreamImageTaskResult,
} from '../../types/provider'
import {
  generateJimengImage,
  getJimengGeneratedAsset,
} from '../jimengProxy'
import { loadJimengModelCatalog } from '../jimengModelMapping'

const capabilities: ProviderCapabilities = {
  endpointStyle: 'task-based',
  auth: 'bearer',
  browserInvocation: 'supported',
  supportsModelDiscovery: true,
  supportsTaskResume: true,
  modelTag: 'jimeng',
  defaultImageParamSchema: [],
}

function createJimengProxyError(message: string): ProviderError {
  const error = new Error(message) as ProviderError
  error.code = 'provider_unavailable'
  error.providerId = 'jimeng-proxy'
  error.retriable = false
  return error
}

function resolveResolutionType(raw: unknown): string {
  if (typeof raw !== 'string') {
    return '2k'
  }
  const normalized = raw.trim().toLowerCase()
  return normalized === '4k' ? '4k' : '2k'
}

function toFailureMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }
  const record = payload as {
    errmsg?: unknown
    data?: {
      fail_starling_message?: unknown
      fail_code?: unknown
    }
  }
  if (typeof record.data?.fail_starling_message === 'string' && record.data.fail_starling_message.trim()) {
    return record.data.fail_starling_message.trim()
  }
  if (typeof record.errmsg === 'string' && record.errmsg.trim()) {
    return record.errmsg.trim()
  }
  if (typeof record.data?.fail_code === 'string' && record.data.fail_code.trim()) {
    return `即梦返回失败码：${record.data.fail_code.trim()}`
  }
  return fallback
}

function buildPendingImageItem(input: {
  seq: number
  historyId: string
  requestUrl: string
  resolutionType: string
  itemIndex: number
  providerTaskStatus?: string
}): NormalizedImageItem {
  return {
    seq: input.seq,
    requestUrl: input.requestUrl,
    providerTaskStatus: input.providerTaskStatus,
    serverTaskId: input.historyId,
    serverTaskMeta: {
      historyId: input.historyId,
      resolutionType: input.resolutionType,
      itemIndex: String(input.itemIndex),
    },
  }
}

export const jimengProxyAdapter: ProviderAdapter = {
  id: 'jimeng-proxy',
  displayName: 'Jimeng Proxy',
  capabilities,
  async discoverModels() {
    return loadJimengModelCatalog().models.map((model) => model.rawId ?? model.id)
  },
  async discoverModelEntries() {
    return loadJimengModelCatalog().models.map((model) => ({
      id: model.rawId ?? model.id,
      metadata: {
        id: model.id,
        sourceName: model.sourceName,
        tags: model.tags,
      },
    })) satisfies ProviderModelEntry[]
  },
  async generateImages(input): Promise<NormalizedImageResult> {
    const resolutionType = resolveResolutionType(input.request.paramValues.resolution)
    try {
      const result = await generateJimengImage({
        baseUrl: input.channel.baseUrl,
        prompt: input.request.prompt,
        modelReqKey: input.request.modelId,
        resolutionType,
      })

      const payload = result.response.json as {
        ret?: unknown
        data?: {
          aigc_data?: {
            history_record_id?: unknown
            status?: unknown
            total_image_count?: unknown
            item_list?: Array<{
              image?: {
                large_images?: Array<{
                  image_url?: unknown
                }>
              }
            }>
          } | null
        }
      } | null

      const historyId = typeof payload?.data?.aigc_data?.history_record_id === 'string'
        ? payload.data.aigc_data.history_record_id
        : ''
      if (!result.response.ok || payload?.ret !== '0' || !historyId) {
        const message = toFailureMessage(payload, '即梦图片生成提交失败。')
        return {
          items: Array.from({ length: Math.max(1, input.request.imageCount) }, (_, index) => ({
            seq: index + 1,
            requestUrl: result.request.url,
            error: message,
          })),
        }
      }

      const immediateItems = Array.isArray(payload.data?.aigc_data?.item_list)
        ? payload.data.aigc_data.item_list
        : []
      const generatedCount = typeof payload.data?.aigc_data?.total_image_count === 'number'
        ? payload.data.aigc_data.total_image_count
        : Math.max(immediateItems.length, input.request.imageCount, 1)
      const targetCount = Math.max(1, Math.min(input.request.imageCount, generatedCount))
      const items: NormalizedImageItem[] = []

      for (let index = 0; index < targetCount; index += 1) {
        const seq = index + 1
        const immediateImageUrl = immediateItems[index]?.image?.large_images?.[0]?.image_url
        if (typeof immediateImageUrl === 'string' && immediateImageUrl.trim()) {
          const successItem = {
            seq,
            requestUrl: result.request.url,
            src: immediateImageUrl.trim(),
            serverTaskId: historyId,
            serverTaskMeta: {
              historyId,
              resolutionType,
              itemIndex: String(index),
            },
          }
          input.onImageCompleted?.(successItem)
          items.push(successItem)
          continue
        }

        const pendingItem = buildPendingImageItem({
          seq,
          historyId,
          requestUrl: result.request.url,
          resolutionType,
          itemIndex: index,
          providerTaskStatus: String(payload.data?.aigc_data?.status ?? ''),
        })
        input.onTaskRegistered?.(pendingItem)
        input.onImageCompleted?.(pendingItem)
        items.push(pendingItem)
      }

      return { items }
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'AbortError') {
        throw error
      }
      return {
        items: Array.from({ length: Math.max(1, input.request.imageCount) }, (_, index) => ({
          seq: index + 1,
          error: error instanceof Error ? error.message : '即梦图片生成失败。',
        })),
      }
    }
  },
  async resumeImageTask(input): Promise<NormalizedResumeResult> {
    const historyId = input.taskMeta?.historyId ?? input.taskId
    if (!historyId) {
      return { state: 'failed', error: 'missing history id' }
    }

    try {
      const result = await getJimengGeneratedAsset({
        baseUrl: input.channel.baseUrl,
        historyId,
        resolutionType: resolveResolutionType(input.taskMeta?.resolutionType),
      })

      const itemIndex = Number(input.taskMeta?.itemIndex ?? '0')
      const resolvedItemIndex = Number.isFinite(itemIndex) ? itemIndex : 0
      const imageUrl = result.imageUrls[resolvedItemIndex] ?? result.imageUrl

      if (result.state === 'success' && typeof imageUrl === 'string' && imageUrl.trim()) {
        return {
          state: 'success',
          src: imageUrl.trim(),
          serverTaskId: historyId,
          serverTaskMeta: {
            historyId,
            resolutionType: resolveResolutionType(input.taskMeta?.resolutionType),
            itemIndex: String(resolvedItemIndex),
          },
        }
      }

      return {
        state: 'pending',
        serverTaskId: historyId,
        serverTaskMeta: {
          historyId,
          resolutionType: resolveResolutionType(input.taskMeta?.resolutionType),
          itemIndex: String(resolvedItemIndex),
        },
      }
    } catch (error) {
      const itemIndex = Number(input.taskMeta?.itemIndex ?? '0')
      const resolvedItemIndex = Number.isFinite(itemIndex) ? itemIndex : 0
      return {
        state: 'pending',
        serverTaskId: historyId,
        serverTaskMeta: {
          historyId,
          resolutionType: resolveResolutionType(input.taskMeta?.resolutionType),
          itemIndex: String(resolvedItemIndex),
        },
        providerTaskStatus: error instanceof Error ? error.message : undefined,
      }
    }
  },
  async streamImageTask(): Promise<StreamImageTaskResult> {
    return { state: 'unsupported' }
  },
  async streamText(): Promise<void> {
    throw createJimengProxyError('即梦代理当前仅支持图片模型。')
  },
  normalizeError(error: unknown): ProviderError {
    if (error && typeof error === 'object' && 'code' in error && 'providerId' in error) {
      return error as ProviderError
    }
    return createJimengProxyError(error instanceof Error ? error.message : '即梦代理调用失败')
  },
}
