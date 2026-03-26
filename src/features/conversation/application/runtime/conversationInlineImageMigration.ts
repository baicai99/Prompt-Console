import type { Conversation, ImageTask, Message, Run } from '../../../../types/conversation'
import { createImageResultReferenceStore, isInlineImagePayload } from '../imageResultReferenceStore'

interface ConversationInlineImageMigrationInput {
  fetchFn?: typeof fetch
  putImageBlobFn?: (key: string, blob: Blob) => Promise<void>
}

interface MigratableImageRef {
  fileRef?: string
  thumbRef?: string
  fullRef?: string
  refKind?: string
  refKey?: string
  bytes?: number
}

function getInlineImageSource(input: MigratableImageRef): string | null {
  const candidates = [
    input.fullRef,
    input.fileRef,
    input.thumbRef,
    input.refKind === 'inline' ? input.refKey : undefined,
  ]
  return candidates.find((value) => isInlineImagePayload(value)) ?? null
}

export async function migrateConversationInlineImages(
  conversation: Conversation,
  input: ConversationInlineImageMigrationInput = {},
): Promise<{ conversation: Conversation; changed: boolean }> {
  const imageResultReferenceStore = createImageResultReferenceStore({
    fetchFn: input.fetchFn,
    putImageBlobFn: input.putImageBlobFn,
  })
  const persistedBySrc = new Map<string, ReturnType<typeof imageResultReferenceStore.persistImageResultSource>>()
  let changed = false

  const persistInlineSource = (src: string, seq?: number) => {
    const existing = persistedBySrc.get(src)
    if (existing) {
      return existing
    }

    const task = imageResultReferenceStore.persistImageResultSource(src, {
      traceId: conversation.id,
      seq,
    })
    persistedBySrc.set(src, task)
    return task
  }

  const migrateImage = async <T extends MigratableImageRef & { seq?: number }>(image: T): Promise<T> => {
    const inlineSrc = getInlineImageSource(image)
    if (!inlineSrc) {
      return image
    }

    const persisted = await persistInlineSource(inlineSrc, image.seq)
    changed = true
    return {
      ...image,
      fileRef: persisted.fileRef,
      thumbRef: persisted.thumbRef,
      fullRef: persisted.fullRef,
      refKind: persisted.refKind,
      refKey: persisted.refKey,
      bytes: persisted.bytes ?? image.bytes,
    }
  }

  const nextMessages: Message[] = []
  for (const message of conversation.messages) {
    if (!message.runs?.length) {
      nextMessages.push(message)
      continue
    }

    const nextRuns: Run[] = []
    for (const run of message.runs) {
      const nextImages = await Promise.all(run.images.map((image) => migrateImage(image)))
      nextRuns.push({
        ...run,
        images: nextImages,
      })
    }

    nextMessages.push({
      ...message,
      runs: nextRuns,
    })
  }

  const nextTasksEntries = await Promise.all(
    Object.entries(conversation.tasksById ?? {}).map(async ([taskId, task]) => {
      const nextTask = await migrateImage(task)
      return [taskId, nextTask] as const
    }),
  )
  const nextTasksById = Object.fromEntries(nextTasksEntries) as Record<string, ImageTask>

  if (!changed) {
    return { conversation, changed: false }
  }

  return {
    conversation: {
      ...conversation,
      messages: nextMessages,
      tasksById: Object.keys(nextTasksById).length > 0 ? nextTasksById : undefined,
    },
    changed: true,
  }
}
