import type { ImageTask, Run } from '../../../types/conversation'
import type { ImageItem } from '../../../types/image'
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

export function getRunElapsedMs(run: Run, now?: string | number | Date): number | null {
  const taskState = ensureRunTaskState(run)
  const startedAt = toTimestamp(taskState.generatingStartedAt ?? taskState.waitingStartedAt ?? run.createdAt)
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

export function formatElapsedDuration(elapsedMs: number): string {
  if (elapsedMs < 60_000) {
    const seconds = Math.max(1, Math.round(elapsedMs / 1000))
    return `${seconds}s`
  }

  const totalSeconds = Math.round(elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

export function getRunElapsedLabel(run: Run, now?: string | number | Date): string | null {
  const elapsedMs = getRunElapsedMs(run, now)
  return elapsedMs === null ? null : formatElapsedDuration(elapsedMs)
}

export function getImageTaskElapsedMs(task: Pick<ImageTask, 'startedAt' | 'queuedAt' | 'completedAt'>, now?: string | number | Date): number | null {
  const startedAt = toTimestamp(task.startedAt ?? task.queuedAt)
  if (startedAt === null) {
    return null
  }

  const endedAt = (
    toTimestamp(task.completedAt)
    ?? resolveNowTimestamp(now)
  )

  if (endedAt === null) {
    return null
  }

  return Math.max(0, endedAt - startedAt)
}

export function getImageTaskElapsedLabel(task: Pick<ImageTask, 'startedAt' | 'queuedAt' | 'completedAt'>, now?: string | number | Date): string | null {
  const elapsedMs = getImageTaskElapsedMs(task, now)
  return elapsedMs === null ? null : formatElapsedDuration(elapsedMs)
}

export function getImageElapsedMs(
  image: Pick<ImageItem, 'queuedAt' | 'startedAt' | 'completedAt' | 'pendingStartedAt'>,
  now?: string | number | Date,
): number | null {
  const startedAt = toTimestamp(image.startedAt ?? image.pendingStartedAt ?? image.queuedAt)
  if (startedAt === null) {
    return null
  }

  const endedAt = (
    toTimestamp(image.completedAt)
    ?? resolveNowTimestamp(now)
  )

  if (endedAt === null) {
    return null
  }

  return Math.max(0, endedAt - startedAt)
}

export function getImageElapsedLabel(
  image: Pick<ImageItem, 'queuedAt' | 'startedAt' | 'completedAt' | 'pendingStartedAt'>,
  now?: string | number | Date,
): string | null {
  const elapsedMs = getImageElapsedMs(image, now)
  return elapsedMs === null ? null : formatElapsedDuration(elapsedMs)
}

export function getResolvedImageElapsedMs(
  image: Pick<ImageItem, 'queuedAt' | 'startedAt' | 'completedAt' | 'pendingStartedAt'>,
  task?: Pick<ImageTask, 'startedAt' | 'queuedAt' | 'completedAt'>,
  now?: string | number | Date,
): number | null {
  const taskElapsedMs = task ? getImageTaskElapsedMs(task, now) : null
  if (taskElapsedMs !== null) {
    return taskElapsedMs
  }

  return getImageElapsedMs(image, now)
}

export function getResolvedImageElapsedLabel(
  image: Pick<ImageItem, 'queuedAt' | 'startedAt' | 'completedAt' | 'pendingStartedAt'>,
  task?: Pick<ImageTask, 'startedAt' | 'queuedAt' | 'completedAt'>,
  now?: string | number | Date,
): string | null {
  const elapsedMs = getResolvedImageElapsedMs(image, task, now)
  return elapsedMs === null ? null : formatElapsedDuration(elapsedMs)
}

export function getPendingImageElapsedMs(
  image: Pick<ImageItem, 'queuedAt' | 'startedAt' | 'completedAt' | 'pendingStartedAt'>,
  task?: Pick<ImageTask, 'startedAt' | 'queuedAt' | 'completedAt'>,
  now?: string | number | Date,
): number | null {
  const taskElapsedMs = task ? getImageTaskElapsedMs(task, now) : null
  if (taskElapsedMs !== null) {
    return taskElapsedMs
  }

  return getImageElapsedMs({
    queuedAt: image.queuedAt,
    startedAt: image.startedAt,
    completedAt: undefined,
    pendingStartedAt: image.pendingStartedAt,
  }, now)
}

export function getPendingImageElapsedLabel(
  image: Pick<ImageItem, 'queuedAt' | 'startedAt' | 'completedAt' | 'pendingStartedAt'>,
  task?: Pick<ImageTask, 'startedAt' | 'queuedAt' | 'completedAt'>,
  now?: string | number | Date,
): string | null {
  const elapsedMs = getPendingImageElapsedMs(image, task, now)
  return elapsedMs === null ? null : formatElapsedDuration(elapsedMs)
}
