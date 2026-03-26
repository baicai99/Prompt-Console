import { describe, expect, it, vi } from 'vitest'
import {
  type ConversationReadModel,
} from '../conversationControllerContract'
import {
  createConversationCommandGroups,
  createConversationReadSlices,
} from '../../ui/controller/conversationControllerBindings'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../../../utils/imageRuntimeSettings'
import { DEFAULT_LOGGING_SETTINGS } from '../../../../utils/loggingSettings'

const readModel: ConversationReadModel = {
  summaries: [{ id: 'c1', title: 'One', createdAt: '2026-03-01', updatedAt: '2026-03-01', lastMessagePreview: 'hi' }],
  activeConversation: null,
  shouldConfirmCreateConversation: false,
  activeId: 'c1',
  draft: 'hello',
  draftSourceImages: [],
  sendError: '',
  isSending: false,
  showAdvancedVariables: true,
  dynamicPromptEnabled: true,
  autoRenameConversationTitle: false,
  autoRenameConversationTitleModelId: null,
  panelValueFormat: 'json',
  panelVariables: [],
  favoriteModelIds: ['m1'],
  runConcurrency: 2,
  runConcurrencyUnlimited: false,
  imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
  loggingSettings: DEFAULT_LOGGING_SETTINGS,
  imageTasksByRunId: {},
  historyVisibleLimit: 20,
  historyPageSize: 10,
  isLoadingOlderMessages: false,
  sendScrollTrigger: 1,
  sendScrollTargetMessageId: 'msg-1',
  resolvedVariables: { name: 'cat' },
  templatePreview: { ok: true, finalPrompt: 'hello', missingKeys: [] },
  unusedVariableKeys: [],
  activeSideMode: 'single',
  activeSideCount: 2,
  activeSides: ['single'],
  isSideConfigLocked: false,
  activeSettingsBySide: {
    single: {
      generationMode: 'image',
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount: 1,
      gridColumns: 1,
      sizeMode: 'preset',
      customWidth: 1024,
      customHeight: 1024,
      autoSave: false,
      channelId: 'ch',
      modelId: 'm1',
      paramValues: {},
    },
  },
  modelCatalog: { models: [{ id: 'm1', name: 'Model 1', params: [] }] },
  channels: [{ id: 'ch', name: 'main', baseUrl: 'https://example.com', apiKey: 'k' }],
  isSendBlocked: false,
  panelBatchError: '',
  panelMismatchRowIds: [],
  replayingRunIds: [],
  workspaceDiagnostics: {
    summariesCount: 1,
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
    draftCharacterCount: 5,
    panelVariableRowCount: 0,
    resolvedVariableCount: 1,
    unusedVariableCount: 0,
    draftSourceImageCount: 0,
    draftSourcePreviewUrlCount: 0,
    totalDraftSourceBytes: 0,
    replayingRunIdsCount: 0,
    historyVisibleLimit: 20,
    isLoadingOlderMessages: false,
    sendScrollTrigger: 1,
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

describe('conversationControllerContract', () => {
  it('splits read model into stable slices', () => {
    const slices = createConversationReadSlices(readModel)

    expect(slices.sidebar.activeId).toBe('c1')
    expect(slices.composer.draft).toBe('hello')
    expect(slices.workspace.historyVisibleLimit).toBe(20)
    expect(slices.workspace.sendScrollTargetMessageId).toBe('msg-1')
    expect(slices.settings.modelCatalog.models[0]?.id).toBe('m1')
  })

  it('maps grouped commands back to controller dispatch', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const groups = createConversationCommandGroups(dispatch)

    groups.draft.setDraft('next')
    groups.settings.updateSideMode('multi')
    groups.settings.setRunConcurrencyUnlimited(true)
    await groups.run.sendDraft()
    await groups.download.downloadMessageRunImages(['r1'])

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'draft/set', value: 'next' })
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'settings/side-mode/update', mode: 'multi' })
    expect(dispatch).toHaveBeenNthCalledWith(3, { type: 'settings/run-concurrency-unlimited/set', value: true })
    expect(dispatch).toHaveBeenNthCalledWith(4, { type: 'send/execute' })
    expect(dispatch).toHaveBeenNthCalledWith(5, { type: 'download/message', runIds: ['r1'] })
  })
})
