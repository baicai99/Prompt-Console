import { describe, expect, it } from 'vitest'
import { resolveVisibleModelsForSide } from './workspaceModelVisibility'
import type { ApiChannel } from '../../../types/channel'
import type { Side, SingleSideSettings } from '../../../types/conversation'
import type { ModelSpec } from '../../../types/model'

function makeSideSettings(overrides?: Partial<SingleSideSettings>): SingleSideSettings {
  return {
    generationMode: 'image',
    resolution: '1024x1024',
    aspectRatio: '1:1',
    imageCount: 1,
    gridColumns: 1,
    sizeMode: 'preset',
    customWidth: 1024,
    customHeight: 1024,
    autoSave: false,
    channelId: null,
    modelId: '',
    textModelId: '',
    videoModelId: '',
    paramValues: {},
    ...overrides,
  }
}

describe('resolveVisibleModelsForSide', () => {
  const models: ModelSpec[] = [
    { id: 'model-a', name: 'Model A', tags: ['openai'], params: [] },
    { id: 'model-b', name: 'Model B', tags: ['openai'], params: [] },
    { id: 'model-c', name: 'Model C', tags: ['openai'], params: [] },
  ]

  const channels: ApiChannel[] = [
    { id: 'ch-a', name: 'Channel A', baseUrl: 'https://a.example.com', apiKey: 'k1', models: ['model-b', 'model-a'] },
    { id: 'ch-b', name: 'Channel B', baseUrl: 'https://b.example.com', apiKey: 'k2', models: ['model-c'] },
  ]

  it('returns only models from the selected channel in channel order', () => {
    const settingsBySide: Record<Side, SingleSideSettings> = {
      single: makeSideSettings({ channelId: 'ch-a', modelId: 'model-a' }),
    }

    expect(
      resolveVisibleModelsForSide({
        side: 'single',
        settingsBySide,
        channels,
        models,
      }).map((model) => model.id),
    ).toEqual(['model-b', 'model-a'])
  })

  it('keeps each multi-window side scoped to its own selected channel', () => {
    const settingsBySide: Record<Side, SingleSideSettings> = {
      single: makeSideSettings(),
      'win-1': makeSideSettings({ channelId: 'ch-a', modelId: 'model-a' }),
      'win-2': makeSideSettings({ channelId: 'ch-b', modelId: 'model-c' }),
    }

    expect(
      resolveVisibleModelsForSide({
        side: 'win-1',
        settingsBySide,
        channels,
        models,
      }).map((model) => model.id),
    ).toEqual(['model-b', 'model-a'])

    expect(
      resolveVisibleModelsForSide({
        side: 'win-2',
        settingsBySide,
        channels,
        models,
      }).map((model) => model.id),
    ).toEqual(['model-c'])
  })

  it('returns an empty list when the selected channel is missing and no fallback can be resolved', () => {
    const settingsBySide: Record<Side, SingleSideSettings> = {
      single: makeSideSettings({ channelId: null, modelId: '' }),
      'win-1': makeSideSettings({ channelId: 'missing', modelId: 'model-a' }),
    }

    expect(
      resolveVisibleModelsForSide({
        side: 'single',
        settingsBySide,
        channels,
        models,
      }),
    ).toEqual([])

    expect(
      resolveVisibleModelsForSide({
        side: 'win-1',
        settingsBySide,
        channels,
        models,
      }).map((model) => model.id),
    ).toEqual(['model-b', 'model-a'])
  })

  it('falls back to the selected model channel when channelId is missing', () => {
    const settingsBySide: Record<Side, SingleSideSettings> = {
      single: makeSideSettings({ channelId: null, modelId: 'ch-a::model-a' }),
    }
    const scopedModels: ModelSpec[] = [
      { id: 'ch-a::model-a', rawId: 'model-a', channelId: 'ch-a', name: 'Model A', tags: ['openai'], params: [] },
      { id: 'ch-a::model-b', rawId: 'model-b', channelId: 'ch-a', name: 'Model B', tags: ['openai'], params: [] },
      { id: 'ch-b::model-c', rawId: 'model-c', channelId: 'ch-b', name: 'Model C', tags: ['openai'], params: [] },
    ]

    expect(
      resolveVisibleModelsForSide({
        side: 'single',
        settingsBySide,
        channels,
        models: scopedModels,
      }).map((model) => model.id),
    ).toEqual(['ch-a::model-b', 'ch-a::model-a'])
  })

  it('falls back to the unique supporting channel when the selected model id is unscoped', () => {
    const settingsBySide: Record<Side, SingleSideSettings> = {
      single: makeSideSettings({ channelId: null, modelId: 'model-c' }),
    }

    expect(
      resolveVisibleModelsForSide({
        side: 'single',
        settingsBySide,
        channels,
        models,
      }).map((model) => model.id),
    ).toEqual(['model-c'])
  })

  it('falls back to the only configured channel when there is a single channel', () => {
    const settingsBySide: Record<Side, SingleSideSettings> = {
      single: makeSideSettings({ channelId: null, modelId: '' }),
    }

    expect(
      resolveVisibleModelsForSide({
        side: 'single',
        settingsBySide,
        channels: [channels[0]],
        models,
      }).map((model) => model.id),
    ).toEqual(['model-b', 'model-a'])
  })
})
