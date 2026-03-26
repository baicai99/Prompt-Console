import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Message } from '../../../../../types/conversation'

const HISTORY_NAV_CONTEXT_MESSAGE_COUNT = 4
const HISTORY_NAV_SNIPPET_LIMIT = 96
const HISTORY_NAV_HIGHLIGHT_MS = 2200

export interface HistoryNavigatorItem {
  messageId: string
  sequence: number
  snippet: string
}

interface MessageListNavigatorVirtualizer {
  scrollToIndex: (index: number, options?: { align?: 'auto' | 'start' | 'center' | 'end' }) => void
}

interface UseMessageHistoryNavigatorInput {
  conversationId: string | null | undefined
  messages: Message[]
  historyMessages: Message[]
  historyStartIndex: number
  renderableHistoryMessages: Message[]
  messageIndexById: Map<string, number>
  autoScrollTrigger?: number
  assistantAutoScrollTrigger?: number
  assistantAutoScrollMessageId?: string | null
  isLoadingOlderMessages: boolean
  onLoadOlderMessages?: () => void | Promise<void>
  rowVirtualizer: MessageListNavigatorVirtualizer
  contentRef: RefObject<HTMLDivElement | null>
}

function buildHistoryNavigatorSnippet(message: Message): string {
  const normalizedContent = message.content.trim().replace(/\s+/g, ' ')
  const sourceImageCount = message.sourceImages?.length ?? 0

  if (!normalizedContent) {
    return sourceImageCount > 0 ? `已发送 ${sourceImageCount} 张参考图` : '空白输入'
  }

  const truncatedContent = normalizedContent.length > HISTORY_NAV_SNIPPET_LIMIT
    ? `${normalizedContent.slice(0, HISTORY_NAV_SNIPPET_LIMIT).trimEnd()}…`
    : normalizedContent

  if (sourceImageCount === 0) {
    return truncatedContent
  }

  return `${truncatedContent} · ${sourceImageCount} 张参考图`
}

export function useMessageHistoryNavigator(input: UseMessageHistoryNavigatorInput) {
  const {
    assistantAutoScrollMessageId,
    assistantAutoScrollTrigger,
    autoScrollTrigger,
    contentRef,
    conversationId,
    historyMessages,
    historyStartIndex,
    isLoadingOlderMessages,
    messageIndexById,
    messages,
    onLoadOlderMessages,
    renderableHistoryMessages,
    rowVirtualizer,
  } = input
  const [isHistoryNavigatorOpen, setIsHistoryNavigatorOpen] = useState(false)
  const [historyNavigationAnchorMessageId, setHistoryNavigationAnchorMessageId] = useState<string | null>(null)
  const [pendingHistoryNavigationMessageId, setPendingHistoryNavigationMessageId] = useState<string | null>(null)
  const [highlightedHistoryMessageId, setHighlightedHistoryMessageId] = useState<string | null>(null)
  const previousAssistantAutoScrollTriggerRef = useRef<number | undefined>(assistantAutoScrollTrigger)

  const historyNavigatorItems = useMemo<HistoryNavigatorItem[]>(
    () =>
      messages.reduce<HistoryNavigatorItem[]>((items, message) => {
        if (message.role !== 'user') {
          return items
        }

        items.push({
          messageId: message.id,
          sequence: items.length + 1,
          snippet: buildHistoryNavigatorSnippet(message),
        })
        return items
      }, []),
    [messages],
  )
  const historyNavigationAnchorIndex = useMemo(() => {
    if (!historyNavigationAnchorMessageId) {
      return -1
    }
    return historyMessages.findIndex((message) => message.id === historyNavigationAnchorMessageId)
  }, [historyMessages, historyNavigationAnchorMessageId])
  const hasHistoryNavigatorEntries = historyNavigatorItems.length > 0

  const handleHistoryNavigatorOpenChange = useCallback((open: boolean) => {
    setIsHistoryNavigatorOpen(open)
  }, [])

  const handleNavigateToHistoryMessage = useCallback((messageId: string) => {
    setIsHistoryNavigatorOpen(false)
    setHistoryNavigationAnchorMessageId(messageId)
    setPendingHistoryNavigationMessageId(messageId)
    setHighlightedHistoryMessageId(null)
  }, [])

  useEffect(() => {
    setIsHistoryNavigatorOpen(false)
    setHistoryNavigationAnchorMessageId(null)
    setPendingHistoryNavigationMessageId(null)
    setHighlightedHistoryMessageId(null)
  }, [conversationId])

  useEffect(() => {
    if (typeof autoScrollTrigger === 'undefined') {
      return
    }

    setHistoryNavigationAnchorMessageId(null)
    setPendingHistoryNavigationMessageId(null)
    setHighlightedHistoryMessageId(null)
  }, [autoScrollTrigger])

  useEffect(() => {
    if (typeof assistantAutoScrollTrigger === 'undefined') {
      previousAssistantAutoScrollTriggerRef.current = assistantAutoScrollTrigger
      return
    }

    const previousTrigger = previousAssistantAutoScrollTriggerRef.current
    previousAssistantAutoScrollTriggerRef.current = assistantAutoScrollTrigger
    if (previousTrigger === assistantAutoScrollTrigger) {
      return
    }

    setHistoryNavigationAnchorMessageId(null)
    setPendingHistoryNavigationMessageId(null)
    setHighlightedHistoryMessageId(null)

    if (!assistantAutoScrollMessageId) {
      return
    }

    const targetRenderableIndex = renderableHistoryMessages.findIndex((message) => message.id === assistantAutoScrollMessageId)
    if (targetRenderableIndex < 0) {
      return
    }

    rowVirtualizer.scrollToIndex(targetRenderableIndex, { align: 'start' })

    let frameId: number | null = null
    let remainingAttempts = 3

    const alignAssistantBubble = () => {
      const rowNode = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? [])
        .find((node) => node.dataset.messageId === assistantAutoScrollMessageId)
      const targetNode = rowNode?.querySelector<HTMLElement>('.message-card-shell.assistant') ?? rowNode
      if (targetNode) {
        targetNode.scrollIntoView({ block: 'start', behavior: 'smooth' })
        return
      }

      remainingAttempts -= 1
      if (remainingAttempts <= 0) {
        return
      }

      frameId = window.requestAnimationFrame(alignAssistantBubble)
    }

    frameId = window.requestAnimationFrame(alignAssistantBubble)
    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [
    assistantAutoScrollMessageId,
    assistantAutoScrollTrigger,
    contentRef,
    renderableHistoryMessages,
    rowVirtualizer,
  ])

  useEffect(() => {
    if (!pendingHistoryNavigationMessageId) {
      return
    }

    const targetMessageIndex = messageIndexById.get(pendingHistoryNavigationMessageId)
    if (typeof targetMessageIndex !== 'number') {
      setPendingHistoryNavigationMessageId(null)
      return
    }

    if (targetMessageIndex < historyStartIndex) {
      if (!onLoadOlderMessages) {
        setPendingHistoryNavigationMessageId(null)
        return
      }

      if (!isLoadingOlderMessages) {
        void Promise.resolve(onLoadOlderMessages()).catch(() => {})
      }
      return
    }

    const targetRenderableIndex = renderableHistoryMessages.findIndex((message) => message.id === pendingHistoryNavigationMessageId)
    if (targetRenderableIndex < 0) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      rowVirtualizer.scrollToIndex(targetRenderableIndex, { align: 'center' })
      setHighlightedHistoryMessageId(pendingHistoryNavigationMessageId)
      setPendingHistoryNavigationMessageId(null)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [
    historyStartIndex,
    isLoadingOlderMessages,
    messageIndexById,
    onLoadOlderMessages,
    pendingHistoryNavigationMessageId,
    renderableHistoryMessages,
    rowVirtualizer,
  ])

  useEffect(() => {
    if (!highlightedHistoryMessageId) {
      return
    }

    const timerId = window.setTimeout(() => {
      setHighlightedHistoryMessageId((current) => (current === highlightedHistoryMessageId ? null : current))
    }, HISTORY_NAV_HIGHLIGHT_MS)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [highlightedHistoryMessageId])

  return {
    historyNavigatorItems,
    historyNavigationAnchorIndex,
    historyNavigationAnchorMessageId,
    highlightedHistoryMessageId,
    isHistoryNavigatorOpen,
    hasHistoryNavigatorEntries,
    handleHistoryNavigatorOpenChange,
    handleNavigateToHistoryMessage,
    historyContextMessageCount: HISTORY_NAV_CONTEXT_MESSAGE_COUNT,
  }
}
