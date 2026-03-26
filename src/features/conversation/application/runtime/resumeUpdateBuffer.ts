import type { ImageTask, Run } from '../../../../types/conversation'

export interface UpdateRunImageInput {
  runId: string
  seq: number
  status?: 'pending' | 'success' | 'failed'
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  requestUrl?: string
  providerTaskStatus?: Run['images'][number]['providerTaskStatus']
  threadState?: Run['images'][number]['threadState']
  resumeTransport?: Run['images'][number]['resumeTransport']
  fileRef?: string
  thumbRef?: string
  fullRef?: string
  refKind?: Run['images'][number]['refKind']
  refKey?: Run['images'][number]['refKey']
  serverTaskId?: Run['images'][number]['serverTaskId']
  serverTaskMeta?: Run['images'][number]['serverTaskMeta']
  bytes?: number
  error?: string
  errorCode?: Run['images'][number]['errorCode']
  detachedAt?: string
  lastResumeAttemptAt?: string
}

interface QueuedResumeTaskUpdate {
  taskId: string
  runId: string
  seq: number
  status?: ImageTask['status']
  requestUrl?: string
  providerTaskStatus?: ImageTask['providerTaskStatus']
  threadState?: ImageTask['threadState']
  resumeTransport?: ImageTask['resumeTransport']
  fileRef?: string
  thumbRef?: string
  fullRef?: string
  refKind?: ImageTask['refKind']
  refKey?: ImageTask['refKey']
  serverTaskId?: ImageTask['serverTaskId']
  serverTaskMeta?: ImageTask['serverTaskMeta']
  bytes?: ImageTask['bytes']
  error?: ImageTask['error']
  errorCode?: ImageTask['errorCode']
  startedAt?: string
  completedAt?: string
}

export type { QueuedResumeTaskUpdate }

interface QueuedRunTaskStateUpdate {
  runId: string
  status: NonNullable<Run['taskState']>['status']
  reason?: string
}

interface ResumeUpdateBufferDeps {
  conversationId: string
  updateImageTaskInConversation: (conversationId: string, input: QueuedResumeTaskUpdate) => void
  updateRunImageInConversation: (conversationId: string, input: UpdateRunImageInput) => void
  updateRunTaskStateInConversation: (
    conversationId: string,
    input: QueuedRunTaskStateUpdate,
  ) => void
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

export function createResumeUpdateBuffer(deps: ResumeUpdateBufferDeps) {
  const queuedTaskUpdatesById = new Map<string, QueuedResumeTaskUpdate>()
  const queuedRunImageUpdatesByKey = new Map<string, UpdateRunImageInput>()
  const queuedRunTaskStateById = new Map<string, QueuedRunTaskStateUpdate>()
  let frameFlushHandle: number | null = null

  const flush = () => {
    if (frameFlushHandle !== null) {
      cancelAnimationFrameSafe(frameFlushHandle)
      frameFlushHandle = null
    }

    queuedRunTaskStateById.forEach((update) => {
      deps.updateRunTaskStateInConversation(deps.conversationId, update)
    })
    queuedRunTaskStateById.clear()

    queuedTaskUpdatesById.forEach((update) => {
      deps.updateImageTaskInConversation(deps.conversationId, update)
    })
    queuedTaskUpdatesById.clear()

    queuedRunImageUpdatesByKey.forEach((update) => {
      deps.updateRunImageInConversation(deps.conversationId, update)
    })
    queuedRunImageUpdatesByKey.clear()
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
    queueTaskUpdate(update: QueuedResumeTaskUpdate) {
      queuedTaskUpdatesById.set(update.taskId, update)
      schedule()
    },
    queueRunImageUpdate(update: UpdateRunImageInput) {
      queuedRunImageUpdatesByKey.set(`${update.runId}:${update.seq}`, update)
      schedule()
    },
    queueRunTaskStateUpdate(update: QueuedRunTaskStateUpdate) {
      queuedRunTaskStateById.set(update.runId, update)
      schedule()
    },
    flush,
  }
}
