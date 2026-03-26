import type { Conversation } from '../../../../../types/conversation'

export function collectConversationAssetKeys(conversation: Conversation): string[] {
  const keys = new Set<string>()

  for (const message of conversation.messages) {
    for (const sourceImage of message.sourceImages ?? []) {
      if (sourceImage.assetKey.trim()) {
        keys.add(sourceImage.assetKey)
      }
    }

    for (const run of message.runs ?? []) {
      for (const sourceImage of run.sourceImages ?? []) {
        if (sourceImage.assetKey.trim()) {
          keys.add(sourceImage.assetKey)
        }
      }

      for (const image of run.images) {
        if (image.refKind === 'idb-blob' && image.refKey?.trim()) {
          keys.add(image.refKey)
        }
      }
    }
  }

  return Array.from(keys)
}
