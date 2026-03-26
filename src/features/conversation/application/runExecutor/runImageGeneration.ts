import type { ApiChannel } from '../../../../types/channel'
import type { SettingPrimitive } from '../../../../types/primitives'
import type { Run } from '../../../../types/conversation'
import type { ProviderSourceImage } from '../../../../types/provider'
import { emitImageTaskDebug, getChannelDebugMeta, summarizeProviderPayload } from '../../../../services/imageTaskDebug'
import {
  emitImageChainTrace,
  summarizeBlob,
  summarizeImagePayload,
  summarizeString,
} from '../../../../services/imageChainTrace'
import type { CreateRunInput } from '../runExecutor'
import type { ProcessedImage } from './shared'
import { TRACE_FILE, TRACE_MODULE } from './shared'

interface ImageResultPersistenceModule {
  processSuccessfulImage: (input: {
    item: {
      seq: number
      src: string
      queuedAt?: string
      startedAt?: string
      requestUrl?: string
      providerTaskStatus?: string
      serverTaskId?: string
      serverTaskMeta?: Record<string, string>
    }
    shouldAutoSave: boolean
    saveDirectory?: string
    modelName: string
    finalPrompt: string
    runId: string
    onImageProgress?: CreateRunInput['onImageProgress']
    completedBySeq: Map<number, ProcessedImage>
  }) => Promise<void>
  composeRunImages: (input: {
    imageCount: number
    requestQueuedAt?: string
    completedBySeq: Map<number, ProcessedImage>
    generatedItems: Array<{
      seq: number
      requestUrl?: string
      providerTaskStatus?: string
      serverTaskId?: string
      serverTaskMeta?: Record<string, string>
      src?: string
      error?: string
    }>
  }) => Promise<Run['images']>
  buildFailedProcessedImage: (
    item: {
      seq: number
      requestUrl?: string
      providerTaskStatus?: string
      serverTaskId?: string
      serverTaskMeta?: Record<string, string>
      error?: string
    },
    timing?: { queuedAt?: string; startedAt?: string; completedAt?: string },
  ) => ProcessedImage & { status: 'failed'; error: string; errorCode: Run['images'][number]['errorCode'] }
  buildPendingProcessedImage: (
    item: {
      seq: number
      requestUrl?: string
      providerTaskStatus?: string
      serverTaskId?: string
      serverTaskMeta?: Record<string, string>
    },
    timing?: { queuedAt?: string; startedAt?: string },
  ) => ProcessedImage & { status: 'pending'; queuedAt?: string; startedAt?: string }
}

interface GenerateImagesFnInput {
  channel: ApiChannel
  request: {
    modelId: string
    prompt: string
    imageCount: number
    paramValues: Record<string, SettingPrimitive>
    sourceImages: ProviderSourceImage[]
    signal?: AbortSignal
    timing?: {
      traceId?: string
      requestedAt?: string
    }
  }
  runWithRequestLimit?: CreateRunInput['runWithRequestLimit']
  onTaskRegistered?: (item: {
    seq: number
    requestUrl?: string
    providerTaskStatus?: string
    serverTaskId?: string
    serverTaskMeta?: Record<string, string>
  }) => void
  onImageCompleted?: (item: {
    seq: number
    src?: string
    error?: string
    requestUrl?: string
    providerTaskStatus?: string
    serverTaskId?: string
    serverTaskMeta?: Record<string, string>
  }) => void
}

interface GenerateImagesFnResult {
  items: Array<{
    seq: number
    src?: string
    error?: string
    requestUrl?: string
    providerTaskStatus?: string
    serverTaskId?: string
    serverTaskMeta?: Record<string, string>
  }>
}

interface ExecuteRunImageGenerationInput {
  generateImagesFn: (input: GenerateImagesFnInput) => Promise<GenerateImagesFnResult>
  imageResultPersistence: ImageResultPersistenceModule
  channel: ApiChannel
  providerModelId: string
  modelId: string
  modelName: string
  finalPrompt: string
  imageCount: number
  effectiveParamValues: Record<string, SettingPrimitive>
  providerSourceImages: ProviderSourceImage[]
  createdAt: string
  runId: string
  batchId: string
  traceId: string
  saveDirectory?: string
  shouldAutoSave: boolean
  signal?: AbortSignal
  runWithRequestLimit?: CreateRunInput['runWithRequestLimit']
  onImageProgress?: CreateRunInput['onImageProgress']
}

export async function executeRunImageGeneration(input: ExecuteRunImageGenerationInput): Promise<Run['images']> {
  emitImageTaskDebug({
    stage: 'provider_request_prepared',
    runId: input.runId,
    batchId: input.batchId,
    model: input.modelId,
    ...getChannelDebugMeta(input.channel),
    detail: {
      prompt: input.finalPrompt,
      imageCount: input.imageCount,
      sourceImageCount: input.providerSourceImages.length,
      params: input.effectiveParamValues,
    },
  })
  emitImageChainTrace({
    file: TRACE_FILE,
    module: TRACE_MODULE,
    fn: 'createRun',
    stage: 'request_before_generate_images',
    traceId: input.traceId,
    runId: input.runId,
    batchId: input.batchId,
    detail: {
      channelId: input.channel.id,
      channelName: input.channel.name,
      providerId: input.channel.providerId,
      prompt: summarizeString(input.finalPrompt, 120),
      imageCount: input.imageCount,
      effectiveParamValues: summarizeProviderPayload(input.effectiveParamValues),
      providerSourceImages: input.providerSourceImages.map((image) => ({
        fileName: image.fileName,
        mimeType: image.mimeType,
        blob: summarizeBlob(image.blob),
      })),
    },
  })

  const requestQueuedAt = input.createdAt
  const completedBySeq = new Map<number, ProcessedImage>()
  const completionTasks: Promise<void>[] = []

  const generated = await input.generateImagesFn({
    channel: input.channel,
    request: {
      modelId: input.providerModelId,
      prompt: input.finalPrompt,
      imageCount: input.imageCount,
      paramValues: input.effectiveParamValues,
      sourceImages: input.providerSourceImages,
      signal: input.signal,
      timing: {
        traceId: input.traceId,
        requestedAt: input.createdAt,
      },
    },
    runWithRequestLimit: input.runWithRequestLimit,
    onTaskRegistered: (item) => {
      const startedAt = new Date().toISOString()
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'createRun.onTaskRegistered',
        stage: 'request_first_response_received',
        traceId: input.traceId,
        runId: input.runId,
        batchId: input.batchId,
        seq: item.seq,
        detail: {
          requestUrl: summarizeString(item.requestUrl),
          providerTaskStatus: item.providerTaskStatus ?? null,
          serverTaskId: summarizeString(item.serverTaskId),
          serverTaskMeta: summarizeProviderPayload(item.serverTaskMeta),
        },
      })
      emitImageTaskDebug({
        stage: 'provider_first_response_registered',
        runId: input.runId,
        batchId: input.batchId,
        seq: item.seq,
        model: input.modelId,
        ...getChannelDebugMeta(input.channel),
        state: 'first_response',
        parsed: {
          requestUrl: item.requestUrl,
          providerTaskStatus: item.providerTaskStatus,
          serverTaskId: item.serverTaskId,
          serverTaskMeta: item.serverTaskMeta,
        },
        branch:
          item.serverTaskId || item.serverTaskMeta
            ? 'accepted_with_task_handle'
            : 'response_without_task_handle',
        pollTriggered: Boolean(item.serverTaskId || item.serverTaskMeta),
      })
      const pending = input.imageResultPersistence.buildPendingProcessedImage(item, {
        queuedAt: requestQueuedAt,
        startedAt,
      })
      completedBySeq.set(item.seq, pending)
      input.onImageProgress?.({
        runId: input.runId,
        seq: item.seq,
        status: 'pending',
        queuedAt: pending.queuedAt,
        startedAt: pending.startedAt,
        requestUrl: item.requestUrl,
        providerTaskStatus: item.providerTaskStatus,
        threadState: 'active',
        serverTaskId: item.serverTaskId,
        serverTaskMeta: item.serverTaskMeta,
      })
    },
    onImageCompleted: (item) => {
      completionTasks.push((async () => {
        emitImageChainTrace({
          file: TRACE_FILE,
          module: TRACE_MODULE,
          fn: 'createRun.onImageCompleted',
          stage: 'response_item_received',
          traceId: input.traceId,
          runId: input.runId,
          batchId: input.batchId,
          seq: item.seq,
          detail: {
            requestUrl: summarizeString(item.requestUrl),
            providerTaskStatus: item.providerTaskStatus ?? null,
            src: summarizeImagePayload(item.src),
            error: summarizeString(item.error),
            serverTaskId: summarizeString(item.serverTaskId),
            serverTaskMeta: summarizeProviderPayload(item.serverTaskMeta),
          },
        })
        emitImageTaskDebug({
          stage: 'provider_response_parsed',
          runId: input.runId,
          batchId: input.batchId,
          seq: item.seq,
          model: input.modelId,
          ...getChannelDebugMeta(input.channel),
          responseSummary: summarizeProviderPayload(item),
          parsed: {
            hasSrc: Boolean(item.src),
            hasServerTaskId: Boolean(item.serverTaskId),
            hasServerTaskMeta: Boolean(item.serverTaskMeta),
            providerTaskStatus: item.providerTaskStatus,
            error: item.error,
          },
          branch:
            item.src
              ? 'url_or_base64_detected'
              : item.serverTaskId || item.serverTaskMeta
                ? 'task_handle_detected'
                : item.error
                  ? 'error_payload_detected'
                  : 'empty_or_unknown_payload',
        })

        if (!item.src) {
          const hasTaskHandle = Boolean(item.serverTaskId || item.serverTaskMeta)
          if (hasTaskHandle && !item.error?.trim()) {
            const existing = completedBySeq.get(item.seq)
            const pending = input.imageResultPersistence.buildPendingProcessedImage(item, {
              queuedAt: existing?.queuedAt ?? requestQueuedAt,
              startedAt: existing?.startedAt ?? new Date().toISOString(),
            })
            completedBySeq.set(item.seq, pending)
            input.onImageProgress?.({
              runId: input.runId,
              seq: item.seq,
              status: 'pending',
              queuedAt: pending.queuedAt,
              startedAt: pending.startedAt,
              requestUrl: item.requestUrl,
              providerTaskStatus: item.providerTaskStatus,
              threadState: 'active',
              serverTaskId: item.serverTaskId,
              serverTaskMeta: item.serverTaskMeta,
            })
            emitImageTaskDebug({
              stage: 'queue_state_confirmed',
              runId: input.runId,
              batchId: input.batchId,
              seq: item.seq,
              model: input.modelId,
              ...getChannelDebugMeta(input.channel),
              state: 'queued',
              parsed: {
                providerTaskStatus: item.providerTaskStatus,
                serverTaskId: item.serverTaskId,
                serverTaskMeta: item.serverTaskMeta,
              },
              pollTriggered: true,
            })
            emitImageChainTrace({
              file: TRACE_FILE,
              module: TRACE_MODULE,
              fn: 'createRun.onImageCompleted',
              stage: 'response_item_marked_pending',
              traceId: input.traceId,
              runId: input.runId,
              batchId: input.batchId,
              seq: item.seq,
              branch: 'task_handle_without_src',
              detail: {
                providerTaskStatus: item.providerTaskStatus ?? null,
                serverTaskId: summarizeString(item.serverTaskId),
                serverTaskMeta: summarizeProviderPayload(item.serverTaskMeta),
              },
            })
            return
          }

          const existing = completedBySeq.get(item.seq)
          const failed = input.imageResultPersistence.buildFailedProcessedImage(item, {
            queuedAt: existing?.queuedAt ?? requestQueuedAt,
            startedAt: existing?.startedAt ?? requestQueuedAt,
            completedAt: new Date().toISOString(),
          })
          completedBySeq.set(item.seq, failed)
          input.onImageProgress?.({
            runId: input.runId,
            seq: item.seq,
            status: 'failed',
            queuedAt: failed.queuedAt,
            startedAt: failed.startedAt,
            completedAt: failed.completedAt,
            requestUrl: item.requestUrl,
            providerTaskStatus: item.providerTaskStatus,
            threadState: 'settled',
            serverTaskId: item.serverTaskId,
            serverTaskMeta: item.serverTaskMeta,
            error: failed.error,
            errorCode: failed.errorCode,
          })
          emitImageTaskDebug({
            stage: 'provider_result_failed',
            runId: input.runId,
            batchId: input.batchId,
            seq: item.seq,
            model: input.modelId,
            ...getChannelDebugMeta(input.channel),
            nextState: 'failed',
            error: failed.error,
            parsed: {
              errorCode: failed.errorCode,
              providerTaskStatus: item.providerTaskStatus,
              serverTaskId: item.serverTaskId,
            },
          })
          emitImageChainTrace({
            file: TRACE_FILE,
            module: TRACE_MODULE,
            fn: 'createRun.onImageCompleted',
            stage: 'response_item_failed_without_src',
            level: 'warn',
            traceId: input.traceId,
            runId: input.runId,
            batchId: input.batchId,
            seq: item.seq,
            detail: {
              requestUrl: summarizeString(item.requestUrl),
              providerTaskStatus: item.providerTaskStatus ?? null,
              error: summarizeString(failed.error),
              errorCode: failed.errorCode,
            },
          })
          return
        }

        await input.imageResultPersistence.processSuccessfulImage({
          item: {
            seq: item.seq,
            src: item.src,
            queuedAt: requestQueuedAt,
            startedAt: completedBySeq.get(item.seq)?.startedAt ?? requestQueuedAt,
            requestUrl: item.requestUrl,
            providerTaskStatus: item.providerTaskStatus,
            serverTaskId: item.serverTaskId,
            serverTaskMeta: item.serverTaskMeta,
          },
          shouldAutoSave: input.shouldAutoSave,
          saveDirectory: input.saveDirectory,
          modelName: input.modelName,
          finalPrompt: input.finalPrompt,
          runId: input.runId,
          onImageProgress: input.onImageProgress,
          completedBySeq,
        })
        emitImageTaskDebug({
          stage: 'image_result_available',
          runId: input.runId,
          batchId: input.batchId,
          seq: item.seq,
          model: input.modelId,
          ...getChannelDebugMeta(input.channel),
          nextState: 'completed',
          parsed: {
            requestUrl: item.requestUrl,
            providerTaskStatus: item.providerTaskStatus,
            serverTaskId: item.serverTaskId,
            hasSrc: Boolean(item.src),
          },
        })
        emitImageChainTrace({
          file: TRACE_FILE,
          module: TRACE_MODULE,
          fn: 'createRun.onImageCompleted',
          stage: 'response_item_postprocess_finished',
          traceId: input.traceId,
          runId: input.runId,
          batchId: input.batchId,
          seq: item.seq,
          detail: {
            src: summarizeImagePayload(item.src),
            requestUrl: summarizeString(item.requestUrl),
          },
        })
      })())
    },
  })

  await Promise.allSettled(completionTasks)
  emitImageChainTrace({
    file: TRACE_FILE,
    module: TRACE_MODULE,
    fn: 'createRun',
    stage: 'completion_tasks_settled',
    traceId: input.traceId,
    runId: input.runId,
    batchId: input.batchId,
    detail: {
      completionTaskCount: completionTasks.length,
      completedBySeqSize: completedBySeq.size,
    },
  })

  const images = await input.imageResultPersistence.composeRunImages({
    imageCount: input.imageCount,
    requestQueuedAt,
    completedBySeq,
    generatedItems: generated.items,
  })

  emitImageChainTrace({
    file: TRACE_FILE,
    module: TRACE_MODULE,
    fn: 'createRun',
    stage: 'run_images_composed',
    traceId: input.traceId,
    runId: input.runId,
    batchId: input.batchId,
    detail: {
      imageSummaries: images.map((image) => ({
        seq: image.seq,
        status: image.status,
        requestUrl: summarizeString(image.requestUrl),
        thumbRef: summarizeString(image.thumbRef),
        fileRef: summarizeString(image.fileRef),
        fullRef: summarizeString(image.fullRef),
      })),
    },
  })

  return images
}
