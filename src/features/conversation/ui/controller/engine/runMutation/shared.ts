import type { ImageTask, Run } from '../../../../../../types/conversation'

export function mergeOptionalValue<T>(current: T | undefined, next: T | undefined): T | undefined {
  return typeof next === 'undefined' ? current : next
}

export function resolveMirroredTaskStatus(input: {
  currentTask?: ImageTask
  nextImageStatus: 'pending' | 'success' | 'failed'
  nextImageErrorCode?: Run['images'][number]['errorCode']
}): ImageTask['status'] {
  if (input.nextImageStatus === 'success') {
    return 'succeeded'
  }
  if (input.nextImageStatus === 'failed') {
    if (input.nextImageErrorCode === 'timeout') {
      return 'timeout'
    }
    if (input.nextImageErrorCode === 'cancelled') {
      return 'cancelled'
    }
    return 'failed'
  }

  if (input.currentTask?.status) {
    return input.currentTask.status
  }
  return 'submitting'
}

export function findTaskForRunImage(input: {
  taskRegistry: Record<string, ImageTask>
  run: Run
  runId: string
  seq: number
}): ImageTask | undefined {
  for (const taskId of input.run.taskIds ?? []) {
    const task = input.taskRegistry[taskId]
    if (task?.runId === input.runId && task.seq === input.seq) {
      return task
    }
  }

  return Object.values(input.taskRegistry).find((task) => task.runId === input.runId && task.seq === input.seq)
}
