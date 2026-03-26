import type { Conversation, ConversationSummary, Run } from '../../../../types/conversation'
import { normalizeConversationTitleMode, toSummary } from '../../../../utils/chat'

export const PROGRESS_PERSIST_DEBOUNCE_MS = 250
export const MESSAGE_HISTORY_INITIAL_LIMIT = 60
export const MESSAGE_HISTORY_PAGE_SIZE = 50
export const MAX_IN_MEMORY_CONVERSATIONS = 5

export function toEpoch(value: string | null | undefined): number {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 0
  }
  const epoch = Date.parse(value)
  return Number.isFinite(epoch) ? epoch : 0
}

function getConversationLastMessageEpoch(conversation: Conversation | undefined): number {
  if (!conversation) {
    return 0
  }

  const lastMessageEpoch = conversation.messages.reduce((maxEpoch, message) => {
    const messageEpoch = toEpoch(message.createdAt)
    return messageEpoch > maxEpoch ? messageEpoch : maxEpoch
  }, 0)
  if (lastMessageEpoch > 0) {
    return lastMessageEpoch
  }
  return toEpoch(conversation.updatedAt)
}

export function conversationHasActiveImageThreads(conversation: Conversation | null | undefined): boolean {
  if (!conversation) {
    return false
  }

  return conversation.messages.some((message) =>
    (message.runs ?? []).some((run) =>
      run.images.some((image) => image.status === 'pending' && image.threadState === 'active'),
    ),
  )
}

export function getRunCompletionStats(run: Run): { pendingCount: number; successCount: number; failedCount: number } {
  return run.images.reduce(
    (acc, image) => {
      if (image.status === 'pending') {
        acc.pendingCount += 1
      } else if (image.status === 'success') {
        acc.successCount += 1
      } else {
        acc.failedCount += 1
      }
      return acc
    },
    { pendingCount: 0, successCount: 0, failedCount: 0 },
  )
}

export function sortConversationSummariesByLastMessageTime(
  summaries: ConversationSummary[],
  contents: Record<string, Conversation>,
): ConversationSummary[] {
  return [...summaries]
    .map((summary, index) => ({
      summary,
      index,
      pinnedEpoch: Math.max(toEpoch(summary.pinnedAt), toEpoch(contents[summary.id]?.pinnedAt)),
      lastMessageEpoch: Math.max(
        getConversationLastMessageEpoch(contents[summary.id]),
        toEpoch(summary.updatedAt),
        toEpoch(summary.createdAt),
      ),
      createdAtEpoch: toEpoch(summary.createdAt),
    }))
    .sort((left, right) => {
      const leftPinned = left.pinnedEpoch > 0
      const rightPinned = right.pinnedEpoch > 0
      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1
      }
      if (leftPinned && rightPinned && right.pinnedEpoch !== left.pinnedEpoch) {
        return right.pinnedEpoch - left.pinnedEpoch
      }
      if (left.lastMessageEpoch !== right.lastMessageEpoch) {
        return right.lastMessageEpoch - left.lastMessageEpoch
      }
      if (left.createdAtEpoch !== right.createdAtEpoch) {
        return right.createdAtEpoch - left.createdAtEpoch
      }
      return left.index - right.index
    })
    .map((item) => item.summary)
}

export function upsertConversationState(
  summaries: ConversationSummary[],
  contents: Record<string, Conversation>,
  conversation: Conversation,
  activeId: string | null,
  lruOrder: string[],
): { nextSummaries: ConversationSummary[]; nextContents: Record<string, Conversation> } {
  const existingSummary = summaries.find((item) => item.id === conversation.id)
  const resolvedConversation =
    existingSummary?.title?.trim()
    && existingSummary.title !== conversation.title
    && conversation.titleMode === 'default'
      ? {
          ...conversation,
          title: existingSummary.title,
          titleMode: normalizeConversationTitleMode(undefined, existingSummary.title),
        }
      : conversation
  const cachedIds = [conversation.id, ...lruOrder.filter((id) => id !== conversation.id)]
  const keepIds = new Set(cachedIds.slice(0, MAX_IN_MEMORY_CONVERSATIONS))
  if (activeId) {
    keepIds.add(activeId)
  }

  const nextContents = {
    ...contents,
    [conversation.id]: resolvedConversation,
  }
  for (const existingId of Object.keys(nextContents)) {
    if (!keepIds.has(existingId)) {
      delete nextContents[existingId]
    }
  }

  const summary = toSummary(resolvedConversation)
  const hasExisting = Boolean(existingSummary)
  const nextSummaries = hasExisting
    ? summaries.map((item) => (item.id === conversation.id ? summary : item))
    : [summary, ...summaries]

  return { nextSummaries, nextContents }
}
