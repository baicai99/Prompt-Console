import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { SingleSideSettings } from '../../../types/conversation'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../../utils/imageRuntimeSettings'
import { MemoryRouter } from 'react-router-dom'
import { WorkspaceSettingsSidebar } from './WorkspaceSettingsSidebar'

const MODEL_PICKER_EMPTY_TEXT = '当前没有可用模型，请先配置渠道并刷新模型列表'

function selectableButtonsInSection(sectionTitle: string) {
  try {
    const heading = screen.getByRole('heading', { name: sectionTitle })
    const container = heading.closest('section') ?? heading.parentElement
    if (!container) {
      return []
    }
    return within(container)
      .getAllByRole('button')
      .filter((button) => {
        const label = button.getAttribute('aria-label') ?? button.textContent ?? ''
        return label && !label.startsWith('收藏') && !label.startsWith('取消收藏')
      })
  } catch {
    return []
  }
}

const modelSelectionButtons = () => [
  ...selectableButtonsInSection('当前模型'),
  ...selectableButtonsInSection('已收藏'),
  ...selectableButtonsInSection('全部模型'),
]

class IntersectionObserverMock {
  static instances: IntersectionObserverMock[] = []
  readonly root = null
  readonly rootMargin = '0px'
  readonly thresholds = [0]
  target?: Element
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    IntersectionObserverMock.instances.push(this)
  }
  observe(target: Element) {
    this.target = target
  }
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn((): IntersectionObserverEntry[] => [])
  trigger(entries: IntersectionObserverEntry[]) {
    this.callback(entries, this as unknown as IntersectionObserver)
  }
}

const baseSettings: SingleSideSettings = {
  resolution: '1024x1024',
  modelId: 'model-a',
  aspectRatio: '1:1',
  imageCount: 1,
  gridColumns: 1,
  sizeMode: 'preset',
  customWidth: 1024,
  customHeight: 1024,
  autoSave: false,
  channelId: null,
  generationMode: 'image',
  paramValues: {},
  textModelId: undefined,
}

const makeProps = (overrides: Partial<ComponentProps<typeof WorkspaceSettingsSidebar>>) => {
  const defaultProps: Partial<ComponentProps<typeof WorkspaceSettingsSidebar>> = {
    mode: 'expanded',
    rightPanelTab: 'modelPicker',
    setRightPanelMode: vi.fn(),
    toggleRightPanelMode: vi.fn(),
    setRightPanelTab: vi.fn(),
    expandedWidth: '55vw',
    collapsedWidth: 56,
    activeSideMode: 'single',
    activeSideCount: 1,
    activeSides: ['single'],
    composerPanelMode: 'expanded',
    modelPickerTarget: { kind: 'window', side: 'single' },
    summaries: [],
    isSideConfigLocked: false,
    activeSettingsBySide: { single: baseSettings },
    models: [{ id: 'model-a', name: 'Model A', params: [], tags: [] }],
    channels: [],
    activeGenerationMode: 'image',
    loggingSettings: {
      enabled: false,
      detailLevel: 'brief',
      features: {
        imageGeneration: true,
        textConversation: true,
        multiWindow: true,
        dynamicPrompt: true,
        concurrencyPool: true,
        polling: true,
        stateTransition: true,
        uiRender: true,
      },
    },
    showAdvancedVariables: false,
    dynamicPromptEnabled: false,
    dynamicPromptRequestedTab: null,
    dynamicPromptOpenRequestToken: 0,
    autoRenameConversationTitle: false,
    autoRenameConversationTitleModelId: null,
    runConcurrency: 1,
    runConcurrencyUnlimited: false,
    imageRuntimeSettings: {
      ...DEFAULT_IMAGE_RUNTIME_SETTINGS,
      resumePollStrategyMode: 'custom',
      resumePollSchedule: [{ elapsedSeconds: 0, intervalSeconds: 5 }],
      generationTimeoutMinutes: 10,
      showRequestMethodBadge: false,
    },
    panelValueFormat: 'json',
    panelVariables: [],
    resolvedVariables: {},
    finalPromptPreview: '',
    missingKeys: [],
    unusedVariableKeys: [],
    panelBatchError: '',
    panelMismatchRowIds: [],
    openAddChannelModalSignal: 0,
    favoriteModelIds: [],
    updateSideMode: vi.fn(),
    updateSideCount: vi.fn(),
    updateSideSettings: vi.fn(),
    updateSidesSettings: vi.fn(),
    setGenerationMode: vi.fn(),
    setSideModel: vi.fn(),
    setSideModelForCurrentMode: vi.fn(),
    setSideModelParam: vi.fn(),
    setChannels: vi.fn(),
    setLoggingSettings: vi.fn(),
    setAdvancedFeaturesEnabled: vi.fn(),
    setAutoRenameConversationTitle: vi.fn(),
    setAutoRenameConversationTitleModelId: vi.fn(),
    setRunConcurrency: vi.fn(),
    setRunConcurrencyUnlimited: vi.fn(),
    setImageRuntimeSettings: vi.fn(),
    setPanelValueFormat: vi.fn(),
    setPanelVariables: vi.fn(),
    setFavoriteModelIds: vi.fn(),
    onOpenModelPicker: vi.fn(),
    onCollapseComposer: vi.fn(),
    onExpandComposer: vi.fn(),
    requestComposerFocus: vi.fn(),
    getPreviewDebugStats: () => ({
      cacheSize: 0,
      cacheCount: 0,
      totalRefs: 0,
      inflightCount: 0,
      createdObjectUrls: 0,
      revokedObjectUrls: 0,
      activeObjectUrls: 0,
      activeCount: 0,
      blockedByBudgetCount: 0,
      maxActivePreviews: DEFAULT_IMAGE_RUNTIME_SETTINGS.maxActivePreviewHandles,
    }),
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
      historyVisibleLimit: 0,
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
      backgroundPollOwnerId: 'test',
      globalSubmitMax: 1,
      globalSubmitActive: 0,
      globalSubmitQueued: 0,
      logEntryCount: 0,
      logBufferLimit: 600,
      uiRenderCacheSize: 0,
      logSubscriberCount: 0,
      loggingEnabled: false,
      loggingDetailLevel: 'brief',
    },
  }
  return { ...defaultProps, ...overrides } as ComponentProps<typeof WorkspaceSettingsSidebar>
}

const renderModelPicker = async (overrideProps: Partial<ComponentProps<typeof WorkspaceSettingsSidebar>> = {}) => {
  const view = render(
    <MemoryRouter>
      <WorkspaceSettingsSidebar {...makeProps(overrideProps)} />
    </MemoryRouter>,
  )
  await waitFor(() => {
    expect(
      document.querySelector('.favorite-model-panel')
      || screen.queryByText(MODEL_PICKER_EMPTY_TEXT),
    ).toBeTruthy()
  })
  return view
}

beforeEach(() => {
  IntersectionObserverMock.instances = []
  window.IntersectionObserver = IntersectionObserverMock as unknown as typeof window.IntersectionObserver
})

const originalIntersectionObserver = window.IntersectionObserver

afterAll(() => {
  window.IntersectionObserver = originalIntersectionObserver
})

describe('WorkspaceSettingsSidebar model picker integration', () => {
  it('renders current model and switches when selecting another', async () => {
    const setSideModelForCurrentMode = vi.fn()
    await renderModelPicker({
      setSideModelForCurrentMode,
      models: [
        { id: 'model-a', name: 'Model A', params: [], tags: [] },
        { id: 'model-b', name: 'Model B', params: [], tags: [] },
      ],
      favoriteModelIds: [],
    })

    expect(screen.getByRole('heading', { name: '当前模型' })).toBeInTheDocument()
    const modelButton = screen.getByRole('button', { name: 'Model B' })
    fireEvent.click(modelButton)

    expect(setSideModelForCurrentMode).toHaveBeenCalledWith('single', 'model-b')
  })

  it('uses the provided multi-window target without rendering window tabs', async () => {
    const setSideModelForCurrentMode = vi.fn()
    await renderModelPicker({
      activeSideMode: 'multi',
      activeSideCount: 2,
      activeSides: ['left', 'right'],
      modelPickerTarget: { kind: 'window', side: 'right' },
      activeSettingsBySide: {
        left: { ...baseSettings, modelId: 'left-model' },
        right: { ...baseSettings, modelId: 'right-model' },
      },
      models: [
        { id: 'left-model', name: 'Left Model', params: [], tags: [] },
        { id: 'right-model', name: 'Right Model', params: [], tags: [] },
      ],
      setSideModelForCurrentMode,
    })

    expect(screen.queryByRole('tab', { name: '窗口 1' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '当前模型' })).toBeInTheDocument()
    const rightButton = screen.getByRole('button', { name: 'Right Model' })
    fireEvent.click(rightButton)

    expect(setSideModelForCurrentMode).toHaveBeenCalledWith('right', 'right-model')
  })

  it('uses the single-side seed settings when editing the default model in multi mode', async () => {
    const setSideModelForCurrentMode = vi.fn()
    await renderModelPicker({
      activeSideMode: 'multi',
      activeSideCount: 2,
      activeSides: ['left', 'right'],
      modelPickerTarget: { kind: 'default' },
      activeSettingsBySide: {
        single: { ...baseSettings, modelId: 'seed-model' },
        left: { ...baseSettings, modelId: 'left-model' },
        right: { ...baseSettings, modelId: 'right-model' },
      },
      models: [
        { id: 'seed-model', name: 'Seed Model', params: [], tags: [] },
        { id: 'seed-next', name: 'Seed Next', params: [], tags: [] },
        { id: 'left-model', name: 'Left Model', params: [], tags: [] },
        { id: 'right-model', name: 'Right Model', params: [], tags: [] },
      ],
      setSideModelForCurrentMode,
    })

    expect(screen.queryByText('编辑默认模型')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seed Next' }))

    expect(setSideModelForCurrentMode).toHaveBeenCalledWith('single', 'seed-next')
  })

  it('toggles favorites via star buttons', async () => {
    const setFavoriteModelIds = vi.fn()
    await renderModelPicker({
      setFavoriteModelIds,
      models: [{ id: 'model-a', name: 'Model A', params: [], tags: [] }],
      favoriteModelIds: [],
    })

    const starButton = screen.getByRole('button', { name: '收藏 Model A' })
    fireEvent.click(starButton)
    fireEvent.click(starButton)

    expect(setFavoriteModelIds).toHaveBeenCalledTimes(2)
    expect(setFavoriteModelIds).toHaveBeenNthCalledWith(1, ['model-a'])
    expect(setFavoriteModelIds).toHaveBeenNthCalledWith(2, ['model-a'])
  })

  it('filters by supplier and categories and updates visible selection', async () => {
    const models = [
      { id: 'openai::gpt', name: 'OpenAI Model（https://ai.openai.example）', params: [], tags: ['openai'] },
      { id: 'gemini::gemini', name: 'Gemini Model（https://ai.gemini.example）', params: [], tags: ['google'] },
    ]
    await renderModelPicker({
      models,
      favoriteModelIds: [],
    })

    const provider = screen.getByRole('combobox', { name: '筛选供应商' })
    fireEvent.mouseDown(provider)
    fireEvent.click(await screen.findByRole('option', { name: 'ai.openai.example' }))
    expect(modelSelectionButtons().map((button) => button.getAttribute('aria-label'))).toContain('OpenAI Model（https://ai.openai.example）')

    const category = screen.getByRole('combobox', { name: '筛选模型分类' })
    fireEvent.mouseDown(category)
    expect((await screen.findAllByRole('option')).map((item) => item.getAttribute('aria-label'))).toContain('OpenAI（GPT）')

    fireEvent.change(screen.getByPlaceholderText('搜索模型'), { target: { value: 'Gemini' } })
    await waitFor(() => {
      expect(modelSelectionButtons().map((button) => button.getAttribute('aria-label'))).toEqual(['Gemini Model（https://ai.gemini.example）'])
    })
  })

  it('shows an empty state when no models are available', async () => {
    await renderModelPicker({
      models: [],
      favoriteModelIds: [],
    })

    expect(screen.getByText(MODEL_PICKER_EMPTY_TEXT)).toBeInTheDocument()
    expect(modelSelectionButtons()).toHaveLength(0)
  })

  it('progressively renders large lists via IntersectionObserver', async () => {
    const models = Array.from({ length: 200 }, (_, index) => ({
      id: `model-${index + 1}`,
      name: `Model ${index + 1}`,
      params: [],
      tags: ['openai'],
    }))
    await renderModelPicker({
      isSideConfigLocked: false,
      models,
      favoriteModelIds: [],
      setFavoriteModelIds: vi.fn(),
    })

    expect(screen.getByText('正在加载模型列表')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('正在加载模型列表')).not.toBeInTheDocument()
    })

    expect(modelSelectionButtons().length).toBeGreaterThanOrEqual(80)

    const list = document.querySelector('.favorite-model-manage-list') as HTMLDivElement | null
    expect(list).toBeTruthy()
    if (!list) {
      throw new Error('Model list container not found')
    }

    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 200 })
    Object.defineProperty(list, 'scrollTop', { configurable: true, value: 700, writable: true })

    fireEvent.scroll(list)

    await waitFor(() => {
      expect(modelSelectionButtons().length).toBeGreaterThan(80)
    })

    fireEvent.change(screen.getByPlaceholderText('搜索模型'), { target: { value: 'Model 200' } })
    await waitFor(() => {
      expect(modelSelectionButtons().map((button) => button.getAttribute('aria-label'))).toEqual(['Model 200'])
    })
  }, 30000)
})
