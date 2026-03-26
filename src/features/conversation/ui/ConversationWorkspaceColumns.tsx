import { Col, Row } from 'antd'
import type { ModelSpec } from '../../../types/model'
import { MessageList } from './components/MessageList'
import { FavoriteModelTrigger } from './components/FavoriteModelPill'
import type { MessageAction, Side } from '../../../types/conversation'
import type { ConversationSourceImagePreviewService } from '../application/conversationSourceImagePreviewService'
import type { ImageRuntimeSettings } from '../../../types/conversation'
import type { ModelPickerTarget } from './modelPickerTarget'

interface MessageListBindings {
  activeConversation: import('../../../types/conversation').Conversation | null
  imageTasksByRunId?: Record<string, Record<number, import('../../../types/conversation').ImageTask>>
  onOpenPreview: (run: import('../../../types/conversation').Run, imageId: string, linkedRun?: import('../../../types/conversation').Run) => void
  onUseUserPrompt: (prompt: string) => void
  onRetryRun: (runId: string) => void | Promise<void>
  onReplayRun: (runId: string) => void
  onCancelMessageRuns: (messageId: string, runIds: string[]) => void | Promise<void>
  onDownloadAllRun: (runId: string) => void | Promise<void>
  onDownloadMessageImages: (runIds: string[]) => void | Promise<void>
  onDownloadSingleImage: (runId: string, imageId: string) => void
  onDownloadBatchRun: (runId: string) => void
  replayingRunIds: string[]
  historyVisibleLimit: number
  historyPageSize: number
  isLoadingOlderMessages: boolean
  conversationOpenScrollTrigger: number
  sendScrollTrigger: number
  sendScrollTargetMessageId: string | null
  loadOlderMessages: () => void | Promise<void>
  handleAssistantMessageAction: (action: MessageAction) => void
  sourceImagePreviewService: ConversationSourceImagePreviewService
  imageRuntimeSettings: ImageRuntimeSettings
}

interface ConversationWorkspaceColumnsProps extends MessageListBindings {
  activeSideMode: 'single' | 'multi'
  activeSides: Side[]
  activeSideCount: number
  currentModelsForTrigger: Record<Side, ModelSpec | null>
  hasApiChannels?: boolean
  onOpenChannelManagement?: () => void
  onOpenModelPicker: (target: ModelPickerTarget) => void
  multiRenderProfile: {
    runInitialLimit: number
    runPageSize: number
    imageInitialLimit: number
    imagePageSize: number
    messageWindowSize: number
    messageOverscan: number
  }
}

export function ConversationWorkspaceColumns(props: ConversationWorkspaceColumnsProps) {
  const commonMessageListProps = {
    activeConversation: props.activeConversation,
    imageTasksByRunId: props.imageTasksByRunId,
    onOpenPreview: props.onOpenPreview,
    onUseUserPrompt: props.onUseUserPrompt,
    onRetryRun: props.onRetryRun,
    onReplayRun: props.onReplayRun,
    onCancelMessageRuns: props.onCancelMessageRuns,
    onDownloadAllRun: props.onDownloadAllRun,
    onDownloadMessageImages: props.onDownloadMessageImages,
    onDownloadSingleImage: props.onDownloadSingleImage,
    onDownloadBatchRun: props.onDownloadBatchRun,
    replayingRunIds: props.replayingRunIds,
    initialMessageLimit: props.historyVisibleLimit,
    messagePageSize: props.historyPageSize,
    isLoadingOlderMessages: props.isLoadingOlderMessages,
    autoScrollTrigger: props.conversationOpenScrollTrigger,
    assistantAutoScrollTrigger: props.sendScrollTrigger,
    assistantAutoScrollMessageId: props.sendScrollTargetMessageId,
    onLoadOlderMessages: props.loadOlderMessages,
    onAssistantMessageAction: props.handleAssistantMessageAction,
    resolveImagePreviewSource: props.sourceImagePreviewService.acquirePreview,
    imageRuntimeSettings: props.imageRuntimeSettings,
  }

  const singleCurrentModel = props.currentModelsForTrigger.single ?? null
  const shouldPromptAddApiChannel = singleCurrentModel === null && props.hasApiChannels === false
  const singleModelTrigger = (
    <div className="chat-favorite-model-layer absolute top-[18px] left-6 z-[14]">
      <FavoriteModelTrigger
        currentModel={singleCurrentModel}
        fallbackLabel={shouldPromptAddApiChannel ? '添加 API 渠道' : undefined}
        onClick={shouldPromptAddApiChannel
          ? () => props.onOpenChannelManagement?.()
          : () => props.onOpenModelPicker({ kind: 'window', side: 'single' })}
      />
    </div>
  )

  if (props.activeSideMode === 'single') {
    return (
      <>
        {singleModelTrigger}
        <MessageList
          {...commonMessageListProps}
          sideView="single"
        />
      </>
    )
  }

  return (
    <Row gutter={[12, 12]} wrap={false} className="ab-windows-row box-border h-full flex-[1_1_auto] items-stretch p-3">
      {props.activeSides.map((sideId, index) => {
        const currentModel = props.currentModelsForTrigger[sideId] ?? null
        const buttonAriaLabel = currentModel
          ? `窗口 ${index + 1} 当前模型 ${currentModel.name}`
          : `为窗口 ${index + 1} 选择模型`

        return (
          <Col key={sideId} flex={`0 0 ${100 / props.activeSideCount}%`} className="ab-window-col flex h-full min-w-0">
            <div className="ab-window-shell relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[rgba(208,218,230,0.95)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,255,0.96)_100%)] shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
              <div className="ab-window-model-trigger-layer absolute top-4 left-4 z-[14] max-w-[calc(100%-32px)]">
                <FavoriteModelTrigger
                  currentModel={currentModel}
                  className="max-w-[min(100%,268px)]"
                  onClick={() => props.onOpenModelPicker({ kind: 'window', side: sideId })}
                  fallbackLabel="选择模型"
                  buttonAriaLabel={buttonAriaLabel}
                />
              </div>
              <MessageList
                {...commonMessageListProps}
                sideView={sideId}
                windowSize={props.multiRenderProfile.messageWindowSize}
                overscan={props.multiRenderProfile.messageOverscan}
                multiImageInitialLimit={props.multiRenderProfile.imageInitialLimit}
                multiImagePageSize={props.multiRenderProfile.imagePageSize}
              />
            </div>
          </Col>
        )
      })}
    </Row>
  )
}
