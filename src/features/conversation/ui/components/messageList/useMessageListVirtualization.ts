import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Message } from '../../../../../types/conversation'
import { useMessageListViewport } from '../useMessageListViewport'

const ESTIMATED_MESSAGE_HEIGHT = 220
const DEFAULT_INITIAL_VIEWPORT_HEIGHT = 600

interface UseMessageListVirtualizationInput {
  conversationId: string | null | undefined
  renderableHistoryMessages: Message[]
  overscan: number
  autoScrollTrigger?: number
  onReachBottom?: () => void
  onReachTop?: () => void
  cleanupKey: string
}

export function useMessageListVirtualization(input: UseMessageListVirtualizationInput) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const rowResizeObserversRef = useRef(new Map<string, ResizeObserver>())
  const completedAutoScrollKeyRef = useRef<string | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)

  const {
    viewportRef,
    viewportNodeRef,
    viewportElement,
    viewportHeight,
    scrollTop,
    showScrollToBottom,
    handleScrollToBottom,
    scrollViewportToBottom,
  } = useMessageListViewport({
    conversationId: input.conversationId ?? undefined,
    onReachBottom: input.onReachBottom,
    onReachTop: input.onReachTop,
  })

  const rowVirtualizer = useVirtualizer({
    count: input.renderableHistoryMessages.length,
    getScrollElement: () => viewportNodeRef.current,
    estimateSize: () => ESTIMATED_MESSAGE_HEIGHT,
    initialRect: {
      width: 0,
      height: viewportHeight || (typeof window === 'undefined' ? DEFAULT_INITIAL_VIEWPORT_HEIGHT : window.innerHeight || DEFAULT_INITIAL_VIEWPORT_HEIGHT),
    },
    overscan: Math.max(1, input.overscan),
    getItemKey: (index) => input.renderableHistoryMessages[index]?.id ?? index,
  })

  const measureRow = useCallback((index: number, node: HTMLDivElement | null) => {
    if (!node) {
      return
    }
    const nextHeight = Math.max(
      node.getBoundingClientRect().height,
      node.offsetHeight,
      node.scrollHeight,
      ESTIMATED_MESSAGE_HEIGHT,
    )
    rowVirtualizer.resizeItem(index, nextHeight)
  }, [rowVirtualizer])

  const bindMeasuredRow = useCallback((messageId: string, index: number, node: HTMLDivElement | null) => {
    const previousObserver = rowResizeObserversRef.current.get(messageId)
    if (previousObserver) {
      previousObserver.disconnect()
      rowResizeObserversRef.current.delete(messageId)
    }

    if (!node) {
      return
    }

    measureRow(index, node)
    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      measureRow(index, node)
    })
    observer.observe(node)
    rowResizeObserversRef.current.set(messageId, observer)
  }, [measureRow])

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalVirtualSize = rowVirtualizer.getTotalSize()
  const pendingAutoScrollKey = input.conversationId && typeof input.autoScrollTrigger !== 'undefined'
    ? `${input.conversationId}:${input.autoScrollTrigger}`
    : null
  const autoScrollRequested = pendingAutoScrollKey !== null
    && completedAutoScrollKeyRef.current !== pendingAutoScrollKey
  const resolvedVirtualItems = useMemo(() => {
    if (input.renderableHistoryMessages.length === 0) {
      return virtualItems
    }

    if (autoScrollRequested) {
      const estimatedVisibleCount = viewportHeight > 0
        ? Math.max(1, Math.ceil(viewportHeight / ESTIMATED_MESSAGE_HEIGHT))
        : Math.max(1, input.overscan * 2)
      const bufferCount = Math.max(1, input.overscan)
      const endIndex = input.renderableHistoryMessages.length - 1
      const startIndex = Math.max(0, endIndex - estimatedVisibleCount - bufferCount * 2 + 1)

      return Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
        const index = startIndex + offset
        const start = index * ESTIMATED_MESSAGE_HEIGHT
        return {
          key: input.renderableHistoryMessages[index]?.id ?? index,
          index,
          start,
          end: start + ESTIMATED_MESSAGE_HEIGHT,
        }
      })
    }

    if (virtualItems.length === 0) {
      const estimatedVisibleCount = viewportHeight > 0
        ? Math.max(1, Math.ceil(viewportHeight / ESTIMATED_MESSAGE_HEIGHT))
        : Math.max(1, input.overscan * 2)
      const bufferCount = Math.max(1, input.overscan)
      const endIndex = input.renderableHistoryMessages.length - 1
      const shouldPreferTailWindow = viewportHeight > 0 && scrollTop > ESTIMATED_MESSAGE_HEIGHT
      const startIndex = shouldPreferTailWindow
        ? Math.max(0, endIndex - estimatedVisibleCount - bufferCount * 2 + 1)
        : 0
      const resolvedEndIndex = shouldPreferTailWindow
        ? endIndex
        : Math.min(endIndex, estimatedVisibleCount + bufferCount - 1)

      return Array.from({ length: resolvedEndIndex - startIndex + 1 }, (_, offset) => {
        const index = startIndex + offset
        return {
          key: input.renderableHistoryMessages[index]?.id ?? index,
          index,
          start: index * ESTIMATED_MESSAGE_HEIGHT,
          end: (index + 1) * ESTIMATED_MESSAGE_HEIGHT,
        }
      })
    }

    const maxScrollTop = Math.max(totalVirtualSize - viewportHeight, 0)
    const hasOversizedScrollTop = viewportHeight > 0 && scrollTop > maxScrollTop + ESTIMATED_MESSAGE_HEIGHT
    const appearsStuckAtHead = virtualItems.length > 0 && virtualItems[0]?.index === 0
    if (!hasOversizedScrollTop || !appearsStuckAtHead) {
      return virtualItems
    }

    const visibleCount = Math.max(1, Math.ceil(viewportHeight / ESTIMATED_MESSAGE_HEIGHT))
    const bufferCount = Math.max(1, input.overscan)
    const endIndex = input.renderableHistoryMessages.length - 1
    const startIndex = Math.max(0, endIndex - visibleCount - bufferCount * 2 + 1)

    return Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
      const index = startIndex + offset
      const start = index * ESTIMATED_MESSAGE_HEIGHT
      return {
        key: input.renderableHistoryMessages[index]?.id ?? index,
        index,
        start,
        end: start + ESTIMATED_MESSAGE_HEIGHT,
      }
    })
  }, [autoScrollRequested, input.overscan, input.renderableHistoryMessages, scrollTop, totalVirtualSize, viewportHeight, virtualItems])

  useLayoutEffect(() => {
    if (!autoScrollRequested) {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current)
        autoScrollFrameRef.current = null
      }
      return
    }

    const lastRenderableIndex = input.renderableHistoryMessages.length - 1
    if (lastRenderableIndex < 0 || pendingAutoScrollKey === null) {
      return
    }

    let cancelled = false

    const attemptAlignToBottom = (remainingFrames: number) => {
      if (cancelled) {
        return
      }

      rowVirtualizer.scrollToIndex(lastRenderableIndex, { align: 'end' })
      scrollViewportToBottom('auto')

      const viewportNode = viewportNodeRef.current
      if (!viewportNode) {
        if (remainingFrames <= 0) {
          return
        }

        autoScrollFrameRef.current = window.requestAnimationFrame(() => {
          autoScrollFrameRef.current = null
          attemptAlignToBottom(remainingFrames - 1)
        })
        return
      }

      const distanceToBottom = viewportNode.scrollHeight - viewportNode.scrollTop - viewportNode.clientHeight
      if (distanceToBottom < 24) {
        completedAutoScrollKeyRef.current = pendingAutoScrollKey
        return
      }

      if (remainingFrames <= 0) {
        return
      }

      autoScrollFrameRef.current = window.requestAnimationFrame(() => {
        autoScrollFrameRef.current = null
        attemptAlignToBottom(remainingFrames - 1)
      })
    }

    attemptAlignToBottom(12)

    return () => {
      cancelled = true
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current)
        autoScrollFrameRef.current = null
      }
    }
  }, [autoScrollRequested, input.renderableHistoryMessages.length, pendingAutoScrollKey, rowVirtualizer, scrollViewportToBottom, viewportNodeRef])

  useLayoutEffect(() => {
    if (!viewportElement || viewportHeight <= 0) {
      return
    }

    const maxScrollTop = Math.max(totalVirtualSize - viewportHeight, 0)
    if (scrollTop <= maxScrollTop + ESTIMATED_MESSAGE_HEIGHT) {
      return
    }

    viewportElement.scrollTop = maxScrollTop
  }, [scrollTop, totalVirtualSize, viewportElement, viewportHeight])

  const mountedMessages = useMemo(
    () => resolvedVirtualItems
      .map((item) => input.renderableHistoryMessages[item.index])
      .filter((message): message is NonNullable<typeof message> => Boolean(message)),
    [input.renderableHistoryMessages, resolvedVirtualItems],
  )
  const visibleMessagesCount = useMemo(() => {
    const viewportBottom = scrollTop + viewportHeight
    return resolvedVirtualItems.filter((item) => item.end > scrollTop && item.start < viewportBottom).length
  }, [resolvedVirtualItems, scrollTop, viewportHeight])

  useEffect(() => {
    const rowResizeObservers = rowResizeObserversRef.current
    return () => {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current)
        autoScrollFrameRef.current = null
      }
      rowResizeObservers.forEach((observer) => observer.disconnect())
      rowResizeObservers.clear()
    }
  }, [input.cleanupKey])

  return {
    contentRef,
    viewportRef,
    viewportNodeRef,
    viewportHeight,
    scrollTop,
    showScrollToBottom,
    handleScrollToBottom,
    rowVirtualizer,
    totalVirtualSize,
    resolvedVirtualItems,
    mountedMessages,
    visibleMessagesCount,
    bindMeasuredRow,
  }
}
