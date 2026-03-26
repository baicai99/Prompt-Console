import { describe, expect, it, vi } from 'vitest'
import { createConversationSettingsModule } from './conversationSettings'
import type { PanelVariableRow } from '../../../domain/types'
import type { SingleSideSettings } from '../../../../../types/conversation'

function makePanelRows(): PanelVariableRow[] {
  return [
    {
      id: 'row-1',
      key: 'style',
      valuesText: '["漫改","日系职场","日系校园"]',
      selectedValue: '',
    },
  ]
}

function makeSideSettings(overrides?: Partial<SingleSideSettings>): SingleSideSettings {
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
    channelId: '',
    modelId: 'model-a',
    textModelId: 'text-a',
    paramValues: {},
    ...overrides,
  }
}

describe('createConversationSettingsModule', () => {
  it('reformats existing panel rows when changing panel value format', () => {
    const actions = {
      setDynamicPromptEnabled: vi.fn(),
      setAutoRenameConversationTitle: vi.fn(),
      setAutoRenameConversationTitleModelId: vi.fn(),
      setPanelValueFormat: vi.fn(),
      setPanelVariables: vi.fn(),
    }
    const saveStagedSettings = vi.fn()
    const panelVariables = makePanelRows()
    const stateRef = {
      current: {
        channels: [],
        panelVariables,
        panelValueFormat: 'json',
      },
    }

    const module = createConversationSettingsModule({
      state: stateRef.current as never,
      stateRef: stateRef as never,
      dispatch: vi.fn(),
      actions,
      repository: {} as never,
      modelCatalog: { models: [] },
      activeSideMode: 'single',
      activeSideCount: 2,
      activeSides: ['single'],
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
          channelId: '',
          modelId: '',
          paramValues: {},
        },
      },
      isSideConfigLocked: false,
      saveStagedSettings,
      persistConversation: vi.fn(),
      setActiveConversation: vi.fn(),
      clearDraftSourceImages: vi.fn(),
    })

    module.setPanelValueFormat('line')

    expect(actions.setPanelValueFormat).toHaveBeenCalledWith('line')
    expect(actions.setPanelVariables).toHaveBeenCalledWith([
      {
        id: 'row-1',
        key: 'style',
        valuesText: '漫改\n日系职场\n日系校园',
        selectedValue: '',
      },
    ])
    expect(saveStagedSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        overrides: expect.objectContaining({
          panelValueFormat: 'line',
          panelVariables: [
            {
              id: 'row-1',
              key: 'style',
              valuesText: '漫改\n日系职场\n日系校园',
              selectedValue: '',
            },
          ],
        }),
      }),
    )
    expect(stateRef.current.panelValueFormat).toBe('line')
    expect(stateRef.current.panelVariables[0]?.valuesText).toBe('漫改\n日系职场\n日系校园')
  })

  it('seeds multi-side settings from the current single-side settings when switching to compare mode', () => {
    const actions = {
      setDynamicPromptEnabled: vi.fn(),
      setAutoRenameConversationTitle: vi.fn(),
      setAutoRenameConversationTitleModelId: vi.fn(),
      setPanelValueFormat: vi.fn(),
      setPanelVariables: vi.fn(),
    }
    const saveStagedSettings = vi.fn()
    const stateRef = {
      current: {
        channels: [
          {
            id: 'ch',
            name: 'main',
            baseUrl: 'https://example.com',
            apiKey: 'key',
            models: ['model-a'],
          },
        ],
        panelVariables: [],
        panelValueFormat: 'json',
      },
    }

    const singleSettings = {
      generationMode: 'image' as const,
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount: 1,
      gridColumns: 1,
      sizeMode: 'preset' as const,
      customWidth: 1024,
      customHeight: 1024,
      autoSave: false,
      channelId: 'ch',
      modelId: 'model-a',
      paramValues: {},
    }

    const module = createConversationSettingsModule({
      state: stateRef.current as never,
      stateRef: stateRef as never,
      dispatch: vi.fn(),
      actions,
      repository: {} as never,
      modelCatalog: { models: [{ id: 'model-a', name: 'Model A', tags: ['test'], params: [] }] },
      activeSideMode: 'single',
      activeSideCount: 2,
      activeSides: ['single'],
      activeSettingsBySide: {
        single: singleSettings,
        'win-1': {
          ...singleSettings,
          channelId: null,
        },
        'win-2': {
          ...singleSettings,
          channelId: null,
        },
      },
      isSideConfigLocked: false,
      saveStagedSettings,
      persistConversation: vi.fn(),
      setActiveConversation: vi.fn(),
      clearDraftSourceImages: vi.fn(),
    })

    module.updateSideMode('multi')

    expect(saveStagedSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'multi',
        sideCount: 2,
        settingsBySide: expect.objectContaining({
          'win-1': expect.objectContaining({ channelId: 'ch', modelId: 'model-a' }),
          'win-2': expect.objectContaining({ channelId: 'ch', modelId: 'model-a' }),
        }),
      }),
    )
  })

  it('updates multiple sides in a single merged settings change', () => {
    const actions = {
      setDynamicPromptEnabled: vi.fn(),
      setAutoRenameConversationTitle: vi.fn(),
      setAutoRenameConversationTitleModelId: vi.fn(),
      setPanelValueFormat: vi.fn(),
      setPanelVariables: vi.fn(),
    }
    const saveStagedSettings = vi.fn()
    const persistConversation = vi.fn()
    const stateRef = {
      current: {
        activeId: 'conv-1',
        contents: {
          'conv-1': {
            id: 'conv-1',
            title: 'Test',
            titleMode: 'default',
            createdAt: '2026-03-10T00:00:00.000Z',
            updatedAt: '2026-03-10T00:00:00.000Z',
            sideMode: 'multi',
            sideCount: 2,
            settingsBySide: {
              single: makeSideSettings({ imageCount: 1, gridColumns: 1 }),
              'win-1': makeSideSettings({ imageCount: 1 }),
              'win-2': makeSideSettings({ imageCount: 2 }),
            },
            messages: [],
          },
        },
        channels: [],
        panelVariables: [],
        panelValueFormat: 'json',
      },
    }

    const module = createConversationSettingsModule({
      state: stateRef.current as never,
      stateRef: stateRef as never,
      dispatch: vi.fn(),
      actions,
      repository: {} as never,
      modelCatalog: { models: [] },
      activeSideMode: 'multi',
      activeSideCount: 2,
      activeSides: ['win-1', 'win-2'],
      activeSettingsBySide: {
        single: makeSideSettings({ imageCount: 1, gridColumns: 1 }),
        'win-1': makeSideSettings({ imageCount: 1 }),
        'win-2': makeSideSettings({ imageCount: 2 }),
      },
      isSideConfigLocked: false,
      saveStagedSettings,
      persistConversation,
      setActiveConversation: vi.fn(),
      clearDraftSourceImages: vi.fn(),
    })

    module.updateSidesSettings(['win-1', 'win-2'], { imageCount: 4, gridColumns: 4 })

    expect(saveStagedSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        settingsBySide: expect.objectContaining({
          single: expect.objectContaining({ imageCount: 4, gridColumns: 4 }),
          'win-1': expect.objectContaining({ imageCount: 4, gridColumns: 4 }),
          'win-2': expect.objectContaining({ imageCount: 4, gridColumns: 4 }),
        }),
      }),
    )
    expect(persistConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        settingsBySide: expect.objectContaining({
          single: expect.objectContaining({ imageCount: 4, gridColumns: 4 }),
          'win-1': expect.objectContaining({ imageCount: 4, gridColumns: 4 }),
          'win-2': expect.objectContaining({ imageCount: 4, gridColumns: 4 }),
        }),
      }),
    )
  })

  it('mirrors permanent model shortcuts back to the single-side seed in compare mode', () => {
    const actions = {
      setDynamicPromptEnabled: vi.fn(),
      setAutoRenameConversationTitle: vi.fn(),
      setAutoRenameConversationTitleModelId: vi.fn(),
      setPanelValueFormat: vi.fn(),
      setPanelVariables: vi.fn(),
    }
    const saveStagedSettings = vi.fn()
    const persistConversation = vi.fn()
    const stateRef = {
      current: {
        activeId: 'conv-1',
        contents: {
          'conv-1': {
            id: 'conv-1',
            title: 'Test',
            titleMode: 'default',
            createdAt: '2026-03-10T00:00:00.000Z',
            updatedAt: '2026-03-10T00:00:00.000Z',
            sideMode: 'multi',
            sideCount: 2,
            settingsBySide: {
              single: makeSideSettings({ modelId: 'model-a', textModelId: 'text-a', channelId: 'ch-a' }),
              'win-1': makeSideSettings({ modelId: 'model-a', textModelId: 'text-a', channelId: 'ch-a' }),
              'win-2': makeSideSettings({ modelId: 'model-a', textModelId: 'text-a', channelId: 'ch-a' }),
            },
            messages: [],
          },
        },
        channels: [
          {
            id: 'ch-a',
            name: 'Channel A',
            baseUrl: 'https://example.com/a',
            apiKey: 'key-a',
            models: ['model-a'],
          },
          {
            id: 'ch-b',
            name: 'Channel B',
            baseUrl: 'https://example.com/b',
            apiKey: 'key-b',
            models: ['model-b'],
          },
        ],
        panelVariables: [],
        panelValueFormat: 'json',
      },
    }

    const module = createConversationSettingsModule({
      state: stateRef.current as never,
      stateRef: stateRef as never,
      dispatch: vi.fn(),
      actions,
      repository: {} as never,
      modelCatalog: {
        models: [
          { id: 'model-a', name: 'Model A', tags: ['test'], params: [] },
          { id: 'model-b', name: 'Model B', tags: ['test'], params: [] },
        ],
      },
      activeSideMode: 'multi',
      activeSideCount: 2,
      activeSides: ['win-1', 'win-2'],
      activeSettingsBySide: {
        single: makeSideSettings({ modelId: 'model-a', textModelId: 'text-a', channelId: 'ch-a' }),
        'win-1': makeSideSettings({ modelId: 'model-a', textModelId: 'text-a', channelId: 'ch-a' }),
        'win-2': makeSideSettings({ modelId: 'model-a', textModelId: 'text-a', channelId: 'ch-a' }),
      },
      isSideConfigLocked: false,
      saveStagedSettings,
      persistConversation,
      setActiveConversation: vi.fn(),
      clearDraftSourceImages: vi.fn(),
    })

    module.applyModelShortcut('model-b')

    expect(saveStagedSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        settingsBySide: expect.objectContaining({
          single: expect.objectContaining({ modelId: 'model-b', textModelId: 'model-b' }),
          'win-1': expect.objectContaining({ modelId: 'model-b', textModelId: 'model-b' }),
          'win-2': expect.objectContaining({ modelId: 'model-b', textModelId: 'model-b' }),
        }),
      }),
    )
    expect(persistConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        settingsBySide: expect.objectContaining({
          single: expect.objectContaining({ modelId: 'model-b', textModelId: 'model-b' }),
          'win-1': expect.objectContaining({ modelId: 'model-b', textModelId: 'model-b' }),
          'win-2': expect.objectContaining({ modelId: 'model-b', textModelId: 'model-b' }),
        }),
      }),
    )
  })

  it('syncs single-side generation mode when toggling image generation off in compare mode', () => {
    const actions = {
      setDynamicPromptEnabled: vi.fn(),
      setAutoRenameConversationTitle: vi.fn(),
      setAutoRenameConversationTitleModelId: vi.fn(),
      setPanelValueFormat: vi.fn(),
      setPanelVariables: vi.fn(),
    }
    const saveStagedSettings = vi.fn()
    const persistConversation = vi.fn()
    const clearDraftSourceImages = vi.fn()
    const stateRef = {
      current: {
        activeId: 'conv-1',
        contents: {
          'conv-1': {
            id: 'conv-1',
            title: 'Test',
            titleMode: 'default',
            createdAt: '2026-03-10T00:00:00.000Z',
            updatedAt: '2026-03-10T00:00:00.000Z',
            sideMode: 'multi',
            sideCount: 2,
            settingsBySide: {
              single: makeSideSettings({ generationMode: 'image' }),
              'win-1': makeSideSettings({ generationMode: 'image' }),
              'win-2': makeSideSettings({ generationMode: 'image' }),
            },
            messages: [],
          },
        },
        channels: [],
        panelVariables: [],
        panelValueFormat: 'json',
      },
    }

    const module = createConversationSettingsModule({
      state: stateRef.current as never,
      stateRef: stateRef as never,
      dispatch: vi.fn(),
      actions,
      repository: {} as never,
      modelCatalog: { models: [] },
      activeSideMode: 'multi',
      activeSideCount: 2,
      activeSides: ['win-1', 'win-2'],
      activeSettingsBySide: {
        single: makeSideSettings({ generationMode: 'image' }),
        'win-1': makeSideSettings({ generationMode: 'image' }),
        'win-2': makeSideSettings({ generationMode: 'image' }),
      },
      isSideConfigLocked: false,
      saveStagedSettings,
      persistConversation,
      setActiveConversation: vi.fn(),
      clearDraftSourceImages,
    })

    module.setGenerationMode('text')

    expect(saveStagedSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        settingsBySide: expect.objectContaining({
          single: expect.objectContaining({ generationMode: 'text' }),
          'win-1': expect.objectContaining({ generationMode: 'text' }),
          'win-2': expect.objectContaining({ generationMode: 'text' }),
        }),
      }),
    )
    expect(persistConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        settingsBySide: expect.objectContaining({
          single: expect.objectContaining({ generationMode: 'text' }),
          'win-1': expect.objectContaining({ generationMode: 'text' }),
          'win-2': expect.objectContaining({ generationMode: 'text' }),
        }),
      }),
    )
    expect(clearDraftSourceImages).toHaveBeenCalledTimes(1)
  })

  it('switches only the current side text model when the side is in text mode', () => {
    const actions = {
      setDynamicPromptEnabled: vi.fn(),
      setAutoRenameConversationTitle: vi.fn(),
      setAutoRenameConversationTitleModelId: vi.fn(),
      setPanelValueFormat: vi.fn(),
      setPanelVariables: vi.fn(),
    }
    const saveStagedSettings = vi.fn()
    const persistConversation = vi.fn()
    const modelCatalog = {
      models: [
        { id: 'image-a', name: 'Image A', tags: ['test'], params: [] },
        { id: 'image-b', name: 'Image B', tags: ['test'], params: [] },
        { id: 'text-a', name: 'Text A', tags: ['test'], params: [] },
        { id: 'text-b', name: 'Text B', tags: ['test'], params: [] },
        { id: 'text-next', name: 'Text Next', tags: ['test'], params: [] },
      ],
    }
    const stateRef = {
      current: {
        activeId: 'conv-1',
        contents: {
          'conv-1': {
            id: 'conv-1',
            title: 'Test',
            titleMode: 'default',
            createdAt: '2026-03-10T00:00:00.000Z',
            updatedAt: '2026-03-10T00:00:00.000Z',
            sideMode: 'multi',
            sideCount: 2,
            settingsBySide: {
              'win-1': makeSideSettings({ generationMode: 'text', modelId: 'image-a', textModelId: 'text-a' }),
              'win-2': makeSideSettings({ generationMode: 'text', modelId: 'image-b', textModelId: 'text-b' }),
            },
            messages: [],
          },
        },
        channels: [
          {
            id: 'ch',
            name: 'main',
            baseUrl: 'https://example.com',
            apiKey: 'key',
            models: ['image-a', 'image-b', 'text-a', 'text-b', 'text-next'],
          },
        ],
        panelVariables: [],
        panelValueFormat: 'json',
      },
    }

    const module = createConversationSettingsModule({
      state: stateRef.current as never,
      stateRef: stateRef as never,
      dispatch: vi.fn(),
      actions,
      repository: {} as never,
      modelCatalog,
      activeSideMode: 'multi',
      activeSideCount: 2,
      activeSides: ['win-1', 'win-2'],
      activeSettingsBySide: {
        'win-1': makeSideSettings({ generationMode: 'text', channelId: 'ch', modelId: 'image-a', textModelId: 'text-a' }),
        'win-2': makeSideSettings({ generationMode: 'text', channelId: 'ch', modelId: 'image-b', textModelId: 'text-b' }),
      },
      isSideConfigLocked: false,
      saveStagedSettings,
      persistConversation,
      setActiveConversation: vi.fn(),
      clearDraftSourceImages: vi.fn(),
    })

    module.setSideModelForCurrentMode('win-1', 'text-next')

    expect(saveStagedSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        settingsBySide: expect.objectContaining({
          'win-1': expect.objectContaining({ modelId: 'image-a', textModelId: 'text-next' }),
          'win-2': expect.objectContaining({ modelId: 'image-b', textModelId: 'text-b' }),
        }),
      }),
    )
    expect(persistConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        settingsBySide: expect.objectContaining({
          'win-1': expect.objectContaining({ modelId: 'image-a', textModelId: 'text-next' }),
          'win-2': expect.objectContaining({ modelId: 'image-b', textModelId: 'text-b' }),
        }),
      }),
    )
  })

  it('switches the current side channel when selecting a model from another provider', () => {
    const actions = {
      setDynamicPromptEnabled: vi.fn(),
      setAutoRenameConversationTitle: vi.fn(),
      setAutoRenameConversationTitleModelId: vi.fn(),
      setPanelValueFormat: vi.fn(),
      setPanelVariables: vi.fn(),
    }
    const saveStagedSettings = vi.fn()
    const persistConversation = vi.fn()
    const stateRef = {
      current: {
        activeId: 'conv-1',
        contents: {
          'conv-1': {
            id: 'conv-1',
            title: 'Test',
            titleMode: 'default',
            createdAt: '2026-03-10T00:00:00.000Z',
            updatedAt: '2026-03-10T00:00:00.000Z',
            sideMode: 'multi',
            sideCount: 2,
            settingsBySide: {
              'win-1': makeSideSettings({ channelId: 'openai', modelId: 'openai::gpt-image-1' }),
              'win-2': makeSideSettings({ channelId: 'openai', modelId: 'openai::gpt-image-1' }),
            },
            messages: [],
          },
        },
        channels: [
          { id: 'openai', name: 'OpenAI', baseUrl: 'https://openai.example', apiKey: 'key', models: ['gpt-image-1'] },
          { id: 'gemini', name: 'Gemini', baseUrl: 'https://gemini.example', apiKey: 'key', models: ['gemini-2.5-flash-image'] },
        ],
        panelVariables: [],
        panelValueFormat: 'json',
      },
    }
    const modelCatalog = {
      models: [
        { id: 'openai::gpt-image-1', rawId: 'gpt-image-1', channelId: 'openai', name: 'GPT Image 1（OpenAI）', tags: ['openai'], params: [] },
        { id: 'gemini::gemini-2.5-flash-image', rawId: 'gemini-2.5-flash-image', channelId: 'gemini', name: 'Gemini 2.5 Flash Image（Gemini）', tags: ['google'], params: [] },
      ],
    }

    const module = createConversationSettingsModule({
      state: stateRef.current as never,
      stateRef: stateRef as never,
      dispatch: vi.fn(),
      actions,
      repository: {} as never,
      modelCatalog,
      activeSideMode: 'multi',
      activeSideCount: 2,
      activeSides: ['win-1', 'win-2'],
      activeSettingsBySide: {
        'win-1': makeSideSettings({ channelId: 'openai', modelId: 'openai::gpt-image-1' }),
        'win-2': makeSideSettings({ channelId: 'openai', modelId: 'openai::gpt-image-1' }),
      },
      isSideConfigLocked: false,
      saveStagedSettings,
      persistConversation,
      setActiveConversation: vi.fn(),
      clearDraftSourceImages: vi.fn(),
    })

    module.setSideModelForCurrentMode('win-1', 'gemini::gemini-2.5-flash-image')

    expect(saveStagedSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        settingsBySide: expect.objectContaining({
          'win-1': expect.objectContaining({ channelId: 'gemini', modelId: 'gemini::gemini-2.5-flash-image' }),
          'win-2': expect.objectContaining({ channelId: 'openai', modelId: 'openai::gpt-image-1' }),
        }),
      }),
    )
    expect(persistConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        settingsBySide: expect.objectContaining({
          'win-1': expect.objectContaining({ channelId: 'gemini', modelId: 'gemini::gemini-2.5-flash-image' }),
          'win-2': expect.objectContaining({ channelId: 'openai', modelId: 'openai::gpt-image-1' }),
        }),
      }),
    )
  })
})
