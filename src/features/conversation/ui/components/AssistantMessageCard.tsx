import { memo, useMemo } from 'react'
import { DownloadOutlined, ReloadOutlined, SettingOutlined, StopOutlined } from '@ant-design/icons'
import { Button, Card, Dropdown, Space, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import type { ImageRuntimeSettings, ImageTask, Message, MessageAction, Run, Side } from '../../../../types/conversation'
import { URL_RESPONSE_FORMAT_BATCH_DOWNLOAD_HINT } from '../../domain/batchDownload'
import { AssistantMarkdown } from './AssistantMarkdown'
import { AssistantRunList } from './AssistantRunList'
import type { AssistantActionTrigger } from './messageListShared'
import { getSingleRuns, getSideRuns, isMessageBatchDownloadBlocked } from './messageListUtils'
import type { ResolveImagePreviewSource } from './useResolvedImagePreview'

const STREAMING_PLACEHOLDER_LABEL = '模型响应中'

interface AssistantMessageCardProps {
  message: Message
  sideView: Side
  tasksByRunId?: Record<string, Record<number, ImageTask>>
  visibleImageLimitByRunId: Record<string, number>
  expandedPromptRunIds: Record<string, boolean>
  normalizedMultiImageInitialLimit: number
  isReplayingPrimaryRun: boolean
  isRetryingMessage: boolean
  isDownloadingMessage: boolean
  isCancellingMessage: boolean
  onReplayRun: (runId: string) => void
  onRetryRun: (runId: string) => void | Promise<void>
  onCancelMessageRuns?: (messageId: string, runIds: string[]) => void | Promise<void>
  onOpenPreview: (run: Run, imageId: string, linkedRun?: Run) => void
  onDownloadSingleImage?: (runId: string, imageId: string) => void
  onDownloadBatchRun?: (runId: string) => void
  onDownloadAllForMessage: (messageId: string, runIds: string[], primaryRunId: string) => Promise<void>
  onHandleRetryAllFailed: (messageId: string, runs: Run[]) => Promise<void>
  onLoadMoreImages: (runId: string) => void
  onToggleRunPrompt: (runId: string) => void
  onAssistantMessageAction?: (action: MessageAction) => void
  onShowParams: (messageId: string) => void
  triggerAssistantAction: AssistantActionTrigger
  resolveImagePreviewSource?: ResolveImagePreviewSource
  imageRuntimeSettings?: ImageRuntimeSettings
  elapsedNow?: number
  isCompact?: boolean
}

function AssistantMessageCardComponent({
  message,
  sideView,
  tasksByRunId,
  visibleImageLimitByRunId,
  expandedPromptRunIds,
  normalizedMultiImageInitialLimit,
  isReplayingPrimaryRun,
  isRetryingMessage,
  isDownloadingMessage,
  isCancellingMessage,
  onReplayRun,
  onRetryRun,
  onCancelMessageRuns,
  onOpenPreview,
  onDownloadSingleImage,
  onDownloadBatchRun,
  onDownloadAllForMessage,
  onHandleRetryAllFailed,
  onLoadMoreImages,
  onToggleRunPrompt,
  onAssistantMessageAction,
  onShowParams,
  triggerAssistantAction,
  resolveImagePreviewSource,
  imageRuntimeSettings,
  elapsedNow,
  isCompact = false,
}: AssistantMessageCardProps) {
  const runsForMessage = useMemo(
    () => (sideView === 'single' ? getSingleRuns(message) : getSideRuns(message, sideView)),
    [message, sideView],
  )
  const primaryRun = runsForMessage[0]
  const isStreamingPlaceholder =
    (message.content?.trim() ?? '').length === 0
    && (message.runs?.length ?? 0) === 0
  const isBatchDownloadBlocked = isMessageBatchDownloadBlocked(runsForMessage)

  const assistantActions = primaryRun
    ? (() => {
        const imagesInMessage = runsForMessage.flatMap((run) => run.images)
        const isAllImagesCompleted = imagesInMessage.length > 0 && imagesInMessage.every(
          (item) => item.status !== 'pending',
        )
        const hasDownloadableImages = runsForMessage.some((run) =>
          run.images.some(
            (item) =>
              item.status === 'success' &&
              Boolean(item.fullRef ?? item.fileRef ?? item.thumbRef ?? item.refKey),
          ),
        )
        const hasFailedImages = runsForMessage.some((run) =>
          run.images.some((item) => item.status === 'failed'),
        )
        const hasCancelableImages = runsForMessage.some((run) =>
          run.images.some((item) => item.status === 'pending' && (item.threadState === 'active' || item.threadState === 'detached')),
        )
        const actionMenuItems: MenuProps['items'] = [
          {
            key: 'replay',
            label: '再来一次',
            disabled: isReplayingPrimaryRun,
          },
          {
            key: 'retry-all-failed',
            label: '重试所有失败项',
            disabled: !hasFailedImages || isRetryingMessage,
          },
        ]

        return (
          <Space size={4} className="message-bottom-actions">
            <Tooltip title="生成操作">
              <Dropdown
                trigger={['click']}
                menu={{
                  items: actionMenuItems,
                  onClick: (info) => {
                    if (info.key === 'replay') {
                      triggerAssistantAction(
                        `message-${message.id}-replay-primary`,
                        info.domEvent as unknown as React.MouseEvent<HTMLElement>,
                        () => onReplayRun(primaryRun.id),
                      )
                      return
                    }
                    if (info.key === 'retry-all-failed') {
                      triggerAssistantAction(
                        `message-${message.id}-retry-all-failed`,
                        info.domEvent as unknown as React.MouseEvent<HTMLElement>,
                        () => onHandleRetryAllFailed(message.id, runsForMessage),
                      )
                    }
                  },
                }}
              >
                <Button
                  size="small"
                  type="default"
                  className="assistant-action-btn assistant-action-menu-trigger"
                  icon={<ReloadOutlined />}
                  aria-label="生成操作"
                  loading={isRetryingMessage}
                />
              </Dropdown>
            </Tooltip>
            <Tooltip title={isBatchDownloadBlocked ? URL_RESPONSE_FORMAT_BATCH_DOWNLOAD_HINT : '下载全部'}>
              <span>
                <Button
                  size="small"
                  type="default"
                  className="assistant-action-btn"
                  icon={<DownloadOutlined />}
                  aria-label="下载全部"
                  disabled={isBatchDownloadBlocked || !isAllImagesCompleted || !hasDownloadableImages || isDownloadingMessage}
                  loading={isDownloadingMessage}
                  onClick={(event) => {
                    triggerAssistantAction(`message-${message.id}-download-all`, event, () => (
                      onDownloadAllForMessage(
                        message.id,
                        runsForMessage.map((run) => run.id),
                        primaryRun.id,
                      )
                    ))
                  }}
                />
              </span>
            </Tooltip>
            <Tooltip title="显示参数">
              <Button
                size="small"
                type="default"
                className="assistant-action-btn"
                icon={<SettingOutlined />}
                aria-label="显示参数"
                onClick={(event) => {
                  triggerAssistantAction(`message-${message.id}-show-params`, event, () => {
                    onShowParams(message.id)
                  })
                }}
              />
            </Tooltip>
            {hasCancelableImages ? (
              <Tooltip title="中断生成">
                <Button
                  size="small"
                  type="default"
                  danger
                  className="assistant-action-btn"
                  icon={<StopOutlined />}
                  aria-label="中断生成"
                  loading={isCancellingMessage}
                  onClick={(event) => {
                    triggerAssistantAction(`message-${message.id}-cancel-generation`, event, () => (
                      onCancelMessageRuns?.(message.id, runsForMessage.map((run) => run.id))
                    ))
                  }}
                />
              </Tooltip>
            ) : null}
          </Space>
        )
      })()
    : null

  return (
    <div className="message-card-shell assistant flex w-full flex-col items-start gap-2.5">
      <Card
        size="small"
        className={`message-card assistant relative !w-full overflow-hidden !border-[#eadfce] !bg-[radial-gradient(circle_at_top_right,rgba(223,162,88,0.12)_0,rgba(223,162,88,0)_32%),linear-gradient(145deg,#fffaf3_0%,#ffffff_48%,#fff7ee_100%)] !shadow-none ${isCompact ? 'assistant-compact !rounded-[var(--message-bubble-radius)]' : '!rounded-[var(--message-bubble-radius)]'}`.trim()}
        styles={{
          body: {
            padding: isCompact ? '10px 12px' : '18px',
            position: 'relative',
            zIndex: 1,
          },
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 h-[180px] w-[180px] rounded-br-[180px] bg-[radial-gradient(circle_at_top_left,rgba(245,199,137,0.34),rgba(245,199,137,0))]"
        />
        <Space orientation="vertical" size={12} className={`w-full assistant-message-layout relative z-[1] ${isCompact ? 'gap-3' : 'gap-[18px]'}`}>
          <div className="assistant-message-body grid gap-2">
            {isStreamingPlaceholder ? (
              <div
                className="message-streaming-placeholder inline-flex min-h-7 items-center gap-2.5 text-[#595959]"
                role="status"
                aria-live="polite"
                aria-label={STREAMING_PLACEHOLDER_LABEL}
              >
                <span className="message-streaming-placeholder-text font-medium">{STREAMING_PLACEHOLDER_LABEL}</span>
                <span className="message-streaming-dots inline-flex items-center gap-1.5" aria-hidden="true">
                  <span className="message-streaming-dot h-2 w-2 rounded-full bg-[#95de64] opacity-30 [animation:message-streaming-bounce_1.1s_ease-in-out_infinite]" />
                  <span className="message-streaming-dot h-2 w-2 rounded-full bg-[#95de64] opacity-30 [animation:message-streaming-bounce_1.1s_ease-in-out_infinite] [animation-delay:0.15s]" />
                  <span className="message-streaming-dot h-2 w-2 rounded-full bg-[#95de64] opacity-30 [animation:message-streaming-bounce_1.1s_ease-in-out_infinite] [animation-delay:0.3s]" />
                </span>
              </div>
            ) : (
              <AssistantMarkdown content={message.content} />
            )}
          </div>

          {message.actions?.length ? (
            <Space size={8} wrap className="message-inline-actions inline-flex flex-wrap items-center gap-2">
              {message.actions.map((action) => (
                <Button
                  key={action.id}
                  size="small"
                  type="default"
                  className="assistant-inline-action-btn"
                  onClick={() => onAssistantMessageAction?.(action)}
                >
                  {action.label}
                </Button>
              ))}
            </Space>
          ) : null}

          <div className="assistant-message-runs grid gap-3">
            <AssistantRunList
              runs={runsForMessage}
              tasksByRunId={tasksByRunId}
              isCompact={isCompact}
              visibleImageLimitByRunId={visibleImageLimitByRunId}
              expandedPromptRunIds={expandedPromptRunIds}
              normalizedMultiImageInitialLimit={normalizedMultiImageInitialLimit}
              onOpenPreview={onOpenPreview}
              onRetryRun={onRetryRun}
              onDownloadSingleImage={onDownloadSingleImage}
              onDownloadBatchRun={onDownloadBatchRun}
              onLoadMoreImages={onLoadMoreImages}
              onToggleRunPrompt={onToggleRunPrompt}
              triggerAssistantAction={triggerAssistantAction}
              resolveImagePreviewSource={resolveImagePreviewSource}
              imageRuntimeSettings={imageRuntimeSettings}
              elapsedNow={elapsedNow}
            />
          </div>
        </Space>
      </Card>

      {assistantActions ? (
        <div className="assistant-message-outside-actions flex min-w-0 items-center justify-start pl-2">
          {assistantActions}
        </div>
      ) : null}
    </div>
  )
}

function areAssistantMessageCardPropsEqual(prev: AssistantMessageCardProps, next: AssistantMessageCardProps): boolean {
  if (
    prev.message !== next.message ||
    prev.sideView !== next.sideView ||
    prev.normalizedMultiImageInitialLimit !== next.normalizedMultiImageInitialLimit ||
    prev.isReplayingPrimaryRun !== next.isReplayingPrimaryRun ||
    prev.isRetryingMessage !== next.isRetryingMessage ||
    prev.isDownloadingMessage !== next.isDownloadingMessage ||
    prev.isCancellingMessage !== next.isCancellingMessage ||
    prev.isCompact !== next.isCompact ||
    prev.resolveImagePreviewSource !== next.resolveImagePreviewSource ||
    prev.imageRuntimeSettings?.showRequestMethodBadge !== next.imageRuntimeSettings?.showRequestMethodBadge ||
    prev.imageRuntimeSettings?.offscreenPreviewReleaseDelayMs !== next.imageRuntimeSettings?.offscreenPreviewReleaseDelayMs ||
    prev.elapsedNow !== next.elapsedNow
  ) {
    return false
  }

  const prevRuns = prev.sideView === 'single' ? getSingleRuns(prev.message) : getSideRuns(prev.message, prev.sideView)
  const nextRuns = next.sideView === 'single' ? getSingleRuns(next.message) : getSideRuns(next.message, next.sideView)
  if (prevRuns.length !== nextRuns.length) {
    return false
  }

  for (let index = 0; index < prevRuns.length; index += 1) {
    const prevRun = prevRuns[index]
    const nextRun = nextRuns[index]
    if (prevRun !== nextRun || prevRun.id !== nextRun.id) {
      return false
    }
    if (prev.visibleImageLimitByRunId[prevRun.id] !== next.visibleImageLimitByRunId[nextRun.id]) {
      return false
    }
    if (prev.expandedPromptRunIds[prevRun.id] !== next.expandedPromptRunIds[nextRun.id]) {
      return false
    }
    if ((prev.tasksByRunId?.[prevRun.id] ?? null) !== (next.tasksByRunId?.[nextRun.id] ?? null)) {
      return false
    }
  }

  return true
}

export const AssistantMessageCard = memo(AssistantMessageCardComponent, areAssistantMessageCardPropsEqual)
