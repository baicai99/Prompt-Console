import type { ImageTask, ImageTaskStatus } from '../../../types/conversation'

const SETTLED_IMAGE_TASK_STATUSES = new Set<ImageTaskStatus>([
  'succeeded',
  'failed',
  'timeout',
  'cancelled',
])

export function isSettledImageTaskStatus(status: ImageTaskStatus | undefined | null): boolean {
  return Boolean(status && SETTLED_IMAGE_TASK_STATUSES.has(status))
}

export function isActiveImageTask(task: Pick<ImageTask, 'status'> | null | undefined): boolean {
  return Boolean(task && !isSettledImageTaskStatus(task.status))
}

export function filterActiveImageTasksRecord(
  tasksById: Record<string, ImageTask> | undefined,
): Record<string, ImageTask> {
  if (!tasksById) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(tasksById).filter(([, task]) => isActiveImageTask(task)),
  )
}
