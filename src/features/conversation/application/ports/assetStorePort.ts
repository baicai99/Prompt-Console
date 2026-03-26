import * as imageAssetStore from '../../../../services/imageAssetStore'

export interface ConversationAssetStorePort {
  getImageBlob: typeof imageAssetStore.getImageBlob
  putImageBlob: typeof imageAssetStore.putImageBlob
  deleteImageBlob: typeof imageAssetStore.deleteImageBlob
  clearImageBlobs: typeof imageAssetStore.clearImageBlobs
}

export function createConversationAssetStorePort(
  overrides: Partial<ConversationAssetStorePort> = {},
): ConversationAssetStorePort {
  return {
    getImageBlob: overrides.getImageBlob ?? ((...args) => imageAssetStore.getImageBlob(...args)),
    putImageBlob: overrides.putImageBlob ?? ((...args) => imageAssetStore.putImageBlob(...args)),
    deleteImageBlob: overrides.deleteImageBlob ?? ((...args) => imageAssetStore.deleteImageBlob(...args)),
    clearImageBlobs: overrides.clearImageBlobs ?? (() => imageAssetStore.clearImageBlobs()),
  }
}

export const conversationAssetStorePort = createConversationAssetStorePort()
