import type { ConversationReadModel } from '../../application/conversationControllerContract'

interface ConversationActionSet {
  setDraft: (value: string) => void
  setAdvancedVariables: (value: boolean) => void
  setDynamicPromptEnabled: (value: boolean) => void
  setAutoRenameConversationTitle: (value: boolean) => void
  setAutoRenameConversationTitleModelId: (value: string | null) => void
  setPanelValueFormat: (value: ConversationReadModel['panelValueFormat']) => void
  setPanelVariables: (value: ConversationReadModel['panelVariables']) => void
}

interface ConversationSettingsModule {
  createNewConversation: () => void
  updateSideMode: (mode: ConversationReadModel['activeSideMode']) => void
  updateSideCount: (count: number) => void
  updateSideSettings: (side: string, patch: Partial<ConversationReadModel['activeSettingsBySide'][string]>) => void
  updateSidesSettings: (sides: string[], patch: Partial<ConversationReadModel['activeSettingsBySide'][string]>) => void
  setGenerationMode: (mode: 'image' | 'text') => void
  setSideModel: (side: string, modelId: string) => void
  setSideModelForCurrentMode: (side: string, modelId: string) => void
  applyModelShortcut: (modelId: string) => void
  setSideModelParam: (side: string, paramKey: string, value: string | number | boolean) => void
  setFavoriteModelIds: (value: string[]) => void
  setChannels: (channels: ConversationReadModel['channels']) => void
  setRunConcurrency: (value: number) => void
  setRunConcurrencyUnlimited: (value: boolean) => void
  setImageRuntimeSettings: (value: Partial<ConversationReadModel['imageRuntimeSettings']>) => void
  setLoggingSettings: (value: Partial<ConversationReadModel['loggingSettings']>) => void
  setDynamicPromptEnabled: (value: boolean) => void
  setAutoRenameConversationTitle: (value: boolean) => void
  setAutoRenameConversationTitleModelId: (value: string | null) => void
  setPanelValueFormat: (value: ConversationReadModel['panelValueFormat']) => void
  setPanelVariables: (value: ConversationReadModel['panelVariables']) => void
}

interface ConversationListCommands {
  switchConversation: (conversationId: string) => void
  clearAllConversations: () => void
  removeConversation: (conversationId: string) => void
  renameConversation: (conversationId: string, title: string) => void
  togglePinConversation: (conversationId: string) => void
}

interface ConversationSendFlow {
  appendDraftSourceImages: (files: File[]) => void
  sendDraft: () => Promise<void>
  retryRun: (runId: string) => Promise<void>
  editRunTemplate: (runId: string) => Promise<void>
  cancelMessageRuns: (conversationId: string, messageId: string, runIds: string[]) => Promise<void>
  replayRunAsNewMessage: (runId: string) => void
}

interface ConversationDownloadFlow {
  downloadAllRunImages: (runId: string) => void
  downloadSingleRunImage: (runId: string, imageId: string) => void
  downloadBatchRunImages: (runId: string) => void
  downloadMessageRunImages: (runIds: string[]) => Promise<void>
}

interface CreateConversationCommandFactoryInput {
  actions: ConversationActionSet
  removeDraftSourceImage: (imageId: string) => void
  clearDraftSourceImages: () => void
  conversationSettings: ConversationSettingsModule
  conversationListCommands: ConversationListCommands
  sendFlow: ConversationSendFlow
  downloadFlow: ConversationDownloadFlow
  loadOlderMessages: () => Promise<void>
  flushPendingPersistence: () => Promise<void>
}

export function createConversationCommandFactory(input: CreateConversationCommandFactoryInput) {
  return {
    commands: {
      setDraft: input.actions.setDraft,
      appendDraftSourceImages: input.sendFlow.appendDraftSourceImages,
      removeDraftSourceImage: input.removeDraftSourceImage,
      clearDraftSourceImages: input.clearDraftSourceImages,
      setShowAdvancedVariables: input.actions.setAdvancedVariables,
      setDynamicPromptEnabled: input.conversationSettings.setDynamicPromptEnabled,
      setAutoRenameConversationTitle: input.conversationSettings.setAutoRenameConversationTitle,
      setAutoRenameConversationTitleModelId: input.conversationSettings.setAutoRenameConversationTitleModelId,
      setPanelValueFormat: input.conversationSettings.setPanelValueFormat,
      setPanelVariables: input.conversationSettings.setPanelVariables,
      setFavoriteModelIds: input.conversationSettings.setFavoriteModelIds,
      setRunConcurrency: input.conversationSettings.setRunConcurrency,
      setRunConcurrencyUnlimited: input.conversationSettings.setRunConcurrencyUnlimited,
      setImageRuntimeSettings: input.conversationSettings.setImageRuntimeSettings,
      setLoggingSettings: input.conversationSettings.setLoggingSettings,
      createNewConversation: input.conversationSettings.createNewConversation,
      clearAllConversations: input.conversationListCommands.clearAllConversations,
      removeConversation: input.conversationListCommands.removeConversation,
      renameConversation: input.conversationListCommands.renameConversation,
      togglePinConversation: input.conversationListCommands.togglePinConversation,
      switchConversation: input.conversationListCommands.switchConversation,
      updateSideMode: input.conversationSettings.updateSideMode,
      updateSideCount: input.conversationSettings.updateSideCount,
      updateSideSettings: input.conversationSettings.updateSideSettings,
      updateSidesSettings: input.conversationSettings.updateSidesSettings,
      setGenerationMode: input.conversationSettings.setGenerationMode,
      setSideModel: input.conversationSettings.setSideModel,
      setSideModelForCurrentMode: input.conversationSettings.setSideModelForCurrentMode,
      applyModelShortcut: input.conversationSettings.applyModelShortcut,
      setSideModelParam: input.conversationSettings.setSideModelParam,
      setChannels: input.conversationSettings.setChannels,
      sendDraft: input.sendFlow.sendDraft,
      loadOlderMessages: input.loadOlderMessages,
      retryRun: input.sendFlow.retryRun,
      editRunTemplate: input.sendFlow.editRunTemplate,
      cancelMessageRuns: input.sendFlow.cancelMessageRuns,
      replayRunAsNewMessage: input.sendFlow.replayRunAsNewMessage,
      downloadAllRunImages: input.downloadFlow.downloadAllRunImages,
      downloadSingleRunImage: input.downloadFlow.downloadSingleRunImage,
      downloadBatchRunImages: input.downloadFlow.downloadBatchRunImages,
      downloadMessageRunImages: input.downloadFlow.downloadMessageRunImages,
    },
    maintenance: {
      flushPendingPersistence: input.flushPendingPersistence,
    },
  }
}
