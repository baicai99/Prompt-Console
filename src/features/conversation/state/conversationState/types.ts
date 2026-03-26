import type { ApiChannel } from '../../../../types/channel'
import type {
  Conversation,
  ConversationSummary,
  ImageRuntimeSettings,
  ImageTask,
  LoggingSettings,
  Side,
  SideMode,
  SingleSideSettings,
} from '../../../../types/conversation'
import type { PanelValueFormat, PanelVariableRow } from '../../domain/types'

export interface ConversationContentState {
  summaries: ConversationSummary[]
  contents: Record<string, Conversation>
  activeId: string | null
}

export interface ConversationRuntimeState {
  runtimeTasksByConversationId: Record<string, Record<string, ImageTask>>
}

export interface ConversationComposerState {
  draft: string
  sendError: string
  isSending: boolean
  showAdvancedVariables: boolean
  dynamicPromptEnabled: boolean
  autoRenameConversationTitle: boolean
  autoRenameConversationTitleModelId: string | null
  panelValueFormat: PanelValueFormat
  panelVariables: PanelVariableRow[]
}

export interface ConversationSettingsState {
  favoriteModelIds: string[]
  runConcurrency: number
  runConcurrencyUnlimited: boolean
  imageRuntimeSettings: ImageRuntimeSettings
  loggingSettings: LoggingSettings
  stagedSideMode: SideMode
  stagedSideCount: number
  stagedSettingsBySide: Record<Side, SingleSideSettings>
  channels: ApiChannel[]
}

export interface ConversationState
  extends ConversationContentState,
    ConversationRuntimeState,
    ConversationComposerState,
    ConversationSettingsState {}

export type ConversationAction =
  | { type: 'draft/set'; payload: string }
  | { type: 'send/start' }
  | { type: 'send/succeed' }
  | { type: 'send/fail'; payload: string }
  | { type: 'send/clearError' }
  | { type: 'variables/setPanelRows'; payload: PanelVariableRow[] }
  | { type: 'variables/setPanelValueFormat'; payload: PanelValueFormat }
  | { type: 'settings/setFavoriteModels'; payload: string[] }
  | { type: 'settings/setRunConcurrency'; payload: number }
  | { type: 'settings/setRunConcurrencyUnlimited'; payload: boolean }
  | { type: 'settings/setImageRuntimeSettings'; payload: Partial<ImageRuntimeSettings> }
  | { type: 'settings/setLoggingSettings'; payload: Partial<LoggingSettings> }
  | { type: 'conversation/sync'; payload: { summaries: ConversationSummary[]; contents: Record<string, Conversation> } }
  | { type: 'conversation/content-upsert'; payload: Conversation }
  | { type: 'conversation/runtime-task-upsert'; payload: { conversationId: string; task: ImageTask } }
  | { type: 'conversation/runtime-tasks-replace'; payload: { conversationId: string; tasksById: Record<string, ImageTask> } }
  | { type: 'conversation/switch'; payload: string | null }
  | { type: 'conversation/clear' }
  | {
      type: 'settings/updateSide'
      payload: {
        sideMode: SideMode
        sideCount: number
        settingsBySide: Record<Side, SingleSideSettings>
      }
    }
  | { type: 'channels/set'; payload: ApiChannel[] }
  | { type: 'ui/setAdvancedVariables'; payload: boolean }
  | { type: 'ui/setDynamicPromptEnabled'; payload: boolean }
  | { type: 'ui/setAutoRenameConversationTitle'; payload: boolean }
  | { type: 'ui/setAutoRenameConversationTitleModelId'; payload: string | null }
