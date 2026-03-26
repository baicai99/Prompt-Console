import { conversationImageTracePort } from '../../../../application/ports/imageTracePort'
import { conversationLoggingPort } from '../../../../application/ports/loggingPort'
import { createRunTaskState, resolveRunTaskStatusFromImages } from '../../../../domain/runTaskState'
import type { RunMutationDeps, UpdateRunImageInput } from './types'
import { findTaskForRunImage, mergeOptionalValue, resolveMirroredTaskStatus } from './shared'

const TRACE_FILE = 'src/features/conversation/ui/controller/engine/runMutation.ts'
const TRACE_MODULE = 'runMutation'
const { emitImageTaskDebug } = conversationLoggingPort
const { emitImageChainTrace, summarizeImageRefs, summarizeString } = conversationImageTracePort

export function createRunImagePatchApplier(deps: Pick<
  RunMutationDeps,
  'stateRef' | 'runLocationByConversationRef' | 'upsertRuntimeTask' | 'persistConversation' | 'scheduleConversationPersistence' | 'notifyRunCompleted'
>) {
  return (conversationId: string, input: UpdateRunImageInput) => {
    const snapshot = deps.stateRef.current
    const currentConversation = snapshot.contents[conversationId]
    if (!currentConversation) {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'updateRunImageInConversation',
        stage: 'state_update_skipped_missing_conversation',
        level: 'warn',
        traceId: input.runId,
        runId: input.runId,
        conversationId,
        seq: input.seq,
      })
      return
    }

    const locationMap = deps.runLocationByConversationRef.current[conversationId]
    const location = locationMap?.get(input.runId)
    if (!location) {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'updateRunImageInConversation',
        stage: 'state_update_skipped_missing_run_location',
        level: 'warn',
        traceId: input.runId,
        runId: input.runId,
        conversationId,
        seq: input.seq,
      })
      return
    }

    const message = currentConversation.messages[location.messageIndex]
    const runs = message.runs ?? []
    const run = runs[location.runIndex]
    if (!run || run.id !== input.runId) {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'updateRunImageInConversation',
        stage: 'state_update_skipped_run_mismatch',
        level: 'warn',
        traceId: input.runId,
        runId: input.runId,
        conversationId,
        seq: input.seq,
        detail: {
          runIdAtLocation: run?.id ?? null,
        },
      })
      return
    }

    const imageIndex = run.images.findIndex((item) => item.seq === input.seq)
    if (imageIndex < 0) {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'updateRunImageInConversation',
        stage: 'state_update_skipped_missing_image_seq',
        level: 'warn',
        traceId: input.runId,
        runId: input.runId,
        conversationId,
        seq: input.seq,
        detail: {
          availableSeqs: run.images.map((item) => item.seq),
        },
      })
      return
    }

    const taskRegistry = deps.stateRef.current.runtimeTasksByConversationId[conversationId] ?? currentConversation.tasksById ?? {}
    const matchedTask = findTaskForRunImage({
      taskRegistry,
      run,
      runId: input.runId,
      seq: input.seq,
    })
    const targetImage = run.images[imageIndex]
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'updateRunImageInConversation',
      stage: 'state_update_before',
      traceId: input.runId,
      runId: input.runId,
      batchId: run.batchId,
      conversationId,
      taskId: matchedTask?.taskId,
      imageId: targetImage.id,
      seq: input.seq,
      detail: {
        previousImage: summarizeImageRefs(targetImage),
        incomingPatch: {
          status: input.status ?? null,
          requestUrl: summarizeString(input.requestUrl),
          providerTaskStatus: input.providerTaskStatus ?? null,
          threadState: input.threadState ?? null,
          fileRef: summarizeString(input.fileRef),
          thumbRef: summarizeString(input.thumbRef),
          fullRef: summarizeString(input.fullRef),
          refKind: input.refKind ?? null,
          refKey: summarizeString(input.refKey),
          serverTaskId: summarizeString(input.serverTaskId),
          bytes: input.bytes ?? null,
          error: summarizeString(input.error),
        },
      },
    })

    const nextStatus = input.status ?? targetImage.status
    const nextQueuedAt =
      'queuedAt' in input
        ? input.queuedAt
        : targetImage.queuedAt ?? matchedTask?.queuedAt ?? run.createdAt
    const nextPendingStartedAt =
      'pendingStartedAt' in input
        ? input.pendingStartedAt
        : nextStatus === 'pending'
          ? (targetImage.pendingStartedAt ?? targetImage.startedAt ?? matchedTask?.startedAt ?? nextQueuedAt ?? new Date().toISOString())
          : targetImage.pendingStartedAt
    const nextStartedAt =
      'startedAt' in input
        ? input.startedAt
        : nextStatus === 'pending'
          ? (targetImage.startedAt ?? matchedTask?.startedAt ?? nextPendingStartedAt ?? nextQueuedAt ?? new Date().toISOString())
          : targetImage.startedAt ?? matchedTask?.startedAt
    const nextCompletedAt =
      'completedAt' in input
        ? input.completedAt
        : nextStatus === 'success' || nextStatus === 'failed'
          ? (targetImage.completedAt ?? matchedTask?.completedAt ?? new Date().toISOString())
          : undefined
    const nextImage = {
      ...targetImage,
      status: nextStatus,
      queuedAt: nextQueuedAt,
      startedAt: nextStartedAt,
      completedAt: nextCompletedAt,
      pendingStartedAt: nextPendingStartedAt,
      requestUrl: mergeOptionalValue(targetImage.requestUrl, input.requestUrl),
      providerTaskStatus: mergeOptionalValue(targetImage.providerTaskStatus, input.providerTaskStatus),
      threadState: mergeOptionalValue(targetImage.threadState, input.threadState),
      resumeTransport: mergeOptionalValue(targetImage.resumeTransport, input.resumeTransport),
      fileRef: mergeOptionalValue(targetImage.fileRef, input.fileRef),
      thumbRef: mergeOptionalValue(targetImage.thumbRef, input.thumbRef),
      fullRef: mergeOptionalValue(targetImage.fullRef, input.fullRef),
      refKind: mergeOptionalValue(targetImage.refKind, input.refKind),
      refKey: mergeOptionalValue(targetImage.refKey, input.refKey),
      serverTaskId: mergeOptionalValue(targetImage.serverTaskId, input.serverTaskId),
      serverTaskMeta: mergeOptionalValue(targetImage.serverTaskMeta, input.serverTaskMeta),
      bytes: mergeOptionalValue(targetImage.bytes, input.bytes),
      error: mergeOptionalValue(targetImage.error, input.error),
      errorCode: mergeOptionalValue(targetImage.errorCode, input.errorCode),
      detachedAt: mergeOptionalValue(targetImage.detachedAt, input.detachedAt),
      lastResumeAttemptAt: mergeOptionalValue(targetImage.lastResumeAttemptAt, input.lastResumeAttemptAt),
    }
    if (
      nextImage.status === targetImage.status &&
      nextImage.queuedAt === targetImage.queuedAt &&
      nextImage.startedAt === targetImage.startedAt &&
      nextImage.completedAt === targetImage.completedAt &&
      nextImage.pendingStartedAt === targetImage.pendingStartedAt &&
      nextImage.requestUrl === targetImage.requestUrl &&
      nextImage.providerTaskStatus === targetImage.providerTaskStatus &&
      nextImage.threadState === targetImage.threadState &&
      nextImage.resumeTransport === targetImage.resumeTransport &&
      nextImage.fileRef === targetImage.fileRef &&
      nextImage.thumbRef === targetImage.thumbRef &&
      nextImage.fullRef === targetImage.fullRef &&
      nextImage.refKind === targetImage.refKind &&
      nextImage.refKey === targetImage.refKey &&
      nextImage.serverTaskId === targetImage.serverTaskId &&
      JSON.stringify(nextImage.serverTaskMeta ?? null) === JSON.stringify(targetImage.serverTaskMeta ?? null) &&
      nextImage.bytes === targetImage.bytes &&
      nextImage.error === targetImage.error &&
      nextImage.errorCode === targetImage.errorCode &&
      nextImage.detachedAt === targetImage.detachedAt &&
      nextImage.lastResumeAttemptAt === targetImage.lastResumeAttemptAt
    ) {
      emitImageTaskDebug({
        stage: 'run_image_update_skipped',
        runId: input.runId,
        seq: input.seq,
        state: targetImage.status,
        detail: {
          reason: 'no_effective_change',
        },
      })
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'updateRunImageInConversation',
        stage: 'state_update_skipped_no_effective_change',
        level: 'warn',
        traceId: input.runId,
        runId: input.runId,
        batchId: run.batchId,
        conversationId,
        taskId: matchedTask?.taskId,
        imageId: targetImage.id,
        seq: input.seq,
        detail: {
          image: summarizeImageRefs(targetImage),
        },
      })
      return
    }

    const nextImages = [...run.images]
    nextImages[imageIndex] = nextImage
    const provisionalRun: typeof run = {
      ...run,
      images: nextImages,
    }
    const nextRun: typeof run = {
      ...provisionalRun,
      taskState: createRunTaskState({
        status:
          input.status === 'pending'
            ? 'generating'
            : resolveRunTaskStatusFromImages({
              ...provisionalRun,
              taskState: run.taskState,
            }),
        previous: run.taskState,
      }),
    }
    const nextRuns = [...runs]
    nextRuns[location.runIndex] = nextRun
    const nextMessages = [...currentConversation.messages]
    nextMessages[location.messageIndex] = {
      ...message,
      runs: nextRuns,
    }

    const nextTaskStatus = resolveMirroredTaskStatus({
      currentTask: matchedTask,
      nextImageStatus: nextStatus,
      nextImageErrorCode: nextImage.errorCode,
    })
    const nextTaskRecord = matchedTask
      ? {
          ...matchedTask,
          status: nextTaskStatus,
          requestUrl: nextImage.requestUrl,
          providerTaskStatus: nextImage.providerTaskStatus,
          threadState: nextImage.threadState,
          resumeTransport: nextImage.resumeTransport,
          fileRef: nextImage.fileRef,
          thumbRef: nextImage.thumbRef,
          fullRef: nextImage.fullRef,
          refKind: nextImage.refKind,
          refKey: nextImage.refKey,
          serverTaskId: nextImage.serverTaskId,
          serverTaskMeta: nextImage.serverTaskMeta,
          bytes: nextImage.bytes,
          error: nextImage.error,
          errorCode: nextImage.errorCode,
          queuedAt: nextImage.queuedAt ?? matchedTask.queuedAt,
          startedAt: nextImage.startedAt ?? matchedTask.startedAt,
          completedAt: nextImage.completedAt ?? matchedTask.completedAt,
        }
      : undefined
    if (nextTaskRecord) {
      deps.upsertRuntimeTask(conversationId, nextTaskRecord)
    }

    deps.persistConversation({
      ...currentConversation,
      updatedAt: new Date().toISOString(),
      messages: nextMessages,
    }, {
      saveStorage: false,
      saveIndex: false,
      skipSummaryUpdate: true,
    })
    emitImageTaskDebug({
      stage: 'run_image_state_updated',
      runId: input.runId,
      batchId: run.batchId,
      taskId: matchedTask?.taskId,
      imageId: nextImage.id,
      seq: input.seq,
      previousState: targetImage.status,
      nextState: nextImage.status,
      state: matchedTask?.status,
      label: nextImage.status,
      uiUpdated: true,
      parsed: {
        previousTaskStatus: matchedTask?.status,
        nextTaskStatus,
        providerTaskStatus: nextImage.providerTaskStatus,
        serverTaskId: nextImage.serverTaskId,
        serverTaskMeta: nextImage.serverTaskMeta,
        resumeTransport: nextImage.resumeTransport,
      },
      detail: {
        branch: nextImage.status === 'pending' ? 'pending_patch' : nextImage.status,
      },
    })
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'updateRunImageInConversation',
      stage: 'state_update_after',
      traceId: input.runId,
      runId: input.runId,
      batchId: run.batchId,
      conversationId,
      taskId: matchedTask?.taskId,
      imageId: nextImage.id,
      seq: input.seq,
      detail: {
        previousImage: summarizeImageRefs(targetImage),
        nextImage: summarizeImageRefs(nextImage),
        previousTaskStatus: matchedTask?.status ?? null,
        nextTaskStatus,
        providerTaskStatus: nextImage.providerTaskStatus ?? null,
      },
    })
    deps.notifyRunCompleted(conversationId, nextRun)
    deps.scheduleConversationPersistence(conversationId)
  }
}
