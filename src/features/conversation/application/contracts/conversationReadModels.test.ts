import { describe, expect, it } from 'vitest'
import type { ConversationReadModel } from '../conversationControllerContract'
import { createConversationReadSlices } from '../../ui/controller/conversationControllerBindings'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../../../utils/imageRuntimeSettings'
import { DEFAULT_LOGGING_SETTINGS } from '../../../../utils/loggingSettings'

function createReadModel(): ConversationReadModel {
  return {
    summaries: [],
    activeId: null,
    shouldConfirmCreateConversation: false,
    draft: '',
    draftSourceImages: [],
    sendError: '',
    isSending: false,
    showAdvancedVariables: false,
    dynamicPromptEnabled: false,
    panelValueFormat: 'json',
    panelVariables: [],
    resolvedVariables: {},
    templatePreview: { ok: true, missingKeys: [], finalPrompt: '' },
    unusedVariableKeys: [],
    isSendBlocked: false,
    panelBatchError: '',
    panelMismatchRowIds: [],
    activeConversation: null,
    imageTasksByRunId: {},
    historyVisibleLimit: 60,
    historyPageSize: 50,
    isLoadingOlderMessages: false,
    sendScrollTrigger: 0,
    sendScrollTargetMessageId: null,
    replayingRunIds: [],
    activeSideMode: 'single',
    isSideConfigLocked: false,
    activeSideCount: 1,
    activeSides: ['left'],
    activeSettingsBySide: {
      left: {
        resolution: '1024',
        aspectRatio: '1:1',
        imageCount: 1,
        gridColumns: 1,
        sizeMode: 'preset',
        customWidth: 1024,
        customHeight: 1024,
        autoSave: false,
        channelId: null,
        modelId: '',
        paramValues: {},
      },
    },
    autoRenameConversationTitle: false,
    autoRenameConversationTitleModelId: null,
    favoriteModelIds: [],
    runConcurrency: 1,
    runConcurrencyUnlimited: false,
    imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
    loggingSettings: DEFAULT_LOGGING_SETTINGS,
    modelCatalog: { models: [] },
    channels: [],
    workspaceDiagnostics: {
      summariesCount: 0,
      loadedConversationCount: 0,
      runtimeTaskConversationCount: 0,
      runtimeTaskTotalCount: 0,
      activeConversationMessageCount: 0,
      activeConversationRunCount: 0,
      activeConversationImageCount: 0,
      activeConversationTaskCount: 0,
      activeConversationLiveFeedCount: 0,
      inlineImageCount: 0,
      inlineImageBytes: 0,
      idbBackedImageCount: 0,
      directUrlImageCount: 0,
      activeTaskCount: 0,
      settledTaskCount: 0,
      draftCharacterCount: 0,
      panelVariableRowCount: 0,
      resolvedVariableCount: 0,
      unusedVariableCount: 0,
      draftSourceImageCount: 0,
      draftSourcePreviewUrlCount: 0,
      totalDraftSourceBytes: 0,
      replayingRunIdsCount: 0,
      historyVisibleLimit: 60,
      isLoadingOlderMessages: false,
      sendScrollTrigger: 0,
      pendingPersistConversationCount: 0,
      persistTimerActive: false,
      resumePollTimerActive: false,
      backgroundResumePollTimerActive: false,
      resumePollInFlight: false,
      backgroundResumePollInFlight: false,
      conversationCacheOrderCount: 0,
      runLocationConversationCount: 0,
      runLocationEntryCount: 0,
      activeRunControllerConversationCount: 0,
      activeRunControllerCount: 0,
      resumingImageCount: 0,
      runCompletionSignatureCount: 0,
      backgroundPollOwnerId: 'window:test',
      globalSubmitMax: 1,
      globalSubmitActive: 0,
      globalSubmitQueued: 0,
      logEntryCount: 0,
      logBufferLimit: 0,
      uiRenderCacheSize: 0,
      logSubscriberCount: 0,
      loggingEnabled: false,
      loggingDetailLevel: 'brief',
    },
  }
}

describe('createConversationReadSlices', () => {
  it('maps the workspace slice including older-message loading state', () => {
    const read = createReadModel()

    const slices = createConversationReadSlices(read)

    expect(slices.workspace.historyVisibleLimit).toBe(60)
    expect(slices.workspace.isLoadingOlderMessages).toBe(false)
    expect(slices.workspace.sendScrollTargetMessageId).toBeNull()
  })
})
