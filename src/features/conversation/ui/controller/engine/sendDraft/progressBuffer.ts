import type { QueuedTaskProgress, QueuedTaskState, SendFlowDeps } from './types'

interface CreateQueuedTaskUpdateBufferInput {
  targetConversationId: string
  isRunStillActive: SendFlowDeps['isRunStillActive']
  updateImageTaskInConversation: SendFlowDeps['updateImageTaskInConversation']
  updateRunImageInConversation: SendFlowDeps['updateRunImageInConversation']
  updateRunTaskStateInConversation: SendFlowDeps['updateRunTaskStateInConversation']
}

function requestAnimationFrameSafe(callback: FrameRequestCallback): number {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return globalThis.setTimeout(() => callback(Date.now()), 16) as unknown as number
  }
  return window.requestAnimationFrame(callback)
}

function cancelAnimationFrameSafe(handle: number) {
  if (typeof window === 'undefined' || typeof window.cancelAnimationFrame !== 'function') {
    globalThis.clearTimeout(handle)
    return
  }
  window.cancelAnimationFrame(handle)
}

export function createQueuedTaskUpdateBuffer(input: CreateQueuedTaskUpdateBufferInput) {
  const queuedProgressByTaskId = new Map<string, QueuedTaskProgress>()
  const queuedStateByTaskId = new Map<string, QueuedTaskState>()
  let frameFlushHandle: number | null = null

  const flush = () => {
    if (frameFlushHandle !== null) {
      cancelAnimationFrameSafe(frameFlushHandle)
      frameFlushHandle = null
    }

    queuedStateByTaskId.forEach((progress) => {
      if (!input.isRunStillActive(input.targetConversationId, progress.runId)) {
        return
      }
      const startedAt = progress.state === 'running' ? new Date().toISOString() : undefined
      input.updateImageTaskInConversation(input.targetConversationId, {
        taskId: progress.taskId,
        runId: progress.runId,
        seq: progress.seq,
        status: progress.state === 'running' ? 'submitting' : progress.state,
        startedAt,
        completedAt:
          progress.state === 'succeeded'
          || progress.state === 'failed'
          || progress.state === 'timeout'
          || progress.state === 'cancelled'
            ? new Date().toISOString()
            : undefined,
        error: progress.reason,
      })
      if (progress.state === 'running') {
        input.updateRunImageInConversation(input.targetConversationId, {
          runId: progress.runId,
          seq: progress.seq,
          status: 'pending',
          startedAt,
        })
        input.updateRunTaskStateInConversation(input.targetConversationId, {
          runId: progress.runId,
          status: 'generating',
          reason: progress.reason,
        })
      }
    })
    queuedStateByTaskId.clear()

    queuedProgressByTaskId.forEach((progress) => {
      if (!input.isRunStillActive(input.targetConversationId, progress.runId)) {
        return
      }
      input.updateRunImageInConversation(input.targetConversationId, {
        ...progress,
        resumeTransport: undefined,
      })
    })
    queuedProgressByTaskId.clear()
  }

  const schedule = () => {
    if (frameFlushHandle !== null) {
      return
    }
    frameFlushHandle = requestAnimationFrameSafe(() => {
      frameFlushHandle = null
      flush()
    })
  }

  return {
    queueProgress(progress: QueuedTaskProgress) {
      queuedProgressByTaskId.set(progress.taskId, progress)
      schedule()
    },
    queueState(progress: QueuedTaskState) {
      queuedStateByTaskId.set(progress.taskId, progress)
      schedule()
    },
    flush,
    dispose() {
      flush()
      if (frameFlushHandle !== null) {
        cancelAnimationFrameSafe(frameFlushHandle)
        frameFlushHandle = null
      }
    },
  }
}
