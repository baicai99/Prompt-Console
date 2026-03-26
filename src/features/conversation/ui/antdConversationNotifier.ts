import type { ConversationNotifier } from '../application/conversationNotifier'
import { createAntdFeedback } from './antdFeedback'

export function createAntdConversationNotifier(): ConversationNotifier {
  const feedback = createAntdFeedback()
  return {
    info(content) {
      feedback.info(content)
    },
    success(content) {
      feedback.success(content)
    },
    warning(content) {
      feedback.warning(content)
    },
    error(content) {
      feedback.error(content)
    },
    notify(input) {
      feedback.notify(input)
    },
  }
}
