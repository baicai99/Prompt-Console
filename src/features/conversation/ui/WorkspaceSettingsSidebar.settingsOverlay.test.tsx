import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceSettingsSidebar } from './WorkspaceSettingsSidebar'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../../utils/imageRuntimeSettings'

const navigateMock = vi.fn()

const {
  fetchChannelModelsMock,
  fetchChannelModelEntriesMock,
  pickSaveDirectoryMock,
  isSaveDirectoryReadyMock,
  makeIdMock,
} = vi.hoisted(() => ({
  fetchChannelModelsMock: vi.fn(),
  fetchChannelModelEntriesMock: vi.fn(),
  pickSaveDirectoryMock: vi.fn(),
  isSaveDirectoryReadyMock: vi.fn(),
  makeIdMock: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../application/settingsPanelService', async () => {
  const actual = await vi.importActual<typeof import('../application/settingsPanelService')>(
    '../application/settingsPanelService',
  )

  return {
    ...actual,
    settingsPanelService: {
      ...actual.settingsPanelService,
      fetchChannelModels: fetchChannelModelsMock,
      fetchChannelModelEntries: fetchChannelModelEntriesMock,
      pickSaveDirectory: pickSaveDirectoryMock,
      isSaveDirectoryReady: isSaveDirectoryReadyMock,
      makeId: makeIdMock,
    },
  }
})

const singleSideSettings = {
  generationMode: 'image' as const,
  resolution: '1024x1024',
  modelId: 'gpt-image-1',
  aspectRatio: '',
  imageCount: 1,
  gridColumns: 1,
  sizeMode: 'preset' as const,
  customWidth: 1024,
  customHeight: 1024,
  autoSave: false,
  channelId: 'channel-1',
  paramValues: {},
}

const loggingSettings = {
  enabled: false,
  detailLevel: 'brief' as const,
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
}

function getOpenDrawerTitles(): string[] {
  return Array.from(document.querySelectorAll('.ant-drawer-open .ant-drawer-title'))
    .map((element) => element.textContent ?? '')
}

function SidebarHarness() {
  const [mode, setMode] = useState<'collapsed' | 'expanded'>('collapsed')
  const [rightPanelTab, setRightPanelTab] = useState<
    'modelPicker' | 'settings' | 'modelStats' | 'imageParams' | 'dynamicPrompt' | 'advanced' | 'diagnostics'
  >('settings')

  return (
    <WorkspaceSettingsSidebar
      mode={mode}
      rightPanelTab={rightPanelTab}
      setRightPanelMode={setMode}
      toggleRightPanelMode={() => setMode((prev) => (prev === 'expanded' ? 'collapsed' : 'expanded'))}
      setRightPanelTab={setRightPanelTab}
      expandedWidth="55vw"
      collapsedWidth={56}
      activeSideMode="single"
      activeSideCount={1}
      activeSides={['single']}
      composerPanelMode="expanded"
      modelPickerTarget={{ kind: 'window', side: 'single' }}
      summaries={[]}
      isSideConfigLocked={false}
      activeSettingsBySide={{ single: singleSideSettings }}
      models={[{ id: 'gpt-image-1', name: 'GPT Image 1', tags: ['openai'], params: [] }]}
      channels={[
        {
          id: 'channel-1',
          name: 'OpenAI Proxy',
          baseUrl: 'https://example.com/v1',
          apiKey: 'k-test',
          providerId: 'openai-compatible',
          models: ['gpt-image-1'],
        },
      ]}
      activeGenerationMode="image"
      loggingSettings={loggingSettings}
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
      onOpenModelPicker={vi.fn()}
      onCollapseComposer={vi.fn()}
      onExpandComposer={vi.fn()}
      requestComposerFocus={vi.fn()}
    />
  )
}

describe('WorkspaceSettingsSidebar settings overlays', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigateMock.mockReset()
    fetchChannelModelsMock.mockResolvedValue(['gpt-image-1'])
    fetchChannelModelEntriesMock.mockResolvedValue([
      {
        id: 'gpt-image-1',
        metadata: { capability: 'image' },
      },
    ])
    pickSaveDirectoryMock.mockResolvedValue({
      saveDirectory: 'picked:Downloads:test',
      directoryName: 'Downloads',
    })
    isSaveDirectoryReadyMock.mockReturnValue(true)
    makeIdMock.mockReturnValue('mock-channel-id')
  })

  it('resets nested settings overlays after closing and reopening the main settings drawer', async () => {
    const user = userEvent.setup()
    render(<SidebarHarness />)

    await user.click(screen.getByRole('button', { name: '打开设置' }))
    const manageChannelsButton = await screen.findByRole('button', { name: '管理渠道' }, { timeout: 4000 })
    await user.click(manageChannelsButton)
    const modelListButton = await screen.findByRole('button', { name: '模型列表' }, { timeout: 4000 })
    await user.click(modelListButton)

    await waitFor(() => {
      expect(fetchChannelModelEntriesMock).toHaveBeenCalledWith({
        baseUrl: 'https://example.com/v1',
        apiKey: 'k-test',
        providerId: 'openai-compatible',
      })
      expect(getOpenDrawerTitles()).toEqual(expect.arrayContaining(['设置', 'API 渠道管理', '模型列表']))
    })

    const settingsDrawerTitle = Array.from(document.querySelectorAll('.ant-drawer-title')).find(
      (element) => element.textContent === '设置',
    )
    const settingsDrawerCloseButton = settingsDrawerTitle
      ?.closest('.ant-drawer')
      ?.querySelector('.ant-drawer-close') as HTMLButtonElement | null

    expect(settingsDrawerCloseButton).not.toBeNull()

    await user.click(settingsDrawerCloseButton as HTMLButtonElement)

    await waitFor(() => {
      expect(getOpenDrawerTitles()).toHaveLength(0)
    })

    await user.click(screen.getByRole('button', { name: '打开设置' }))

    await waitFor(() => {
      expect(getOpenDrawerTitles()).toEqual(['设置'])
    })
  })
})
