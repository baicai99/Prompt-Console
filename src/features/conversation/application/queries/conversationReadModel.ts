import type { ConversationReadModel, ConversationDraftSourceImage } from '../conversationControllerContract'
import { previewTemplate } from '../../domain/templatePreview'
import type { Conversation, Side, SideMode, SingleSideSettings } from '../../../../types/conversation'
import type { ModelCatalog } from '../../../../types/model'
import type { ConversationState } from '../../state/conversationState'
import { conversationHasActiveImageThreads, MESSAGE_HISTORY_PAGE_SIZE } from './conversationView'

interface ReadModelInput {
  state: ConversationState
  activeConversation: Conversation | null
  imageTasksByRunId: Record<string, Record<number, NonNullable<Conversation['tasksById']>[string]>>
  draftSourceImages: ConversationDraftSourceImage[]
  historyVisibleLimit: number
  isLoadingOlderMessages: boolean
  sendScrollTrigger: number
  sendScrollTargetMessageId: string | null
  resolvedVariables: Record<string, string>
  templatePreview: ReturnType<typeof previewTemplate>
  unusedVariableKeys: string[]
  activeSideMode: SideMode
  activeSideCount: number
  activeSides: Side[]
  isSideConfigLocked: boolean
  activeSettingsBySide: Record<Side, SingleSideSettings>
  modelCatalog: ModelCatalog
  isPanelBatchInvalid: boolean
  panelBatchValidation: {
    ok: boolean
    error: string
    mismatchRowIds: string[]
  }
  replayingRunIds: string[]
  workspaceDiagnostics: ConversationReadModel['workspaceDiagnostics']
}

export function createConversationReadModel(input: ReadModelInput): ConversationReadModel {
  const {
    state,
    activeConversation,
    imageTasksByRunId,
    draftSourceImages,
    historyVisibleLimit,
    isLoadingOlderMessages,
    sendScrollTrigger,
    sendScrollTargetMessageId,
    resolvedVariables,
    templatePreview,
    unusedVariableKeys,
    activeSideMode,
    activeSideCount,
    activeSides,
    isSideConfigLocked,
    activeSettingsBySide,
    modelCatalog,
    isPanelBatchInvalid,
    panelBatchValidation,
    replayingRunIds,
    workspaceDiagnostics,
  } = input
  return {
    summaries: state.summaries,
    activeConversation,
    shouldConfirmCreateConversation: conversationHasActiveImageThreads(activeConversation),
    activeId: state.activeId,
    draft: state.draft,
    draftSourceImages,
    sendError: state.sendError,
    isSending: state.isSending,
    showAdvancedVariables: state.showAdvancedVariables,
    dynamicPromptEnabled: state.dynamicPromptEnabled,
    autoRenameConversationTitle: state.autoRenameConversationTitle,
    autoRenameConversationTitleModelId: state.autoRenameConversationTitleModelId,
    panelValueFormat: state.panelValueFormat,
    panelVariables: state.panelVariables,
    favoriteModelIds: state.favoriteModelIds,
    runConcurrency: state.runConcurrency,
    runConcurrencyUnlimited: state.runConcurrencyUnlimited,
    imageRuntimeSettings: state.imageRuntimeSettings,
    loggingSettings: state.loggingSettings,
    historyVisibleLimit,
    historyPageSize: MESSAGE_HISTORY_PAGE_SIZE,
    isLoadingOlderMessages,
    sendScrollTrigger,
    sendScrollTargetMessageId,
    resolvedVariables,
    templatePreview,
    unusedVariableKeys,
    activeSideMode,
    activeSideCount,
    activeSides,
    isSideConfigLocked,
    activeSettingsBySide,
    workspaceDiagnostics,
    modelCatalog,
    channels: state.channels,
    isSendBlocked: state.draft.trim().length === 0 || isPanelBatchInvalid,
    panelBatchError: isPanelBatchInvalid ? panelBatchValidation.error ?? '' : '',
    panelMismatchRowIds: panelBatchValidation.mismatchRowIds,
    replayingRunIds,
    imageTasksByRunId,
  }
}
