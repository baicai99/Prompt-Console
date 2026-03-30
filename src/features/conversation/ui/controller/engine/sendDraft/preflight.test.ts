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
  it('does not block sends for a configured Jimeng virtual channel', () => {
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
        single: createImageSettings('__jimeng-proxy__', '__jimeng-proxy__::high_aes_general_v50'),
      },
      channels: [
        {
          id: '__jimeng-proxy__',
          name: '即梦本地代理',
          baseUrl: 'http://127.0.0.1:8787',
          apiKey: 'local-session',
          providerId: 'jimeng-proxy',
          models: ['high_aes_general_v50'],
        },
      ],
    }

    const modelCatalog: ModelCatalog = {
      models: [
        {
          id: '__jimeng-proxy__::high_aes_general_v50',
          rawId: 'high_aes_general_v50',
          name: '图片5.0 Lite（即梦图片）',
          channelId: '__jimeng-proxy__',
          sourceName: '即梦图片',
          tags: ['jimeng-proxy', '即梦'],
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
