import { previewTemplate } from '../domain/templatePreview'
import type { PanelValueFormat, PanelVariableRow } from '../domain/types'
import type { ApiChannel } from '../../../types/channel'
import type {
  Conversation,
  ConversationSummary,
  ImageTask,
  ImageRuntimeSettings,
  LoggingSettings,
  Side,
  SideMode,
  SingleSideSettings,
} from '../../../types/conversation'
import type { ModelCatalog } from '../../../types/model'

export interface ConversationDraftSourceImage {
  id: string
  file: File
  previewUrl: string
}

export type ConversationDraftCommand =
  | { type: 'draft/set'; value: string }
  | { type: 'draft/source-images/append'; files: File[] }
  | { type: 'draft/source-images/remove'; imageId: string }
  | { type: 'draft/source-images/clear' }
  | { type: 'variables/panel-format/set'; value: PanelValueFormat }
  | { type: 'variables/panel-rows/set'; value: PanelVariableRow[] }

export type ConversationPresentationCommand =
  | { type: 'ui/advanced-variables/set'; value: boolean }
  | { type: 'ui/dynamic-prompt/set'; value: boolean }
  | { type: 'ui/auto-rename-title/set'; value: boolean }
  | { type: 'ui/auto-rename-title-model/set'; value: string | null }

export type ConversationLifecycleCommand =
  | { type: 'conversation/create' }
  | { type: 'conversation/clear-all' }
  | { type: 'conversation/remove'; conversationId: string }
  | { type: 'conversation/rename'; conversationId: string; title: string }
  | { type: 'conversation/toggle-pin'; conversationId: string }
  | { type: 'conversation/switch'; conversationId: string }
  | { type: 'history/load-older' }

export type ConversationSettingsCommand =
  | { type: 'settings/favorite-models/set'; value: string[] }
  | { type: 'settings/run-concurrency/set'; value: number }
  | { type: 'settings/run-concurrency-unlimited/set'; value: boolean }
  | { type: 'settings/image-runtime/update'; value: Partial<ImageRuntimeSettings> }
  | { type: 'settings/logging/update'; value: Partial<LoggingSettings> }
  | { type: 'settings/side-mode/update'; mode: SideMode }
  | { type: 'settings/side-count/update'; count: number }
  | { type: 'settings/side/update'; side: Side; patch: Partial<SingleSideSettings> }
  | { type: 'settings/sides/update'; sides: Side[]; patch: Partial<SingleSideSettings> }
  | { type: 'settings/generation-mode/set'; mode: 'image' | 'text' }
  | { type: 'settings/side-model/set'; side: Side; modelId: string }
  | { type: 'settings/side-model-current-mode/set'; side: Side; modelId: string }
  | { type: 'settings/model-shortcut/apply'; modelId: string }
  | { type: 'settings/side-param/set'; side: Side; paramKey: string; value: string | number | boolean }
  | { type: 'settings/channels/set'; channels: ApiChannel[] }

export type ConversationRunCommand =
  | { type: 'send/execute' }
  | { type: 'run/retry'; runId: string }
  | { type: 'run/edit-template'; runId: string }
  | { type: 'run/cancel-message'; conversationId: string; messageId: string; runIds: string[] }
  | { type: 'run/replay'; runId: string }

export type ConversationDownloadCommand =
  | { type: 'download/run/all'; runId: string }
  | { type: 'download/run/single'; runId: string; imageId: string }
  | { type: 'download/run/batch'; runId: string }
  | { type: 'download/message'; runIds: string[] }

export type ConversationCommand =
  | ConversationDraftCommand
  | ConversationPresentationCommand
  | ConversationLifecycleCommand
  | ConversationSettingsCommand
  | ConversationRunCommand
  | ConversationDownloadCommand

export type ConversationSystemJob =
  | { type: 'persistence/flush-pending' }

export interface ConversationController<ReadModel> {
  read: ReadModel
  dispatch: (command: ConversationCommand) => Promise<void>
  runSystemJob: (job: ConversationSystemJob) => Promise<void>
}

export interface ConversationSidebarReadModel {
  summaries: ConversationSummary[]
  activeId: string | null
  shouldConfirmCreateConversation: boolean
}

export interface ConversationComposerReadModel {
  draft: string
  draftSourceImages: ConversationDraftSourceImage[]
  sendError: string
  isSending: boolean
  showAdvancedVariables: boolean
  dynamicPromptEnabled: boolean
  panelValueFormat: PanelValueFormat
  panelVariables: PanelVariableRow[]
  resolvedVariables: Record<string, string>
  templatePreview: ReturnType<typeof previewTemplate>
  unusedVariableKeys: string[]
  isSendBlocked: boolean
  panelBatchError: string
  panelMismatchRowIds: string[]
  activeSideMode: SideMode
  isSideConfigLocked: boolean
}

export interface ConversationWorkspaceReadModel {
  activeConversation: Conversation | null
  imageTasksByRunId: Record<string, Record<number, ImageTask>>
  historyVisibleLimit: number
  historyPageSize: number
  isLoadingOlderMessages: boolean
  sendScrollTrigger: number
  sendScrollTargetMessageId: string | null
  replayingRunIds: string[]
  activeSideMode: SideMode
  activeSideCount: number
  activeSides: Side[]
  activeSettingsBySide: Record<Side, SingleSideSettings>
  workspaceDiagnostics: {
    summariesCount: number
    loadedConversationCount: number
    runtimeTaskConversationCount: number
    runtimeTaskTotalCount: number
    activeConversationMessageCount: number
    activeConversationRunCount: number
    activeConversationImageCount: number
    activeConversationTaskCount: number
    activeConversationLiveFeedCount: number
    inlineImageCount: number
    inlineImageBytes: number
    idbBackedImageCount: number
    directUrlImageCount: number
    activeTaskCount: number
    settledTaskCount: number
    draftCharacterCount: number
    panelVariableRowCount: number
    resolvedVariableCount: number
    unusedVariableCount: number
    draftSourceImageCount: number
    draftSourcePreviewUrlCount: number
    totalDraftSourceBytes: number
    replayingRunIdsCount: number
    historyVisibleLimit: number
    isLoadingOlderMessages: boolean
    sendScrollTrigger: number
    pendingPersistConversationCount: number
    persistTimerActive: boolean
    resumePollTimerActive: boolean
    backgroundResumePollTimerActive: boolean
    resumePollInFlight: boolean
    backgroundResumePollInFlight: boolean
    conversationCacheOrderCount: number
    runLocationConversationCount: number
    runLocationEntryCount: number
    activeRunControllerConversationCount: number
    activeRunControllerCount: number
    resumingImageCount: number
    runCompletionSignatureCount: number
    backgroundPollOwnerId: string
    globalSubmitMax: number
    globalSubmitActive: number
    globalSubmitQueued: number
    logEntryCount: number
    logBufferLimit: number
    uiRenderCacheSize: number
    logSubscriberCount: number
    loggingEnabled: boolean
    loggingDetailLevel: string
  }
}

export interface ConversationSettingsReadModel {
  autoRenameConversationTitle: boolean
  autoRenameConversationTitleModelId: string | null
  favoriteModelIds: string[]
  runConcurrency: number
  runConcurrencyUnlimited: boolean
  imageRuntimeSettings: ImageRuntimeSettings
  loggingSettings: LoggingSettings
  activeSideMode: SideMode
  activeSideCount: number
  activeSides: Side[]
  isSideConfigLocked: boolean
  activeSettingsBySide: Record<Side, SingleSideSettings>
  modelCatalog: ModelCatalog
  channels: ApiChannel[]
}

export interface ConversationReadSlices {
  sidebar: ConversationSidebarReadModel
  composer: ConversationComposerReadModel
  workspace: ConversationWorkspaceReadModel
  settings: ConversationSettingsReadModel
}

export interface ConversationReadModel extends
  ConversationSidebarReadModel,
  ConversationComposerReadModel,
  ConversationWorkspaceReadModel,
  ConversationSettingsReadModel {
}

export interface ConversationDraftCommandGroup {
  setDraft: (value: string) => void
  appendDraftSourceImages: (files: File[]) => void
  removeDraftSourceImage: (imageId: string) => void
  clearDraftSourceImages: () => void
  setPanelValueFormat: (value: PanelValueFormat) => void
  setPanelVariables: (value: PanelVariableRow[]) => void
}

export interface ConversationPresentationCommandGroup {
  setShowAdvancedVariables: (value: boolean) => void
  setDynamicPromptEnabled: (value: boolean) => void
  setAutoRenameConversationTitle: (value: boolean) => void
  setAutoRenameConversationTitleModelId: (value: string | null) => void
}

export interface ConversationLifecycleCommandGroup {
  createNewConversation: () => void
  clearAllConversations: () => void
  removeConversation: (conversationId: string) => void
  renameConversation: (conversationId: string, title: string) => void
  togglePinConversation: (conversationId: string) => void
  switchConversation: (conversationId: string) => void
  loadOlderMessages: () => void
}

export interface ConversationSettingsCommandGroup {
  setFavoriteModelIds: (value: string[]) => void
  setRunConcurrency: (value: number) => void
  setRunConcurrencyUnlimited: (value: boolean) => void
  setImageRuntimeSettings: (value: Partial<ImageRuntimeSettings>) => void
  setLoggingSettings: (value: Partial<LoggingSettings>) => void
  updateSideMode: (mode: SideMode) => void
  updateSideCount: (count: number) => void
  updateSideSettings: (side: Side, patch: Partial<SingleSideSettings>) => void
  updateSidesSettings: (sides: Side[], patch: Partial<SingleSideSettings>) => void
  setGenerationMode: (mode: 'image' | 'text') => void
  setSideModel: (side: Side, modelId: string) => void
  setSideModelForCurrentMode: (side: Side, modelId: string) => void
  applyModelShortcut: (modelId: string) => void
  setSideModelParam: (side: Side, paramKey: string, value: string | number | boolean) => void
  setChannels: (channels: ApiChannel[]) => void
}

export interface ConversationRunCommandGroup {
  sendDraft: () => Promise<void>
  retryRun: (runId: string) => Promise<void>
  editRunTemplate: (runId: string) => Promise<void>
  cancelMessageRuns: (conversationId: string, messageId: string, runIds: string[]) => Promise<void>
  replayRunAsNewMessage: (runId: string) => Promise<void>
}

export interface ConversationDownloadCommandGroup {
  downloadAllRunImages: (runId: string) => void
  downloadSingleRunImage: (runId: string, imageId: string) => void
  downloadBatchRunImages: (runId: string) => void
  downloadMessageRunImages: (runIds: string[]) => Promise<void>
}

export interface ConversationCommandGroups {
  draft: ConversationDraftCommandGroup
  presentation: ConversationPresentationCommandGroup
  lifecycle: ConversationLifecycleCommandGroup
  settings: ConversationSettingsCommandGroup
  run: ConversationRunCommandGroup
  download: ConversationDownloadCommandGroup
}

export type ConversationControllerResult<ReadModel> = ConversationController<ReadModel>

export type AppConversationController = ConversationControllerResult<ConversationReadModel>
