import { useMemo } from 'react'
import {
  createConversationCommandGroups,
  createConversationReadSlices,
} from './conversationControllerBindings'
import { useConversationController } from '../useConversationController'

export function useConversationWorkspaceController() {
  const controller = useConversationController()
  const readSlices = useMemo(() => createConversationReadSlices(controller.read), [controller.read])
  const actions = useMemo(() => createConversationCommandGroups(controller.dispatch), [controller.dispatch])

  return {
    ...readSlices.sidebar,
    ...readSlices.composer,
    ...readSlices.workspace,
    ...readSlices.settings,
    setDraft: actions.draft.setDraft,
    appendDraftSourceImages: actions.draft.appendDraftSourceImages,
    removeDraftSourceImage: actions.draft.removeDraftSourceImage,
    clearDraftSourceImages: actions.draft.clearDraftSourceImages,
    setShowAdvancedVariables: actions.presentation.setShowAdvancedVariables,
    setDynamicPromptEnabled: actions.presentation.setDynamicPromptEnabled,
    setAutoRenameConversationTitle: actions.presentation.setAutoRenameConversationTitle,
    setAutoRenameConversationTitleModelId: actions.presentation.setAutoRenameConversationTitleModelId,
    setPanelValueFormat: actions.draft.setPanelValueFormat,
    setPanelVariables: actions.draft.setPanelVariables,
    setFavoriteModelIds: actions.settings.setFavoriteModelIds,
    setRunConcurrency: actions.settings.setRunConcurrency,
    setRunConcurrencyUnlimited: actions.settings.setRunConcurrencyUnlimited,
    setImageRuntimeSettings: actions.settings.setImageRuntimeSettings,
    setLoggingSettings: actions.settings.setLoggingSettings,
    createNewConversation: actions.lifecycle.createNewConversation,
    clearAllConversations: actions.lifecycle.clearAllConversations,
    removeConversation: actions.lifecycle.removeConversation,
    renameConversation: actions.lifecycle.renameConversation,
    togglePinConversation: actions.lifecycle.togglePinConversation,
    switchConversation: actions.lifecycle.switchConversation,
    updateSideMode: actions.settings.updateSideMode,
    updateSideCount: actions.settings.updateSideCount,
    updateSideSettings: actions.settings.updateSideSettings,
    updateSidesSettings: actions.settings.updateSidesSettings,
    setGenerationMode: actions.settings.setGenerationMode,
    setSideModel: actions.settings.setSideModel,
    setSideModelForCurrentMode: actions.settings.setSideModelForCurrentMode,
    applyModelShortcut: actions.settings.applyModelShortcut,
    setSideModelParam: actions.settings.setSideModelParam,
    setChannels: actions.settings.setChannels,
    sendDraft: actions.run.sendDraft,
    loadOlderMessages: actions.lifecycle.loadOlderMessages,
    retryRun: actions.run.retryRun,
    editRunTemplate: actions.run.editRunTemplate,
    cancelMessageRuns: actions.run.cancelMessageRuns,
    replayRunAsNewMessage: actions.run.replayRunAsNewMessage,
    downloadAllRunImages: actions.download.downloadAllRunImages,
    downloadSingleRunImage: actions.download.downloadSingleRunImage,
    downloadBatchRunImages: actions.download.downloadBatchRunImages,
    downloadMessageRunImages: actions.download.downloadMessageRunImages,
    readSlices,
    actionGroups: actions,
  }
}
