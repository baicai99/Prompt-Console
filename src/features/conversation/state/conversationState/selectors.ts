import {
  getUnusedVariableKeys,
  previewTemplate,
} from '../../domain/templatePreview'
import { collectVariables } from '../../domain/panelVariableParsing'
import type {
  Conversation,
  Side,
  SideMode,
  SingleSideSettings,
} from '../../../../types/conversation'
import type {
  ConversationComposerState,
  ConversationContentState,
  ConversationRuntimeState,
  ConversationSettingsState,
  ConversationState,
} from './types'

export interface ConversationSelectors {
  selectContentState: (state: ConversationState) => ConversationContentState
  selectRuntimeState: (state: ConversationState) => ConversationRuntimeState
  selectComposerState: (state: ConversationState) => ConversationComposerState
  selectSettingsState: (state: ConversationState) => ConversationSettingsState
  selectActiveConversation: (state: ConversationState) => Conversation | null
  selectActiveSettings: (
    state: ConversationState,
  ) => {
    activeSideMode: SideMode
    activeSideCount: number
    activeSettingsBySide: Record<Side, SingleSideSettings>
  }
  selectTemplatePreview: (state: ConversationState) => {
    resolvedVariables: Record<string, string>
    templatePreview: ReturnType<typeof previewTemplate>
    unusedVariableKeys: string[]
  }
  selectSendStatus: (state: ConversationState) => { isSending: boolean; sendError: string }
}

export const conversationSelectors: ConversationSelectors = {
  selectContentState: (state) => ({
    summaries: state.summaries,
    contents: state.contents,
    activeId: state.activeId,
  }),
  selectRuntimeState: (state) => ({
    runtimeTasksByConversationId: state.runtimeTasksByConversationId,
  }),
  selectComposerState: (state) => ({
    draft: state.draft,
    sendError: state.sendError,
    isSending: state.isSending,
    showAdvancedVariables: state.showAdvancedVariables,
    dynamicPromptEnabled: state.dynamicPromptEnabled,
    autoRenameConversationTitle: state.autoRenameConversationTitle,
    autoRenameConversationTitleModelId: state.autoRenameConversationTitleModelId,
    panelValueFormat: state.panelValueFormat,
    panelVariables: state.panelVariables,
  }),
  selectSettingsState: (state) => ({
    favoriteModelIds: state.favoriteModelIds,
    runConcurrency: state.runConcurrency,
    runConcurrencyUnlimited: state.runConcurrencyUnlimited,
    imageRuntimeSettings: state.imageRuntimeSettings,
    loggingSettings: state.loggingSettings,
    stagedSideMode: state.stagedSideMode,
    stagedSideCount: state.stagedSideCount,
    stagedSettingsBySide: state.stagedSettingsBySide,
    channels: state.channels,
  }),
  selectActiveConversation: (state) => (state.activeId ? state.contents[state.activeId] ?? null : null),
  selectActiveSettings: (state) => {
    const activeConversation = state.activeId ? state.contents[state.activeId] ?? null : null
    return {
      activeSideMode: activeConversation?.sideMode ?? state.stagedSideMode,
      activeSideCount: activeConversation?.sideCount ?? state.stagedSideCount,
      activeSettingsBySide: activeConversation?.settingsBySide ?? state.stagedSettingsBySide,
    }
  },
  selectTemplatePreview: (state) => {
    if (!state.dynamicPromptEnabled) {
      return {
        resolvedVariables: {},
        templatePreview: {
          ok: true as const,
          finalPrompt: state.draft,
          missingKeys: [],
        },
        unusedVariableKeys: [],
      }
    }

    const resolvedVariables = collectVariables(state.panelVariables, state.panelValueFormat)

    return {
      resolvedVariables,
      templatePreview: previewTemplate(state.draft, resolvedVariables),
      unusedVariableKeys: getUnusedVariableKeys(state.draft, resolvedVariables),
    }
  },
  selectSendStatus: (state) => ({ isSending: state.isSending, sendError: state.sendError }),
}
