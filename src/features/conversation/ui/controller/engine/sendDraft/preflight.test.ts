import { describe, expect, it } from 'vitest'
import type { ConversationState } from '../../../../state/conversationState'
import type { ModelCatalog } from '../../../../../../types/model'
import type { SingleSideSettings } from '../../../../../../types/conversation'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../../../../../utils/imageRuntimeSettings'
import { DEFAULT_LOGGING_SETTINGS } from '../../../../../../utils/loggingSettings'
import { resolveSendBlockedReason } from './preflight'

function createImageSettings(channelId: string, modelId: string): SingleSideSettings {
  return {
    generationMode: 'image',
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

describe('sendDraft preflight', () => {
  it('does not block sends for a configured channel with a selected model', () => {
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
      stagedSettingsBySide: {
        single: createImageSettings('openai', 'openai::gpt-image-1'),
      },
      channels: [
        {
          id: 'openai',
          name: 'OpenAI',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'key',
          providerId: 'openai-compatible',
          models: ['gpt-image-1'],
        },
      ],
    }

    const modelCatalog: ModelCatalog = {
      models: [
        {
          id: 'openai::gpt-image-1',
          rawId: 'gpt-image-1',
          name: 'gpt-image-1（OpenAI）',
          channelId: 'openai',
          sourceName: 'OpenAI',
          tags: ['openai-compatible'],
          params: [],
        },
      ],
    }

    const blockedReason = resolveSendBlockedReason(state, modelCatalog, {
      activeSideMode: 'single',
      activeSideCount: 1,
      activeSettingsBySide: state.stagedSettingsBySide,
    })

    expect(blockedReason).toBeNull()
  })
})
