import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { DownOutlined } from '@ant-design/icons'
import { Button, Space, Typography } from 'antd'
import type { Conversation, ImageRuntimeSettings, ImageTask, MessageAction, Run, Side } from '../../../../types/conversation'
import { trackMetrics } from '../../../performance/runtimeMetrics'
import { buildImageTasksByRunId } from '../../application/queries/imageTaskReadModel'
import { AssistantMessageCard } from './AssistantMessageCard'
import { AssistantParamsModal } from './AssistantParamsModal'
import { UserMessageCard } from './UserMessageCard'
import {
  getSingleRuns,
  getSideRuns,
  shouldRenderAssistantMessage,
} from './messageListUtils'
import { ensureRunTaskState } from '../../domain/runTaskState'
import type { AssistantActionTrigger } from './messageListShared'
import type { ResolveImagePreviewSource } from './useResolvedImagePreview'
import { MessageListToolbar } from './messageList/MessageListToolbar'
import { useMessageActionState } from './messageList/useMessageActionState'
import { useMessageListVirtualization } from './messageList/useMessageListVirtualization'
import {
  clearMessageListDiagnostics,
  isChatMemoryDiagnosticsEnabled,
  recordChatMemoryEvent,
  reportMessageListDiagnostics,
  subscribeChatMemoryDiagnostics,
} from '../../../performance/chatMemoryDiagnostics'

const { Text } = Typography
const DEFAULT_MESSAGE_PAGE_SIZE = 50
const DEFAULT_MULTI_IMAGE_INITIAL_LIMIT = 24
const DEFAULT_MULTI_IMAGE_PAGE_SIZE = 24
const ASSISTANT_ACTION_ANIMATION_MS = 140
const ASSISTANT_ACTION_ANIMATING_CLASS = 'assistant-action-btn-animating'
const ASSISTANT_COMPACT_LAYOUT_ENABLED = true
const ELAPSED_TIMER_INTERVAL_MS = 1000
const HISTORY_NAV_CONTEXT_MESSAGE_COUNT = 4
const HISTORY_NAV_SNIPPET_LIMIT = 96
const HISTORY_NAV_HIGHLIGHT_MS = 2200

interface HistoryNavigatorItem {
  messageId: string
  sequence: number
  snippet: string
}

function buildHistoryNavigatorSnippet(message: Conversation['messages'][number]): string {
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

interface MessageListProps {
  activeConversation: Conversation | null
  imageTasksByRunId?: Record<string, Record<number, ImageTask>>
  sideView: Side
  onOpenPreview: (run: Run, imageId: string, linkedRun?: Run) => void
  onUseUserPrompt?: (prompt: string) => void
  onRetryRun: (runId: string) => void | Promise<void>
  onReplayRun: (runId: string) => void
  onCancelMessageRuns?: (messageId: string, runIds: string[]) => void | Promise<void>
  onDownloadAllRun?: (runId: string) => void | Promise<void>
  onDownloadMessageImages?: (runIds: string[]) => void | Promise<void>
  onDownloadSingleImage?: (runId: string, imageId: string) => void
  onDownloadBatchRun?: (runId: string) => void
  replayingRunIds?: string[]
  windowSize?: number
  overscan?: number
  onReachBottom?: () => void
  initialMessageLimit?: number
  messagePageSize?: number
  isLoadingOlderMessages?: boolean
  autoScrollTrigger?: number
  assistantAutoScrollTrigger?: number
  assistantAutoScrollMessageId?: string | null
  onLoadOlderMessages?: () => void | Promise<void>
  multiImageInitialLimit?: number
  multiImagePageSize?: number
  onAssistantMessageAction?: (action: MessageAction) => void
  resolveImagePreviewSource?: ResolveImagePreviewSource
  imageRuntimeSettings?: ImageRuntimeSettings
}

function MessageListComponent(props: MessageListProps) {
  const {
    activeConversation,
    imageTasksByRunId,
    sideView,
    onOpenPreview,
    onUseUserPrompt,
    onRetryRun,
    onReplayRun,
    onCancelMessageRuns,
    onDownloadAllRun,
    onDownloadMessageImages,
    onDownloadSingleImage,
    onDownloadBatchRun,
    replayingRunIds = [],
    windowSize,
    overscan = 6,
    onReachBottom,
    initialMessageLimit = 100,
    messagePageSize = DEFAULT_MESSAGE_PAGE_SIZE,
    isLoadingOlderMessages = false,
    autoScrollTrigger,
    assistantAutoScrollTrigger,
    assistantAutoScrollMessageId,
    onLoadOlderMessages,
    multiImageInitialLimit = DEFAULT_MULTI_IMAGE_INITIAL_LIMIT,
    multiImagePageSize = DEFAULT_MULTI_IMAGE_PAGE_SIZE,
    onAssistantMessageAction,
    resolveImagePreviewSource,
    imageRuntimeSettings,
  } = props

  const [visibleImageLimitByRunId, setVisibleImageLimitByRunId] = useState<Record<string, number>>({})
  const [expandedPromptRunIds, setExpandedPromptRunIds] = useState<Record<string, boolean>>({})
  const [isHistoryNavigatorOpen, setIsHistoryNavigatorOpen] = useState(false)
  const [historyNavigationAnchorMessageId, setHistoryNavigationAnchorMessageId] = useState<string | null>(null)
  const [pendingHistoryNavigationMessageId, setPendingHistoryNavigationMessageId] = useState<string | null>(null)
  const [highlightedHistoryMessageId, setHighlightedHistoryMessageId] = useState<string | null>(null)
  const previousAssistantAutoScrollTriggerRef = useRef<number | undefined>(assistantAutoScrollTrigger)
  const [elapsedNow, setElapsedNow] = useState(() => Date.now())
  const elapsedSecondRef = useRef(0)
  const diagnosticsEnabled = useSyncExternalStore(
    subscribeChatMemoryDiagnostics,
    isChatMemoryDiagnosticsEnabled,
    isChatMemoryDiagnosticsEnabled,
  )

  const messages = useMemo(() => activeConversation?.messages ?? [], [activeConversation?.messages])
  const messageIndexById = useMemo(() => {
    const nextMap = new Map<string, number>()
    messages.forEach((message, index) => {
      nextMap.set(message.id, index)
    })
    return nextMap
  }, [messages])
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
  const resolvedImageTasksByRunId = useMemo(() => {
    if (imageTasksByRunId) {
      return imageTasksByRunId
    }
    return buildImageTasksByRunId({
      conversationTasks: activeConversation?.tasksById,
    })
  }, [activeConversation?.tasksById, imageTasksByRunId])
  const boundedLimit = Math.max(1, initialMessageLimit)
  const historyStartIndex = Math.max(0, messages.length - boundedLimit)
  const historyMessages = useMemo(() => messages.slice(historyStartIndex), [messages, historyStartIndex])
  const historyNavigationAnchorIndex = useMemo(() => {
    if (!historyNavigationAnchorMessageId) {
      return -1
    }
    return historyMessages.findIndex((message) => message.id === historyNavigationAnchorMessageId)
  }, [historyMessages, historyNavigationAnchorMessageId])
  const normalizedWindowSize = typeof windowSize === 'number' && Number.isFinite(windowSize)
    ? Math.max(1, Math.floor(windowSize))
    : null
  const diagnosticsKey = `${activeConversation?.id ?? 'none'}:${sideView}`
  const renderWindowStartIndex = useMemo(() => {
    if (normalizedWindowSize === null) {
      return 0
    }

    const defaultStartIndex = Math.max(0, historyMessages.length - normalizedWindowSize)
    if (historyNavigationAnchorIndex < 0) {
      return defaultStartIndex
    }

    return Math.max(0, Math.min(defaultStartIndex, historyNavigationAnchorIndex - HISTORY_NAV_CONTEXT_MESSAGE_COUNT))
  }, [historyMessages.length, historyNavigationAnchorIndex, normalizedWindowSize])
  const renderWindowMessages = useMemo(
    () => historyMessages.slice(renderWindowStartIndex),
    [historyMessages, renderWindowStartIndex],
  )
  const hasOlderMessages = historyStartIndex > 0
  const renderableHistoryMessages = useMemo(
    () => renderWindowMessages.filter((message) => (message.role === 'assistant' ? shouldRenderAssistantMessage(message, sideView) : true)),
    [renderWindowMessages, sideView],
  )
  const isCompactAssistantView = ASSISTANT_COMPACT_LAYOUT_ENABLED
  const {
    paramModalMessageId,
    setParamModalMessageId,
    isRetryingMessage,
    isDownloadingMessage,
    isCancellingMessage,
    handleRetryAllFailed,
    handleDownloadAllForMessage,
    handleCancelMessageRuns,
  } = useMessageActionState({
    onRetryRun,
    onDownloadAllRun,
    onDownloadMessageImages,
    onCancelMessageRuns,
  })

  const handleReachBottom = useCallback(() => {
    recordChatMemoryEvent('scroll-bottom', diagnosticsKey)
    onReachBottom?.()
  }, [diagnosticsKey, onReachBottom])

  const handleReachTop = useCallback(() => {
    recordChatMemoryEvent('scroll-top', diagnosticsKey)
  }, [diagnosticsKey])

  const {
    viewportRef,
    contentRef,
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
  } = useMessageListVirtualization({
    conversationId: activeConversation?.id,
    renderableHistoryMessages,
    overscan,
    autoScrollTrigger,
    onReachBottom: handleReachBottom,
    onReachTop: handleReachTop,
    cleanupKey: diagnosticsKey,
  })
  const hasVisibleRunningRuns = useMemo(
    () => mountedMessages.some((message) =>
      message.role === 'assistant'
      && (sideView === 'single' ? getSingleRuns(message) : getSideRuns(message, sideView))
        .some((run) => {
          const status = ensureRunTaskState(run).status
          return status === 'waiting' || status === 'generating'
        }),
    ),
    [mountedMessages, sideView],
  )
  const paramModalMessage = useMemo(
    () => activeConversation?.messages.find((message) => message.id === paramModalMessageId) ?? null,
    [activeConversation?.messages, paramModalMessageId],
  )
  const paramModalRuns = useMemo(() => {
    if (!paramModalMessage || paramModalMessage.role !== 'assistant') {
      return []
    }
    return sideView === 'single' ? getSingleRuns(paramModalMessage) : getSideRuns(paramModalMessage, sideView)
  }, [paramModalMessage, sideView])

  const normalizedMultiImageInitialLimit = Math.max(1, Math.floor(multiImageInitialLimit))
  const normalizedMultiImagePageSize = Math.max(1, Math.floor(multiImagePageSize))
  const hasHistoryNavigatorEntries = historyNavigatorItems.length > 0
  const isMultiSideView = sideView !== 'single'

  const handleHistoryNavigatorOpenChange = useCallback((open: boolean) => {
    setIsHistoryNavigatorOpen(open)
  }, [])

  const handleNavigateToHistoryMessage = useCallback((messageId: string) => {
    setIsHistoryNavigatorOpen(false)
    setHistoryNavigationAnchorMessageId(messageId)
    setPendingHistoryNavigationMessageId(messageId)
    setHighlightedHistoryMessageId(null)
  }, [])

  const handleLoadMoreImages = useCallback((runId: string) => {
    setVisibleImageLimitByRunId((prev) => {
      const current = prev[runId] ?? normalizedMultiImageInitialLimit
      const next = current + normalizedMultiImagePageSize
      if (next === current) {
        return prev
      }
      return {
        ...prev,
        [runId]: next,
      }
    })
  }, [normalizedMultiImageInitialLimit, normalizedMultiImagePageSize])

  const handleToggleRunPrompt = useCallback((runId: string) => {
    setExpandedPromptRunIds((prev) => ({
      ...prev,
      [runId]: !prev[runId],
    }))
  }, [])

  const handleLoadOlderMessages = () => {
    recordChatMemoryEvent('load-older-messages', `${diagnosticsKey}:${Math.min(messagePageSize, historyStartIndex)}`)
    onLoadOlderMessages?.()
  }

  useEffect(() => {
    trackMetrics('messageList.visibility', {
      totalMessages: messages.length,
      historyMessages: historyMessages.length,
      renderedMessages: renderableHistoryMessages.length,
      mountedMessages: mountedMessages.length,
      visibleMessages: visibleMessagesCount,
      sourcePreviewUrls: 0,
    })
  }, [historyMessages.length, messages.length, mountedMessages.length, renderableHistoryMessages.length, visibleMessagesCount])

  useEffect(() => {
    if (!diagnosticsEnabled) {
      return
    }

    const handle = window.requestAnimationFrame(() => {
      const viewportNode = viewportNodeRef.current
      const contentNode = contentRef.current
      if (!viewportNode || !contentNode) {
        return
      }

      reportMessageListDiagnostics({
        key: diagnosticsKey,
        conversationId: activeConversation?.id ?? null,
        sideView,
        totalMessages: messages.length,
        historyMessages: historyMessages.length,
        hydratedMessages: activeConversation?.memoryState?.hydratedMessageCount ?? activeConversation?.messages.length ?? 0,
        renderedMessages: renderableHistoryMessages.length,
        mountedMessages: mountedMessages.length,
        visibleMessages: visibleMessagesCount,
        imgNodes: contentNode.querySelectorAll('img').length,
        viewportNodes: contentNode.querySelectorAll('*').length,
        scrollTop: viewportNode.scrollTop,
        scrollHeight: viewportNode.scrollHeight,
        viewportHeight: viewportNode.clientHeight,
        virtualRangeStart: resolvedVirtualItems[0]?.index ?? 0,
        virtualRangeEnd: resolvedVirtualItems[resolvedVirtualItems.length - 1]?.index ?? 0,
      })
    })

    return () => {
      window.cancelAnimationFrame(handle)
    }
  }, [
    activeConversation?.id,
    activeConversation?.memoryState?.hydratedMessageCount,
    activeConversation?.messages.length,
    contentRef,
    diagnosticsKey,
    historyMessages.length,
    messages.length,
    mountedMessages.length,
    renderableHistoryMessages.length,
    scrollTop,
    sideView,
    viewportHeight,
    resolvedVirtualItems,
    visibleMessagesCount,
    diagnosticsEnabled,
    viewportNodeRef,
  ])

  useEffect(() => {
    return () => {
      clearMessageListDiagnostics(diagnosticsKey)
    }
  }, [diagnosticsKey])

  useEffect(() => {
    setIsHistoryNavigatorOpen(false)
    setHistoryNavigationAnchorMessageId(null)
    setPendingHistoryNavigationMessageId(null)
    setHighlightedHistoryMessageId(null)
    setExpandedPromptRunIds({})
  }, [activeConversation?.id])

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
  }, [assistantAutoScrollMessageId, assistantAutoScrollTrigger, contentRef, renderableHistoryMessages, rowVirtualizer])

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

  useEffect(() => {
    if (!hasVisibleRunningRuns) {
      return
    }

    const updateElapsedNow = () => {
      const nextNow = Date.now()
      const nextSecond = Math.floor(nextNow / 1000)
      if (nextSecond === elapsedSecondRef.current) {
        return
      }
      elapsedSecondRef.current = nextSecond
      setElapsedNow(nextNow)
    }

    updateElapsedNow()
    const timer = window.setInterval(updateElapsedNow, ELAPSED_TIMER_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [hasVisibleRunningRuns])

  const triggerAssistantAction = useCallback<AssistantActionTrigger>((actionKey, event, action) => {
    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) {
      void Promise.resolve(action())
      return
    }

    if (target.dataset.assistantActionAnimating === 'true') {
      return
    }

    target.dataset.assistantActionAnimating = 'true'
    target.dataset.assistantActionKey = actionKey
    target.classList.add(ASSISTANT_ACTION_ANIMATING_CLASS)

    window.setTimeout(() => {
      target.classList.remove(ASSISTANT_ACTION_ANIMATING_CLASS)
      delete target.dataset.assistantActionAnimating
      delete target.dataset.assistantActionKey
      void Promise.resolve(action())
    }, ASSISTANT_ACTION_ANIMATION_MS)
  }, [])

  if (!activeConversation || activeConversation.messages.length === 0) {
    return (
      <div className="w-full message-list-shell relative flex min-h-0 flex-1 flex-col">
        <div
          ref={viewportRef}
          className="w-full message-list-viewport min-h-0 flex-1 overflow-y-auto"
          style={{
            paddingTop: 'var(--message-list-top-clearance, 12px)',
            scrollPaddingTop: 'var(--message-list-top-clearance, 12px)',
            paddingBottom: isMultiSideView ? '16px' : '18px',
            scrollPaddingBottom: isMultiSideView ? '16px' : '18px',
          }}
        >
          <div className="empty-state">
            <Text type="secondary">我可以怎么帮你？</Text>
          </div>
        </div>
        <MessageListToolbar
          hasOlderMessages={hasOlderMessages}
          isLoadingOlderMessages={isLoadingOlderMessages}
          messagePageSize={messagePageSize}
          historyStartIndex={historyStartIndex}
          onLoadOlderMessages={handleLoadOlderMessages}
          historyNavigatorItems={historyNavigatorItems}
          isHistoryNavigatorOpen={isHistoryNavigatorOpen}
          historyNavigationAnchorMessageId={historyNavigationAnchorMessageId}
          hasHistoryNavigatorEntries={hasHistoryNavigatorEntries}
          onHistoryNavigatorOpenChange={handleHistoryNavigatorOpenChange}
          onNavigateToHistoryMessage={handleNavigateToHistoryMessage}
        />
      </div>
    )
  }

  return (
    <div className="w-full message-list-shell relative flex min-h-0 flex-1 flex-col">
      <div
        ref={viewportRef}
        className="w-full message-list-viewport min-h-0 flex-1 overflow-y-auto"
        style={{
          paddingTop: 'var(--message-list-top-clearance, 12px)',
          scrollPaddingTop: 'var(--message-list-top-clearance, 12px)',
          paddingBottom: isMultiSideView ? '16px' : '18px',
          scrollPaddingBottom: isMultiSideView ? '16px' : '18px',
        }}
      >
        <div
          className="message-list-content-inner mx-auto"
          style={
            isMultiSideView
              ? {
                  width: 'calc(100% - 28px)',
                  maxWidth: 'calc(100% - 28px)',
                }
              : {
                  width: 'min(var(--chat-content-max-width, 920px), calc(100% - 40px))',
                  maxWidth: 'calc(100% - 40px)',
                }
          }
        >
          <Space orientation="vertical" size={12} className="w-full">
            <MessageListToolbar
              hasOlderMessages={hasOlderMessages}
              isLoadingOlderMessages={isLoadingOlderMessages}
              messagePageSize={messagePageSize}
              historyStartIndex={historyStartIndex}
              onLoadOlderMessages={handleLoadOlderMessages}
              historyNavigatorItems={historyNavigatorItems}
              isHistoryNavigatorOpen={isHistoryNavigatorOpen}
              historyNavigationAnchorMessageId={historyNavigationAnchorMessageId}
              hasHistoryNavigatorEntries={hasHistoryNavigatorEntries}
              onHistoryNavigatorOpenChange={handleHistoryNavigatorOpenChange}
              onNavigateToHistoryMessage={handleNavigateToHistoryMessage}
            />

            <div
              ref={contentRef}
              className="w-full message-list-content"
              style={{ height: `${totalVirtualSize}px`, position: 'relative', padding: isMultiSideView ? '12px 14px 14px' : '16px' }}
            >
              {resolvedVirtualItems.map((virtualItem) => {
                const message = renderableHistoryMessages[virtualItem.index]
                if (!message) {
                  return null
                }

                const runsForMessage = message.role === 'assistant'
                  ? (sideView === 'single' ? getSingleRuns(message) : getSideRuns(message, sideView))
                  : []
                const retryingMessage = isRetryingMessage(message.id)
                const downloadingMessage = isDownloadingMessage(message.id)
                const cancellingMessage = isCancellingMessage(message.id)
                const primaryRunId = runsForMessage[0]?.id
                const isReplayingPrimaryRun = primaryRunId ? replayingRunIds.includes(primaryRunId) : false

                return (
                  <div
                    key={virtualItem.key}
                    data-message-id={message.id}
                    data-message-role={message.role}
                    className={`message-row-shell box-border pt-1.5 pb-1.5 ${highlightedHistoryMessageId === message.id ? "is-history-nav-highlighted after:pointer-events-none after:absolute after:inset-[6px_10px] after:rounded-[28px] after:border after:border-[rgba(34,94,168,0.28)] after:bg-[linear-gradient(135deg,rgba(91,147,219,0.12),rgba(255,255,255,0))] after:shadow-[0_0_0_1px_rgba(91,147,219,0.16),0_18px_36px_rgba(91,147,219,0.14)] after:[animation:message-history-nav-highlight_2.2s_ease] after:content-['']" : ''}`}
                    ref={(node) => {
                      bindMeasuredRow(message.id, virtualItem.index, node)
                    }}
                    style={{
                      boxSizing: 'border-box',
                      paddingTop: '6px',
                      paddingBottom: '6px',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {message.role === 'assistant' ? (
                      <AssistantMessageCard
                        message={message}
                        sideView={sideView}
                        tasksByRunId={resolvedImageTasksByRunId}
                        visibleImageLimitByRunId={visibleImageLimitByRunId}
                        expandedPromptRunIds={expandedPromptRunIds}
                        normalizedMultiImageInitialLimit={normalizedMultiImageInitialLimit}
                        isCompact={isCompactAssistantView}
                        isReplayingPrimaryRun={isReplayingPrimaryRun}
                        isRetryingMessage={retryingMessage}
                        isDownloadingMessage={downloadingMessage}
                        isCancellingMessage={cancellingMessage}
                        onReplayRun={onReplayRun}
                        onRetryRun={onRetryRun}
                        onCancelMessageRuns={handleCancelMessageRuns}
                        onOpenPreview={onOpenPreview}
                        onDownloadSingleImage={onDownloadSingleImage}
                        onDownloadBatchRun={onDownloadBatchRun}
                        onDownloadAllForMessage={handleDownloadAllForMessage}
                        onHandleRetryAllFailed={handleRetryAllFailed}
                        onLoadMoreImages={handleLoadMoreImages}
                        onToggleRunPrompt={handleToggleRunPrompt}
                        onAssistantMessageAction={onAssistantMessageAction}
                        onShowParams={setParamModalMessageId}
                        triggerAssistantAction={triggerAssistantAction}
                        resolveImagePreviewSource={resolveImagePreviewSource}
                        imageRuntimeSettings={imageRuntimeSettings}
                        elapsedNow={elapsedNow}
                      />
                    ) : (
                      <UserMessageCard
                        message={message}
                        onUseUserPrompt={onUseUserPrompt}
                        resolveImagePreviewSource={resolveImagePreviewSource}
                        offscreenPreviewReleaseDelayMs={imageRuntimeSettings?.offscreenPreviewReleaseDelayMs}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </Space>
        </div>
      </div>
      <div className="message-scroll-to-bottom-layer pointer-events-none absolute right-0 bottom-[18px] left-0 z-[18] flex justify-center" aria-hidden={!showScrollToBottom}>
        <Button
          type="default"
          shape="circle"
          aria-label="回到底部"
          aria-hidden={!showScrollToBottom}
          tabIndex={showScrollToBottom ? 0 : -1}
          disabled={!showScrollToBottom}
          className={`message-scroll-to-bottom-btn relative !flex !h-9 !w-9 !min-w-9 !items-center !justify-center !rounded-full !shadow-[0_6px_18px_rgba(0,0,0,0.12)] transition-[opacity,transform,visibility] ${showScrollToBottom ? 'is-visible pointer-events-auto visible translate-y-0 scale-100 opacity-100 [animation:message-scroll-to-bottom-pop_0.44s_cubic-bezier(0.34,1.56,0.64,1)] duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]' : 'is-hidden pointer-events-none invisible translate-y-[10px] scale-90 opacity-0 duration-[340ms] ease-[cubic-bezier(0.4,0,1,1)]'}`}
          icon={<DownOutlined />}
          onClick={() => {
            handleScrollToBottom()
            setHistoryNavigationAnchorMessageId(null)
          }}
        />
      </div>
      <AssistantParamsModal
        open={Boolean(paramModalMessageId)}
        runs={paramModalRuns}
        onClose={() => setParamModalMessageId(null)}
      />
    </div>
  )
}

export const MessageList = memo(MessageListComponent)
