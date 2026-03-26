import { classifyFailure } from '../../domain/failureClassifier'
import type { PersistedImageReference } from '../imageResultReferenceStore'
import type { ConversationState } from '../../state/conversationState'
import type { Run } from '../../../../types/conversation'
import type { ImageTaskDebugEvent } from '../../../../services/imageTaskDebug'
import type { QueuedResumeTaskUpdate, UpdateRunImageInput } from './resumeUpdateBuffer'
import {
  buildFailedRunImagePatch,
  buildPendingRunImagePatch,
  buildSucceededRunImagePatch,
} from '../taskLifecycle/shared'

interface ResumeChannelMeta {
  emitImageTaskDebug: (input: ImageTaskDebugEvent) => void
  getChannelDebugMeta: (channel: ConversationState['channels'][number] | undefined) => Record<string, unknown>
}

interface ResumeStateTransitionDeps {
  conversationId: string
  entry: {
    task: {
      taskId: string
      status: string
      providerTaskStatus?: string
      serverTaskId?: string
      serverTaskMeta?: Record<string, string>
      queuedAt?: string
      startedAt?: string
    }
    run: Pick<Run, 'id' | 'batchId' | 'modelId'>
    image: Pick<
      Run['images'][number],
      'id' | 'seq' | 'queuedAt' | 'startedAt' | 'completedAt' | 'providerTaskStatus' | 'serverTaskId' | 'serverTaskMeta'
    >
  }
  channel: ConversationState['channels'][number] | undefined
  attemptedAt: string
  fallbackServerTaskId?: string
  fallbackServerTaskMeta?: Record<string, string>
  canApplyUpdate: () => boolean
  queueTaskUpdate: (input: QueuedResumeTaskUpdate) => void
  queueRunImageUpdate: (input: UpdateRunImageInput) => void
  queueRunTaskStateUpdate: (input: {
    runId: string
    status: NonNullable<Run['taskState']>['status']
    reason?: string
  }) => void
  persistImageResultSource: (
    src: string,
    meta?: { traceId?: string; seq?: number },
  ) => Promise<PersistedImageReference>
  markSettled: () => void
  logging: ResumeChannelMeta
}

export function createResumeStateTransitions(deps: ResumeStateTransitionDeps) {
  const {
    conversationId,
    entry,
    channel,
    attemptedAt,
    fallbackServerTaskId,
    fallbackServerTaskMeta,
    canApplyUpdate,
    queueTaskUpdate,
    queueRunImageUpdate,
    queueRunTaskStateUpdate,
    persistImageResultSource,
    markSettled,
    logging,
  } = deps

  const buildBaseMeta = () => ({
    conversationId,
    runId: entry.run.id,
    batchId: entry.run.batchId,
    taskId: entry.task.taskId,
    imageId: entry.image.id,
    seq: entry.image.seq,
    model: entry.run.modelId,
    ...logging.getChannelDebugMeta(channel),
  })

  const applyPendingState = (
    transport: 'stream' | 'polling',
    override?: { providerTaskStatus?: string; serverTaskId?: string; serverTaskMeta?: Record<string, string> },
  ) => {
    if (!canApplyUpdate()) {
      return
    }
    queueTaskUpdate({
      taskId: entry.task.taskId,
      runId: entry.run.id,
      seq: entry.image.seq,
      status: transport === 'stream' ? 'running' : 'polling',
      providerTaskStatus: override?.providerTaskStatus,
      resumeTransport: transport,
      serverTaskId: override?.serverTaskId ?? fallbackServerTaskId,
      serverTaskMeta: override?.serverTaskMeta ?? fallbackServerTaskMeta,
      startedAt: entry.task.startedAt ?? attemptedAt,
    })
    queueRunImageUpdate({
      runId: entry.run.id,
      seq: entry.image.seq,
      ...buildPendingRunImagePatch({
        queuedAt: entry.image.queuedAt ?? entry.task.queuedAt ?? attemptedAt,
        startedAt: entry.image.startedAt ?? entry.task.startedAt ?? attemptedAt,
        providerTaskStatus: override?.providerTaskStatus,
        resumeTransport: transport,
        serverTaskId: override?.serverTaskId ?? fallbackServerTaskId,
        serverTaskMeta: override?.serverTaskMeta ?? fallbackServerTaskMeta,
      }),
      lastResumeAttemptAt: attemptedAt,
    })
    queueRunTaskStateUpdate({
      runId: entry.run.id,
      status: 'generating',
    })
    logging.emitImageTaskDebug({
      stage: 'resume_state_applied',
      ...buildBaseMeta(),
      previousState: entry.task.status,
      nextState: transport === 'stream' ? 'running' : 'polling',
      pollTriggered: transport === 'polling',
      parsed: {
        providerTaskStatus: override?.providerTaskStatus,
        serverTaskId: override?.serverTaskId ?? fallbackServerTaskId,
        serverTaskMeta: override?.serverTaskMeta ?? fallbackServerTaskMeta,
        transport,
      },
    })
  }

  const applyFailedState = (
    transport: 'stream' | 'polling',
    resumed: { error?: string; serverTaskId?: string; serverTaskMeta?: Record<string, string> },
  ) => {
    if (!canApplyUpdate()) {
      return
    }
    const failureMessage = resumed.error?.trim() ? resumed.error : '图片生成失败'
    const failureCode = classifyFailure(failureMessage)
    queueTaskUpdate({
      taskId: entry.task.taskId,
      runId: entry.run.id,
      seq: entry.image.seq,
      status: failureCode === 'timeout' ? 'timeout' : 'failed',
      resumeTransport: transport,
      error: failureMessage,
      errorCode: failureCode,
      serverTaskId: resumed.serverTaskId ?? fallbackServerTaskId,
      serverTaskMeta: resumed.serverTaskMeta ?? fallbackServerTaskMeta,
      completedAt: attemptedAt,
    })
    queueRunTaskStateUpdate({
      runId: entry.run.id,
      status: failureCode === 'timeout' ? 'timeout' : 'failed',
      reason: failureCode === 'timeout' ? 'generating-timeout' : 'resume-failed',
    })
    queueRunImageUpdate({
      runId: entry.run.id,
      seq: entry.image.seq,
      ...buildFailedRunImagePatch({
        queuedAt: entry.image.queuedAt ?? entry.task.queuedAt ?? attemptedAt,
        startedAt: entry.image.startedAt ?? entry.task.startedAt ?? attemptedAt,
        completedAt: attemptedAt,
        error: failureMessage,
        errorCode: failureCode,
        resumeTransport: transport,
        serverTaskId: resumed.serverTaskId ?? fallbackServerTaskId,
        serverTaskMeta: resumed.serverTaskMeta ?? fallbackServerTaskMeta,
      }),
      lastResumeAttemptAt: attemptedAt,
    })
    markSettled()
    logging.emitImageTaskDebug({
      stage: 'resume_failed',
      ...buildBaseMeta(),
      nextState: failureCode,
      error: failureMessage,
      parsed: {
        transport,
        serverTaskId: resumed.serverTaskId ?? fallbackServerTaskId,
        serverTaskMeta: resumed.serverTaskMeta ?? fallbackServerTaskMeta,
      },
    })
  }

  const applySuccessState = async (
    transport: 'stream' | 'polling',
    resumed: { src: string; serverTaskId?: string; serverTaskMeta?: Record<string, string> },
  ): Promise<void> => {
    if (!canApplyUpdate()) {
      return
    }
    const persisted = await persistImageResultSource(resumed.src, {
      traceId: entry.run.id,
      seq: entry.image.seq,
    })
    if (!canApplyUpdate()) {
      return
    }
    queueTaskUpdate({
      taskId: entry.task.taskId,
      runId: entry.run.id,
      seq: entry.image.seq,
      status: 'succeeded',
      resumeTransport: transport,
      fileRef: persisted.fileRef,
      thumbRef: persisted.thumbRef,
      fullRef: persisted.fullRef,
      refKind: persisted.refKind,
      refKey: persisted.refKey,
      bytes: persisted.bytes,
      serverTaskId: resumed.serverTaskId ?? fallbackServerTaskId,
      serverTaskMeta: resumed.serverTaskMeta ?? fallbackServerTaskMeta,
      completedAt: attemptedAt,
    })
    queueRunTaskStateUpdate({
      runId: entry.run.id,
      status: 'completed',
    })
    queueRunImageUpdate({
      runId: entry.run.id,
      seq: entry.image.seq,
      ...buildSucceededRunImagePatch({
        queuedAt: entry.image.queuedAt ?? entry.task.queuedAt ?? attemptedAt,
        startedAt: entry.image.startedAt ?? entry.task.startedAt ?? attemptedAt,
        completedAt: attemptedAt,
        resumeTransport: transport,
        fileRef: persisted.fileRef,
        thumbRef: persisted.thumbRef,
        fullRef: persisted.fullRef,
        refKind: persisted.refKind,
        refKey: persisted.refKey,
        bytes: persisted.bytes,
        serverTaskId: resumed.serverTaskId ?? fallbackServerTaskId,
        serverTaskMeta: resumed.serverTaskMeta ?? fallbackServerTaskMeta,
      }),
      lastResumeAttemptAt: attemptedAt,
    })
    markSettled()
    logging.emitImageTaskDebug({
      stage: 'resume_succeeded',
      ...buildBaseMeta(),
      nextState: 'completed',
      parsed: {
        transport,
        src: resumed.src,
        serverTaskId: resumed.serverTaskId ?? fallbackServerTaskId,
        serverTaskMeta: resumed.serverTaskMeta ?? fallbackServerTaskMeta,
      },
    })
  }

  return {
    applyPendingState,
    applyFailedState,
    applySuccessState,
  }
}
