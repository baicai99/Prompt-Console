import type { Run } from '../../../../types/conversation'
import type { ImageRefKind } from '../../../../types/image'
import type { NormalizedImageItem } from '../../../../types/provider'
import {
  emitImageChainTrace,
  summarizeImagePayload,
  summarizeImageRefs,
  summarizeString,
} from '../../../../services/imageChainTrace'
import { makeId } from '../../../../utils/chat'
import { classifyFailure } from '../../domain/failureClassifier'
import { createImageResultReferenceStore } from '../imageResultReferenceStore'
import type { CreateRunInput } from '../runExecutor'
import { Semaphore } from '../utils/semaphore'
import type {
  ProcessedFailedImage,
  ProcessedImage,
  ProcessedPendingImage,
  ProcessedSuccessImage,
  RunTraceMeta,
} from './shared'
import { TRACE_FILE, TRACE_MODULE } from './shared'

interface CreateRunImageResultPersistenceInput {
  fetchFn?: typeof fetch
  putImageBlobFn: (key: string, blob: Blob) => Promise<void>
  autoSaveImageFn: (input: {
    imageSrc: string
    saveDirectory: string | undefined
    modelName: string
    prompt: string
    seq: number
  }) => Promise<boolean>
  postProcessingSemaphore: Semaphore
}

export function createRunImageResultPersistence(input: CreateRunImageResultPersistenceInput) {
  const { fetchFn, putImageBlobFn, autoSaveImageFn, postProcessingSemaphore } = input
  const imageResultReferenceStore = createImageResultReferenceStore({
    fetchFn,
    putImageBlobFn,
  })

  async function toRefs(src: string, meta?: RunTraceMeta): Promise<ProcessedSuccessImage> {
    return {
      status: 'success',
      threadState: 'settled',
      ...(await imageResultReferenceStore.persistImageResultSource(src, meta)),
    }
  }

  async function processSuccessfulImage(input: {
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
  }): Promise<void> {
    await postProcessingSemaphore.use(async () => {
      const previous = input.completedBySeq.get(input.item.seq)
      const completedAt = new Date().toISOString()
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'processSuccessfulImage',
        stage: 'postprocess_started',
        traceId: input.runId,
        runId: input.runId,
        seq: input.item.seq,
        detail: {
          src: summarizeImagePayload(input.item.src),
          shouldAutoSave: input.shouldAutoSave,
        },
      })
      const refs = await toRefs(input.item.src, {
        traceId: input.runId,
        seq: input.item.seq,
      })
      const success: ProcessedSuccessImage = {
        ...refs,
        status: 'success',
        threadState: 'settled',
        queuedAt: input.item.queuedAt ?? previous?.queuedAt,
        startedAt: input.item.startedAt ?? previous?.startedAt ?? input.item.queuedAt ?? completedAt,
        completedAt,
        requestUrl: input.item.requestUrl,
        providerTaskStatus: input.item.providerTaskStatus,
        serverTaskId: input.item.serverTaskId,
        serverTaskMeta: input.item.serverTaskMeta,
      }
      input.completedBySeq.set(input.item.seq, success)
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'processSuccessfulImage',
        stage: 'postprocess_completed',
        traceId: input.runId,
        runId: input.runId,
        seq: input.item.seq,
        detail: {
          result: summarizeImageRefs({
            status: success.status,
            requestUrl: success.requestUrl,
            thumbRef: success.thumbRef,
            fileRef: success.fileRef,
            fullRef: success.fullRef,
            refKind: success.refKind,
            refKey: success.refKey,
            bytes: success.bytes,
            error: undefined,
          }),
          providerTaskStatus: success.providerTaskStatus ?? null,
          serverTaskId: summarizeString(success.serverTaskId),
        },
      })
      input.onImageProgress?.({
        runId: input.runId,
        seq: input.item.seq,
        status: 'success',
        queuedAt: success.queuedAt,
        startedAt: success.startedAt,
        completedAt: success.completedAt,
        requestUrl: success.requestUrl,
        providerTaskStatus: success.providerTaskStatus,
        threadState: 'settled',
        fileRef: success.fileRef,
        thumbRef: success.thumbRef,
        fullRef: success.fullRef,
        refKind: success.refKind,
        refKey: success.refKey,
        serverTaskId: success.serverTaskId,
        serverTaskMeta: success.serverTaskMeta,
        bytes: success.bytes,
      })

      if (input.shouldAutoSave) {
        emitImageChainTrace({
          file: TRACE_FILE,
          module: TRACE_MODULE,
          fn: 'processSuccessfulImage',
          stage: 'autosave_triggered',
          traceId: input.runId,
          runId: input.runId,
          seq: input.item.seq,
          detail: {
            saveDirectory: summarizeString(input.saveDirectory),
          },
        })
        void autoSaveImageFn({
          imageSrc: input.item.src,
          saveDirectory: input.saveDirectory,
          modelName: input.modelName,
          prompt: input.finalPrompt,
          seq: input.item.seq,
        })
      }
    })
  }

  async function composeRunImages(input: {
    imageCount: number
    requestQueuedAt?: string
    completedBySeq: Map<number, ProcessedImage>
    generatedItems: NormalizedImageItem[]
  }): Promise<Run['images']> {
    return Promise.all(
      Array.from({ length: input.imageCount }, async (_, index) => {
        const seq = index + 1
        const completed = input.completedBySeq.get(seq)
        if (!completed || completed.status === 'failed') {
          const fallbackItem = input.generatedItems.find((entry) => entry.seq === seq)
          if (!completed && fallbackItem?.src) {
            const refs = await postProcessingSemaphore.use(() => toRefs(fallbackItem.src!))
            const completedAt = new Date().toISOString()
            return {
              id: makeId(),
              seq,
              status: 'success' as const,
              threadState: 'settled' as const,
              queuedAt: input.requestQueuedAt,
              startedAt: input.requestQueuedAt,
              completedAt,
              requestUrl: fallbackItem.requestUrl,
              providerTaskStatus: fallbackItem.providerTaskStatus,
              fileRef: refs.fileRef,
              thumbRef: refs.thumbRef,
              fullRef: refs.fullRef,
              refKind: refs.refKind,
              refKey: refs.refKey,
              serverTaskId: fallbackItem.serverTaskId,
              serverTaskMeta: fallbackItem.serverTaskMeta,
              bytes: refs.bytes,
            }
          }

          if (!completed && (fallbackItem?.serverTaskId || fallbackItem?.serverTaskMeta) && !fallbackItem?.error) {
            return {
              id: makeId(),
              seq,
              status: 'pending' as const,
              threadState: 'active' as const,
              queuedAt: input.requestQueuedAt,
              startedAt: input.requestQueuedAt,
              requestUrl: fallbackItem.requestUrl,
              providerTaskStatus: fallbackItem.providerTaskStatus,
              serverTaskId: fallbackItem.serverTaskId,
              serverTaskMeta: fallbackItem.serverTaskMeta,
            }
          }

          const message = completed?.error ?? fallbackItem?.error?.trim() ?? '该序号未返回图片'
          return {
            id: makeId(),
            seq,
            status: 'failed' as const,
            threadState: 'settled' as const,
            queuedAt: completed?.queuedAt ?? input.requestQueuedAt,
            startedAt: completed?.startedAt ?? input.requestQueuedAt,
            completedAt: completed?.completedAt ?? new Date().toISOString(),
            requestUrl: completed?.requestUrl ?? fallbackItem?.requestUrl,
            providerTaskStatus: completed?.providerTaskStatus ?? fallbackItem?.providerTaskStatus,
            serverTaskId: completed?.serverTaskId ?? fallbackItem?.serverTaskId,
            serverTaskMeta: completed?.serverTaskMeta ?? fallbackItem?.serverTaskMeta,
            error: message,
            errorCode: completed?.errorCode ?? classifyFailure(message),
          }
        }

        if (completed.status === 'pending') {
          return {
            id: makeId(),
            seq,
            status: 'pending' as const,
            threadState: 'active' as const,
            queuedAt: completed.queuedAt,
            startedAt: completed.startedAt,
            requestUrl: completed.requestUrl,
            providerTaskStatus: completed.providerTaskStatus,
            serverTaskId: completed.serverTaskId,
            serverTaskMeta: completed.serverTaskMeta,
          }
        }

        return {
          id: makeId(),
          seq,
          status: 'success' as const,
          threadState: 'settled' as const,
          queuedAt: completed.queuedAt,
          startedAt: completed.startedAt,
          completedAt: completed.completedAt,
          requestUrl: completed.requestUrl,
          providerTaskStatus: completed.providerTaskStatus,
          fileRef: completed.fileRef,
          thumbRef: completed.thumbRef,
          fullRef: completed.fullRef,
          refKind: completed.refKind as ImageRefKind | undefined,
          refKey: completed.refKey,
          serverTaskId: completed.serverTaskId,
          serverTaskMeta: completed.serverTaskMeta,
          bytes: completed.bytes,
        }
      }),
    )
  }

  function buildFailedProcessedImage(
    item: NormalizedImageItem,
    timing?: { queuedAt?: string; startedAt?: string; completedAt?: string },
  ): ProcessedFailedImage {
    const errorMessage = item.error?.trim() ? item.error : '该序号未返回图片'
    return {
      status: 'failed',
      threadState: 'settled',
      queuedAt: timing?.queuedAt,
      startedAt: timing?.startedAt,
      completedAt: timing?.completedAt,
      requestUrl: item.requestUrl,
      providerTaskStatus: item.providerTaskStatus,
      error: errorMessage,
      errorCode: classifyFailure(errorMessage),
      serverTaskId: item.serverTaskId,
      serverTaskMeta: item.serverTaskMeta,
    }
  }

  function buildPendingProcessedImage(
    item: NormalizedImageItem,
    timing?: { queuedAt?: string; startedAt?: string },
  ): ProcessedPendingImage {
    return {
      status: 'pending',
      threadState: 'active',
      queuedAt: timing?.queuedAt,
      startedAt: timing?.startedAt,
      requestUrl: item.requestUrl,
      providerTaskStatus: item.providerTaskStatus,
      serverTaskId: item.serverTaskId,
      serverTaskMeta: item.serverTaskMeta,
    }
  }

  return {
    processSuccessfulImage,
    composeRunImages,
    buildFailedProcessedImage,
    buildPendingProcessedImage,
  }
}
