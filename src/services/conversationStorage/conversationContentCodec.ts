import type { Conversation, Message } from '../../types/conversation'
import { DEFAULT_CONVERSATION_TITLE, normalizeConversationTitleMode } from '../../utils/chat'
import { compactConversationImages } from '../../utils/conversationCompaction'
import {
  KEEP_FULL_IMAGE_RECENT_MESSAGE_COUNT,
  STORAGE_CONTENT_PREFIX,
} from './constants'

export function resolveConversationTitle(title: string | undefined, fallbackTitle: string): string {
  const existingTitle = title?.trim()
  const normalizedFallbackTitle = fallbackTitle.trim()

  if (existingTitle && existingTitle !== DEFAULT_CONVERSATION_TITLE) {
    return existingTitle
  }

  if (normalizedFallbackTitle && normalizedFallbackTitle !== DEFAULT_CONVERSATION_TITLE) {
    return normalizedFallbackTitle
  }

  if (existingTitle) {
    return existingTitle
  }

  return normalizedFallbackTitle || DEFAULT_CONVERSATION_TITLE
}

export function normalizeConversationMessages(messages: Message[] | undefined): Message[] {
  if (!Array.isArray(messages)) {
    return []
  }

  return messages.map((message) => ({
    ...message,
    titleEligible:
      message.role === 'user' ? (typeof message.titleEligible === 'boolean' ? message.titleEligible : true) : undefined,
  }))
}

export function contentStorageKey(conversationId: string): string {
  return `${STORAGE_CONTENT_PREFIX}${conversationId}`
}

export function compactConversationHistory(conversation: Conversation): Conversation {
  return compactConversationImages(conversation, {
    retainedMessageCount: KEEP_FULL_IMAGE_RECENT_MESSAGE_COUNT,
  })
}

export function compactedConversationForLimit(conversation: Conversation): Conversation {
  return compactConversationImages(conversation, {
    retainedMessageCount: 8,
  })
}

export function safeParseConversation(raw: string, fallbackTitle = DEFAULT_CONVERSATION_TITLE): Conversation | null {
  try {
    const parsed = JSON.parse(raw) as Conversation & { titleMode?: Conversation['titleMode'] }
    if (!parsed?.id) {
      return null
    }

    const persistedTitle = parsed.title?.trim() || ''
    const resolvedTitle = resolveConversationTitle(parsed.title, fallbackTitle)
    const resolvedTitleMode =
      resolvedTitle !== persistedTitle
        ? normalizeConversationTitleMode(undefined, resolvedTitle)
        : normalizeConversationTitleMode(parsed.titleMode, resolvedTitle)

    return {
      ...parsed,
      title: resolvedTitle,
      titleMode: resolvedTitleMode,
      messages: normalizeConversationMessages(parsed.messages),
    }
  } catch {
    return null
  }
}
