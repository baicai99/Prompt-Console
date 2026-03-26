import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Conversation } from '../../../../types/conversation'
import type { ModelCatalog } from '../../../../types/model'
import type { ConversationRepository } from '../../infra/conversationRepository'
import { ModelUsageStatsPanel } from './ModelUsageStatsPanel'

type ConversationRun = NonNullable<Conversation['messages'][number]['runs']>[number]

function makeConversation(createdAt: string, overrides?: Partial<ConversationRun>): Conversation {
  return {
    id: 'conv-1',
    title: 'Conversation',
    titleMode: 'default',
    createdAt,
    updatedAt: createdAt,
    sideMode: 'single',
    sideCount: 1,
    settingsBySide: {
      single: {
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
        modelId: 'ch-a::model-a',
        paramValues: {},
      },
    },
    messages: [
      {
        id: 'message-1',
        createdAt,
        role: 'assistant',
        content: 'done',
        runs: [
          {
            id: 'run-1',
            batchId: 'batch-1',
            createdAt,
            sideMode: 'single',
            side: 'single',
            prompt: 'prompt',
            imageCount: 1,
            channelId: overrides?.channelId ?? null,
            channelName: overrides?.channelName ?? null,
            modelId: overrides?.modelId ?? 'ch-a::model-a',
            modelName: overrides?.modelName ?? 'Model A',
            templatePrompt: '',
            finalPrompt: '',
            variablesSnapshot: {},
            paramsSnapshot: {},
            settingsSnapshot: {
              resolution: '1024x1024',
              aspectRatio: '1:1',
              imageCount: 1,
              gridColumns: 1,
              sizeMode: 'preset',
              customWidth: 1024,
              customHeight: 1024,
              autoSave: false,
            },
            retryAttempt: 0,
            taskState: overrides?.taskState ?? {
              status: 'completed',
              updatedAt: createdAt,
            },
            images: overrides?.images ?? [{ id: 'img-1', seq: 1, status: 'pending', threadState: 'active' }],
          },
        ],
      },
    ],
  }
}

function makeRepository(loadConversation: ConversationRepository['loadConversation']): ConversationRepository {
  return {
    load: () => ({ summaries: [], activeId: null }),
    loadConversation,
    loadConversations: vi.fn(),
    migrateLegacyContent: vi.fn(),
    loadChannels: vi.fn(() => []),
    loadStagedSettings: vi.fn(() => null),
    saveIndex: vi.fn(),
    saveConversation: vi.fn(),
    removeConversation: vi.fn(),
    clearConversations: vi.fn(),
    saveActiveId: vi.fn(),
    saveChannels: vi.fn(),
    saveStagedSettings: vi.fn(),
  }
}

function getCurrentIso(): string {
  return new Date().toISOString()
}

function getCurrentDayLabel(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${month}/${day}`
}

function getCurrentWeekBucketCount(): number {
  const now = new Date()
  const weekday = now.getDay() === 0 ? 7 : now.getDay()
  return weekday
}

async function renderPanel(
  loadConversation: ConversationRepository['loadConversation'],
  modelCatalog: ModelCatalog = { models: [{ id: 'ch-a::model-a', name: 'Model A（https://ai.t8star.cn）', rawId: 'Model A', sourceName: 'https://ai.t8star.cn', params: [] }] },
) {
  await act(async () => {
    render(
      <ModelUsageStatsPanel
        isActive
        repository={makeRepository(loadConversation)}
        summaries={[{ id: 'conv-1', title: 'Conversation', createdAt: '', updatedAt: '', lastMessagePreview: '' }]}
        modelCatalog={modelCatalog}
      />,
    )
  })
}

describe('ModelUsageStatsPanel', () => {
  it('loads and shows the default range and granularity', async () => {
    await renderPanel(
      async () => makeConversation(getCurrentIso(), {
        modelName: 'chatgpt-4o-latest（https://ai.t8star.cn）',
        channelName: 'https://ai.t8star.cn',
        modelId: 'ch-a::chatgpt-4o-latest',
      }),
      { models: [{ id: 'ch-a::chatgpt-4o-latest', name: 'chatgpt-4o-latest（https://ai.t8star.cn）', rawId: 'chatgpt-4o-latest', sourceName: 'https://ai.t8star.cn', params: [] }] },
    )

    expect(await screen.findByText('模型调用排行榜')).toBeInTheDocument()
    expect(screen.getAllByRole('radio', { name: '天' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('radio', { name: '周' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('radio', { name: '月' }).length).toBeGreaterThan(0)
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getAllByText('chatgpt-4o-latest').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ai.t8star.cn').length).toBeGreaterThan(0)
    expect(screen.getByText('调用次数')).toBeInTheDocument()
    expect(screen.getByText('调用占比')).toBeInTheDocument()
    expect(screen.getAllByText('1 次').length).toBeGreaterThan(0)
    expect(screen.getAllByText('100.0%').length).toBeGreaterThan(0)
    expect(screen.getByText('成功 1')).toBeInTheDocument()
    expect(screen.getByText('失败率 0.00%')).toBeInTheDocument()
    expect(screen.queryByText('失败 0')).not.toBeInTheDocument()
    expect(screen.getByLabelText('统计摘要')).toBeInTheDocument()
    expect(screen.getByText('Top 1 模型')).toBeInTheDocument()
    expect(screen.getByText('统计口径')).toBeInTheDocument()
    expect(screen.getByText('状态分布')).toBeInTheDocument()
    expect(screen.queryByText(/ch-a::chatgpt-4o-latest/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/所选日期所在自然周/).length).toBeGreaterThan(0)
  })

  it('auto-adjusts unsupported granularity after range switch', async () => {
    await renderPanel(async () => makeConversation(getCurrentIso()))
    await screen.findByText('模型调用排行榜')

    fireEvent.click(screen.getAllByRole('radio', { name: '周' })[1])
    fireEvent.click(screen.getAllByRole('radio', { name: '天' })[0])

    expect(await screen.findByText('粒度已自动调整')).toBeInTheDocument()
    expect(screen.getByText(/已自动切换为“小时”/)).toBeInTheDocument()
  })

  it('shows empty state when there is no data', async () => {
    await renderPanel(async () => null)

    expect(await screen.findByText('当前时间范围和来源筛选下暂无模型调用数据')).toBeInTheDocument()
  })

  it('shows empty state after switching to day when there is no data for today', async () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayIso = yesterday.toISOString()

    await renderPanel(async () => makeConversation(yesterdayIso))
    await screen.findByText('时间范围')

    fireEvent.click(screen.getAllByRole('radio', { name: '天' })[0])

    expect(await screen.findByText('当前时间范围和来源筛选下暂无模型调用数据')).toBeInTheDocument()
  })

  it('allows choosing a specific date from the calendar input', async () => {
    const now = new Date()
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    const twoDaysAgoIso = twoDaysAgo.toISOString()
    const twoDaysAgoDateValue = twoDaysAgoIso.slice(0, 10)
    const twoDaysAgoDisplayValue = twoDaysAgoDateValue.replace(/-/g, '/')

    await renderPanel(async () => makeConversation(twoDaysAgoIso))
    await screen.findByText('时间范围')

    fireEvent.change(screen.getByLabelText('选择统计日期'), {
      target: { value: twoDaysAgoDisplayValue },
    })
    fireEvent.keyDown(screen.getByLabelText('选择统计日期'), { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(screen.getAllByText('Model A').length).toBeGreaterThan(0)
    })
    expect(screen.getByDisplayValue(twoDaysAgoDisplayValue)).toBeInTheDocument()
  })

  it('filters dashboard stats by source', async () => {
    await act(async () => {
      render(
        <ModelUsageStatsPanel
          isActive
          repository={makeRepository(async (conversationId) => {
            if (conversationId === 'conv-openai') {
              return makeConversation(getCurrentIso(), {
                modelId: 'openai::gpt-image-1',
                modelName: 'gpt-image-1（https://ai.t8star.cn）',
                channelName: 'https://ai.t8star.cn',
              })
            }

            return makeConversation(getCurrentIso(), {
              modelId: 'gemini::gemini-2.5-flash-image',
              modelName: 'gemini-2.5-flash-image（Gemini）',
              channelName: 'Gemini',
              taskState: {
                status: 'failed',
                updatedAt: getCurrentIso(),
              },
            })
          })}
          summaries={[
            { id: 'conv-openai', title: 'OpenAI', createdAt: '', updatedAt: '', lastMessagePreview: '' },
            { id: 'conv-gemini', title: 'Gemini', createdAt: '', updatedAt: '', lastMessagePreview: '' },
          ]}
          modelCatalog={{
            models: [
              { id: 'openai::gpt-image-1', name: 'gpt-image-1（https://ai.t8star.cn）', rawId: 'gpt-image-1', sourceName: 'https://ai.t8star.cn', params: [] },
              { id: 'gemini::gemini-2.5-flash-image', name: 'gemini-2.5-flash-image（Gemini）', rawId: 'gemini-2.5-flash-image', sourceName: 'Gemini', params: [] },
            ],
          }}
        />,
      )
    })

    expect(await screen.findByText('模型调用排行榜')).toBeInTheDocument()
    expect(screen.getAllByText('来源').length).toBeGreaterThan(0)

    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click((await screen.findAllByText('Gemini')).at(-1) as HTMLElement)

    await waitFor(() => {
      expect(screen.getAllByText('gemini-2.5-flash-image').length).toBeGreaterThan(0)
    })
    expect(screen.queryByText('gpt-image-1')).not.toBeInTheDocument()
    expect(screen.getAllByText('1 次').length).toBeGreaterThan(0)
    expect(screen.getByText('失败 1')).toBeInTheDocument()
    expect(screen.getByText('失败率 100.0%')).toBeInTheDocument()
    expect(screen.queryByText('成功 0')).not.toBeInTheDocument()
  })

  it('shows success and failure tags separately when both are present', async () => {
    const currentIso = getCurrentIso()

    await act(async () => {
      render(
        <ModelUsageStatsPanel
          isActive
          repository={makeRepository(async (conversationId) => {
            if (conversationId === 'conv-success') {
              return makeConversation(currentIso, {
                modelId: 'ch-a::model-a',
                modelName: 'Model A',
                taskState: {
                  status: 'completed',
                  updatedAt: currentIso,
                },
              })
            }

            return makeConversation(currentIso, {
              modelId: 'ch-a::model-a',
              modelName: 'Model A',
              taskState: {
                status: 'failed',
                updatedAt: currentIso,
              },
            })
          })}
          summaries={[
            { id: 'conv-success', title: 'Success', createdAt: '', updatedAt: '', lastMessagePreview: '' },
            { id: 'conv-failed', title: 'Failed', createdAt: '', updatedAt: '', lastMessagePreview: '' },
          ]}
          modelCatalog={{ models: [{ id: 'ch-a::model-a', name: 'Model A', params: [] }] }}
        />,
      )
    })

    expect(await screen.findByText('模型调用排行榜')).toBeInTheDocument()
    expect(screen.getByText('成功 1')).toBeInTheDocument()
    expect(screen.getByText('失败 1')).toBeInTheDocument()
  })

  it('shows error and allows retry when loading fails', async () => {
    const loadConversation = vi
      .fn<ConversationRepository['loadConversation']>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(makeConversation(getCurrentIso()))

    await renderPanel(loadConversation)

    expect(await screen.findByText('模型调用统计暂时无法读取，请稍后重试。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }))

    await waitFor(() => {
      expect(screen.getAllByText('Model A').length).toBeGreaterThan(0)
    })
  })

  it('shows a warning when part of the history cannot be loaded', async () => {
    await act(async () => {
      render(
        <ModelUsageStatsPanel
          isActive
          repository={makeRepository(async (conversationId) => (
            conversationId === 'broken' ? Promise.reject(new Error('broken')) : makeConversation(getCurrentIso())
          ))}
          summaries={[
            { id: 'broken', title: 'Broken', createdAt: '', updatedAt: '', lastMessagePreview: '' },
            { id: 'conv-1', title: 'Conversation', createdAt: '', updatedAt: '', lastMessagePreview: '' },
          ]}
          modelCatalog={{ models: [{ id: 'ch-a::model-a', name: 'Model A', params: [] }] }}
        />,
      )
    })

    expect(await screen.findByText('统计结果可能不完整')).toBeInTheDocument()
    expect(screen.getByText(/有 1 条读取失败/)).toBeInTheDocument()
  })

  it('marks stale data when a refresh fails after a successful load', async () => {
    const loadConversation = vi
      .fn<ConversationRepository['loadConversation']>()
      .mockResolvedValueOnce(makeConversation(getCurrentIso()))
      .mockRejectedValueOnce(new Error('boom'))

    await renderPanel(loadConversation)

    expect((await screen.findAllByText('Model A')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /刷\s*新/ }))

    expect(await screen.findByText('当前展示的是旧数据')).toBeInTheDocument()
    expect(screen.getByText('最新一次刷新失败，当前展示的是上一次成功加载的统计结果。')).toBeInTheDocument()
    expect(screen.getAllByText('Model A').length).toBeGreaterThan(0)
  })

  it('shows technical details only after expanding an item', async () => {
    await renderPanel(
      async () => makeConversation(getCurrentIso(), {
        modelName: 'chatgpt-4o-latest（https://ai.t8star.cn）',
        channelName: 'https://ai.t8star.cn',
        modelId: 'e233c234-8c4a-4662-9943-85b2c6432e28::chatgpt-4o-latest',
      }),
      { models: [{ id: 'e233c234-8c4a-4662-9943-85b2c6432e28::chatgpt-4o-latest', name: 'chatgpt-4o-latest（https://ai.t8star.cn）', rawId: 'chatgpt-4o-latest', sourceName: 'https://ai.t8star.cn', params: [] }] },
    )

    expect((await screen.findAllByText('chatgpt-4o-latest')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/e233c234-8c4a-4662-9943-85b2c6432e28::chatgpt-4o-latest/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /详情/ }))

    expect(await screen.findByText('内部 ID')).toBeInTheDocument()
    expect(screen.getByText(/e233c234-8c4a-4662-9943-85b2c6432e28::chatgpt-4o-latest/)).toBeInTheDocument()
    expect(screen.getAllByText('来源').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ai.t8star.cn').length).toBeGreaterThan(0)
  })

  it('keeps all status counts visible inside the grouped status card', async () => {
    const currentIso = getCurrentIso()
    await renderPanel(async () => makeConversation(currentIso, {
      taskState: {
        status: 'failed',
        updatedAt: currentIso,
      },
    }))

    await screen.findByText('状态分布')

    expect(screen.getAllByText('成功').length).toBeGreaterThan(0)
    expect(screen.getAllByText('失败').length).toBeGreaterThan(0)
    expect(screen.getAllByText('取消').length).toBeGreaterThan(0)
    expect(screen.getAllByText('进行中').length).toBeGreaterThan(0)
  })

  it('keeps the trend chart readable by reserving horizontal space for bucket labels', async () => {
    await renderPanel(async () => makeConversation(getCurrentIso()))

    await screen.findByText('调用趋势')

    const chart = screen.getByRole('img', { name: '模型调用趋势图' })
    expect(chart).toHaveStyle({ minWidth: `${Math.max(320, getCurrentWeekBucketCount() * 56)}px` })
    expect(screen.getAllByText(getCurrentDayLabel()).length).toBeGreaterThan(0)
  })
})
