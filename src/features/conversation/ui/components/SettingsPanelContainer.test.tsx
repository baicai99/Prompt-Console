import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPanelContainer } from './SettingsPanelContainer'

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

vi.mock('../../application/settingsPanelService', async () => {
  const actual = await vi.importActual<typeof import('../../application/settingsPanelService')>(
    '../../application/settingsPanelService',
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

beforeEach(() => {
  vi.clearAllMocks()
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

async function renderSettingsPanel(overrides?: Partial<ComponentProps<typeof SettingsPanelContainer>>) {
  const onSettingsChange = vi.fn()
  const onSettingsBatchChange = vi.fn()
  const onModelParamChange = vi.fn()
  let currentProps: ComponentProps<typeof SettingsPanelContainer> = {
    isVisible: true,
    sideMode: 'single',
    sideCount: 2,
    sideIds: [],
    isSideConfigLocked: false,
    settingsBySide: {
      single: {
        resolution: '1024x1024',
        modelId: 'gpt-image-1',
        aspectRatio: '',
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
    models: [{ id: 'gpt-image-1', name: 'GPT Image 1', tags: ['openai'], params: [] }],
    channels: [],
    generationMode: 'image',
    onSideModeChange: vi.fn(),
    onSideCountChange: vi.fn(),
    onSettingsChange,
    onSettingsBatchChange,
    onGenerationModeChange: vi.fn(),
    onModelChange: vi.fn(),
    onModelParamChange,
    onChannelsChange: vi.fn(),
    ...overrides,
  }
  let renderView: ReturnType<typeof render> | undefined
  await act(async () => {
    renderView = render(<SettingsPanelContainer {...currentProps} />)
    await Promise.resolve()
    await Promise.resolve()
  })

  if (!renderView) {
    throw new Error('SettingsPanelContainer test render did not initialize')
  }
  const settledRenderView = renderView
  const rerenderSettingsPanel = async (nextOverrides: Partial<ComponentProps<typeof SettingsPanelContainer>>) => {
    currentProps = { ...currentProps, ...nextOverrides }
    await act(async () => {
      settledRenderView.rerender(<SettingsPanelContainer {...currentProps} />)
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  return {
    ...settledRenderView,
    rerenderSettingsPanel,
    props: currentProps,
    onSettingsChange,
    onSettingsBatchChange,
    onModelParamChange,
  }
}

function getOpenDrawerTitles(): string[] {
  return Array.from(document.querySelectorAll('.ant-drawer-open .ant-drawer-title'))
    .map((element) => element.textContent ?? '')
}

function getVisibleModalTitles(): string[] {
  return Array.from(document.querySelectorAll('.ant-modal'))
    .filter((element) => (element as HTMLElement).style.display !== 'none')
    .map((element) => element.querySelector('.ant-modal-title')?.textContent ?? '')
}

describe('SettingsPanelContainer advanced features toggle', () => {
  it('does not render advanced feature controls in settings panel', async () => {
    await renderSettingsPanel()

    expect(screen.getByText('基础设置')).toBeInTheDocument()
    expect(screen.queryByText('启用高级功能')).not.toBeInTheDocument()
    expect(screen.getByText('生成模式')).toBeInTheDocument()
    expect(screen.getAllByText('生成模式')).toHaveLength(1)
    expect(screen.queryByText('显示输入框高级变量')).not.toBeInTheDocument()
    expect(screen.queryByText('启用动态提示词')).not.toBeInTheDocument()
    expect(screen.queryByText('根据首条提问自动重命名新对话标题')).not.toBeInTheDocument()
    expect(screen.queryByText('尺寸模式')).not.toBeInTheDocument()
    expect(screen.queryByText('比例')).not.toBeInTheDocument()
    expect(screen.queryByText('预设尺寸')).not.toBeInTheDocument()
    expect(screen.queryByText('单次生成张数')).not.toBeInTheDocument()
    expect(screen.queryByText('网格列数')).not.toBeInTheDocument()
    expect(screen.queryByText('模式')).not.toBeInTheDocument()
    expect(screen.queryByText('尺寸')).not.toBeInTheDocument()
    expect(screen.queryByText('保存')).not.toBeInTheDocument()
  })

  it('uses the global generation mode control', async () => {
    const onGenerationModeChange = vi.fn()
    await renderSettingsPanel({ onGenerationModeChange })

    fireEvent.click(screen.getByText('文本'))

    expect(onGenerationModeChange).toHaveBeenCalledWith('text')
  })

  it('renders stable top-level controls for the settings sidebar content', async () => {
    await renderSettingsPanel()

    expect(screen.getByText('多窗口开启')).toBeInTheDocument()
    expect(screen.queryByText('本地存储调试信息')).not.toBeInTheDocument()
    expect(screen.queryByText('当前已确认的业务落点')).not.toBeInTheDocument()
    expect(screen.getAllByRole('switch').length).toBeGreaterThan(0)
    expect(screen.getByText('图片')).toBeInTheDocument()
    expect(screen.getByText('文本')).toBeInTheDocument()
  })

  it('renders multi-window image settings without the workload summary alert', async () => {
    await renderSettingsPanel({
      sideMode: 'multi',
      sideCount: 2,
      sideIds: ['win-1', 'win-2'],
      settingsBySide: {
        single: {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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
        'win-1': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
          imageCount: 4,
          gridColumns: 4,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
          channelId: null,
          generationMode: 'image',
          paramValues: {},
        },
        'win-2': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
          imageCount: 4,
          gridColumns: 4,
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

    expect(screen.queryByText('当前配置单轮会提交 8 张图片')).not.toBeInTheDocument()
  })

  it('renders output and save once as a global section in multi-window mode', async () => {
    await renderSettingsPanel({
      sideMode: 'multi',
      sideCount: 2,
      sideIds: ['win-1', 'win-2'],
      settingsBySide: {
        single: {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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
        'win-1': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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
        'win-2': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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

    expect(screen.getByText('自动保存到本地')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择保存路径' })).toBeInTheDocument()
    expect(screen.queryByText('全局输出与保存')).not.toBeInTheDocument()
    expect(screen.queryByText('输出尺寸和本地保存策略对所有窗口统一生效。')).not.toBeInTheDocument()
  })

  it('renders the window settings section with nested tabs in multi-window mode', async () => {
    await renderSettingsPanel({
      sideMode: 'multi',
      sideCount: 3,
      sideIds: ['win-1', 'win-2', 'win-3'],
      settingsBySide: {
        single: {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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
        'win-1': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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
        'win-2': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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
        'win-3': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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

    expect(screen.queryByText('窗口设置')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '窗口 1' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '窗口 2' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '窗口 3' })).toBeInTheDocument()
  })

  it('renders a dedicated global channel section and keeps window settings focused on models', async () => {
    await renderSettingsPanel({
      sideMode: 'multi',
      sideCount: 2,
      sideIds: ['win-1', 'win-2'],
      channels: [
        {
          id: 'ch-1',
          name: 'https://ai.t8star.cn',
          baseUrl: 'https://ai.t8star.cn',
          apiKey: 'k',
          models: ['gpt-image-1'],
        },
      ],
      settingsBySide: {
        single: {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
          channelId: 'ch-1',
          generationMode: 'image',
          paramValues: {},
        },
        'win-1': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
          channelId: 'ch-1',
          generationMode: 'image',
          paramValues: {},
        },
        'win-2': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
          channelId: 'ch-1',
          generationMode: 'image',
          paramValues: {},
        },
      },
    })

    expect(screen.getByText('渠道管理')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '管理渠道' })).toBeInTheDocument()
    expect(screen.queryByText('全局模型渠道')).not.toBeInTheDocument()
    expect(screen.getByText('按窗口选择模型')).toBeInTheDocument()
    expect(screen.queryByText('渠道为全局资源。每个窗口可独立选择不同服务商下的图片、文本和视频模型。')).not.toBeInTheDocument()
    expect(screen.getByText('模型与参数')).toBeInTheDocument()
    expect(screen.queryByText('生成渠道')).not.toBeInTheDocument()
  })

  it('renders image model params inside window settings in multi-window mode', async () => {
    await renderSettingsPanel({
      sideMode: 'multi',
      sideCount: 2,
      sideIds: ['win-1', 'win-2'],
      channels: [
        {
          id: 'ch-1',
          name: 'https://ai.t8star.cn',
          baseUrl: 'https://ai.t8star.cn',
          apiKey: 'k',
          models: ['gpt-image-1'],
        },
      ],
      models: [
        {
          id: 'gpt-image-1',
          name: 'GPT Image 1',
          tags: ['openai'],
          params: [
            {
              key: 'responseFormat',
              label: '返回格式',
              type: 'enum',
              default: 'b64_json',
              options: ['url', 'b64_json'],
            },
          ],
        },
      ],
      settingsBySide: {
        single: {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
          channelId: 'ch-1',
          generationMode: 'image',
          paramValues: { responseFormat: 'b64_json' },
        },
        'win-1': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
          channelId: 'ch-1',
          generationMode: 'image',
          paramValues: { responseFormat: 'b64_json' },
        },
        'win-2': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
          channelId: 'ch-1',
          generationMode: 'image',
          paramValues: { responseFormat: 'b64_json' },
        },
      },
    })

    expect(screen.getByText('当前图片模型参数')).toBeInTheDocument()
    expect(screen.getAllByText('返回格式')).toHaveLength(1)
  })

  it('asks whether to sync generation-base changes across all windows in multi-window mode', async () => {
    await renderSettingsPanel({
      sideMode: 'multi',
      sideCount: 2,
      sideIds: ['win-1', 'win-2'],
      settingsBySide: {
        single: {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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
        'win-1': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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
        'win-2': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
          imageCount: 2,
          gridColumns: 2,
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

  })

  it('applies the pending settings patch to every window after confirmation', async () => {
    await renderSettingsPanel({
      sideMode: 'multi',
      sideCount: 2,
      sideIds: ['win-1', 'win-2'],
      settingsBySide: {
        single: {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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
        'win-1': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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
        'win-2': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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

  })

  it('applies output and save changes to all windows immediately in multi-window mode', async () => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: vi.fn().mockResolvedValue({ name: 'Downloads' }),
    })

    const { onSettingsBatchChange, onSettingsChange } = await renderSettingsPanel({
      sideMode: 'multi',
      sideCount: 2,
      sideIds: ['win-1', 'win-2'],
      settingsBySide: {
        single: {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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
        'win-1': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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
        'win-2': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
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

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '选择保存路径' }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onSettingsBatchChange).toHaveBeenCalledTimes(1)
    expect(onSettingsBatchChange.mock.calls[0]?.[0]).toEqual(['win-1', 'win-2'])
    expect(onSettingsBatchChange.mock.calls[0]?.[1]).toEqual({
      saveDirectory: expect.stringMatching(/^picked:Downloads:/),
    })
    expect(onSettingsChange).not.toHaveBeenCalled()
    expect(screen.queryByText('同步到所有窗口')).not.toBeInTheDocument()
  })

  it('keeps only the channel management entry in the global channel section', async () => {
    const { onSettingsBatchChange, onSettingsChange } = await renderSettingsPanel({
      sideMode: 'multi',
      sideCount: 2,
      sideIds: ['win-1', 'win-2'],
      channels: [
        {
          id: 'old-channel',
          name: 'Old',
          baseUrl: 'https://old.example.com',
          apiKey: 'k1',
          models: ['gpt-image-1'],
        },
        {
          id: 'gemini-proxy',
          name: 'https://ai.t8star.cn',
          baseUrl: 'https://ai.t8star.cn',
          apiKey: 'k2',
          models: ['gpt-image-1'],
        },
      ],
      settingsBySide: {
        single: {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
          channelId: 'old-channel',
          generationMode: 'image',
          paramValues: { size: '1K' },
        },
        'win-1': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
          channelId: 'old-channel',
          generationMode: 'image',
          paramValues: { size: '1K' },
        },
        'win-2': {
          resolution: '1024x1024',
          modelId: 'gpt-image-1',
          aspectRatio: '',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
          channelId: 'old-channel',
          generationMode: 'image',
          paramValues: { size: '1K' },
        },
      },
    })

    expect(screen.getByRole('button', { name: '管理渠道' })).toBeInTheDocument()
    expect(screen.getByText('渠道管理')).toBeInTheDocument()
    expect(screen.queryByText('生成渠道')).not.toBeInTheDocument()
    expect(onSettingsChange).not.toHaveBeenCalled()
    expect(onSettingsBatchChange).not.toHaveBeenCalled()
    expect(screen.queryByText('同步到所有窗口')).not.toBeInTheDocument()
  })

  it('opens the api channel management drawer when requested externally', async () => {
    await renderSettingsPanel({
      openChannelManagementDrawerSignal: 1,
    })

    await waitFor(() => {
      expect(getOpenDrawerTitles()).toEqual(['API 渠道管理'])
    })

    expect(getVisibleModalTitles()).toHaveLength(0)
  })

  it('opens the channel model list in a drawer and pushes the parent drawer', async () => {
    await renderSettingsPanel({
      channels: [
        {
          id: 'channel-1',
          name: 'OpenAI Proxy',
          baseUrl: 'https://example.com/v1',
          apiKey: 'k-test',
          providerId: 'openai-compatible',
          models: ['gpt-image-1'],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: '管理渠道' }))
    fireEvent.click(screen.getByRole('button', { name: '模型列表' }))

    await waitFor(() => {
      expect(fetchChannelModelEntriesMock).toHaveBeenCalledWith({
        baseUrl: 'https://example.com/v1',
        apiKey: 'k-test',
        providerId: 'openai-compatible',
      })
    })

    await waitFor(() => {
      expect(document.querySelectorAll('.ant-drawer').length).toBeGreaterThan(1)
    })

    const channelManagementDrawerTitle = Array.from(document.querySelectorAll('.ant-drawer-title')).find(
      (element) => element.textContent === 'API 渠道管理',
    )
    const modelListDrawerTitle = Array.from(document.querySelectorAll('.ant-drawer-title')).find(
      (element) => element.textContent === '模型列表',
    )

    const channelManagementDrawer = channelManagementDrawerTitle?.closest('.ant-drawer')
    const channelManagementWrapper = channelManagementDrawer?.querySelector('.ant-drawer-content-wrapper') as HTMLElement | null
    const modelListDrawer = modelListDrawerTitle?.closest('.ant-drawer')
    const modelListWrapper = modelListDrawer?.querySelector('.ant-drawer-content-wrapper') as HTMLElement | null

    expect(channelManagementDrawerTitle).not.toBeNull()
    expect(modelListDrawerTitle).not.toBeNull()
    expect(modelListDrawerTitle?.closest('.ant-drawer')).not.toBeNull()
    expect(channelManagementWrapper).not.toBeNull()
    expect(modelListWrapper).not.toBeNull()
    expect(channelManagementWrapper?.style.transform).toBe('translateX(-180px)')
    expect(modelListWrapper?.style.width).toContain('820px')
    expect(modelListWrapper?.style.width).toContain('100vw - 32px')
    expect(document.querySelector('.ant-modal')).toBeNull()
  })

  it('returns to the channel table after closing and reopening the parent drawer', async () => {
    await renderSettingsPanel({
      channels: [
        {
          id: 'channel-1',
          name: 'OpenAI Proxy',
          baseUrl: 'https://example.com/v1',
          apiKey: 'k-test',
          providerId: 'openai-compatible',
          models: ['gpt-image-1'],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: '管理渠道' }))
    fireEvent.click(screen.getByRole('button', { name: '模型列表' }))

    await waitFor(() => {
      expect(getOpenDrawerTitles()).toEqual(expect.arrayContaining(['API 渠道管理', '模型列表']))
    })

    const channelManagementDrawerTitle = Array.from(document.querySelectorAll('.ant-drawer-title')).find(
      (element) => element.textContent === 'API 渠道管理',
    )
    const channelManagementCloseButton = channelManagementDrawerTitle
      ?.closest('.ant-drawer')
      ?.querySelector('.ant-drawer-close') as HTMLButtonElement | null

    expect(channelManagementCloseButton).not.toBeNull()

    fireEvent.click(channelManagementCloseButton as HTMLButtonElement)

    await waitFor(() => {
      expect(getOpenDrawerTitles()).toHaveLength(0)
    })

    fireEvent.click(screen.getByRole('button', { name: '管理渠道' }))

    await waitFor(() => {
      expect(getOpenDrawerTitles()).toEqual(['API 渠道管理'])
    })
  })

  it('resets settings overlays when the parent settings drawer becomes hidden', async () => {
    const { rerenderSettingsPanel, props } = await renderSettingsPanel({
      channels: [
        {
          id: 'channel-1',
          name: 'OpenAI Proxy',
          baseUrl: 'https://example.com/v1',
          apiKey: 'k-test',
          providerId: 'openai-compatible',
          models: ['gpt-image-1'],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: '管理渠道' }))
    fireEvent.click(screen.getByRole('button', { name: '模型列表' }))

    await waitFor(() => {
      expect(getOpenDrawerTitles()).toEqual(expect.arrayContaining(['API 渠道管理', '模型列表']))
    })

    await rerenderSettingsPanel({ ...props, isVisible: false })

    await waitFor(() => {
      expect(getOpenDrawerTitles()).toHaveLength(0)
      expect(document.querySelector('.ant-modal')).toBeNull()
    })

    await rerenderSettingsPanel({ ...props, isVisible: true })

    fireEvent.click(screen.getByRole('button', { name: '管理渠道' }))
    fireEvent.click(screen.getByRole('button', { name: '新增渠道' }))

    await waitFor(() => {
      expect(getVisibleModalTitles()).toEqual(['新增渠道'])
    })

    await rerenderSettingsPanel({ ...props, isVisible: false })

    await waitFor(() => {
      expect(getOpenDrawerTitles()).toHaveLength(0)
      expect(getVisibleModalTitles()).toHaveLength(0)
    })

    await rerenderSettingsPanel({ ...props, isVisible: true })

    expect(getOpenDrawerTitles()).toHaveLength(0)
    expect(getVisibleModalTitles()).toHaveLength(0)
  })

  it('does not render logging controls in advanced settings', async () => {
    await renderSettingsPanel()

    expect(screen.queryByText('日志功能')).not.toBeInTheDocument()
    expect(screen.queryByText('启用日志系统')).not.toBeInTheDocument()
    expect(screen.queryByText('日志详情级别')).not.toBeInTheDocument()
    expect(screen.queryByText('图片生成链路日志')).not.toBeInTheDocument()
  })
})
