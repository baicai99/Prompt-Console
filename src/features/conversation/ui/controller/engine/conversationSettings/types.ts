import type { MutableRefObject } from 'react'
import type { ConversationRepository } from '../../../../infra/conversationRepository'
import type { ConversationAction, ConversationState } from '../../../../state/conversationState'
import type { PanelValueFormat, PanelVariableRow } from '../../../../domain/types'
import type {
  Conversation,
  ImageRuntimeSettings,
  LoggingSettings,
  Side,
  SideMode,
  SingleSideSettings,
} from '../../../../../../types/conversation'
import type { ModelCatalog } from '../../../../../../types/model'

export interface ConversationActions {
  setDynamicPromptEnabled: (value: boolean) => void
  setAutoRenameConversationTitle: (value: boolean) => void
  setAutoRenameConversationTitleModelId: (value: string | null) => void
  setPanelValueFormat: (value: PanelValueFormat) => void
  setPanelVariables: (value: PanelVariableRow[]) => void
}

export interface SaveStagedSettingsInput {
  mode: SideMode
  sideCount: number
  settingsBySide: Record<Side, SingleSideSettings>
  overrides?: Partial<{
    runConcurrency: number
    runConcurrencyUnlimited: boolean
    dynamicPromptEnabled: boolean
    autoRenameConversationTitle: boolean
    autoRenameConversationTitleModelId: string | null
    panelValueFormat: PanelValueFormat
    panelVariables: PanelVariableRow[]
    favoriteModelIds: string[]
    imageRuntimeSettings: ImageRuntimeSettings
    loggingSettings: LoggingSettings
  }>
}

export interface ConversationSettingsModuleDeps {
  state: ConversationState
  stateRef: MutableRefObject<ConversationState>
  dispatch: (action: ConversationAction) => void
  actions: ConversationActions
  repository: ConversationRepository
  modelCatalog: ModelCatalog
  activeSideMode: SideMode
  activeSideCount: number
  activeSides: Side[]
  activeSettingsBySide: Record<Side, SingleSideSettings>
  isSideConfigLocked: boolean
  saveStagedSettings: (input: SaveStagedSettingsInput) => void
  persistConversation: (conversation: Conversation) => void
  setActiveConversation: (conversationId: string | null) => void
  clearDraftSourceImages: () => void
}
