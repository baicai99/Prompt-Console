import { describe, expect, it } from 'vitest'
import type { SingleSideSettings } from '../../../../../types/conversation'
import { resolveSendGenerationMode } from './sendFlowUtils'

function makeSettings(overrides?: Partial<SingleSideSettings>): SingleSideSettings {
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
    channelId: 'ch-a',
    modelId: 'image-a',
    textModelId: 'text-a',
    paramValues: {},
    ...overrides,
  }
}

describe('resolveSendGenerationMode', () => {
  it('allows multi-window text sends when all text targets match', () => {
    expect(resolveSendGenerationMode({
      sideMode: 'multi',
      sideCount: 2,
      settingsBySide: {
        single: makeSettings({ generationMode: 'text', channelId: 'ch-a', modelId: 'image-a', textModelId: 'text-a' }),
        'win-1': makeSettings({ generationMode: 'text', channelId: 'ch-a', modelId: 'image-a', textModelId: 'text-a' }),
        'win-2': makeSettings({ generationMode: 'text', channelId: 'ch-a', modelId: 'image-b', textModelId: 'text-a' }),
      },
    })).toEqual({ mode: 'text' })
  })

  it('rejects multi-window text sends when text models differ between windows', () => {
    expect(resolveSendGenerationMode({
      sideMode: 'multi',
      sideCount: 2,
      settingsBySide: {
        single: makeSettings({ generationMode: 'text', channelId: 'ch-a', modelId: 'image-a', textModelId: 'text-a' }),
        'win-1': makeSettings({ generationMode: 'text', channelId: 'ch-a', modelId: 'image-a', textModelId: 'text-a' }),
        'win-2': makeSettings({ generationMode: 'text', channelId: 'ch-a', modelId: 'image-b', textModelId: 'text-b' }),
      },
    })).toEqual({ error: '当前窗口文本模型或渠道不一致，请先统一后再进行多窗口文本生成。' })
  })

  it('rejects multi-window text sends when channels differ between windows', () => {
    expect(resolveSendGenerationMode({
      sideMode: 'multi',
      sideCount: 2,
      settingsBySide: {
        single: makeSettings({ generationMode: 'text', channelId: 'ch-a', modelId: 'image-a', textModelId: 'text-a' }),
        'win-1': makeSettings({ generationMode: 'text', channelId: 'ch-a', modelId: 'image-a', textModelId: 'text-a' }),
        'win-2': makeSettings({ generationMode: 'text', channelId: 'ch-b', modelId: 'image-a', textModelId: 'text-a' }),
      },
    })).toEqual({ error: '当前窗口文本模型或渠道不一致，请先统一后再进行多窗口文本生成。' })
  })
})
