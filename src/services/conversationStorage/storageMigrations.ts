import { DEFAULT_CONVERSATION_TITLE } from '../../utils/chat'
import {
  EMPTY_ACTIVE_CONVERSATION_SENTINEL,
  STORAGE_ACTIVE_KEY,
  STORAGE_CONTENT_PREFIX,
  STORAGE_INDEX_KEY,
  MAX_CONVERSATION_PAYLOAD_CHARS,
} from './constants'
import {
  idbClearConversationRecords,
  idbDeleteConversationRecord,
  idbGetConversationRecord,
  idbSetConversationRecord,
  canUseIndexedDb,
} from './contentDb'
import {
  compactConversationHistory,
  compactedConversationForLimit,
  contentStorageKey,
  safeParseConversation,
} from './conversationContentCodec'
import type { Conversation, ConversationSummary } from '../../types/conversation'

export function loadConversationIndexFromStorage(): {
  summaries: ConversationSummary[]
  activeId: string | null
} {
  try {
    const rawIndex = localStorage.getItem(STORAGE_INDEX_KEY)
    const rawActiveId = localStorage.getItem(STORAGE_ACTIVE_KEY)

    if (!rawIndex) {
      return { summaries: [], activeId: null }
    }

    const parsedIndex = JSON.parse(rawIndex) as ConversationSummary[]
    const summaries = parsedIndex.filter((item) => typeof item.id === 'string')
    const summaryIds = new Set(summaries.map((item) => item.id))
    if (rawActiveId === EMPTY_ACTIVE_CONVERSATION_SENTINEL || rawActiveId === '') {
      return { summaries, activeId: null }
    }

    const activeId =
      rawActiveId === null ? summaries[0]?.id ?? null : summaryIds.has(rawActiveId) ? rawActiveId : summaries[0]?.id ?? null
    return { summaries, activeId }
  } catch {
    return { summaries: [], activeId: null }
  }
}

export function saveIndex(summaries: ConversationSummary[]): void {
  localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(summaries))
}

export function saveActiveConversationId(conversationId: string | null): void {
  if (conversationId === null) {
    localStorage.setItem(STORAGE_ACTIVE_KEY, EMPTY_ACTIVE_CONVERSATION_SENTINEL)
    return
  }
  localStorage.setItem(STORAGE_ACTIVE_KEY, conversationId)
}

export async function clearConversationsFromStorage(): Promise<void> {
  localStorage.removeItem(STORAGE_INDEX_KEY)
  localStorage.removeItem(STORAGE_ACTIVE_KEY)

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (key && key.startsWith(STORAGE_CONTENT_PREFIX)) {
      localStorage.removeItem(key)
    }
  }

  await idbClearConversationRecords()
}

export async function removeConversationContentFromStorage(conversationId: string): Promise<void> {
  localStorage.removeItem(contentStorageKey(conversationId))
  await idbDeleteConversationRecord(conversationId)
}

export async function loadConversationContentById(
  conversationId: string,
  fallbackTitle = DEFAULT_CONVERSATION_TITLE,
): Promise<Conversation | null> {
  const idbRecord = await idbGetConversationRecord(conversationId)
  if (idbRecord?.payload) {
    return safeParseConversation(idbRecord.payload, fallbackTitle)
  }

  const legacyRaw = localStorage.getItem(contentStorageKey(conversationId))
  if (!legacyRaw) {
    return null
  }

  const parsed = safeParseConversation(legacyRaw, fallbackTitle)
  if (!parsed) {
    return null
  }

  void idbSetConversationRecord({
    id: conversationId,
    payload: legacyRaw,
    updatedAt: parsed.updatedAt,
  }).then(() => {
    localStorage.removeItem(contentStorageKey(conversationId))
  })

  return parsed
}

export async function saveConversationContent(conversation: Conversation): Promise<void> {
  const sanitizedConversation = conversation.memoryState
    ? {
        ...conversation,
        memoryState: undefined,
      }
    : conversation
  const rawCompacted = JSON.stringify(sanitizedConversation)
  const persistedRaw =
    rawCompacted.length <= MAX_CONVERSATION_PAYLOAD_CHARS
      ? rawCompacted
      : JSON.stringify(compactedConversationForLimit(compactConversationHistory(sanitizedConversation)))

  if (!canUseIndexedDb()) {
    localStorage.setItem(contentStorageKey(conversation.id), persistedRaw)
    return
  }

  await idbSetConversationRecord({
    id: conversation.id,
    payload: persistedRaw,
    updatedAt: conversation.updatedAt,
  })
}

export async function migrateLegacyConversationContent(summaryIds: string[]): Promise<void> {
  if (!canUseIndexedDb()) {
    return
  }

  const tasks: Promise<void>[] = []
  for (const conversationId of summaryIds) {
    const raw = localStorage.getItem(contentStorageKey(conversationId))
    if (!raw) {
      continue
    }

    tasks.push(
      idbSetConversationRecord({
        id: conversationId,
        payload: raw,
        updatedAt: new Date().toISOString(),
      }).then(() => {
        localStorage.removeItem(contentStorageKey(conversationId))
      }),
    )
  }

  await Promise.all(tasks)
}
