import type { MutableRefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ApiChannel } from '../../../../../types/channel'
import type { Conversation, Run, Side, SingleSideSettings } from '../../../../../types/conversation'
import type { ModelCatalog } from '../../../../../types/model'
import type { ConversationState } from '../../../state/conversationState'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../../../../utils/imageRuntimeSettings'
import { DEFAULT_LOGGING_SETTINGS } from '../../../../../utils/loggingSettings'
import { createSendFlowModule } from './sendFlow'

function createImageSettings(channelId: string): SingleSideSettings {
  return {
    generationMode: 'image',
    resolution: '1K',
    aspectRatio: '1:1',
    imageCount: 4,
    gridColumns: 4,
    sizeMode: 'preset',
    customWidth: 1024,
    customHeight: 1024,
    autoSave: false,
    channelId,
    modelId: 'model-a',
    textModelId: 'model-a',
    paramValues: {},
  }
}

function createTextSettings(channelId: string, modelId = 'gpt-4o'): SingleSideSettings {
  return {
    generationMode: 'text',
    resolution: '1K',
    aspectRatio: '1:1',
    imageCount: 1,
    gridColumns: 1,
    sizeMode: 'preset',
    customWidth: 1024,
    customHeight: 1024,
    autoSave: false,
    channelId,
    modelId,
    textModelId: modelId,
    paramValues: {},
  }
}

function createPendingRun(input: {
  id: string
  batchId: string
  side: Side
  channel: ApiChannel
}): Run {
  return {
    id: input.id,
    batchId: input.batchId,
    createdAt: '2026-03-10T00:00:00.000Z',
    sideMode: 'multi',
    side: input.side,
    prompt: 'draw cat',
    imageCount: 4,
    channelId: input.channel.id,
    channelName: input.channel.name,
    modelId: 'model-a',
    modelName: 'Model A',
    templatePrompt: 'draw cat',
    finalPrompt: 'draw cat',
    variablesSnapshot: {},
    paramsSnapshot: {},
    sourceImages: [],
    settingsSnapshot: {
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount: 4,
      gridColumns: 4,
      sizeMode: 'preset',
      customWidth: 1024,
      customHeight: 1024,
      autoSave: false,
    },
    retryAttempt: 0,
    images: Array.from({ length: 4 }, (_, index) => ({
      id: `${input.id}-img-${index + 1}`,
      seq: index + 1,
      status: 'pending' as const,
      threadState: 'active' as const,
    })),
  }
}

describe('createSendFlowModule', () => {
  it('keeps requested run concurrency for multi-window image sends', async () => {
    const channel: ApiChannel = {
      id: 'ch-1',
      name: 'Main',
      baseUrl: 'https://example.com/v1',
      apiKey: 'key',
      models: ['model-a'],
    }
    const settingsBySide = {
      single: createImageSettings(channel.id),
      'win-1': createImageSettings(channel.id),
      'win-2': createImageSettings(channel.id),
    } satisfies Record<Side, SingleSideSettings>
    const state: ConversationState = {
      summaries: [],
      contents: {},
      runtimeTasksByConversationId: {},
      activeId: null,
      draft: 'draw cat',
      sendError: '',
      isSending: false,
      showAdvancedVariables: false,
      dynamicPromptEnabled: false,
      autoRenameConversationTitle: false,
      autoRenameConversationTitleModelId: null,
      panelValueFormat: 'json',
      panelVariables: [{ id: 'row-1', key: '', valuesText: '', selectedValue: '' }],
      favoriteModelIds: [],
      runConcurrency: 2,
      runConcurrencyUnlimited: false,
      imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
      loggingSettings: DEFAULT_LOGGING_SETTINGS,
      stagedSideMode: 'multi',
      stagedSideCount: 2,
      stagedSettingsBySide: settingsBySide,
      channels: [channel],
    }
    const stateRef = { current: state } as MutableRefObject<ConversationState>
    const draftSourceImagesRef = { current: [] } as MutableRefObject<[]>
    const pendingRunA = createPendingRun({ id: 'run-a', batchId: 'batch-1', side: 'win-1', channel })
    const pendingRunB = createPendingRun({ id: 'run-b', batchId: 'batch-1', side: 'win-2', channel })
    const modelCatalog: ModelCatalog = {
      models: [{ id: 'model-a', name: 'Model A', params: [] }],
    }
    const plan = {
      ok: true as const,
      value: {
        batchId: 'batch-1',
        userPrompt: 'draw cat',
        templatePrompt: 'draw cat',
        finalPrompt: 'draw cat',
        variablesSnapshot: {},
        mode: 'multi' as const,
        sideCount: 2,
        settingsBySide,
        runPlans: [
          {
            side: 'win-1' as const,
            settings: settingsBySide['win-1'],
            modelId: 'model-a',
            modelName: 'Model A',
            paramsSnapshot: {},
            sourceImages: [],
            channel,
            pendingRun: pendingRunA,
          },
          {
            side: 'win-2' as const,
            settings: settingsBySide['win-2'],
            modelId: 'model-a',
            modelName: 'Model A',
            paramsSnapshot: {},
            sourceImages: [],
            channel,
            pendingRun: pendingRunB,
          },
        ],
        imageTasks: [
          {
            taskId: 'task-a',
            runId: pendingRunA.id,
            batchId: 'batch-1',
            side: 'win-1',
            seq: 1,
            finalPrompt: pendingRunA.finalPrompt,
            status: 'queued' as const,
            createdAt: pendingRunA.createdAt,
            queuedAt: pendingRunA.createdAt,
            threadState: 'active' as const,
          },
          {
            taskId: 'task-b',
            runId: pendingRunB.id,
            batchId: 'batch-1',
            side: 'win-2',
            seq: 1,
            finalPrompt: pendingRunB.finalPrompt,
            status: 'queued' as const,
            createdAt: pendingRunB.createdAt,
            queuedAt: pendingRunB.createdAt,
            threadState: 'active' as const,
          },
        ],
        pendingRuns: [pendingRunA, pendingRunB],
      },
    }
    const executeRunPlans = vi.fn().mockResolvedValue([pendingRunA, pendingRunB])
    const persistConversation = vi.fn((conversation: Conversation) => {
      stateRef.current = {
        ...stateRef.current,
        contents: {
          ...stateRef.current.contents,
          [conversation.id]: conversation,
        },
      }
    })

    const sendFlow = createSendFlowModule({
      stateRef,
      modelCatalog,
      orchestrator: {
        planSendDraft: vi.fn(() => plan),
        executeRunPlans,
        planRetry: vi.fn(),
        planReplay: vi.fn(),
        executeRetry: vi.fn(),
        executeReplay: vi.fn(),
      },
      streamText: vi.fn(),
      dispatch: vi.fn(),
      actions: { setDraft: vi.fn() },
      notifier: {
        info: vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
      },
      ensureConversationLoaded: vi.fn(),
      persistConversation,
      setActiveConversation: vi.fn(),
      setSendScrollTrigger: vi.fn(),
      setSendScrollTargetMessageId: vi.fn(),
      clearDraftSourceImages: vi.fn(),
      draftSourceImagesRef,
      appendSourceImageFiles: vi.fn(() => ({ invalidNames: [], droppedValidCount: 0 })),
      persistDraftSourceImages: vi.fn(),
      maxSourceImages: 4,
      applyModelShortcut: vi.fn(() => settingsBySide),
      resolveAdaptiveRunConcurrency: vi.fn(() => 2),
      registerActiveRun: vi.fn(),
      unregisterActiveRun: vi.fn(),
      isRunStillActive: vi.fn(() => true),
      updateImageTaskInConversation: vi.fn(),
      updateRunImageInConversation: vi.fn(),
      updateRunTaskStateInConversation: vi.fn(),
      replaceRunsInConversation: vi.fn(),
      appendRunsToMessage: vi.fn(),
      findRunInConversation: vi.fn(() => null),
      replayingRunIdsRef: { current: new Set<string>() },
      setReplayingRunIds: vi.fn(),
      updateAssistantMessageContent: vi.fn(),
    })

    await sendFlow.sendDraft()

    expect(executeRunPlans).toHaveBeenCalledTimes(1)
    expect(executeRunPlans.mock.calls[0]?.[1]).toHaveLength(2)
    expect(executeRunPlans.mock.calls[0]?.[2]).toBe(2)
  })

  it('uses max concurrency when unlimited mode is enabled', async () => {
    const channel: ApiChannel = {
      id: 'ch-1',
      name: 'Main',
      baseUrl: 'https://example.com/v1',
      apiKey: 'key',
      models: ['model-a'],
    }
    const settingsBySide = {
      single: createImageSettings(channel.id),
      'win-1': createImageSettings(channel.id),
      'win-2': createImageSettings(channel.id),
    } satisfies Record<Side, SingleSideSettings>
    const state: ConversationState = {
      summaries: [],
      contents: {},
      runtimeTasksByConversationId: {},
      activeId: null,
      draft: 'draw cat',
      sendError: '',
      isSending: false,
      showAdvancedVariables: false,
      dynamicPromptEnabled: false,
      autoRenameConversationTitle: false,
      autoRenameConversationTitleModelId: null,
      panelValueFormat: 'json',
      panelVariables: [{ id: 'row-1', key: '', valuesText: '', selectedValue: '' }],
      favoriteModelIds: [],
      runConcurrency: 1,
      runConcurrencyUnlimited: true,
      imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
      loggingSettings: DEFAULT_LOGGING_SETTINGS,
      stagedSideMode: 'multi',
      stagedSideCount: 2,
      stagedSettingsBySide: settingsBySide,
      channels: [channel],
    }
    const stateRef = { current: state } as MutableRefObject<ConversationState>
    const draftSourceImagesRef = { current: [] } as MutableRefObject<[]>
    const pendingRunA = createPendingRun({ id: 'run-a', batchId: 'batch-1', side: 'win-1', channel })
    const pendingRunB = createPendingRun({ id: 'run-b', batchId: 'batch-1', side: 'win-2', channel })
    const modelCatalog: ModelCatalog = {
      models: [{ id: 'model-a', name: 'Model A', params: [] }],
    }
    const plan = {
      ok: true as const,
      value: {
        batchId: 'batch-1',
        userPrompt: 'draw cat',
        templatePrompt: 'draw cat',
        finalPrompt: 'draw cat',
        variablesSnapshot: {},
        mode: 'multi' as const,
        sideCount: 2,
        settingsBySide,
        runPlans: [
          {
            side: 'win-1' as const,
            settings: settingsBySide['win-1'],
            modelId: 'model-a',
            modelName: 'Model A',
            paramsSnapshot: {},
            sourceImages: [],
            channel,
            pendingRun: pendingRunA,
          },
          {
            side: 'win-2' as const,
            settings: settingsBySide['win-2'],
            modelId: 'model-a',
            modelName: 'Model A',
            paramsSnapshot: {},
            sourceImages: [],
            channel,
            pendingRun: pendingRunB,
          },
        ],
        imageTasks: [
          {
            taskId: 'task-a1',
            runId: pendingRunA.id,
            batchId: 'batch-1',
            side: 'win-1',
            seq: 1,
            finalPrompt: pendingRunA.finalPrompt,
            status: 'queued' as const,
            createdAt: pendingRunA.createdAt,
            queuedAt: pendingRunA.createdAt,
            threadState: 'active' as const,
          },
          {
            taskId: 'task-a2',
            runId: pendingRunA.id,
            batchId: 'batch-1',
            side: 'win-1',
            seq: 2,
            finalPrompt: pendingRunA.finalPrompt,
            status: 'queued' as const,
            createdAt: pendingRunA.createdAt,
            queuedAt: pendingRunA.createdAt,
            threadState: 'active' as const,
          },
          {
            taskId: 'task-b1',
            runId: pendingRunB.id,
            batchId: 'batch-1',
            side: 'win-2',
            seq: 1,
            finalPrompt: pendingRunB.finalPrompt,
            status: 'queued' as const,
            createdAt: pendingRunB.createdAt,
            queuedAt: pendingRunB.createdAt,
            threadState: 'active' as const,
          },
        ],
        pendingRuns: [pendingRunA, pendingRunB],
      },
    }
    const executeRunPlans = vi.fn().mockResolvedValue([pendingRunA, pendingRunB])

    const sendFlow = createSendFlowModule({
      stateRef,
      modelCatalog,
      orchestrator: {
        planSendDraft: vi.fn(() => plan),
        executeRunPlans,
        planRetry: vi.fn(),
        planReplay: vi.fn(),
        executeRetry: vi.fn(),
        executeReplay: vi.fn(),
      },
      streamText: vi.fn(),
      dispatch: vi.fn(),
      actions: { setDraft: vi.fn() },
      notifier: {
        info: vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
      },
      ensureConversationLoaded: vi.fn(),
      persistConversation: vi.fn(),
      setActiveConversation: vi.fn(),
      setSendScrollTrigger: vi.fn(),
      setSendScrollTargetMessageId: vi.fn(),
      clearDraftSourceImages: vi.fn(),
      draftSourceImagesRef,
      appendSourceImageFiles: vi.fn(() => ({ invalidNames: [], droppedValidCount: 0 })),
      persistDraftSourceImages: vi.fn(),
      maxSourceImages: 4,
      applyModelShortcut: vi.fn(() => settingsBySide),
      resolveAdaptiveRunConcurrency: vi.fn(() => 1),
      registerActiveRun: vi.fn(),
      unregisterActiveRun: vi.fn(),
      isRunStillActive: vi.fn(() => true),
      updateImageTaskInConversation: vi.fn(),
      updateRunImageInConversation: vi.fn(),
      updateRunTaskStateInConversation: vi.fn(),
      replaceRunsInConversation: vi.fn(),
      appendRunsToMessage: vi.fn(),
      findRunInConversation: vi.fn(() => null),
      replayingRunIdsRef: { current: new Set<string>() },
      setReplayingRunIds: vi.fn(),
      updateAssistantMessageContent: vi.fn(),
    })

    await sendFlow.sendDraft()

    expect(executeRunPlans).toHaveBeenCalledTimes(1)
    expect(executeRunPlans.mock.calls[0]?.[2]).toBe(3)
  })

  it('triggers auto scroll only after image-mode messages are persisted', async () => {
    const channel: ApiChannel = {
      id: 'ch-1',
      name: 'Main',
      baseUrl: 'https://example.com/v1',
      apiKey: 'key',
      models: ['model-a'],
    }
    const settingsBySide = {
      single: createImageSettings(channel.id),
    } satisfies Record<Side, SingleSideSettings>
    const state: ConversationState = {
      summaries: [],
      contents: {},
      runtimeTasksByConversationId: {},
      activeId: null,
      draft: 'draw cat',
      sendError: '',
      isSending: false,
      showAdvancedVariables: false,
      dynamicPromptEnabled: false,
      autoRenameConversationTitle: false,
      autoRenameConversationTitleModelId: null,
      panelValueFormat: 'json',
      panelVariables: [{ id: 'row-1', key: '', valuesText: '', selectedValue: '' }],
      favoriteModelIds: [],
      runConcurrency: 1,
      runConcurrencyUnlimited: false,
      imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
      loggingSettings: DEFAULT_LOGGING_SETTINGS,
      stagedSideMode: 'single',
      stagedSideCount: 1,
      stagedSettingsBySide: settingsBySide,
      channels: [channel],
    }
    const stateRef = { current: state } as MutableRefObject<ConversationState>
    const pendingRun = createPendingRun({ id: 'run-a', batchId: 'batch-1', side: 'single', channel })
    const persistConversation = vi.fn((conversation: Conversation) => {
      stateRef.current = {
        ...stateRef.current,
        contents: {
          ...stateRef.current.contents,
          [conversation.id]: conversation,
        },
      }
    })
    const setSendScrollTrigger = vi.fn()
    const setSendScrollTargetMessageId = vi.fn()

    const sendFlow = createSendFlowModule({
      stateRef,
      modelCatalog: { models: [{ id: 'model-a', name: 'Model A', params: [] }] },
      orchestrator: {
        planSendDraft: vi.fn(() => ({
          ok: true as const,
          value: {
            batchId: 'batch-1',
            userPrompt: 'draw cat',
            templatePrompt: 'draw cat',
            finalPrompt: 'draw cat',
            variablesSnapshot: {},
            mode: 'single' as const,
            sideCount: 1,
            settingsBySide,
            runPlans: [{
              side: 'single' as const,
              settings: settingsBySide.single,
              modelId: 'model-a',
              modelName: 'Model A',
              paramsSnapshot: {},
              sourceImages: [],
              channel,
              pendingRun,
            }],
            imageTasks: [{
              taskId: 'task-a',
              runId: pendingRun.id,
              batchId: 'batch-1',
              side: 'single',
              seq: 1,
              finalPrompt: pendingRun.finalPrompt,
              status: 'queued' as const,
              createdAt: pendingRun.createdAt,
              queuedAt: pendingRun.createdAt,
              threadState: 'active' as const,
            }],
            pendingRuns: [pendingRun],
          },
        })),
        executeRunPlans: vi.fn().mockResolvedValue([pendingRun]),
        planRetry: vi.fn(),
        planReplay: vi.fn(),
        executeRetry: vi.fn(),
        executeReplay: vi.fn(),
      },
      streamText: vi.fn(),
      dispatch: vi.fn(),
      actions: { setDraft: vi.fn() },
      notifier: {
        info: vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
      },
      ensureConversationLoaded: vi.fn(),
      persistConversation,
      setActiveConversation: vi.fn(),
      setSendScrollTrigger,
      setSendScrollTargetMessageId,
      clearDraftSourceImages: vi.fn(),
      draftSourceImagesRef: { current: [] } as MutableRefObject<[]>,
      appendSourceImageFiles: vi.fn(() => ({ invalidNames: [], droppedValidCount: 0 })),
      persistDraftSourceImages: vi.fn(),
      maxSourceImages: 4,
      applyModelShortcut: vi.fn(() => settingsBySide),
      resolveAdaptiveRunConcurrency: vi.fn(() => 1),
      registerActiveRun: vi.fn(),
      unregisterActiveRun: vi.fn(),
      isRunStillActive: vi.fn(() => true),
      updateImageTaskInConversation: vi.fn(),
      updateRunImageInConversation: vi.fn(),
      updateRunTaskStateInConversation: vi.fn(),
      replaceRunsInConversation: vi.fn(),
      appendRunsToMessage: vi.fn(),
      findRunInConversation: vi.fn(() => null),
      replayingRunIdsRef: { current: new Set<string>() },
      setReplayingRunIds: vi.fn(),
      updateAssistantMessageContent: vi.fn(),
    })

    await sendFlow.sendDraft()

    expect(persistConversation).toHaveBeenCalled()
    const persistedConversation = persistConversation.mock.calls[0]?.[0] as Conversation
    expect(setSendScrollTargetMessageId).toHaveBeenCalledWith(persistedConversation.messages[1]?.id)
    expect(setSendScrollTrigger).toHaveBeenCalledWith(expect.any(Function))
    expect(persistConversation.mock.invocationCallOrder[0]).toBeLessThan(setSendScrollTrigger.mock.invocationCallOrder[0])
  })

  it('tracks the streamed assistant bubble as the send scroll target for plain text sends', async () => {
    const channel: ApiChannel = {
      id: 'ch-text',
      name: 'Text',
      baseUrl: 'https://example.com/v1',
      apiKey: 'key',
      models: ['gpt-4o'],
    }
    const settingsBySide = {
      single: createTextSettings(channel.id, 'gpt-4o'),
    } satisfies Record<Side, SingleSideSettings>
    const state: ConversationState = {
      summaries: [],
      contents: {},
      runtimeTasksByConversationId: {},
      activeId: null,
      draft: '你好',
      sendError: '',
      isSending: false,
      showAdvancedVariables: false,
      dynamicPromptEnabled: false,
      autoRenameConversationTitle: false,
      autoRenameConversationTitleModelId: null,
      panelValueFormat: 'json',
      panelVariables: [],
      favoriteModelIds: [],
      runConcurrency: 1,
      runConcurrencyUnlimited: false,
      imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
      loggingSettings: DEFAULT_LOGGING_SETTINGS,
      stagedSideMode: 'single',
      stagedSideCount: 1,
      stagedSettingsBySide: settingsBySide,
      channels: [channel],
    }
    const stateRef = { current: state } as MutableRefObject<ConversationState>
    const persistConversation = vi.fn((conversation: Conversation) => {
      stateRef.current = {
        ...stateRef.current,
        contents: {
          ...stateRef.current.contents,
          [conversation.id]: conversation,
        },
      }
    })
    const setSendScrollTargetMessageId = vi.fn()

    const sendFlow = createSendFlowModule({
      stateRef,
      modelCatalog: { models: [{ id: 'gpt-4o', name: 'GPT-4o', params: [] }] },
      orchestrator: {
        planSendDraft: vi.fn(),
        executeRunPlans: vi.fn(),
        planRetry: vi.fn(),
        planReplay: vi.fn(),
        executeRetry: vi.fn(),
        executeReplay: vi.fn(),
      },
      streamText: vi.fn(async ({ onDelta }) => {
        onDelta('你好')
      }),
      dispatch: vi.fn(),
      actions: { setDraft: vi.fn() },
      notifier: { info: vi.fn(), warning: vi.fn(), success: vi.fn() },
      ensureConversationLoaded: vi.fn(),
      persistConversation,
      setActiveConversation: vi.fn(),
      setSendScrollTrigger: vi.fn(),
      setSendScrollTargetMessageId,
      clearDraftSourceImages: vi.fn(),
      draftSourceImagesRef: { current: [] } as MutableRefObject<[]>,
      appendSourceImageFiles: vi.fn(() => ({ invalidNames: [], droppedValidCount: 0 })),
      persistDraftSourceImages: vi.fn(),
      maxSourceImages: 4,
      applyModelShortcut: vi.fn(() => settingsBySide),
      resolveAdaptiveRunConcurrency: vi.fn(() => 1),
      registerActiveRun: vi.fn(),
      unregisterActiveRun: vi.fn(),
      isRunStillActive: vi.fn(() => true),
      updateImageTaskInConversation: vi.fn(),
      updateRunImageInConversation: vi.fn(),
      updateRunTaskStateInConversation: vi.fn(),
      replaceRunsInConversation: vi.fn(),
      appendRunsToMessage: vi.fn(),
      findRunInConversation: vi.fn(() => null),
      replayingRunIdsRef: { current: new Set<string>() },
      setReplayingRunIds: vi.fn(),
      updateAssistantMessageContent: vi.fn(),
    })

    await sendFlow.sendDraft()

    const persistedConversation = persistConversation.mock.calls[0]?.[0] as Conversation
    expect(persistedConversation.messages).toHaveLength(2)
    expect(setSendScrollTargetMessageId).toHaveBeenCalledWith(persistedConversation.messages[1]?.id)
  })

  it('tracks the first assistant bubble as the send scroll target for temporary text model sends', async () => {
    const channel: ApiChannel = {
      id: 'ch-text',
      name: 'Text',
      baseUrl: 'https://example.com/v1',
      apiKey: 'key',
      models: ['gpt-4o', 'gpt-4o-mini'],
    }
    const settingsBySide = {
      single: createTextSettings(channel.id, 'gpt-4o'),
    } satisfies Record<Side, SingleSideSettings>
    const state: ConversationState = {
      summaries: [],
      contents: {},
      runtimeTasksByConversationId: {},
      activeId: null,
      draft: '@gpt-4o-mini 你是谁',
      sendError: '',
      isSending: false,
      showAdvancedVariables: false,
      dynamicPromptEnabled: false,
      autoRenameConversationTitle: false,
      autoRenameConversationTitleModelId: null,
      panelValueFormat: 'json',
      panelVariables: [],
      favoriteModelIds: [],
      runConcurrency: 1,
      runConcurrencyUnlimited: false,
      imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
      loggingSettings: DEFAULT_LOGGING_SETTINGS,
      stagedSideMode: 'single',
      stagedSideCount: 1,
      stagedSettingsBySide: settingsBySide,
      channels: [channel],
    }
    const stateRef = { current: state } as MutableRefObject<ConversationState>
    const persistConversation = vi.fn((conversation: Conversation) => {
      stateRef.current = {
        ...stateRef.current,
        contents: {
          ...stateRef.current.contents,
          [conversation.id]: conversation,
        },
      }
    })
    const setSendScrollTargetMessageId = vi.fn()

    const sendFlow = createSendFlowModule({
      stateRef,
      modelCatalog: {
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', params: [] },
          { id: 'gpt-4o-mini', name: 'GPT-4o mini', params: [] },
        ],
      },
      orchestrator: {
        planSendDraft: vi.fn(),
        executeRunPlans: vi.fn(),
        planRetry: vi.fn(),
        planReplay: vi.fn(),
        executeRetry: vi.fn(),
        executeReplay: vi.fn(),
      },
      streamText: vi.fn(async ({ onDelta }) => {
        onDelta('我是 gpt-4o-mini。')
      }),
      dispatch: vi.fn(),
      actions: { setDraft: vi.fn() },
      notifier: { info: vi.fn(), warning: vi.fn(), success: vi.fn() },
      ensureConversationLoaded: vi.fn(),
      persistConversation,
      setActiveConversation: vi.fn(),
      setSendScrollTrigger: vi.fn(),
      setSendScrollTargetMessageId,
      clearDraftSourceImages: vi.fn(),
      draftSourceImagesRef: { current: [] } as MutableRefObject<[]>,
      appendSourceImageFiles: vi.fn(() => ({ invalidNames: [], droppedValidCount: 0 })),
      persistDraftSourceImages: vi.fn(),
      maxSourceImages: 4,
      applyModelShortcut: vi.fn(() => settingsBySide),
      resolveAdaptiveRunConcurrency: vi.fn(() => 1),
      registerActiveRun: vi.fn(),
      unregisterActiveRun: vi.fn(),
      isRunStillActive: vi.fn(() => true),
      updateImageTaskInConversation: vi.fn(),
      updateRunImageInConversation: vi.fn(),
      updateRunTaskStateInConversation: vi.fn(),
      replaceRunsInConversation: vi.fn(),
      appendRunsToMessage: vi.fn(),
      findRunInConversation: vi.fn(() => null),
      replayingRunIdsRef: { current: new Set<string>() },
      setReplayingRunIds: vi.fn(),
      updateAssistantMessageContent: vi.fn(),
    })

    await sendFlow.sendDraft()

    const persistedConversation = persistConversation.mock.calls[0]?.[0] as Conversation
    expect(persistedConversation.messages).toHaveLength(3)
    expect(setSendScrollTargetMessageId).toHaveBeenCalledWith(persistedConversation.messages[1]?.id)
    expect(setSendScrollTargetMessageId).not.toHaveBeenCalledWith(persistedConversation.messages[2]?.id)
  })

  it('tracks the appended assistant bubble as the send scroll target for permanent model commands', async () => {
    const channel: ApiChannel = {
      id: 'ch-text',
      name: 'Text',
      baseUrl: 'https://example.com/v1',
      apiKey: 'key',
      models: ['gpt-4o-mini'],
    }
    const settingsBySide = {
      single: createTextSettings(channel.id, 'gpt-4o-mini'),
    } satisfies Record<Side, SingleSideSettings>
    const stateRef = {
      current: {
        summaries: [],
        contents: {},
        runtimeTasksByConversationId: {},
        activeId: null,
        draft: '@gpt-4o-mini',
        sendError: '',
        isSending: false,
        showAdvancedVariables: false,
        dynamicPromptEnabled: false,
        autoRenameConversationTitle: false,
        autoRenameConversationTitleModelId: null,
        panelValueFormat: 'json',
        panelVariables: [],
        favoriteModelIds: [],
        runConcurrency: 1,
        runConcurrencyUnlimited: false,
        imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
        loggingSettings: DEFAULT_LOGGING_SETTINGS,
        stagedSideMode: 'single',
        stagedSideCount: 1,
        stagedSettingsBySide: settingsBySide,
        channels: [channel],
      },
    } as MutableRefObject<ConversationState>
    const persistConversation = vi.fn((conversation: Conversation) => {
      stateRef.current = {
        ...stateRef.current,
        contents: {
          ...stateRef.current.contents,
          [conversation.id]: conversation,
        },
      }
    })
    const setSendScrollTargetMessageId = vi.fn()

    const sendFlow = createSendFlowModule({
      stateRef,
      modelCatalog: { models: [{ id: 'gpt-4o-mini', name: 'GPT-4o mini', params: [] }] },
      orchestrator: {
        planSendDraft: vi.fn(),
        executeRunPlans: vi.fn(),
        planRetry: vi.fn(),
        planReplay: vi.fn(),
        executeRetry: vi.fn(),
        executeReplay: vi.fn(),
      },
      streamText: vi.fn(),
      dispatch: vi.fn(),
      actions: { setDraft: vi.fn() },
      notifier: { info: vi.fn(), warning: vi.fn(), success: vi.fn() },
      ensureConversationLoaded: vi.fn(),
      persistConversation,
      setActiveConversation: vi.fn(),
      setSendScrollTrigger: vi.fn(),
      setSendScrollTargetMessageId,
      clearDraftSourceImages: vi.fn(),
      draftSourceImagesRef: { current: [] } as MutableRefObject<[]>,
      appendSourceImageFiles: vi.fn(() => ({ invalidNames: [], droppedValidCount: 0 })),
      persistDraftSourceImages: vi.fn(),
      maxSourceImages: 4,
      applyModelShortcut: vi.fn(() => settingsBySide),
      resolveAdaptiveRunConcurrency: vi.fn(() => 1),
      registerActiveRun: vi.fn(),
      unregisterActiveRun: vi.fn(),
      isRunStillActive: vi.fn(() => true),
      updateImageTaskInConversation: vi.fn(),
      updateRunImageInConversation: vi.fn(),
      updateRunTaskStateInConversation: vi.fn(),
      replaceRunsInConversation: vi.fn(),
      appendRunsToMessage: vi.fn(),
      findRunInConversation: vi.fn(() => null),
      replayingRunIdsRef: { current: new Set<string>() },
      setReplayingRunIds: vi.fn(),
      updateAssistantMessageContent: vi.fn(),
    })

    await sendFlow.sendDraft()

    const persistedConversation = persistConversation.mock.calls[0]?.[0] as Conversation
    expect(persistedConversation.messages).toHaveLength(2)
    expect(setSendScrollTargetMessageId).toHaveBeenCalledWith(persistedConversation.messages[1]?.id)
  })

  it('appends retry runs as independent records so retry requests are counted separately', async () => {
    const channel: ApiChannel = {
      id: 'ch-1',
      name: 'Main',
      baseUrl: 'https://example.com/v1',
      apiKey: 'key',
      models: ['model-a'],
    }
    const settingsBySide = {
      single: createImageSettings(channel.id),
    } satisfies Record<Side, SingleSideSettings>
    const sourceRun: Run = {
      id: 'run-1',
      batchId: 'batch-1',
      createdAt: '2026-03-10T00:00:00.000Z',
      sideMode: 'single',
      side: 'single',
      prompt: 'draw cat',
      imageCount: 2,
      channelId: channel.id,
      channelName: channel.name,
      modelId: 'model-a',
      modelName: 'Model A',
      templatePrompt: 'draw cat',
      finalPrompt: 'draw cat',
      variablesSnapshot: {},
      paramsSnapshot: {},
      sourceImages: [],
      settingsSnapshot: {
        resolution: '1K',
        aspectRatio: '1:1',
        imageCount: 2,
        gridColumns: 2,
        sizeMode: 'preset',
        customWidth: 1024,
        customHeight: 1024,
        autoSave: false,
      },
      retryAttempt: 0,
      taskState: {
        status: 'failed',
        updatedAt: '2026-03-10T00:00:30.000Z',
        generatingStartedAt: '2026-03-10T00:00:05.000Z',
        completedAt: '2026-03-10T00:00:30.000Z',
      },
      images: [
        { id: 'img-1', seq: 1, status: 'failed', threadState: 'settled', error: 'bad gateway', errorCode: 'request_failed' },
        { id: 'img-2', seq: 2, status: 'success', threadState: 'settled', fileRef: 'file-2' },
      ],
    }
    const conversation: Conversation = {
      id: 'conv-1',
      title: 'Retry Test',
      titleMode: 'default',
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: '2026-03-10T00:00:00.000Z',
      sideMode: 'single',
      sideCount: 1,
      settingsBySide,
      messages: [{
        id: 'msg-1',
        createdAt: '2026-03-10T00:00:00.000Z',
        role: 'assistant',
        content: 'done',
        runs: [sourceRun],
      }],
    }
    const state: ConversationState = {
      summaries: [],
      contents: { [conversation.id]: conversation },
      runtimeTasksByConversationId: {},
      activeId: conversation.id,
      draft: '',
      sendError: '',
      isSending: false,
      showAdvancedVariables: false,
      dynamicPromptEnabled: false,
      autoRenameConversationTitle: false,
      autoRenameConversationTitleModelId: null,
      panelValueFormat: 'json',
      panelVariables: [],
      favoriteModelIds: [],
      runConcurrency: 1,
      runConcurrencyUnlimited: false,
      imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
      loggingSettings: DEFAULT_LOGGING_SETTINGS,
      stagedSideMode: 'single',
      stagedSideCount: 1,
      stagedSettingsBySide: settingsBySide,
      channels: [channel],
    }
    const stateRef = { current: state } as MutableRefObject<ConversationState>
    const retryResult: Run = {
      ...sourceRun,
      id: 'retry-run-fixed',
      createdAt: '2026-03-10T00:01:00.000Z',
      imageCount: 1,
      retryOfRunId: 'run-1',
      retryAttempt: 1,
      taskState: {
        status: 'completed',
        updatedAt: '2026-03-10T00:01:30.000Z',
        generatingStartedAt: '2026-03-10T00:01:05.000Z',
        completedAt: '2026-03-10T00:01:30.000Z',
      },
      images: [{ id: 'retry-img-1', seq: 1, status: 'success', threadState: 'settled', fileRef: 'retry-file-1' }],
    }
    const replaceRunsInConversation = vi.fn()
    const executeRetry = vi.fn().mockResolvedValue(retryResult)
    const registerActiveRun = vi.fn()
    const unregisterActiveRun = vi.fn()

    const sendFlow = createSendFlowModule({
      stateRef,
      modelCatalog: { models: [{ id: 'model-a', name: 'Model A', params: [] }] },
      orchestrator: {
        planSendDraft: vi.fn(),
        executeRunPlans: vi.fn(),
        planRetry: vi.fn(() => ({
          sourceRun,
          rootRunId: 'run-1',
          nextRetryAttempt: 1,
          settings: settingsBySide.single,
          modelId: 'model-a',
          modelName: 'Model A',
          paramsSnapshot: {},
          sourceImages: [],
          channel,
        })),
        planReplay: vi.fn(),
        executeRetry,
        executeReplay: vi.fn(),
      },
      streamText: vi.fn(),
      dispatch: vi.fn(),
      actions: { setDraft: vi.fn() },
      notifier: { info: vi.fn(), warning: vi.fn(), success: vi.fn() },
      ensureConversationLoaded: vi.fn(),
      persistConversation: vi.fn(),
      setActiveConversation: vi.fn(),
      setSendScrollTrigger: vi.fn(),
      setSendScrollTargetMessageId: vi.fn(),
      clearDraftSourceImages: vi.fn(),
      draftSourceImagesRef: { current: [] } as MutableRefObject<[]>,
      appendSourceImageFiles: vi.fn(() => ({ invalidNames: [], droppedValidCount: 0 })),
      persistDraftSourceImages: vi.fn(),
      maxSourceImages: 4,
      applyModelShortcut: vi.fn(() => settingsBySide),
      resolveAdaptiveRunConcurrency: vi.fn(() => 1),
      registerActiveRun,
      unregisterActiveRun,
      isRunStillActive: vi.fn(() => true),
      updateImageTaskInConversation: vi.fn(),
      updateRunImageInConversation: vi.fn(),
      updateRunTaskStateInConversation: vi.fn(),
      replaceRunsInConversation,
      appendRunsToMessage: vi.fn(),
      findRunInConversation: vi.fn(() => sourceRun),
      replayingRunIdsRef: { current: new Set<string>() },
      setReplayingRunIds: vi.fn(),
      updateAssistantMessageContent: vi.fn(),
    })

    await sendFlow.retryRun('run-1')

    expect(replaceRunsInConversation).toHaveBeenCalledTimes(2)
    const pendingReplacementMap = replaceRunsInConversation.mock.calls[0]?.[1] as Map<string, Run>
    expect(pendingReplacementMap.get('run-1')).toMatchObject({
      id: 'run-1',
      retryAttempt: 1,
      imageCount: 2,
      images: [
        expect.objectContaining({ seq: 1, status: 'pending' }),
        expect.objectContaining({ seq: 2, status: 'success' }),
      ],
    })
    expect(registerActiveRun).toHaveBeenCalledWith('conv-1', 'msg-1', 'run-1', expect.any(AbortController))
    expect(executeRetry).toHaveBeenCalledWith(expect.objectContaining({
      retryOfRunId: 'run-1',
      retryAttempt: 1,
      runId: 'run-1',
    }))
    const replacementMap = replaceRunsInConversation.mock.calls[1]?.[1] as Map<string, Run>
    expect(replaceRunsInConversation.mock.calls[1]?.[0]).toBe('conv-1')
    expect(replacementMap.get('run-1')).toMatchObject({
      id: 'run-1',
      retryAttempt: 1,
      images: [
        expect.objectContaining({ seq: 1, status: 'success', fileRef: 'retry-file-1' }),
        expect.objectContaining({ seq: 2, status: 'success', fileRef: 'file-2' }),
      ],
    })
    expect(unregisterActiveRun).toHaveBeenCalledWith('conv-1', 'run-1')
  })
})
