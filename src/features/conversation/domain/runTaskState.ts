import type { Run, RunTaskState, RunTaskStatus } from '../../../types/conversation'

function countFailedByCode(run: Pick<Run, 'images'>): { timeout: number; other: number } {
  return run.images.reduce(
    (acc, image) => {
      if (image.status !== 'failed') {
        return acc
      }
      if (image.errorCode === 'timeout') {
        acc.timeout += 1
      } else {
        acc.other += 1
      }
      return acc
    },
    { timeout: 0, other: 0 },
  )
}

export function createRunTaskState(input: {
  status: RunTaskStatus
  now?: string
  previous?: RunTaskState
  reason?: string
}): RunTaskState {
  const now = input.now ?? new Date().toISOString()
  const previous = input.previous

  return {
    status: input.status,
    updatedAt: now,
    waitingStartedAt:
      input.status === 'waiting'
        ? previous?.waitingStartedAt ?? now
        : previous?.waitingStartedAt,
    generatingStartedAt:
      input.status === 'generating'
        ? previous?.generatingStartedAt ?? now
        : previous?.generatingStartedAt,
    timedOutAt:
      input.status === 'timeout'
        ? now
        : previous?.timedOutAt,
    completedAt:
      input.status === 'completed' || input.status === 'failed' || input.status === 'cancelled'
        ? now
        : previous?.completedAt,
    reason: input.reason ?? previous?.reason,
  }
}

export function resolveRunTaskStatusFromImages(run: Pick<Run, 'images' | 'taskState'>): RunTaskStatus {
  const pendingCount = run.images.filter((image) => image.status === 'pending').length
  if (pendingCount > 0) {
    if (run.taskState?.status === 'waiting') {
      return 'waiting'
    }
    return 'generating'
  }

  const successCount = run.images.filter((image) => image.status === 'success').length
  const { timeout: timeoutFailures, other: otherFailures } = countFailedByCode(run)
  if (successCount > 0 && timeoutFailures === 0 && otherFailures === 0) {
    return 'completed'
  }
  if (successCount === 0 && timeoutFailures > 0 && otherFailures === 0) {
    return 'timeout'
  }
  return 'failed'
}

export function ensureRunTaskState(run: Run, fallbackStatus?: RunTaskStatus): RunTaskState {
  if (run.taskState) {
    return run.taskState
  }
  const status = fallbackStatus ?? resolveRunTaskStatusFromImages(run)
  return createRunTaskState({
    status,
    now: run.createdAt,
  })
}
