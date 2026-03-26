import type { CancelMessageRunsHandlerInput } from './types'

export function createCancelMessageRunsHandler(input: CancelMessageRunsHandlerInput) {
  return async (conversationId: string, messageId: string, runIds: string[]) => {
    const snapshot = input.stateRef.current
    const conversation = snapshot.contents[conversationId]
    if (!conversation) {
      return
    }

    const message = conversation.messages.find((item) => item.id === messageId)
    if (!message || message.role !== 'assistant') {
      return
    }

    const normalizedRunIds = Array.from(new Set(runIds)).filter((runId) =>
      (message.runs ?? []).some((run) => run.id === runId),
    )
    if (normalizedRunIds.length === 0) {
      return
    }

    input.abortRuns(conversationId, normalizedRunIds)
    input.cancelMessageRunsInConversation(conversationId, messageId, normalizedRunIds, { reason: 'message-aborted' })
  }
}
