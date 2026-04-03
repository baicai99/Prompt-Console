import { makeImageTaskId, type PersistedImageTask } from '../../../../services/imageTaskStore'
import type { Conversation, ImageTask, Message, Run, Side } from '../../../../types/conversation'

export interface RunLocation {
  messageIndex: number
  runIndex: number
}

export interface ResumableImageEntry {
  task: ImageTask
  run: Run
  image: Run['images'][number]
  images: Run['images'][number][]
}

export function collectRuns(conversation: Conversation): Run[] {
  return conversation.messages.flatMap((message) => message.runs ?? [])
}

export function findRunById(conversation: Conversation, runId: string): Run | null {
  return collectRuns(conversation).find((run) => run.id === runId) ?? null
}

export function findRunMessageId(conversation: Conversation, runId: string): string | null {
  for (const message of conversation.messages) {
    if (message.role !== 'assistant') {
      continue
    }
    if ((message.runs ?? []).some((run) => run.id === runId)) {
      return message.id
    }
  }
  return null
}

export function buildRunLocationIndex(conversation: Conversation): Map<string, RunLocation> {
  const nextMap = new Map<string, RunLocation>()
  for (let messageIndex = 0; messageIndex < conversation.messages.length; messageIndex += 1) {
    const runs = conversation.messages[messageIndex].runs ?? []
    for (let runIndex = 0; runIndex < runs.length; runIndex += 1) {
      nextMap.set(runs[runIndex].id, { messageIndex, runIndex })
    }
  }
  return nextMap
}

export function collectPendingImageTasks(conversation: Conversation): PersistedImageTask[] {
  return collectRuns(conversation).flatMap((run) =>
    run.images
      .filter((image) => image.status === 'pending' && Boolean(image.serverTaskId || image.serverTaskMeta))
      .map((image) => ({
        id: makeImageTaskId(conversation.id, run.id, image.id),
        conversationId: conversation.id,
        runId: run.id,
        imageId: image.id,
        seq: image.seq,
        channelId: run.channelId,
        serverTaskId: image.serverTaskId,
        serverTaskMeta: image.serverTaskMeta,
        createdAt: run.createdAt,
        updatedAt: image.lastResumeAttemptAt ?? image.detachedAt ?? conversation.updatedAt,
      })),
  )
}

export function buildFairResumableImageQueue(
  conversation: Conversation,
  runtimeTasksById: Record<string, ImageTask> | undefined,
  toEpoch: (value: string | null | undefined) => number,
): ResumableImageEntry[] {
  const runById = new Map(collectRuns(conversation).map((run) => [run.id, run] as const))

  return Object.values(runtimeTasksById ?? conversation.tasksById ?? {})
    .filter((task) =>
      (task.status === 'running' || task.status === 'polling')
      && Boolean(task.serverTaskId || task.serverTaskMeta),
    )
    .map((task) => {
      const run = runById.get(task.runId)
      if (!run) {
        return null
      }
      const targetSeqs = Array.isArray(task.imageSeqs) && task.imageSeqs.length > 0 ? task.imageSeqs : [task.seq]
      const images = targetSeqs
        .map((seq) => run.images.find((entry) => entry.seq === seq))
        .filter((image): image is Run['images'][number] => Boolean(image))
        .filter((image) => image.status === 'pending')
      const image = images[0]
      if (!image || images.length === 0) {
        return null
      }
      return { task, run, image, images } satisfies ResumableImageEntry
    })
    .filter((entry): entry is ResumableImageEntry => Boolean(entry))
    .sort((left, right) => {
      const leftStarted = toEpoch(left.task.startedAt ?? left.task.queuedAt)
      const rightStarted = toEpoch(right.task.startedAt ?? right.task.queuedAt)
      return leftStarted - rightStarted
    })
}

export function getRunsForSide(message: Message, sideView: Side): Run[] {
  if (sideView === 'single') {
    return (message.runs ?? []).filter((run) => run.sideMode === 'single' && run.side === 'single')
  }
  return (message.runs ?? []).filter((run) => run.sideMode === 'multi' && run.side === sideView)
}
