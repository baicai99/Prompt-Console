import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceSettingsSidebar } from './WorkspaceSettingsSidebar'
import { APP_ROUTES } from '../../../routes'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../../utils/imageRuntimeSettings'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('./components/SettingsPanel', () => ({
  SettingsPanel: () => <div>settings-panel</div>,
}))

vi.mock('./components/ImageParamsPanel', () => ({
  ImageParamsPanel: () => <div>image-params-panel</div>,
}))

vi.mock('./components/AdvancedFeaturesPanel', () => ({
  AdvancedFeaturesPanel: () => <div>advanced-features-panel</div>,
}))

vi.mock('./components/DynamicPromptPanel', () => ({
  DynamicPromptPanel: () => <div>dynamic-prompt-panel</div>,
}))

vi.mock('./components/FavoriteModelPill', () => ({
  FavoriteModelPanel: () => <div>favorite-model-panel</div>,
}))

vi.mock('./components/ChatMemoryDiagnosticsPanel', () => ({
  ChatMemoryDiagnosticsPanel: () => <div>chat-memory-diagnostics-panel</div>,
}))

interface RenderSidebarOptions {
  mode?: 'collapsed' | 'expanded'
  composerPanelMode?: 'collapsed' | 'expanded'
  rightPanelTab?: 'modelPicker' | 'settings' | 'modelStats' | 'imageParams' | 'dynamicPrompt' | 'advanced' | 'diagnostics'
  activeSideMode?: 'single' | 'multi'
  activeSideCount?: number
  activeSides?: string[]
  modelPickerTarget?: { kind: 'window'; side: string } | { kind: 'default' }
  activeSettingsBySide?: Record<string, {
    resolution: string
    modelId: string
    aspectRatio: string
    imageCount: number
    gridColumns: number
    sizeMode: 'preset' | 'custom'
    customWidth: number
    customHeight: number
    autoSave: boolean
    channelId: string | null
    generationMode: 'image' | 'text'
    paramValues: Record<string, never>
  }>
  toggleRightPanelMode?: ReturnType<typeof vi.fn>
  setRightPanelMode?: ReturnType<typeof vi.fn>
  setRightPanelTab?: ReturnType<typeof vi.fn>
  onOpenModelPicker?: ReturnType<typeof vi.fn>
  onCollapseComposer?: ReturnType<typeof vi.fn>
  onExpandComposer?: ReturnType<typeof vi.fn>
}

function renderSidebar(options: RenderSidebarOptions = {}) {
  const toggleRightPanelMode = (options.toggleRightPanelMode ?? vi.fn()) as () => void
  const setRightPanelMode = (options.setRightPanelMode ?? vi.fn()) as (mode: 'collapsed' | 'expanded') => void
  const setRightPanelTab = (options.setRightPanelTab ?? vi.fn()) as (
    tab: 'modelPicker' | 'settings' | 'modelStats' | 'imageParams' | 'dynamicPrompt' | 'advanced' | 'diagnostics',
  ) => void
  const onOpenModelPicker = (options.onOpenModelPicker ?? vi.fn()) as (
    target: { kind: 'window'; side: string } | { kind: 'default' },
  ) => void
  const onCollapseComposer = (options.onCollapseComposer ?? vi.fn()) as () => void
  const onExpandComposer = (options.onExpandComposer ?? vi.fn()) as () => void
  const activeSideMode = options.activeSideMode ?? 'single'
  const activeSides = options.activeSides ?? ['single']
  const activeSettingsBySide = options.activeSettingsBySide ?? {
    single: {
      resolution: '1024x1024',
      modelId: 'model-a',
      aspectRatio: '1:1',
      imageCount: 1,
      gridColumns: 1,
      sizeMode: 'preset' as const,
      customWidth: 1024,
      customHeight: 1024,
      autoSave: false,
      channelId: null,
      generationMode: 'image' as const,
      paramValues: {},
    },
  }

  const view = render(
    <WorkspaceSettingsSidebar
      mode={options.mode ?? 'expanded'}
      rightPanelTab={options.rightPanelTab ?? 'modelStats'}
      setRightPanelMode={setRightPanelMode}
      toggleRightPanelMode={toggleRightPanelMode}
      setRightPanelTab={setRightPanelTab}
      expandedWidth="55vw"
      collapsedWidth={56}
      activeSideMode={activeSideMode}
      activeSideCount={options.activeSideCount ?? (activeSideMode === 'multi' ? 2 : 1)}
      activeSides={activeSides}
      composerPanelMode={options.composerPanelMode ?? 'expanded'}
      modelPickerTarget={options.modelPickerTarget ?? { kind: 'window', side: 'single' }}
      summaries={[]}
      isSideConfigLocked={false}
      activeSettingsBySide={activeSettingsBySide}
      models={[{ id: 'model-a', name: 'Model A', params: [] }]}
      channels={[]}
      activeGenerationMode="image"
      loggingSettings={{
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
      }}
      showAdvancedVariables={false}
      dynamicPromptEnabled={false}
      dynamicPromptRequestedTab={null}
      dynamicPromptOpenRequestToken={0}
      autoRenameConversationTitle={false}
      autoRenameConversationTitleModelId={null}
      runConcurrency={1}
      runConcurrencyUnlimited={false}
      imageRuntimeSettings={{
        ...DEFAULT_IMAGE_RUNTIME_SETTINGS,
        resumePollStrategyMode: 'custom',
        resumePollSchedule: [{ elapsedSeconds: 0, intervalSeconds: 5 }],
        generationTimeoutMinutes: 10,
        showRequestMethodBadge: false,
      }}
      panelValueFormat="json"
      panelVariables={[]}
      resolvedVariables={{}}
      finalPromptPreview=""
      missingKeys={[]}
      unusedVariableKeys={[]}
      panelBatchError=""
      panelMismatchRowIds={[]}
      openAddChannelModalSignal={0}
      favoriteModelIds={[]}
      updateSideMode={vi.fn()}
      updateSideCount={vi.fn()}
      updateSideSettings={vi.fn()}
      updateSidesSettings={vi.fn()}
      setGenerationMode={vi.fn()}
      setSideModel={vi.fn()}
      setSideModelForCurrentMode={vi.fn()}
      setSideModelParam={vi.fn()}
      setChannels={vi.fn()}
      setLoggingSettings={vi.fn()}
      setAdvancedFeaturesEnabled={vi.fn()}
      setAutoRenameConversationTitle={vi.fn()}
      setAutoRenameConversationTitleModelId={vi.fn()}
      setRunConcurrency={vi.fn()}
      setRunConcurrencyUnlimited={vi.fn()}
      setImageRuntimeSettings={vi.fn()}
      setPanelValueFormat={vi.fn()}
      setPanelVariables={vi.fn()}
      setFavoriteModelIds={vi.fn()}
      onOpenModelPicker={onOpenModelPicker}
      onCollapseComposer={onCollapseComposer}
      onExpandComposer={onExpandComposer}
      requestComposerFocus={vi.fn()}
      getPreviewDebugStats={() => ({
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
      })}
      workspaceDiagnostics={{
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
      }}
    />,
  )

  return {
    ...view,
    toggleRightPanelMode,
    setRightPanelMode,
    setRightPanelTab,
    onOpenModelPicker,
    onCollapseComposer,
    onExpandComposer,
  }
}

describe('WorkspaceSettingsSidebar', () => {
  beforeEach(() => {
    navigateMock.mockReset()
  })

  it('renders the narrow entry buttons while collapsed and keeps drawer content hidden', () => {
    renderSidebar({ mode: 'collapsed' })

    expect(screen.getByRole('toolbar', { name: '工作区快捷侧栏' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开模型管理' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开生图参数' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开动态提示词' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开设置' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开运行分析' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开高级功能' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开内存诊断' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收起输入框' })).toBeInTheDocument()
    expect(screen.queryByText('模型分析')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the expand action in the same footer slot when the composer is collapsed', () => {
    renderSidebar({ mode: 'collapsed', composerPanelMode: 'collapsed' })

    expect(screen.getByRole('button', { name: '展开输入框' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '收起输入框' })).not.toBeInTheDocument()
  })

  it('renders a diagnostics entry in the narrow sidebar', () => {
    renderSidebar({ mode: 'collapsed' })

    expect(screen.getByRole('button', { name: '打开内存诊断' })).toBeInTheDocument()
  })

  it('opens the target drawer panel from a narrow entry button', () => {
    const { toggleRightPanelMode, setRightPanelTab } = renderSidebar({ mode: 'collapsed' })

    fireEvent.click(screen.getByRole('button', { name: '打开动态提示词' }))

    expect(setRightPanelTab).toHaveBeenCalledWith('dynamicPrompt')
    expect(toggleRightPanelMode).toHaveBeenCalledTimes(1)
  })

  it('switches panel from the narrow sidebar without reopening an already open drawer', () => {
    const { toggleRightPanelMode, setRightPanelTab } = renderSidebar({ mode: 'expanded', rightPanelTab: 'settings' })

    fireEvent.click(screen.getByRole('button', { name: '打开生图参数' }))

    expect(setRightPanelTab).toHaveBeenCalledWith('imageParams')
    expect(toggleRightPanelMode).not.toHaveBeenCalled()
  })

  it('opens model picker through the dedicated callback from the narrow sidebar', () => {
    const { onOpenModelPicker, setRightPanelTab, toggleRightPanelMode } = renderSidebar({ mode: 'collapsed' })

    fireEvent.click(screen.getByRole('button', { name: '打开模型管理' }))

    expect(onOpenModelPicker).toHaveBeenCalledTimes(1)
    expect(onOpenModelPicker).toHaveBeenCalledWith({ kind: 'window', side: 'single' })
    expect(setRightPanelTab).not.toHaveBeenCalled()
    expect(toggleRightPanelMode).not.toHaveBeenCalled()
  })

  it('routes the footer collapse button through the dedicated composer callback', () => {
    const { onCollapseComposer } = renderSidebar({ mode: 'collapsed' })

    fireEvent.click(screen.getByRole('button', { name: '收起输入框' }))

    expect(onCollapseComposer).toHaveBeenCalledTimes(1)
  })

  it('routes the footer expand button through the dedicated composer callback', () => {
    const { onExpandComposer } = renderSidebar({ mode: 'collapsed', composerPanelMode: 'collapsed' })

    fireEvent.click(screen.getByRole('button', { name: '展开输入框' }))

    expect(onExpandComposer).toHaveBeenCalledTimes(1)
  })

  it('renames the mini bar entry to default model in multi mode', () => {
    renderSidebar({
      mode: 'collapsed',
      activeSideMode: 'multi',
      activeSideCount: 2,
      activeSides: ['left', 'right'],
      modelPickerTarget: { kind: 'default' },
      activeSettingsBySide: {
        single: {
          resolution: '1024x1024',
          modelId: 'seed-model',
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
        },
        left: {
          resolution: '1024x1024',
          modelId: 'left-model',
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
        },
        right: {
          resolution: '1024x1024',
          modelId: 'right-model',
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
        },
      },
    })

    expect(screen.getByRole('button', { name: '打开默认模型' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '打开模型管理' })).not.toBeInTheDocument()
  })

  it('closes the drawer through the built-in close button', () => {
    const { setRightPanelMode } = renderSidebar({ mode: 'expanded' })

    fireEvent.click(screen.getByLabelText('Close'))

    expect(setRightPanelMode).toHaveBeenCalledWith('collapsed')
  })

  it('updates drawer title from the active narrow sidebar entry', () => {
    renderSidebar({ mode: 'expanded', rightPanelTab: 'dynamicPrompt' })

    expect(screen.getByText('动态提示词')).toBeInTheDocument()
    expect(screen.queryByText('运行分析')).not.toBeInTheDocument()
  })

  it('renders model manager content when the model picker tab is active', async () => {
    renderSidebar({ mode: 'expanded', rightPanelTab: 'modelPicker' })

    expect(screen.getByText('模型管理')).toBeInTheDocument()
    expect(await screen.findByText('favorite-model-panel')).toBeInTheDocument()
  })

  it('renders default-model drawer content and title in multi mode', async () => {
    renderSidebar({
      mode: 'expanded',
      rightPanelTab: 'modelPicker',
      activeSideMode: 'multi',
      activeSideCount: 2,
      activeSides: ['left', 'right'],
      modelPickerTarget: { kind: 'default' },
      activeSettingsBySide: {
        single: {
          resolution: '1024x1024',
          modelId: 'seed-model',
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
        },
        left: {
          resolution: '1024x1024',
          modelId: 'left-model',
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
        },
        right: {
          resolution: '1024x1024',
          modelId: 'right-model',
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
        },
      },
    })

    expect(screen.getByText('默认模型')).toBeInTheDocument()
    expect(await screen.findByText('favorite-model-panel')).toBeInTheDocument()
  })

  it('renders dynamic prompt panel content when the dynamic prompt tab is active', async () => {
    renderSidebar({ mode: 'expanded', rightPanelTab: 'dynamicPrompt' })

    expect(await screen.findByText('dynamic-prompt-panel')).toBeInTheDocument()
    expect(screen.queryByText('advanced-features-panel')).not.toBeInTheDocument()
  })

  it('renders diagnostics panel content when the diagnostics tab is active', async () => {
    renderSidebar({ mode: 'expanded', rightPanelTab: 'diagnostics' })

    expect(screen.getByText('内存诊断')).toBeInTheDocument()
    expect(await screen.findByText('chat-memory-diagnostics-panel')).toBeInTheDocument()
  })

  it('marks the active narrow entry with pressed semantics', () => {
    renderSidebar({ mode: 'collapsed', rightPanelTab: 'settings' })

    expect(screen.getByRole('button', { name: '打开设置' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '打开生图参数' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('removes storage from the top-level tabs and provides a dashboard entry button', async () => {
    renderSidebar()

    expect(screen.queryByRole('button', { name: '本地存储' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '进入本地存储仪表盘' })).toBeInTheDocument()
  })

  it('uses a unified analytics entry set with consistent actions', async () => {
    renderSidebar()

    expect(await screen.findByText('模型分析')).toBeInTheDocument()
    expect(await screen.findByText('运行日志')).toBeInTheDocument()
    expect(await screen.findByText('本地存储')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '进入模型分析' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '进入日志页' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '进入本地存储仪表盘' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '运行分析' })).not.toBeInTheDocument()
  })

  it('navigates to the storage dashboard route from the analysis tab', async () => {
    renderSidebar()

    fireEvent.click(await screen.findByRole('button', { name: '进入本地存储仪表盘' }))

    expect(navigateMock).toHaveBeenCalledWith(APP_ROUTES.storage)
  })

  it('navigates to the model stats route when clicking the analysis card body', async () => {
    renderSidebar()

    fireEvent.click(await screen.findByText('模型分析'))

    expect(navigateMock).toHaveBeenCalledWith(APP_ROUTES.modelStats)
  })

  it('renders a logs entry card inside the analysis tab', async () => {
    renderSidebar()

    expect(await screen.findByRole('button', { name: '进入日志页' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '进入模型分析' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '日志' })).not.toBeInTheDocument()
  })

  it('navigates to the logs dashboard route from the analysis tab', async () => {
    renderSidebar()

    fireEvent.click(await screen.findByRole('button', { name: '进入日志页' }))

    expect(navigateMock).toHaveBeenCalledWith(APP_ROUTES.logs)
  })
})
