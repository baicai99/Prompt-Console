import { MESSAGE_HISTORY_PAGE_SIZE } from '../../../application/queries/conversationView'
import type { LoadOlderMessagesHandlerInput } from './types'

export function createLoadOlderMessagesHandler(input: LoadOlderMessagesHandlerInput) {
  return async () => {
    const activeConversationId = input.stateRef.current.activeId
    if (!activeConversationId) {
      return
    }

    const nextLimit = input.historyVisibleLimitRef.current + MESSAGE_HISTORY_PAGE_SIZE
    const activeConversationSnapshot = input.stateRef.current.contents[activeConversationId] ?? null
    const hydratedMessageCount =
      activeConversationSnapshot?.memoryState?.hydratedMessageCount ?? activeConversationSnapshot?.messages.length ?? 0
    const shouldHydrate = Boolean(activeConversationSnapshot?.memoryState?.isCompacted) && nextLimit > hydratedMessageCount

    input.setIsLoadingOlderMessages(true)
    try {
      if (shouldHydrate) {
        await input.hydrateConversationHistory(activeConversationId, nextLimit)
      } else {
        await input.ensureConversationLoaded(activeConversationId)
      }
      input.setHistoryVisibleLimit(nextLimit)
    } finally {
      input.setIsLoadingOlderMessages(false)
    }
  }
}
