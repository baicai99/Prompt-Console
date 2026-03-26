import type { ImageTask } from '../../../../types/conversation'

interface ImageTasksByRunIdInput {
  runtimeTasks?: Record<string, ImageTask>
  conversationTasks?: Record<string, ImageTask>
}

export function buildImageTasksByRunId(input: ImageTasksByRunIdInput): Record<string, Record<number, ImageTask>> {
  const source = input.runtimeTasks ?? input.conversationTasks ?? {}
  return Object.values(source).reduce<Record<string, Record<number, ImageTask>>>((acc, task) => {
    if (!task?.runId || typeof task.seq !== 'number') {
      return acc
    }
    const runBucket = acc[task.runId] ?? {}
    runBucket[task.seq] = task
    acc[task.runId] = runBucket
    return acc
  }, {})
}
