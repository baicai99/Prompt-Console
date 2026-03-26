import type { Conversation } from '../types/conversation'

interface CompactConversationImagesOptions {
  retainedMessageCount: number
  includeMemoryState?: boolean
}

export function compactConversationImages(
  conversation: Conversation,
  options: CompactConversationImagesOptions,
): Conversation {
  const normalizedRetainedCount = Math.max(1, Math.floor(options.retainedMessageCount))
  const cutoffIndex = Math.max(0, conversation.messages.length - normalizedRetainedCount)

  if (cutoffIndex <= 0) {
    if (!options.includeMemoryState) {
      return conversation
    }
    return {
      ...conversation,
      memoryState: {
        isCompacted: false,
        hydratedMessageCount: conversation.messages.length,
        totalMessageCount: conversation.messages.length,
      },
    }
  }

  const compacted: Conversation = {
    ...conversation,
    messages: conversation.messages.map((message, index) => {
      if (index >= cutoffIndex || !Array.isArray(message.runs) || message.runs.length === 0) {
        return message
      }

      return {
        ...message,
        runs: message.runs.map((run) => ({
          ...run,
          images: run.images.map((image) => {
            if (image.refKind === 'idb-blob') {
              return {
                ...image,
                thumbRef: undefined,
                fullRef: undefined,
                fileRef: undefined,
                refKey: image.refKey,
                refKind: image.refKind,
              }
            }
            const thumbRef = image.thumbRef ?? image.fileRef
            return {
              ...image,
              thumbRef,
              fullRef: undefined,
              fileRef: thumbRef,
              refKey: image.refKey,
              refKind: image.refKind,
            }
          }),
        })),
      }
    }),
  }

  if (!options.includeMemoryState) {
    return compacted
  }

  return {
    ...compacted,
    memoryState: {
      isCompacted: true,
      hydratedMessageCount: normalizedRetainedCount,
      totalMessageCount: conversation.messages.length,
    },
  }
}
