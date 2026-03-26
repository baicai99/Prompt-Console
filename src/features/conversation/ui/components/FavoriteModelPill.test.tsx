import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelSpec } from '../../../../types/model'
import { FavoriteModelPanel, FavoriteModelTrigger } from './FavoriteModelPill'
import { resolveVisibleModelsForPicker } from './favoriteModelPanelHelpers'

function makeModels(): ModelSpec[] {
  return [
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', tags: ['google'], params: [] },
    { id: 'gpt-image-1', name: 'GPT Image 1', tags: ['openai'], params: [] },
    { id: 'dall-e-3', name: 'DALL-E 3', tags: ['openai'], params: [] },
  ]
}

function selectableButtonsInSection(sectionTitle: string) {
  const heading = screen.getByRole('heading', { name: sectionTitle })
  const container = heading.closest('section') ?? heading.parentElement
  if (!container) {
    throw new Error(`Section container for "${sectionTitle}" not found`) 
  }
  return within(container)
    .getAllByRole('button')
    .filter((button) => {
      const label = button.getAttribute('aria-label') ?? button.textContent ?? ''
      return !label.startsWith('收藏') && !label.startsWith('取消收藏')
    })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('FavoriteModelPanel', () => {
  it('renders the manage panel content without an extra trigger layer', () => {
    render(
      <FavoriteModelPanel
        currentModelId="gpt-image-1"
        models={makeModels()}
        favoriteModelIds={[]}
        onSelectModel={vi.fn()}
        onFavoriteModelIdsChange={vi.fn()}
        headerTitle="管理常用模型"
      />,
    )

    expect(screen.getByText('管理常用模型')).toBeInTheDocument()
    expect(screen.queryByText('常用模型')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '完成' })).not.toBeInTheDocument()
  })

  it('sorts favorite models to the top while preserving original order within groups', () => {
    render(
      <FavoriteModelPanel
        currentModelId="gpt-image-1"
        models={makeModels()}
        favoriteModelIds={['dall-e-3']}
        onSelectModel={vi.fn()}
        onFavoriteModelIdsChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: '当前模型' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '已收藏' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '全部模型' })).toBeInTheDocument()
    expect(selectableButtonsInSection('当前模型').map((button) => button.getAttribute('aria-label'))).toEqual(['GPT Image 1'])
    expect(selectableButtonsInSection('已收藏').map((button) => button.getAttribute('aria-label'))).toEqual(['DALL-E 3'])
    expect(selectableButtonsInSection('全部模型').map((button) => button.getAttribute('aria-label'))).toEqual(['Gemini 2.5 Flash Image'])
  })

  it('clicks the model row to switch current model', () => {
    const onSelectModel = vi.fn()
    render(
      <FavoriteModelPanel
        currentModelId="gpt-image-1"
        models={makeModels()}
        favoriteModelIds={['dall-e-3']}
        onSelectModel={onSelectModel}
        onFavoriteModelIdsChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'DALL-E 3' }))

    expect(onSelectModel).toHaveBeenCalledWith('dall-e-3')
  })

  it('clicks the star to update favorites without switching the current model', () => {
    const onFavoriteModelIdsChange = vi.fn()
    const onSelectModel = vi.fn()
    render(
      <FavoriteModelPanel
        currentModelId="gpt-image-1"
        models={makeModels()}
        favoriteModelIds={[]}
        onSelectModel={onSelectModel}
        onFavoriteModelIdsChange={onFavoriteModelIdsChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '收藏 GPT Image 1' }))

    expect(onFavoriteModelIdsChange).toHaveBeenCalledWith(['gpt-image-1'])
    expect(onSelectModel).not.toHaveBeenCalled()
  })

  it('keeps favorites first after search filtering', () => {
    render(
      <FavoriteModelPanel
        currentModelId="gpt-image-1"
        models={makeModels()}
        favoriteModelIds={['dall-e-3']}
        onSelectModel={vi.fn()}
        onFavoriteModelIdsChange={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('搜索模型'), { target: { value: 'e' } })

    const modelButtons = screen.getAllByRole('button').filter((button) => {
      const label = button.getAttribute('aria-label') ?? ''
      return label && !label.startsWith('收藏') && !label.startsWith('取消收藏')
    })

    expect(modelButtons.map((item) => item.getAttribute('aria-label'))).toEqual(['GPT Image 1', 'DALL-E 3', 'Gemini 2.5 Flash Image'])
  })

  it('supports compact fuzzy search across separators and version markers', () => {
    render(
      <FavoriteModelPanel
        currentModelId="doubao-seedance-1.5-pro"
        models={[
          { id: 'doubao-seedance-1.5-pro', name: 'Doubao Seedance 1.5 Pro', tags: ['doubao'], params: [] },
          { id: 'doubao-seedream-3.0', name: 'Doubao Seedream 3.0', tags: ['doubao'], params: [] },
          { id: 'dall-e-3', name: 'DALL-E 3', tags: ['openai'], params: [] },
        ]}
        favoriteModelIds={[]}
        onSelectModel={vi.fn()}
        onFavoriteModelIdsChange={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('搜索模型'), { target: { value: 'se15' } })

    const modelButtons = screen.getAllByRole('button').filter((button) => {
      const label = button.getAttribute('aria-label') ?? ''
      return label && !label.startsWith('收藏') && !label.startsWith('取消收藏')
    })

    expect(modelButtons.map((item) => item.getAttribute('aria-label'))).toEqual(['Doubao Seedance 1.5 Pro'])
  })

  it('shows models from all configured providers in one picker', () => {
    render(
      <FavoriteModelPanel
        currentModelId="openai::gpt-image-1"
        models={[
          { id: 'openai::gpt-image-1', name: 'gpt-image-1（https://ai.openai.example）', rawId: 'gpt-image-1', channelId: 'openai', sourceName: 'https://ai.openai.example', tags: ['openai'], params: [] },
          { id: 'gemini::gemini-2.5-flash-image', name: 'gemini-2.5-flash-image（https://ai.gemini.example）', rawId: 'gemini-2.5-flash-image', channelId: 'gemini', sourceName: 'https://ai.gemini.example', tags: ['google'], params: [] },
          { id: 'doubao::seedream-3.0', name: 'seedream-3.0（https://ai.doubao.example）', rawId: 'seedream-3.0', channelId: 'doubao', sourceName: 'https://ai.doubao.example', tags: ['豆包'], params: [] },
        ]}
        favoriteModelIds={[]}
        onSelectModel={vi.fn()}
        onFavoriteModelIdsChange={vi.fn()}
      />,
    )

    const modelButtons = screen.getAllByRole('button').filter((button) => {
      const label = button.getAttribute('aria-label') ?? ''
      return label && !label.startsWith('收藏') && !label.startsWith('取消收藏')
    })

    expect(modelButtons.map((item) => item.getAttribute('aria-label'))).toEqual([
      'gpt-image-1（https://ai.openai.example）',
      'gemini-2.5-flash-image（https://ai.gemini.example）',
      'seedream-3.0（https://ai.doubao.example）',
    ])
  })

  it('renders a provider filter with discovered supplier options', async () => {
    render(
      <FavoriteModelPanel
        currentModelId="openai::gpt-image-1"
        models={[
          { id: 'openai::gpt-image-1', name: 'gpt-image-1（https://ai.t8star.cn）', rawId: 'gpt-image-1', channelId: 'openai', sourceName: 'https://ai.t8star.cn', tags: ['openai'], params: [] },
          { id: 'openai::dall-e-3', name: 'dall-e-3（https://ai.t8star.cn）', rawId: 'dall-e-3', channelId: 'openai', sourceName: 'https://ai.t8star.cn', tags: ['openai'], params: [] },
          { id: 'doubao::seedream-4-0', name: 'seedream-4-0（https://ai.qiaojiangapp.cn）', rawId: 'seedream-4-0', channelId: 'doubao', sourceName: 'https://ai.qiaojiangapp.cn', tags: ['豆包'], params: [] },
        ]}
        favoriteModelIds={[]}
        onSelectModel={vi.fn()}
        onFavoriteModelIdsChange={vi.fn()}
      />,
    )

    const providerCombobox = screen.getByRole('combobox', { name: '筛选供应商' })
    fireEvent.mouseDown(providerCombobox)
    expect((await screen.findAllByRole('option')).map((item) => item.getAttribute('aria-label'))).toEqual([
      'ai.t8star.cn',
      'ai.qiaojiangapp.cn',
    ])
  })

  it('renders a model category selector with shared category options', async () => {
    render(
      <FavoriteModelPanel
        currentModelId="openai::gpt-image-1"
        models={[
          { id: 'openai::gpt-image-1', name: 'gpt-image-1（https://ai.t8star.cn）', rawId: 'gpt-image-1', channelId: 'openai', sourceName: 'https://ai.t8star.cn', tags: ['openai'], params: [] },
          { id: 'doubao::seedream-4-0', name: 'doubao-seedream-4-0（https://ai.qiaojiangapp.cn）', rawId: 'doubao-seedream-4-0', channelId: 'doubao', sourceName: 'https://ai.qiaojiangapp.cn', tags: ['豆包'], params: [] },
        ]}
        favoriteModelIds={[]}
        onSelectModel={vi.fn()}
        onFavoriteModelIdsChange={vi.fn()}
      />,
    )

    const categoryCombobox = screen.getByRole('combobox', { name: '筛选模型分类' })
    fireEvent.mouseDown(categoryCombobox)
    expect((await screen.findAllByRole('option')).map((item) => item.getAttribute('aria-label'))).toContain('OpenAI（GPT）')
    expect((await screen.findAllByRole('option')).map((item) => item.getAttribute('aria-label'))).toContain('字节跳动/火山引擎（豆包）')
  })

  it('filters models by selected provider in the picker data set', () => {
    expect(resolveVisibleModelsForPicker({
      models: [
        { id: 'openai::gpt-image-1', name: 'gpt-image-1（https://ai.t8star.cn）', rawId: 'gpt-image-1', channelId: 'openai', sourceName: 'https://ai.t8star.cn', tags: ['openai'], params: [] },
        { id: 'openai::chatgpt-4o-latest', name: 'chatgpt-4o-latest（https://ai.t8star.cn）', rawId: 'chatgpt-4o-latest', channelId: 'openai', sourceName: 'https://ai.t8star.cn', tags: ['openai'], params: [] },
        { id: 'doubao::seedream-4-0', name: 'seedream-4-0（https://ai.qiaojiangapp.cn）', rawId: 'seedream-4-0', channelId: 'doubao', sourceName: 'https://ai.qiaojiangapp.cn', tags: ['豆包'], params: [] },
      ],
      providerFilter: 'ai.qiaojiangapp.cn',
      trainerTagFilter: undefined,
      search: '',
    }).map((item) => item.id)).toEqual(['doubao::seedream-4-0'])
  })

  it('filters models by selected trainer tag in the picker data set', () => {
    expect(resolveVisibleModelsForPicker({
      models: [
        { id: 'openai::gpt-image-1', name: 'gpt-image-1（https://ai.t8star.cn）', rawId: 'gpt-image-1', channelId: 'openai', sourceName: 'https://ai.t8star.cn', tags: ['openai'], params: [] },
        { id: 'doubao::seedream-4-0', name: 'doubao-seedream-4-0（https://ai.qiaojiangapp.cn）', rawId: 'doubao-seedream-4-0', channelId: 'doubao', sourceName: 'https://ai.qiaojiangapp.cn', tags: ['豆包'], params: [] },
      ],
      providerFilter: undefined,
      trainerTagFilter: '字节跳动/火山引擎（豆包）',
      search: '',
    }).map((item) => item.id)).toEqual(['doubao::seedream-4-0'])
  })

  it('combines provider filtering with search in the picker data set', () => {
    expect(resolveVisibleModelsForPicker({
      models: [
        { id: 'openai::gpt-image-1', name: 'gpt-image-1（https://ai.t8star.cn）', rawId: 'gpt-image-1', channelId: 'openai', sourceName: 'https://ai.t8star.cn', tags: ['openai'], params: [] },
        { id: 'openai::dall-e-3', name: 'dall-e-3（https://ai.t8star.cn）', rawId: 'dall-e-3', channelId: 'openai', sourceName: 'https://ai.t8star.cn', tags: ['openai'], params: [] },
        { id: 'doubao::seedream-4-0', name: 'seedream-4-0（https://ai.qiaojiangapp.cn）', rawId: 'seedream-4-0', channelId: 'doubao', sourceName: 'https://ai.qiaojiangapp.cn', tags: ['豆包'], params: [] },
      ],
      providerFilter: undefined,
      trainerTagFilter: 'OpenAI（GPT）',
      search: 'dall',
    }).map((item) => item.id)).toEqual(['openai::dall-e-3'])
  })

  it('combines trainer tag filtering with search in the picker data set', () => {
    expect(resolveVisibleModelsForPicker({
      models: [
        { id: 'openai::gpt-image-1', name: 'gpt-image-1（https://ai.t8star.cn）', rawId: 'gpt-image-1', channelId: 'openai', sourceName: 'https://ai.t8star.cn', tags: ['openai'], params: [] },
        { id: 'doubao::seedream-4-0', name: 'doubao-seedream-4-0（https://ai.qiaojiangapp.cn）', rawId: 'doubao-seedream-4-0', channelId: 'doubao', sourceName: 'https://ai.qiaojiangapp.cn', tags: ['豆包'], params: [] },
        { id: 'doubao::seedream-3-0', name: 'doubao-seedream-3-0（https://ai.qiaojiangapp.cn）', rawId: 'doubao-seedream-3-0', channelId: 'doubao', sourceName: 'https://ai.qiaojiangapp.cn', tags: ['豆包'], params: [] },
      ],
      providerFilter: undefined,
      trainerTagFilter: '字节跳动/火山引擎（豆包）',
      search: '4-0',
    }).map((item) => item.id)).toEqual(['doubao::seedream-4-0'])
  })

  it('shows empty state text when the current channel has no visible models', () => {
    render(
      <FavoriteModelPanel
        currentModelId="gpt-image-1"
        models={[]}
        favoriteModelIds={['gpt-image-1']}
        onSelectModel={vi.fn()}
        onFavoriteModelIdsChange={vi.fn()}
        emptyText="请先为当前窗口选择渠道并刷新模型列表"
      />,
    )

    expect(screen.getByText('请先为当前窗口选择渠道并刷新模型列表')).toBeInTheDocument()
    const selectionButtons = screen.queryAllByRole('button').filter((button) => {
      const label = button.getAttribute('aria-label') ?? ''
      return label && !label.startsWith('收藏') && !label.startsWith('取消收藏')
    })
    expect(selectionButtons).toHaveLength(0)
  })

  it('extracts and formats provider info as secondary text', () => {
    render(
      <FavoriteModelPanel
        currentModelId="m1"
        models={[
          {
            id: 'm1',
            name: 'doubao-seedream-5-0-260128（火山引擎）',
            tags: ['豆包'],
            params: [],
          },
        ]}
        favoriteModelIds={[]}
        onSelectModel={vi.fn()}
        onFavoriteModelIdsChange={vi.fn()}
      />,
    )

    expect(screen.getByText('doubao-seedream-5-0-260128')).toBeInTheDocument()
    expect(screen.getByText('火山引擎')).toBeInTheDocument()
  })

  it('shows compact domain text for url-like provider info in the manage list', () => {
    render(
      <FavoriteModelPanel
        currentModelId="m1"
        models={[
          {
            id: 'm1',
            name: 'doubao-seedream-5-0-260128（https://ai.qiaojiangapp.cn）',
            tags: ['豆包'],
            params: [],
          },
          {
            id: 'm2',
            name: 'doubao-1-5-vision-pro-32k（https://ai.t8star.cn）',
            tags: ['豆包'],
            params: [],
          },
        ]}
        favoriteModelIds={[]}
        onSelectModel={vi.fn()}
        onFavoriteModelIdsChange={vi.fn()}
      />,
    )

    expect(screen.getByText('doubao-seedream-5-0-260128')).toBeInTheDocument()
    const secondaryLabels = screen.getAllByText(/ai\./).map((item) => item.textContent)
    expect(secondaryLabels).toContain('ai.qiaojiangapp.cn')
    expect(secondaryLabels).toContain('ai.t8star.cn')
  })

  it('shows a loading animation before progressively rendering a large model list', async () => {
    render(
      <FavoriteModelPanel
        isActive
        currentModelId="model-1"
        models={Array.from({ length: 120 }, (_, index) => ({
          id: `model-${index + 1}`,
          name: `Model ${index + 1}`,
          tags: ['openai'],
          params: [],
        }))}
        favoriteModelIds={[]}
        onSelectModel={vi.fn()}
        onFavoriteModelIdsChange={vi.fn()}
      />,
    )

    expect(screen.getByText('正在加载模型列表')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText('正在加载模型列表')).not.toBeInTheDocument()
    })
    const modelSelectionButtons = screen.getAllByRole('button').filter((button) => {
      const label = button.getAttribute('aria-label') ?? ''
      return label && !label.startsWith('收藏') && !label.startsWith('取消收藏')
    })
    expect(modelSelectionButtons.length).toBeGreaterThanOrEqual(80)
  })
})

describe('FavoriteModelTrigger', () => {
  it('renders compact provider info for the current model', () => {
    render(
      <FavoriteModelTrigger
        currentModel={{
          name: 'doubao-seedream-5-0-260128（https://ai.qiaojiangapp.cn）',
          sourceName: 'https://ai.qiaojiangapp.cn',
        }}
        onClick={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'doubao-seedream-5-0-260128（https://ai.qiaojiangapp.cn）' })
    expect(document.body.querySelector('.favorite-model-pill-label')?.textContent).toBe('doubao-seedream-5-0-260128')
    expect(document.body.querySelector('.favorite-model-pill-meta')?.textContent).toBe('ai.qiaojiangapp.cn')
    expect(trigger.className).toContain('rounded-lg')
    expect(trigger.className).not.toContain('rounded-[15px]')
  })

  it('uses the placeholder label when no current model exists', () => {
    const onClick = vi.fn()
    render(<FavoriteModelTrigger currentModel={null} onClick={onClick} />)

    const button = screen.getByRole('button', { name: '添加常用模型' })
    expect(button).toBeInTheDocument()
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
