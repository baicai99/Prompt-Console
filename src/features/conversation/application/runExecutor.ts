import { conversationAssetStorePort } from './ports/assetStorePort'
import { conversationProviderGatewayPort } from './ports/providerGatewayPort'
import { autoSaveImage, isSaveDirectoryReady } from '../../../services/imageSave'
import type {
  ImageRuntimeSettings,
  Run,
  Side,
  SideMode,
  SingleSideSettings,
  SettingPrimitive,
} from '../../../types/conversation'
import type { ApiChannel } from '../../../types/channel'
import type { ImageRefKind, ImageThreadState, RunSourceImageRef } from '../../../types/image'
import type { ProviderRequestRunner } from '../../../types/provider'
import { makeId } from '../../../utils/chat'
import { emitImageTaskDebug, getChannelDebugMeta, summarizeProviderPayload } from '../../../services/imageTaskDebug'
import {
  emitImageChainTrace,
  summarizeError,
  summarizeString,
} from '../../../services/imageChainTrace'
import { classifyFailure } from '../domain/failureClassifier'
import { createRunTaskState, resolveRunTaskStatusFromImages } from '../domain/runTaskState'
import { Semaphore } from './utils/semaphore'
import { parseScopedModelId } from '../../../utils/modelIdentity'
import { createRunImageResultPersistence } from './runExecutor/imageResultPersistence'
import {
  buildBaseRun,
  buildMissingChannelRun,
  buildMissingSourceImagesRun,
  buildRunFailureFromError,
  withInitialAttempt,
} from './runExecutor/runFailureBuilders'
import { executeRunImageGeneration } from './runExecutor/runImageGeneration'
import { loadProviderSourceImages } from './runExecutor/sourceImageLoader'
import { LOCAL_IMAGE_POST_PROCESSING_CONCURRENCY, TRACE_FILE, TRACE_MODULE } from './runExecutor/shared'

export interface CreateRunInput {
  batchId: string
  sideMode: SideMode
  side: Side
  settings: SingleSideSettings
  templatePrompt: string
  finalPrompt: string
  variablesSnapshot: Record<string, string>
  modelId: string
  modelName: string
  paramsSnapshot: Record<string, SettingPrimitive>
  sourceImages?: RunSourceImageRef[]
  channel: ApiChannel | undefined
  retryOfRunId?: string
  retryAttempt?: number
  runId?: string
  createdAt?: string
  onImageProgress?: (update: {
    runId: string
    seq: number
    status: 'pending' | 'success' | 'failed'
    queuedAt?: string
    startedAt?: string
    completedAt?: string
    requestUrl?: string
    providerTaskStatus?: string
    threadState?: ImageThreadState
    fileRef?: string
    thumbRef?: string
    fullRef?: string
    refKind?: ImageRefKind
    refKey?: string
    serverTaskId?: string
    serverTaskMeta?: Record<string, string>
    bytes?: number
    error?: string
    errorCode?: ReturnType<typeof classifyFailure>
  }) => void
  signal?: AbortSignal
  runWithRequestLimit?: ProviderRequestRunner
  runtimeSettings?: ImageRuntimeSettings
}

export interface RunExecutorDeps {
  generateImagesFn?: typeof conversationProviderGatewayPort.generateImages
  getImageBlobFn?: typeof conversationAssetStorePort.getImageBlob
  putImageBlobFn?: typeof conversationAssetStorePort.putImageBlob
  autoSaveImageFn?: typeof autoSaveImage
  fetchFn?: typeof fetch
}

export function createRunExecutor(deps: RunExecutorDeps = {}) {
  const generateImagesFn = deps.generateImagesFn ?? conversationProviderGatewayPort.generateImages
  const getImageBlobFn = deps.getImageBlobFn ?? conversationAssetStorePort.getImageBlob
  const putImageBlobFn = deps.putImageBlobFn ?? conversationAssetStorePort.putImageBlob
  const autoSaveImageFn = deps.autoSaveImageFn ?? autoSaveImage
  const fetchFn = deps.fetchFn ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined)
  const postProcessingSemaphore = new Semaphore(LOCAL_IMAGE_POST_PROCESSING_CONCURRENCY)
  const imageResultPersistence = createRunImageResultPersistence({
    fetchFn,
    putImageBlobFn,
    autoSaveImageFn,
    postProcessingSemaphore,
  })

  return {
    releaseObjectUrls() {},
    async createRun(options: CreateRunInput): Promise<Run> {
      const {
        batchId,
        sideMode,
        side,
        settings,
        templatePrompt,
        finalPrompt,
        variablesSnapshot,
        modelId,
        modelName,
        paramsSnapshot,
        sourceImages = [],
        channel,
        retryOfRunId,
        retryAttempt = 0,
        runId = makeId(),
        createdAt = new Date().toISOString(),
        onImageProgress,
      } = options
      const traceId = runId
      const providerModelId = parseScopedModelId(modelId)?.modelId ?? modelId
      const imageCount = Math.max(1, Math.floor(settings.imageCount))
      const baseRun = buildBaseRun({
        batchId,
        sideMode,
        side,
        settings,
        templatePrompt,
        finalPrompt,
        variablesSnapshot,
        modelId,
        modelName,
        paramsSnapshot,
        sourceImages,
        channel,
        retryOfRunId,
        retryAttempt,
        runId,
        createdAt,
      })

      if (!channel || !channel.baseUrl || !channel.apiKey) {
        emitImageChainTrace({
          file: TRACE_FILE,
          module: TRACE_MODULE,
          fn: 'createRun',
          stage: 'request_blocked_missing_channel',
          level: 'warn',
          traceId,
          runId,
          batchId,
          detail: {
            channelId: channel?.id ?? null,
            hasBaseUrl: Boolean(channel?.baseUrl),
            hasApiKey: Boolean(channel?.apiKey),
          },
        })
        return buildMissingChannelRun({
          baseRun,
          imageCount,
          createdAt,
        })
      }

      try {
        emitImageChainTrace({
          file: TRACE_FILE,
          module: TRACE_MODULE,
          fn: 'createRun',
          stage: 'request_prepare_started',
          traceId,
          runId,
          batchId,
          detail: {
            modelId,
            modelName,
            prompt: summarizeString(finalPrompt, 120),
            imageCount,
            sourceImageCount: sourceImages.length,
            paramsSnapshot: summarizeProviderPayload(paramsSnapshot),
          },
        })

        const {
          providerSourceImages,
          missingSourceImageNames,
        } = await loadProviderSourceImages({
          sourceImages,
          getImageBlobFn,
          traceId,
          runId,
          batchId,
        })

        if (sourceImages.length > 0 && providerSourceImages.length === 0) {
          const missingSummary = missingSourceImageNames.length > 0 ? missingSourceImageNames.join('、') : '参考图'
          emitImageChainTrace({
            file: TRACE_FILE,
            module: TRACE_MODULE,
            fn: 'createRun',
            stage: 'request_blocked_missing_source_images',
            level: 'warn',
            traceId,
            runId,
            batchId,
            detail: {
              missingSourceImageNames,
            },
          })
          return buildMissingSourceImagesRun({
            baseRun,
            imageCount,
            createdAt,
            missingSummary,
          })
        }

        const effectiveParamValues = {
          ...paramsSnapshot,
          responseFormat:
            typeof paramsSnapshot.responseFormat === 'string' && paramsSnapshot.responseFormat.trim()
              ? paramsSnapshot.responseFormat
              : ('b64_json' as const),
        }
        const shouldAutoSave = settings.autoSave && isSaveDirectoryReady(settings.saveDirectory)
        const images = await executeRunImageGeneration({
          generateImagesFn,
          imageResultPersistence,
          channel,
          providerModelId,
          modelId,
          modelName,
          finalPrompt,
          imageCount,
          effectiveParamValues,
          providerSourceImages,
          createdAt,
          runId,
          batchId,
          traceId,
          saveDirectory: settings.saveDirectory,
          shouldAutoSave,
          signal: options.signal,
          runWithRequestLimit: options.runWithRequestLimit,
          onImageProgress,
        })

        const nextRun: Run = {
          ...baseRun,
          id: runId,
          images,
        }

        return withInitialAttempt({
          ...nextRun,
          taskState: createRunTaskState({
            status: resolveRunTaskStatusFromImages(nextRun),
            previous: createRunTaskState({
              status: 'generating',
              now: createdAt,
            }),
          }),
        })
      } catch (error) {
        emitImageChainTrace({
          file: TRACE_FILE,
          module: TRACE_MODULE,
          fn: 'createRun',
          stage: 'request_pipeline_failed',
          level: 'error',
          traceId,
          runId,
          batchId,
          error,
          detail: {
            modelId,
            channelId: channel?.id ?? null,
            channelName: channel?.name ?? null,
            errorSummary: summarizeError(error),
          },
        })
        emitImageTaskDebug({
          stage: 'run_execution_failed',
          runId,
          batchId,
          model: modelId,
          ...getChannelDebugMeta(channel),
          error,
        })
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
          throw error
        }
        return buildRunFailureFromError({
          baseRun,
          imageCount,
          createdAt,
          error,
        })
      }
    },
  }
}
