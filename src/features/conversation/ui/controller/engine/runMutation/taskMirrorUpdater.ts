import { conversationImageTracePort } from '../../../../application/ports/imageTracePort'
import { conversationLoggingPort } from '../../../../application/ports/loggingPort'
import type { RunMutationDeps, UpdateImageTaskInput } from './types'
import { mergeOptionalValue } from './shared'

const TRACE_FILE = 'src/features/conversation/ui/controller/engine/runMutation.ts'
const TRACE_MODULE = 'runMutation'
const { emitImageTaskDebug } = conversationLoggingPort
const { emitImageChainTrace, summarizeString } = conversationImageTracePort

export function createTaskMirrorUpdater(deps: Pick<
  RunMutationDeps,
  'stateRef' | 'upsertRuntimeTask'
>) {
  return (conversationId: string, input: UpdateImageTaskInput) => {
    const snapshot = deps.stateRef.current
    const currentConversation = snapshot.contents[conversationId]
    if (!currentConversation) {
      return
    }

    const currentTask = currentConversation.tasksById?.[input.taskId]
    const runtimeTask = deps.stateRef.current.runtimeTasksByConversationId[conversationId]?.[input.taskId]
    const baseTask = runtimeTask ?? currentTask
    if (!baseTask) {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'updateImageTaskInConversation',
        stage: 'task_registry_update_skipped_missing_task',
        level: 'warn',
        traceId: input.runId,
        runId: input.runId,
        conversationId,
        taskId: input.taskId,
        seq: input.seq,
      })
      return
    }

    const nextTask = {
      ...baseTask,
      status: input.status ?? baseTask.status,
      requestUrl: mergeOptionalValue(baseTask.requestUrl, input.requestUrl),
      providerTaskStatus: mergeOptionalValue(baseTask.providerTaskStatus, input.providerTaskStatus),
      threadState: mergeOptionalValue(baseTask.threadState, input.threadState),
      resumeTransport: mergeOptionalValue(baseTask.resumeTransport, input.resumeTransport),
      fileRef: mergeOptionalValue(baseTask.fileRef, input.fileRef),
      thumbRef: mergeOptionalValue(baseTask.thumbRef, input.thumbRef),
      fullRef: mergeOptionalValue(baseTask.fullRef, input.fullRef),
      refKind: mergeOptionalValue(baseTask.refKind, input.refKind),
      refKey: mergeOptionalValue(baseTask.refKey, input.refKey),
      serverTaskId: mergeOptionalValue(baseTask.serverTaskId, input.serverTaskId),
      serverTaskMeta: mergeOptionalValue(baseTask.serverTaskMeta, input.serverTaskMeta),
      bytes: mergeOptionalValue(baseTask.bytes, input.bytes),
      error: mergeOptionalValue(baseTask.error, input.error),
      errorCode: mergeOptionalValue(baseTask.errorCode, input.errorCode),
      startedAt: input.startedAt ?? baseTask.startedAt,
      completedAt: input.completedAt ?? baseTask.completedAt,
    }

    if (
      nextTask.status === baseTask.status &&
      nextTask.requestUrl === baseTask.requestUrl &&
      nextTask.providerTaskStatus === baseTask.providerTaskStatus &&
      nextTask.threadState === baseTask.threadState &&
      nextTask.resumeTransport === baseTask.resumeTransport &&
      nextTask.fileRef === baseTask.fileRef &&
      nextTask.thumbRef === baseTask.thumbRef &&
      nextTask.fullRef === baseTask.fullRef &&
      nextTask.refKind === baseTask.refKind &&
      nextTask.refKey === baseTask.refKey &&
      nextTask.serverTaskId === baseTask.serverTaskId &&
      JSON.stringify(nextTask.serverTaskMeta ?? null) === JSON.stringify(baseTask.serverTaskMeta ?? null) &&
      nextTask.bytes === baseTask.bytes &&
      nextTask.error === baseTask.error &&
      nextTask.errorCode === baseTask.errorCode &&
      nextTask.startedAt === baseTask.startedAt &&
      nextTask.completedAt === baseTask.completedAt
    ) {
      emitImageTaskDebug({
        stage: 'task_registry_update_skipped',
        runId: input.runId,
        batchId: baseTask.batchId,
        taskId: input.taskId,
        seq: input.seq,
        state: baseTask.status,
        detail: {
          reason: 'no_effective_change',
        },
      })
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'updateImageTaskInConversation',
        stage: 'task_registry_update_skipped_no_effective_change',
        level: 'warn',
        traceId: input.runId,
        runId: input.runId,
        batchId: baseTask.batchId,
        conversationId,
        taskId: input.taskId,
        seq: input.seq,
        detail: {
          currentStatus: baseTask.status,
          requestUrl: summarizeString(baseTask.requestUrl),
          refKey: summarizeString(baseTask.refKey),
        },
      })
      return
    }

    deps.upsertRuntimeTask(conversationId, nextTask)
    emitImageTaskDebug({
      stage: 'task_registry_updated',
      runId: input.runId,
      batchId: baseTask.batchId,
      taskId: input.taskId,
      seq: input.seq,
      previousState: baseTask.status,
      nextState: nextTask.status,
      parsed: {
        providerTaskStatus: nextTask.providerTaskStatus,
        serverTaskId: nextTask.serverTaskId,
        serverTaskMeta: nextTask.serverTaskMeta,
        resumeTransport: nextTask.resumeTransport,
      },
      uiUpdated: true,
    })
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'updateImageTaskInConversation',
      stage: 'task_registry_updated_after',
      traceId: input.runId,
      runId: input.runId,
      batchId: baseTask.batchId,
      conversationId,
      taskId: input.taskId,
      seq: input.seq,
      detail: {
        previousStatus: baseTask.status,
        nextStatus: nextTask.status,
        requestUrl: summarizeString(nextTask.requestUrl),
        refKey: summarizeString(nextTask.refKey),
        fileRef: summarizeString(nextTask.fileRef),
        thumbRef: summarizeString(nextTask.thumbRef),
        fullRef: summarizeString(nextTask.fullRef),
      },
    })
  }
}
