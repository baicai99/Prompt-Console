import type { Run, RunAttempt, RunTaskState } from '../../../types/conversation'
import { ensureRunTaskState } from './runTaskState'

function toTimestamp(value?: string): number | null {
  if (!value) {
    return null
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function resolveNowTimestamp(now?: string | number | Date): number | null {
  if (typeof now === 'number') {
    return Number.isFinite(now) ? now : null
  }
  if (typeof now === 'string') {
    return toTimestamp(now)
  }
  if (now instanceof Date) {
    return now.getTime()
  }
  return Date.now()
}

function normalizeAttemptTaskState(attempt: RunAttempt): RunTaskState {
  return {
    status: attempt.status,
    updatedAt: attempt.updatedAt,
    waitingStartedAt: attempt.waitingStartedAt,
    generatingStartedAt: attempt.generatingStartedAt,
    timedOutAt: attempt.timedOutAt,
    completedAt: attempt.completedAt,
  }
}

export function buildRunAttemptFromRun(run: Run, overrides?: Partial<RunAttempt>): RunAttempt {
  const taskState = ensureRunTaskState(run)
  const source = run.retryOfRunId || (run.retryAttempt ?? 0) > 0 ? 'retry' : 'initial'
  return {
    attemptId: overrides?.attemptId ?? `${run.id}:attempt:${run.retryAttempt ?? 0}`,
    source: overrides?.source ?? source,
    createdAt: overrides?.createdAt ?? run.createdAt,
    updatedAt: overrides?.updatedAt ?? taskState.updatedAt,
    status: overrides?.status ?? taskState.status,
    startedAt: overrides?.startedAt ?? taskState.generatingStartedAt ?? taskState.waitingStartedAt ?? run.createdAt,
    waitingStartedAt: overrides?.waitingStartedAt ?? taskState.waitingStartedAt,
    generatingStartedAt: overrides?.generatingStartedAt ?? taskState.generatingStartedAt,
    completedAt: overrides?.completedAt ?? taskState.completedAt,
    timedOutAt: overrides?.timedOutAt ?? taskState.timedOutAt,
    modelId: overrides?.modelId ?? run.modelId,
    modelName: overrides?.modelName ?? run.modelName,
    channelId: overrides?.channelId ?? run.channelId,
    channelName: overrides?.channelName ?? run.channelName,
  }
}

export function normalizeRunAttempts(run: Run): RunAttempt[] {
  if (!Array.isArray(run.attempts) || run.attempts.length === 0) {
    return [buildRunAttemptFromRun(run)]
  }

  return run.attempts.map((attempt, index) => {
    const fallback = buildRunAttemptFromRun(run, {
      attemptId: `${run.id}:attempt:${index}`,
      source: index === 0 ? 'initial' : 'retry',
    })
    return {
      attemptId: typeof attempt.attemptId === 'string' && attempt.attemptId.trim() ? attempt.attemptId : fallback.attemptId,
      source: attempt.source === 'retry' ? 'retry' : 'initial',
      createdAt: typeof attempt.createdAt === 'string' && attempt.createdAt.trim() ? attempt.createdAt : fallback.createdAt,
      updatedAt: typeof attempt.updatedAt === 'string' && attempt.updatedAt.trim() ? attempt.updatedAt : fallback.updatedAt,
      status: attempt.status ?? fallback.status,
      startedAt: attempt.startedAt ?? fallback.startedAt,
      waitingStartedAt: attempt.waitingStartedAt ?? fallback.waitingStartedAt,
      generatingStartedAt: attempt.generatingStartedAt ?? fallback.generatingStartedAt,
      completedAt: attempt.completedAt ?? fallback.completedAt,
      timedOutAt: attempt.timedOutAt ?? fallback.timedOutAt,
      modelId: typeof attempt.modelId === 'string' && attempt.modelId.trim() ? attempt.modelId : fallback.modelId,
      modelName: typeof attempt.modelName === 'string' && attempt.modelName.trim() ? attempt.modelName : fallback.modelName,
      channelId: typeof attempt.channelId === 'string' || attempt.channelId === null ? attempt.channelId : fallback.channelId,
      channelName: typeof attempt.channelName === 'string' || attempt.channelName === null ? attempt.channelName : fallback.channelName,
    }
  })
}

export function replaceOrAppendRunAttempt(run: Run, nextAttempt: RunAttempt): RunAttempt[] {
  const attempts = normalizeRunAttempts(run)
  const existingIndex = attempts.findIndex((attempt) => attempt.attemptId === nextAttempt.attemptId)
  if (existingIndex < 0) {
    return [...attempts, nextAttempt]
  }
  const nextAttempts = [...attempts]
  nextAttempts[existingIndex] = nextAttempt
  return nextAttempts
}

export function getRunAttemptElapsedMs(attempt: RunAttempt, now?: string | number | Date): number | null {
  const taskState = normalizeAttemptTaskState(attempt)
  const startedAt = toTimestamp(taskState.generatingStartedAt ?? taskState.waitingStartedAt ?? attempt.startedAt ?? attempt.createdAt)
  if (startedAt === null) {
    return null
  }

  const endedAt = (
    toTimestamp(taskState.completedAt)
    ?? toTimestamp(taskState.timedOutAt)
    ?? resolveNowTimestamp(now)
    ?? toTimestamp(taskState.updatedAt)
  )
  if (endedAt === null) {
    return null
  }

  return Math.max(0, endedAt - startedAt)
}
