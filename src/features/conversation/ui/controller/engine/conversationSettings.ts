import { createChannelCatalogCommands } from './conversationSettings/channelCatalogCommands'
import { createModelSelectionCommands } from './conversationSettings/modelSelectionCommands'
import { createPreferencesCommands } from './conversationSettings/preferencesCommands'
import { createUpdateConversationState } from './conversationSettings/shared'
import { createSideLayoutCommands } from './conversationSettings/sideLayoutCommands'
import type { ConversationSettingsModuleDeps } from './conversationSettings/types'

export type {
  ConversationActions,
  ConversationSettingsModuleDeps,
  SaveStagedSettingsInput,
} from './conversationSettings/types'

export function createConversationSettingsModule(deps: ConversationSettingsModuleDeps) {
  const updateConversationState = createUpdateConversationState({
    state: deps.state,
    stateRef: deps.stateRef,
    modelCatalog: deps.modelCatalog,
    saveStagedSettings: deps.saveStagedSettings,
    persistConversation: deps.persistConversation,
  })

  const sideLayoutCommands = createSideLayoutCommands({
    dispatch: deps.dispatch,
    state: deps.state,
    activeSideMode: deps.activeSideMode,
    activeSideCount: deps.activeSideCount,
    activeSettingsBySide: deps.activeSettingsBySide,
    isSideConfigLocked: deps.isSideConfigLocked,
    saveStagedSettings: deps.saveStagedSettings,
    setActiveConversation: deps.setActiveConversation,
    updateConversationState,
  })

  const modelSelectionCommands = createModelSelectionCommands({
    stateChannels: deps.state.channels,
    modelCatalog: deps.modelCatalog,
    activeSideMode: deps.activeSideMode,
    activeSideCount: deps.activeSideCount,
    activeSides: deps.activeSides,
    activeSettingsBySide: deps.activeSettingsBySide,
    clearDraftSourceImages: deps.clearDraftSourceImages,
    updateConversationState,
  })

  const channelCatalogCommands = createChannelCatalogCommands({
    dispatch: deps.dispatch,
    actions: deps.actions,
    repository: deps.repository,
    stateRef: deps.stateRef,
    activeSideMode: deps.activeSideMode,
    activeSideCount: deps.activeSideCount,
    activeSettingsBySide: deps.activeSettingsBySide,
    saveStagedSettings: deps.saveStagedSettings,
    persistConversation: deps.persistConversation,
  })

  const preferencesCommands = createPreferencesCommands({
    dispatch: deps.dispatch,
    actions: deps.actions,
    stateRef: deps.stateRef,
    activeSideMode: deps.activeSideMode,
    activeSideCount: deps.activeSideCount,
    activeSettingsBySide: deps.activeSettingsBySide,
    saveStagedSettings: deps.saveStagedSettings,
    modelCatalog: deps.modelCatalog,
  })

  return {
    ...sideLayoutCommands,
    ...modelSelectionCommands,
    ...channelCatalogCommands,
    ...preferencesCommands,
  }
}
