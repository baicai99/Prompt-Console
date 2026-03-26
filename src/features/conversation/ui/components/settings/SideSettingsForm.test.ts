import { describe, expect, it } from 'vitest'
import type { ApiChannel } from '../../../../../types/channel'
import type { SingleSideSettings } from '../../../../../types/conversation'
import type { ModelSpec } from '../../../../../types/model'
import { buildChannelSelectionPatch } from './channelSelectionPatch'

const baseSettings: SingleSideSettings = {
  generationMode: 'image',
  resolution: '1K',
  aspectRatio: '1:1',
  imageCount: 1,
  gridColumns: 1,
  sizeMode: 'preset',
  customWidth: 1024,
  customHeight: 1024,
  autoSave: false,
  channelId: 'old-channel',
  modelId: 'openai::gpt-image-1',
  textModelId: 'openai::gpt-4o-mini',
  videoModelId: 'doubao::seedance-1.0-lite',
  paramValues: { size: '1K' },
}

const models: ModelSpec[] = [
  { id: 'openai::gpt-image-1', rawId: 'gpt-image-1', channelId: 'openai', name: 'GPT Image 1（OpenAI）', tags: ['openai'], params: [] },
  { id: 'openai::gpt-4o-mini', rawId: 'gpt-4o-mini', channelId: 'openai', name: 'GPT 4o Mini（OpenAI）', tags: ['openai'], params: [] },
  { id: 'gemini-proxy::gemini-2.5-flash-image', rawId: 'gemini-2.5-flash-image', channelId: 'gemini-proxy', name: 'Gemini 2.5 Flash Image（Gemini）', tags: ['google'], params: [] },
  { id: 'gemini-proxy::gemini-2.5-flash', rawId: 'gemini-2.5-flash', channelId: 'gemini-proxy', name: 'Gemini 2.5 Flash（Gemini）', tags: ['google'], params: [] },
  { id: 'doubao::seedance-1.0-lite', rawId: 'seedance-1.0-lite', channelId: 'doubao', name: 'Seedance 1.0 Lite（豆包）', tags: ['豆包'], params: [] },
]

const channels: ApiChannel[] = [
  {
    id: 'gemini-proxy',
    name: 'https://ai.t8star.cn',
    baseUrl: 'https://ai.t8star.cn',
    apiKey: 'k',
    models: ['gemini-2.5-flash-image', 'gemini-2.5-flash'],
  },
]

describe('buildChannelSelectionPatch', () => {
  it('updates channel and dependent models in one patch', () => {
    expect(buildChannelSelectionPatch({
      value: 'gemini-proxy',
      settings: baseSettings,
      channels,
      models,
    })).toEqual({
      channelId: 'gemini-proxy',
      modelId: 'gemini-proxy::gemini-2.5-flash-image',
      textModelId: 'gemini-proxy::gemini-2.5-flash-image',
      videoModelId: 'gemini-proxy::gemini-2.5-flash-image',
      paramValues: {},
    })
  })

  it('clears channel without throwing away other settings', () => {
    expect(buildChannelSelectionPatch({
      value: undefined,
      settings: baseSettings,
      channels,
      models,
    })).toEqual({
      channelId: null,
    })
  })
})
