import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ConversationWorkspace } from './ConversationWorkspace'

const switchConversation = vi.fn()
const workspaceSettingsSidebarMock = vi.fn(() => <div>settings-sidebar</div>)
const conversationWorkspaceStageMock = vi.fn(() => <div>workspace-stage</div>)
const imagePreviewModalMock = vi.fn(() => null)
const setPersistentPanelModeMock = vi.fn()
const setComposerPanelModeMock = vi.fn()
const setDraftMock = vi.fn()
const setGenerationModeMock = vi.fn()
const composerPanelModeState = {
  mode: 'expanded' as 'expanded' | 'collapsed',
}
const singleSideSettings = {
  modelId: null,
  promptTemplate: '',
  negativePrompt: '',
  seed: null,
  width: null,
  height: null,
  steps: null,
  cfgScale: null,
  sampler: null,
  paramValues: {},
}
const controllerState = {
  activeId: 'c1',
  sendScrollTrigger: 0,
  sendScrollTargetMessageId: null as string | null,
  activeSideMode: 'single' as 'single' | 'multi',
  activeSideCount: 1,
  activeSides: ['single'] as string[],
  activeSettingsBySide: {
    single: singleSideSettings,
  },
  modelCatalog: { models: [] as Array<{ id: string; name: string; params: [] }> },
}

vi.mock('../application/conversationSourceImagePreviewService', () => ({
  createConversationSourceImagePreviewService: () => ({}),
}))

vi.mock('../../../hooks/useImagePreview', () => ({
  useImagePreview: () => ({
    isPreviewOpen: false,
    previewMode: 'single',
    previewImages: [],
    previewPairs: [],
    interactionMode: 'fit',
    compareMode: 'split',
    isSyncLocked: true,
    showInfoPanel: false,
    pixelMode: 'fit',
    activePane: 'left',
    zoom: 1,
    offset: { x: 0, y: 0 },
    transform: { zoom: 1, offset: { x: 0, y: 0 }, mode: 'fit' },
    sharedTransform: { zoom: 1, offset: { x: 0, y: 0 }, mode: 'fit' },
    leftTransform: { zoom: 1, offset: { x: 0, y: 0 }, mode: 'fit' },
    rightTransform: { zoom: 1, offset: { x: 0, y: 0 }, mode: 'fit' },
    isDragging: false,
    dragOriginRef: { current: null },
    currentPreviewImage: null,
    currentPreviewPair: null,
    openPreview: vi.fn(),
    closePreview: vi.fn(),
    goPrevPreview: vi.fn(),
    goNextPreview: vi.fn(),
    goFirstPreview: vi.fn(),
    goLastPreview: vi.fn(),
    zoomBy: vi.fn(),
    zoomTo: vi.fn(),
    panBy: vi.fn(),
    panTo: vi.fn(),
    toggleFitMode: vi.fn(),
    setActualPixelMode: vi.fn(),
    setCompareMode: vi.fn(),
    setIsSyncLocked: vi.fn(),
    toggleInfoPanel: vi.fn(),
    setActivePane: vi.fn(),
    setIsDragging: vi.fn(),
  }),
}))

vi.mock('../../../hooks/usePersistentPanelMode', () => ({
  usePersistentPanelMode: ({ storageKey }: { storageKey: string }) => {
    if (storageKey === 'm3:composer-panel-collapsed') {
      return {
        mode: composerPanelModeState.mode,
        setMode: setComposerPanelModeMock,
        toggleMode: vi.fn(),
      }
    }

    return {
      mode: 'collapsed',
      setMode: setPersistentPanelModeMock,
      toggleMode: vi.fn(),
    }
  },
}))

vi.mock('./workspace/useGlobalImageDrop', () => ({
  useGlobalImageDrop: vi.fn(),
}))

vi.mock('../domain/generationMode', () => ({
  resolveSharedGenerationMode: () => 'image',
  resolveCurrentModeModelId: (settings: { modelId?: string }) => settings.modelId ?? '',
}))

vi.mock('./ConversationWorkspaceStage', () => ({
  ConversationWorkspaceStage: (props: unknown) => conversationWorkspaceStageMock(props),
}))

vi.mock('./WorkspaceSettingsSidebar', () => ({
  WorkspaceSettingsSidebar: (props: unknown) => workspaceSettingsSidebarMock(props),
}))

vi.mock('./components/ImagePreviewModal', () => ({
  ImagePreviewModal: (props: unknown) => imagePreviewModalMock(props),
}))

vi.mock('./controller/useConversationWorkspaceController', () => ({
  useConversationWorkspaceController: () => ({
    summaries: [
      {
        id: 'c1',
        title: '对话一',
        createdAt: '2026-03-06T00:00:00.000Z',
        updatedAt: '2026-03-06T00:00:00.000Z',
        lastMessagePreview: 'preview',
      },
      {
        id: 'c2',
        title: '对话二',
        createdAt: '2026-03-07T00:00:00.000Z',
        updatedAt: '2026-03-07T00:00:00.000Z',
        lastMessagePreview: 'preview',
      },
    ],
    activeConversation: null,
    imageTasksByRunId: {},
    shouldConfirmCreateConversation: false,
    activeId: controllerState.activeId,
    draft: '',
    draftSourceImages: [],
    sendError: null,
    isSending: false,
    showAdvancedVariables: false,
    dynamicPromptEnabled: false,
    autoRenameConversationTitle: false,
    autoRenameConversationTitleModelId: null,
    panelValueFormat: 'table',
    panelVariables: [],
    favoriteModelIds: [],
    runConcurrency: 1,
    runConcurrencyUnlimited: false,
    imageRuntimeSettings: { maxImageDimension: 2048, imageCountLimit: 4, promptSource: 'chat' },
    loggingSettings: { enabled: false, verbose: false, persistDays: 7 },
    historyVisibleLimit: 20,
    historyPageSize: 20,
    isLoadingOlderMessages: false,
    sendScrollTrigger: controllerState.sendScrollTrigger,
    sendScrollTargetMessageId: controllerState.sendScrollTargetMessageId,
    resolvedVariables: {},
    templatePreview: { ok: true, finalPrompt: '', missingKeys: [] },
    unusedVariableKeys: [],
    activeSideMode: controllerState.activeSideMode,
    activeSideCount: controllerState.activeSideCount,
    activeSides: controllerState.activeSides,
    isSideConfigLocked: false,
    activeSettingsBySide: controllerState.activeSettingsBySide,
    modelCatalog: controllerState.modelCatalog,
    channels: [],
    isSendBlocked: false,
    panelBatchError: null,
    panelMismatchRowIds: [],
    replayingRunIds: [],
    setDraft: setDraftMock,
    appendDraftSourceImages: vi.fn(),
    removeDraftSourceImage: vi.fn(),
    clearDraftSourceImages: vi.fn(),
    setShowAdvancedVariables: vi.fn(),
    setDynamicPromptEnabled: vi.fn(),
    setAutoRenameConversationTitle: vi.fn(),
    setAutoRenameConversationTitleModelId: vi.fn(),
    setPanelValueFormat: vi.fn(),
    setPanelVariables: vi.fn(),
    setFavoriteModelIds: vi.fn(),
    setRunConcurrency: vi.fn(),
    setRunConcurrencyUnlimited: vi.fn(),
    setImageRuntimeSettings: vi.fn(),
    setLoggingSettings: vi.fn(),
    createNewConversation: vi.fn(),
    clearAllConversations: vi.fn(),
    removeConversation: vi.fn(),
    renameConversation: vi.fn(),
    togglePinConversation: vi.fn(),
    switchConversation,
    updateSideMode: vi.fn(),
    updateSideCount: vi.fn(),
    updateSideSettings: vi.fn(),
    updateSidesSettings: vi.fn(),
    setGenerationMode: setGenerationModeMock,
    setSideModel: vi.fn(),
    setSideModelForCurrentMode: vi.fn(),
    setSideModelParam: vi.fn(),
    setChannels: vi.fn(),
    sendDraft: vi.fn(),
    loadOlderMessages: vi.fn(),
    retryRun: vi.fn(),
    cancelMessageRuns: vi.fn(),
    replayRunAsNewMessage: vi.fn(),
    downloadAllRunImages: vi.fn(),
    downloadMessageRunImages: vi.fn(),
    downloadSingleRunImage: vi.fn(),
    downloadBatchRunImages: vi.fn(),
  }),
}))

beforeEach(() => {
  controllerState.activeId = 'c1'
  controllerState.sendScrollTrigger = 0
  controllerState.sendScrollTargetMessageId = null
  controllerState.activeSideMode = 'single'
  controllerState.activeSideCount = 1
  controllerState.activeSides = ['single']
  controllerState.activeSettingsBySide = {
    single: singleSideSettings,
  }
  controllerState.modelCatalog = { models: [] }
  composerPanelModeState.mode = 'expanded'
  setComposerPanelModeMock.mockReset()
  setDraftMock.mockReset()
  setGenerationModeMock.mockReset()
  imagePreviewModalMock.mockClear()
})

describe('ConversationWorkspace', () => {
  it('passes the aligned collapsed width to the right sidebar', () => {
    controllerState.activeId = 'c1'
    controllerState.sendScrollTrigger = 0
    setPersistentPanelModeMock.mockReset()
    workspaceSettingsSidebarMock.mockClear()
    conversationWorkspaceStageMock.mockClear()

    render(
      <MemoryRouter>
        <ConversationWorkspace />
      </MemoryRouter>,
    )

    expect(workspaceSettingsSidebarMock).toHaveBeenCalled()
    expect(workspaceSettingsSidebarMock.mock.calls[0]?.[0]).toMatchObject({
      collapsedWidth: 52,
      expandedWidth: '55vw',
    })
  })

  it('opens the left drawer and closes it after switching conversations', async () => {
    controllerState.activeId = 'c1'
    controllerState.sendScrollTrigger = 0
    setPersistentPanelModeMock.mockReset()
    const user = userEvent.setup()
    switchConversation.mockReset()
    conversationWorkspaceStageMock.mockClear()

    render(
      <MemoryRouter>
        <ConversationWorkspace />
      </MemoryRouter>,
    )

    await user.click(screen.getByLabelText('open-left-sidebar-drawer'))
    expect(await screen.findByText('会话导航')).toBeInTheDocument()

    await user.click(screen.getByText('对话一'))

    expect(switchConversation).toHaveBeenCalledWith('c1')
    await waitFor(() => {
      expect(document.querySelector('.conversation-nav-drawer-root .ant-drawer-open')).toBeNull()
    })
  })

  it('bumps the conversation-open scroll trigger when the active conversation changes without a send', async () => {
    controllerState.activeId = 'c1'
    controllerState.sendScrollTrigger = 0
    controllerState.sendScrollTargetMessageId = null
    setPersistentPanelModeMock.mockReset()
    conversationWorkspaceStageMock.mockClear()

    const { rerender } = render(
      <MemoryRouter>
        <ConversationWorkspace />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(conversationWorkspaceStageMock).toHaveBeenCalled()
    })

    const firstColumnsProps = conversationWorkspaceStageMock.mock.calls.at(-1)?.[0] as {
      columnsProps: { conversationOpenScrollTrigger: number }
    }

    controllerState.activeId = 'c2'

    rerender(
      <MemoryRouter>
        <ConversationWorkspace />
      </MemoryRouter>,
    )

    await waitFor(() => {
      const latestProps = conversationWorkspaceStageMock.mock.calls.at(-1)?.[0] as {
        columnsProps: { conversationOpenScrollTrigger: number }
      }
      expect(latestProps.columnsProps.conversationOpenScrollTrigger)
        .toBeGreaterThan(firstColumnsProps.columnsProps.conversationOpenScrollTrigger)
    })

    const secondColumnsProps = conversationWorkspaceStageMock.mock.calls.at(-1)?.[0] as {
      columnsProps: { conversationOpenScrollTrigger: number }
    }

    expect(secondColumnsProps.columnsProps.conversationOpenScrollTrigger)
      .toBeGreaterThan(firstColumnsProps.columnsProps.conversationOpenScrollTrigger)
  })

  it('does not bump the conversation-open scroll trigger when a send creates and activates a conversation', async () => {
    controllerState.activeId = null
    controllerState.sendScrollTrigger = 0
    controllerState.sendScrollTargetMessageId = null
    setPersistentPanelModeMock.mockReset()
    conversationWorkspaceStageMock.mockClear()

    const { rerender } = render(
      <MemoryRouter>
        <ConversationWorkspace />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(conversationWorkspaceStageMock).toHaveBeenCalled()
    })

    const firstColumnsProps = conversationWorkspaceStageMock.mock.calls.at(-1)?.[0] as {
      columnsProps: {
        conversationOpenScrollTrigger: number
        sendScrollTrigger: number
        sendScrollTargetMessageId: string | null
      }
    }

    controllerState.activeId = 'c2'
    controllerState.sendScrollTrigger = 1
    controllerState.sendScrollTargetMessageId = 'assistant-1'

    rerender(
      <MemoryRouter>
        <ConversationWorkspace />
      </MemoryRouter>,
    )

    await waitFor(() => {
      const latestProps = conversationWorkspaceStageMock.mock.calls.at(-1)?.[0] as {
        columnsProps: {
          conversationOpenScrollTrigger: number
          sendScrollTrigger: number
          sendScrollTargetMessageId: string | null
        }
      }
      expect(latestProps.columnsProps.conversationOpenScrollTrigger)
        .toBe(firstColumnsProps.columnsProps.conversationOpenScrollTrigger)
      expect(latestProps.columnsProps.sendScrollTrigger).toBe(1)
      expect(latestProps.columnsProps.sendScrollTargetMessageId).toBe('assistant-1')
    })
  })

  it('routes composer dynamic prompt requests to the right sidebar drawer', async () => {
    controllerState.activeId = 'c1'
    controllerState.sendScrollTrigger = 0
    setPersistentPanelModeMock.mockReset()
    workspaceSettingsSidebarMock.mockClear()
    conversationWorkspaceStageMock.mockClear()

    render(
      <MemoryRouter>
        <ConversationWorkspace />
      </MemoryRouter>,
    )

    const initialStageProps = conversationWorkspaceStageMock.mock.calls.at(-1)?.[0] as {
      composerProps: { onOpenDynamicPromptDrawer?: (tab?: 'table' | 'bulk') => void }
    }
    initialStageProps.composerProps.onOpenDynamicPromptDrawer?.('table')

    await waitFor(() => {
      const latestSidebarProps = workspaceSettingsSidebarMock.mock.calls.at(-1)?.[0] as {
        rightPanelTab: string
        dynamicPromptRequestedTab: 'table' | 'bulk' | null
      }
      expect(latestSidebarProps.rightPanelTab).toBe('dynamicPrompt')
      expect(latestSidebarProps.dynamicPromptRequestedTab).toBe('table')
    })

    expect(setPersistentPanelModeMock).toHaveBeenCalledWith('expanded')
  })

  it('routes the floating model trigger to the shared right sidebar drawer', async () => {
    setPersistentPanelModeMock.mockReset()
    workspaceSettingsSidebarMock.mockClear()
    conversationWorkspaceStageMock.mockClear()

    render(
      <MemoryRouter>
        <ConversationWorkspace />
      </MemoryRouter>,
    )

    const initialStageProps = conversationWorkspaceStageMock.mock.calls.at(-1)?.[0] as {
      columnsProps: { onOpenModelPicker?: (target: { kind: 'window'; side: string }) => void }
    }
    initialStageProps.columnsProps.onOpenModelPicker?.({ kind: 'window', side: 'single' })

    await waitFor(() => {
      const latestSidebarProps = workspaceSettingsSidebarMock.mock.calls.at(-1)?.[0] as {
        rightPanelTab: string
        modelPickerTarget: { kind: 'window'; side: string } | { kind: 'default' }
      }
      expect(latestSidebarProps.rightPanelTab).toBe('modelPicker')
      expect(latestSidebarProps.modelPickerTarget).toEqual({ kind: 'window', side: 'single' })
    })

    expect(setPersistentPanelModeMock).toHaveBeenCalledWith('expanded')
  })

  it('separates default-model target from per-window target in multi mode', async () => {
    controllerState.activeSideMode = 'multi'
    controllerState.activeSideCount = 2
    controllerState.activeSides = ['left', 'right']
    controllerState.activeSettingsBySide = {
      left: { ...singleSideSettings, modelId: 'left-model' },
      right: { ...singleSideSettings, modelId: 'right-model' },
    }
    controllerState.modelCatalog = {
      models: [
        { id: 'left-model', name: 'Left Model', params: [] },
        { id: 'right-model', name: 'Right Model', params: [] },
      ],
    }
    setPersistentPanelModeMock.mockReset()
    workspaceSettingsSidebarMock.mockClear()
    conversationWorkspaceStageMock.mockClear()

    render(
      <MemoryRouter>
        <ConversationWorkspace />
      </MemoryRouter>,
    )

    const initialSidebarProps = workspaceSettingsSidebarMock.mock.calls.at(-1)?.[0] as {
      onOpenModelPicker?: (target: { kind: 'window'; side: string } | { kind: 'default' }) => void
    }
    initialSidebarProps.onOpenModelPicker?.({ kind: 'default' })

    await waitFor(() => {
      const latestSidebarProps = workspaceSettingsSidebarMock.mock.calls.at(-1)?.[0] as {
        rightPanelTab: string
        modelPickerTarget: { kind: 'window'; side: string } | { kind: 'default' }
      }
      expect(latestSidebarProps.rightPanelTab).toBe('modelPicker')
      expect(latestSidebarProps.modelPickerTarget).toEqual({ kind: 'default' })
    })

    const initialStageProps = conversationWorkspaceStageMock.mock.calls.at(-1)?.[0] as {
      columnsProps: { onOpenModelPicker?: (target: { kind: 'window'; side: string }) => void }
    }
    initialStageProps.columnsProps.onOpenModelPicker?.({ kind: 'window', side: 'right' })

    await waitFor(() => {
      const latestSidebarProps = workspaceSettingsSidebarMock.mock.calls.at(-1)?.[0] as {
        modelPickerTarget: { kind: 'window'; side: string } | { kind: 'default' }
      }
      expect(latestSidebarProps.modelPickerTarget).toEqual({ kind: 'window', side: 'right' })
    })

    const latestSidebarProps = workspaceSettingsSidebarMock.mock.calls.at(-1)?.[0] as {
      onOpenModelPicker?: (target: { kind: 'window'; side: string } | { kind: 'default' }) => void
    }
    latestSidebarProps.onOpenModelPicker?.({ kind: 'default' })

    await waitFor(() => {
      const resolvedSidebarProps = workspaceSettingsSidebarMock.mock.calls.at(-1)?.[0] as {
        modelPickerTarget: { kind: 'window'; side: string } | { kind: 'default' }
      }
      expect(resolvedSidebarProps.modelPickerTarget).toEqual({ kind: 'default' })
    })
  })

  it('passes composer panel mode and handlers to the workspace stage', () => {
    composerPanelModeState.mode = 'collapsed'
    setPersistentPanelModeMock.mockReset()
    setComposerPanelModeMock.mockReset()
    conversationWorkspaceStageMock.mockClear()

    render(
      <MemoryRouter>
        <ConversationWorkspace />
      </MemoryRouter>,
    )

    const stageProps = conversationWorkspaceStageMock.mock.calls.at(-1)?.[0] as {
      composerPanelMode: 'expanded' | 'collapsed'
      onExpandComposer: () => void
      onCollapseComposer: () => void
    }

    expect(stageProps.composerPanelMode).toBe('collapsed')

    stageProps.onExpandComposer()
    stageProps.onCollapseComposer()

    expect(setComposerPanelModeMock).toHaveBeenNthCalledWith(1, 'expanded')
    expect(setComposerPanelModeMock).toHaveBeenNthCalledWith(2, 'collapsed')
  })

  it('reuses template prompt for preview draft backfill', async () => {
    render(
      <MemoryRouter>
        <ConversationWorkspace />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(imagePreviewModalMock).toHaveBeenCalled()
    })

    const modalProps = imagePreviewModalMock.mock.calls.at(-1)?.[0] as {
      onReusePrompt?: (entry: {
        run: {
          templatePrompt: string
          finalPrompt: string
        }
      }) => void
    }

    modalProps.onReusePrompt?.({
      run: {
        templatePrompt: 'raw {{subject}} --ar 16:9',
        finalPrompt: 'raw cat --ar 16:9',
      },
    })

    expect(setGenerationModeMock).toHaveBeenCalledWith('image')
    expect(setDraftMock).toHaveBeenCalledWith('raw {{subject}} --ar 16:9')
  })

  it('falls back to final prompt when template prompt is blank', async () => {
    render(
      <MemoryRouter>
        <ConversationWorkspace />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(imagePreviewModalMock).toHaveBeenCalled()
    })

    const modalProps = imagePreviewModalMock.mock.calls.at(-1)?.[0] as {
      onReusePrompt?: (entry: {
        run: {
          templatePrompt: string
          finalPrompt: string
        }
      }) => void
    }

    modalProps.onReusePrompt?.({
      run: {
        templatePrompt: '   ',
        finalPrompt: 'resolved final prompt',
      },
    })

    expect(setDraftMock).toHaveBeenCalledWith('resolved final prompt')
  })
})
