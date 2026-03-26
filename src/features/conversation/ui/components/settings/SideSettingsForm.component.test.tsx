import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ApiChannel } from '../../../../../types/channel'
import type { Side, SingleSideSettings } from '../../../../../types/conversation'
import type { ModelSpec } from '../../../../../types/model'
import { SideSettingsForm } from './SideSettingsForm'

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
  channelId: 'ch-1',
  modelId: 'gpt-image-1',
  textModelId: 'gpt-4o-mini',
  videoModelId: 'seedance-1.0-lite',
  paramValues: { responseFormat: 'b64_json' },
}

const channels: ApiChannel[] = [
  {
    id: 'ch-1',
    name: 'Main',
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'k',
    models: ['gpt-image-1'],
  },
]

const models: ModelSpec[] = [
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
]

function renderForm(settings: SingleSideSettings) {
  const side: Side = 'single'

  render(
    <SideSettingsForm
      side={side}
      settingsBySide={{ single: settings }}
      modelTagBySide={{ single: '__all__' }}
      setModelTagBySide={vi.fn()}
      channels={channels}
      models={models}
      availableModelTags={[]}
      onSettingsChange={vi.fn()}
      onModelChange={vi.fn()}
      onModelParamChange={vi.fn()}
      messageApi={{
        warning: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
      }}
      onOpenChannelDrawer={vi.fn()}
    />,
  )
}

describe('SideSettingsForm', () => {
  it('renders inline cards instead of collapse panels', () => {
    renderForm(baseSettings)

    expect(screen.getByText('渠道与模型')).toBeInTheDocument()
    expect(screen.getByText('当前图片模型参数')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '管理渠道' })).toBeInTheDocument()
    expect(screen.queryByText('输出与保存')).toBeInTheDocument()
  })

  it('shows a warning when response format is url', () => {
    renderForm({
      ...baseSettings,
      paramValues: { responseFormat: 'url' },
    })

    expect(screen.getByText('当前返回格式为 URL，批量下载不可用，请切换为 b64_json。')).toBeInTheDocument()
    expect(screen.getByText('启用 URL 返回格式后，“下载全部”和“下载这一批次”会被禁用。')).toBeInTheDocument()
  })

  it('does not show the warning for b64_json response format', () => {
    renderForm(baseSettings)

    expect(screen.queryByText('当前返回格式为 URL，批量下载不可用，请切换为 b64_json。')).not.toBeInTheDocument()
  })

  it('honors section visibility props', () => {
    render(
      <SideSettingsForm
        side="single"
        settingsBySide={{ single: baseSettings }}
        modelTagBySide={{ single: '__all__' }}
        setModelTagBySide={vi.fn()}
        channels={channels}
        models={models}
        availableModelTags={[]}
        onSettingsChange={vi.fn()}
        onModelChange={vi.fn()}
        onModelParamChange={vi.fn()}
        messageApi={{
          warning: vi.fn(),
          success: vi.fn(),
          error: vi.fn(),
        }}
        onOpenChannelDrawer={vi.fn()}
        includeOutputSection={false}
        includeChannelSection={false}
        includeImageModelParamsSection={false}
      />,
    )

    expect(screen.queryByText('输出与保存')).not.toBeInTheDocument()
    expect(screen.getByText('模型与参数')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '管理渠道' })).not.toBeInTheDocument()
    expect(screen.queryByText('当前图片模型参数')).not.toBeInTheDocument()
  })
})
