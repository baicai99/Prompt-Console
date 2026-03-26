import type {
  ConversationCommand,
  ConversationCommandGroups,
  ConversationReadModel,
  ConversationReadSlices,
} from '../../application/conversationControllerContract'

export function createConversationReadSlices(read: ConversationReadModel): ConversationReadSlices {
  return {
    sidebar: {
      summaries: read.summaries,
      activeId: read.activeId,
      shouldConfirmCreateConversation: read.shouldConfirmCreateConversation,
    },
    composer: {
      draft: read.draft,
      draftSourceImages: read.draftSourceImages,
      sendError: read.sendError,
      isSending: read.isSending,
      showAdvancedVariables: read.showAdvancedVariables,
      dynamicPromptEnabled: read.dynamicPromptEnabled,
      panelValueFormat: read.panelValueFormat,
      panelVariables: read.panelVariables,
      resolvedVariables: read.resolvedVariables,
      templatePreview: read.templatePreview,
      unusedVariableKeys: read.unusedVariableKeys,
      isSendBlocked: read.isSendBlocked,
      panelBatchError: read.panelBatchError,
      panelMismatchRowIds: read.panelMismatchRowIds,
      activeSideMode: read.activeSideMode,
      isSideConfigLocked: read.isSideConfigLocked,
    },
    workspace: {
      activeConversation: read.activeConversation,
      imageTasksByRunId: read.imageTasksByRunId,
      historyVisibleLimit: read.historyVisibleLimit,
      historyPageSize: read.historyPageSize,
      isLoadingOlderMessages: read.isLoadingOlderMessages,
      sendScrollTrigger: read.sendScrollTrigger,
      sendScrollTargetMessageId: read.sendScrollTargetMessageId,
      replayingRunIds: read.replayingRunIds,
      activeSideMode: read.activeSideMode,
      activeSideCount: read.activeSideCount,
      activeSides: read.activeSides,
      activeSettingsBySide: read.activeSettingsBySide,
      workspaceDiagnostics: read.workspaceDiagnostics,
    },
    settings: {
      autoRenameConversationTitle: read.autoRenameConversationTitle,
      autoRenameConversationTitleModelId: read.autoRenameConversationTitleModelId,
      favoriteModelIds: read.favoriteModelIds,
      runConcurrency: read.runConcurrency,
      runConcurrencyUnlimited: read.runConcurrencyUnlimited,
      imageRuntimeSettings: read.imageRuntimeSettings,
      loggingSettings: read.loggingSettings,
      activeSideMode: read.activeSideMode,
      activeSideCount: read.activeSideCount,
      activeSides: read.activeSides,
      isSideConfigLocked: read.isSideConfigLocked,
      activeSettingsBySide: read.activeSettingsBySide,
      modelCatalog: read.modelCatalog,
      channels: read.channels,
    },
  }
}

export function createConversationCommandGroups(
  dispatch: (command: ConversationCommand) => Promise<void>,
): ConversationCommandGroups {
  return {
    draft: {
      setDraft: (value) => { void dispatch({ type: 'draft/set', value }) },
      appendDraftSourceImages: (files) => { void dispatch({ type: 'draft/source-images/append', files }) },
      removeDraftSourceImage: (imageId) => { void dispatch({ type: 'draft/source-images/remove', imageId }) },
      clearDraftSourceImages: () => { void dispatch({ type: 'draft/source-images/clear' }) },
      setPanelValueFormat: (value) => { void dispatch({ type: 'variables/panel-format/set', value }) },
      setPanelVariables: (value) => { void dispatch({ type: 'variables/panel-rows/set', value }) },
    },
    presentation: {
      setShowAdvancedVariables: (value) => { void dispatch({ type: 'ui/advanced-variables/set', value }) },
      setDynamicPromptEnabled: (value) => { void dispatch({ type: 'ui/dynamic-prompt/set', value }) },
      setAutoRenameConversationTitle: (value) => { void dispatch({ type: 'ui/auto-rename-title/set', value }) },
      setAutoRenameConversationTitleModelId: (value) => { void dispatch({ type: 'ui/auto-rename-title-model/set', value }) },
    },
    lifecycle: {
      createNewConversation: () => { void dispatch({ type: 'conversation/create' }) },
      clearAllConversations: () => { void dispatch({ type: 'conversation/clear-all' }) },
      removeConversation: (conversationId) => { void dispatch({ type: 'conversation/remove', conversationId }) },
      renameConversation: (conversationId, title) => { void dispatch({ type: 'conversation/rename', conversationId, title }) },
      togglePinConversation: (conversationId) => { void dispatch({ type: 'conversation/toggle-pin', conversationId }) },
      switchConversation: (conversationId) => { void dispatch({ type: 'conversation/switch', conversationId }) },
      loadOlderMessages: () => { void dispatch({ type: 'history/load-older' }) },
    },
    settings: {
      setFavoriteModelIds: (value) => { void dispatch({ type: 'settings/favorite-models/set', value }) },
      setRunConcurrency: (value) => { void dispatch({ type: 'settings/run-concurrency/set', value }) },
      setRunConcurrencyUnlimited: (value) => { void dispatch({ type: 'settings/run-concurrency-unlimited/set', value }) },
      setImageRuntimeSettings: (value) => { void dispatch({ type: 'settings/image-runtime/update', value }) },
      setLoggingSettings: (value) => { void dispatch({ type: 'settings/logging/update', value }) },
      updateSideMode: (mode) => { void dispatch({ type: 'settings/side-mode/update', mode }) },
      updateSideCount: (count) => { void dispatch({ type: 'settings/side-count/update', count }) },
      updateSideSettings: (side, patch) => { void dispatch({ type: 'settings/side/update', side, patch }) },
      updateSidesSettings: (sides, patch) => { void dispatch({ type: 'settings/sides/update', sides, patch }) },
      setGenerationMode: (mode) => { void dispatch({ type: 'settings/generation-mode/set', mode }) },
      setSideModel: (side, modelId) => { void dispatch({ type: 'settings/side-model/set', side, modelId }) },
      setSideModelForCurrentMode: (side, modelId) => {
        void dispatch({ type: 'settings/side-model-current-mode/set', side, modelId })
      },
      applyModelShortcut: (modelId) => { void dispatch({ type: 'settings/model-shortcut/apply', modelId }) },
      setSideModelParam: (side, paramKey, value) => { void dispatch({ type: 'settings/side-param/set', side, paramKey, value }) },
      setChannels: (channels) => { void dispatch({ type: 'settings/channels/set', channels }) },
    },
    run: {
      sendDraft: () => dispatch({ type: 'send/execute' }),
      retryRun: (runId) => dispatch({ type: 'run/retry', runId }),
      editRunTemplate: (runId) => dispatch({ type: 'run/edit-template', runId }),
      cancelMessageRuns: (conversationId, messageId, runIds) =>
        dispatch({ type: 'run/cancel-message', conversationId, messageId, runIds }),
      replayRunAsNewMessage: (runId) => dispatch({ type: 'run/replay', runId }),
    },
    download: {
      downloadAllRunImages: (runId) => { void dispatch({ type: 'download/run/all', runId }) },
      downloadSingleRunImage: (runId, imageId) => { void dispatch({ type: 'download/run/single', runId, imageId }) },
      downloadBatchRunImages: (runId) => { void dispatch({ type: 'download/run/batch', runId }) },
      downloadMessageRunImages: (runIds) => dispatch({ type: 'download/message', runIds }),
    },
  }
}
