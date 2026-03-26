import {
  clearConversationsFromStorage,
  loadChannelsFromStorage,
  loadConversationContentById,
  loadConversationIndexFromStorage,
  loadStagedSettingsFromStorage,
  migrateLegacyConversationContent,
  removeConversationContentFromStorage,
  saveActiveConversationId,
  saveChannelsToStorage,
  saveConversationContent,
  saveIndex,
  saveStagedSettingsToStorage,
} from '../../../services/conversationStorage'
import type { ApiChannel } from '../../../types/channel'
import type {
  Conversation,
  ConversationSummary,
  ImageRuntimeSettings,
  LoggingSettings,
  Side,
  SideMode,
  SingleSideSettings,
} from '../../../types/conversation'
import type { PanelValueFormat, PanelVariableRow } from '../domain/types'

export interface ConversationRepository {
  load: () => {
    summaries: ConversationSummary[]
    activeId: string | null
  }
  loadConversation: (conversationId: string, fallbackTitle?: string) => Promise<Conversation | null>
  loadConversations: (conversationIds: string[]) => Promise<Conversation[]>
  migrateLegacyContent: (summaryIds: string[]) => Promise<void>
  loadChannels: () => ApiChannel[]
  loadStagedSettings: () => {
    sideMode: SideMode
    sideCount?: number
    settingsBySide?: Partial<Record<Side, SingleSideSettings>>
    runConcurrency?: number
    runConcurrencyUnlimited?: boolean
    dynamicPromptEnabled?: boolean
    autoRenameConversationTitle?: boolean
    autoRenameConversationTitleModelId?: string | null
    panelValueFormat?: PanelValueFormat
    panelVariables?: PanelVariableRow[]
    favoriteModelIds?: string[]
    imageRuntimeSettings?: Partial<ImageRuntimeSettings>
    loggingSettings?: Partial<LoggingSettings>
  } | null
  saveIndex: (summaries: ConversationSummary[]) => void
  saveConversation: (conversation: Conversation) => Promise<void>
  removeConversation: (conversationId: string) => Promise<void>
  clearConversations: () => Promise<void>
  saveActiveId: (conversationId: string | null) => void
  saveChannels: (channels: ApiChannel[]) => void
  saveStagedSettings: (input: {
    sideMode: SideMode
    sideCount: number
    settingsBySide: Record<Side, SingleSideSettings>
    runConcurrency: number
    runConcurrencyUnlimited: boolean
    dynamicPromptEnabled: boolean
    autoRenameConversationTitle: boolean
    autoRenameConversationTitleModelId?: string | null
    panelValueFormat: PanelValueFormat
    panelVariables: PanelVariableRow[]
    favoriteModelIds: string[]
    imageRuntimeSettings?: ImageRuntimeSettings
    loggingSettings?: LoggingSettings
  }) => void
}

export function createConversationRepository(): ConversationRepository {
  return {
    load: () => loadConversationIndexFromStorage(),
    loadConversation: (conversationId, fallbackTitle) => loadConversationContentById(conversationId, fallbackTitle),
    loadConversations: async (conversationIds) => {
      const conversations = await Promise.all(
        conversationIds.map((conversationId) => loadConversationContentById(conversationId)),
      )
      return conversations.filter((conversation): conversation is Conversation => Boolean(conversation))
    },
    migrateLegacyContent: (summaryIds) => migrateLegacyConversationContent(summaryIds),
    loadChannels: () => loadChannelsFromStorage(),
    loadStagedSettings: () => loadStagedSettingsFromStorage(),
    saveIndex,
    saveConversation: saveConversationContent,
    removeConversation: removeConversationContentFromStorage,
    clearConversations: clearConversationsFromStorage,
    saveActiveId: (conversationId) => saveActiveConversationId(conversationId),
    saveChannels: saveChannelsToStorage,
    saveStagedSettings: ({
      sideMode,
      sideCount,
      settingsBySide,
      runConcurrency,
      runConcurrencyUnlimited,
      dynamicPromptEnabled,
      autoRenameConversationTitle,
      autoRenameConversationTitleModelId,
      panelValueFormat,
      panelVariables,
      favoriteModelIds,
      imageRuntimeSettings,
      loggingSettings,
    }) => {
      saveStagedSettingsToStorage({
        sideMode,
        sideCount,
        settingsBySide,
        runConcurrency,
        runConcurrencyUnlimited,
        dynamicPromptEnabled,
        autoRenameConversationTitle,
        autoRenameConversationTitleModelId,
        panelValueFormat,
        panelVariables,
        favoriteModelIds,
        imageRuntimeSettings,
        loggingSettings,
      })
    },
  }
}
