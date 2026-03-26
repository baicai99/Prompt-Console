import { describe, expect, it, vi } from 'vitest'
import type { Conversation } from '../../../../types/conversation'
import { loadModelUsageStats } from '../modelUsageStatsService'
import type { ConversationRepository } from '../../infra/conversationRepository'

function makeConversation(id: string, createdAt: string, modelId = 'ch-a::model-a'): Conversation {
  return {
    id,
    title: id,
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
        modelId,
        paramValues: {},
      },
    },
    messages: [
      {
        id: `${id}-message`,
        createdAt,
        role: 'assistant',
        content: 'done',
        runs: [
          {
            id: `${id}-run`,
            batchId: `${id}-batch`,
            createdAt,
            sideMode: 'single',
            side: 'single',
            prompt: 'prompt',
            imageCount: 1,
            channelId: null,
            channelName: null,
            modelId,
            modelName: modelId,
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
            taskState: {
              status: 'completed',
              updatedAt: createdAt,
            },
            images: [{ id: `${id}-image`, seq: 1, status: 'pending', threadState: 'active' }],
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

describe('loadModelUsageStats', () => {
  it('loads multiple conversations and aggregates their runs', async () => {
    const firstConversationIso = getCurrentIso()
    const secondConversationIso = getCurrentIso()

    const repository = makeRepository(async (conversationId) => {
      if (conversationId === 'conv-1') {
        return makeConversation('conv-1', firstConversationIso)
      }
      return makeConversation('conv-2', secondConversationIso, 'ch-b::model-b')
    })

    const snapshot = await loadModelUsageStats({
      repository,
      summaries: [
        { id: 'conv-1', title: 'one', createdAt: '', updatedAt: '', lastMessagePreview: '' },
        { id: 'conv-2', title: 'two', createdAt: '', updatedAt: '', lastMessagePreview: '' },
      ],
      modelCatalog: { models: [] },
      range: 'week',
      granularity: 'day',
      timeZone: 'UTC',
      now: new Date(),
    })

    expect(snapshot.totalCount).toBe(2)
    expect(snapshot.activeModelCount).toBe(2)
  })

  it('skips conversations that fail to load and still returns remaining stats', async () => {
    const currentIso = getCurrentIso()

    const repository = makeRepository(async (conversationId) => {
      if (conversationId === 'broken') {
        throw new Error('broken')
      }
      return makeConversation('conv-1', currentIso)
    })

    const snapshot = await loadModelUsageStats({
      repository,
      summaries: [
        { id: 'broken', title: 'broken', createdAt: '', updatedAt: '', lastMessagePreview: '' },
        { id: 'conv-1', title: 'ok', createdAt: '', updatedAt: '', lastMessagePreview: '' },
      ],
      modelCatalog: { models: [] },
      range: 'week',
      granularity: 'day',
      timeZone: 'UTC',
      now: new Date(),
    })

    expect(snapshot.totalCount).toBe(1)
    expect(snapshot.loadIssues).toEqual({
      failedConversationCount: 1,
      totalConversationCount: 2,
    })
  })

  it('returns an empty snapshot when there is no history', async () => {
    const repository = makeRepository(async () => null)

    const snapshot = await loadModelUsageStats({
      repository,
      summaries: [],
      modelCatalog: { models: [] },
      range: 'week',
      granularity: 'day',
      timeZone: 'UTC',
      now: new Date(),
    })

    expect(snapshot.totalCount).toBe(0)
    expect(snapshot.activeModelCount).toBe(0)
    expect(snapshot.loadIssues).toBeNull()
  })

  it('includes retry-chain runs as separate requests in the loaded snapshot', async () => {
    const repository = makeRepository(async () => {
      const conversation = makeConversation('conv-1', '2026-03-16T10:00:00.000Z')
      const baseRun = conversation.messages[0].runs![0]
      return {
        ...conversation,
        messages: [
          {
            ...conversation.messages[0],
            runs: [
              {
                ...baseRun,
                id: 'run-1',
                batchId: 'batch-1',
                createdAt: '2026-03-16T10:00:00.000Z',
                taskState: {
                  status: 'failed',
                  updatedAt: '2026-03-16T10:00:30.000Z',
                  generatingStartedAt: '2026-03-16T10:00:10.000Z',
                  completedAt: '2026-03-16T10:00:30.000Z',
                },
              },
              {
                ...baseRun,
                id: 'run-2',
                batchId: 'batch-1',
                createdAt: '2026-03-16T10:01:00.000Z',
                retryOfRunId: 'run-1',
                retryAttempt: 1,
                taskState: {
                  status: 'completed',
                  updatedAt: '2026-03-16T10:01:40.000Z',
                  generatingStartedAt: '2026-03-16T10:01:10.000Z',
                  completedAt: '2026-03-16T10:01:40.000Z',
                },
              },
            ],
          },
        ],
      }
    })

    const snapshot = await loadModelUsageStats({
      repository,
      summaries: [
        { id: 'conv-1', title: 'one', createdAt: '', updatedAt: '', lastMessagePreview: '' },
      ],
      modelCatalog: { models: [] },
      range: 'week',
      granularity: 'day',
      timeZone: 'UTC',
      now: new Date('2026-03-16T12:00:00.000Z'),
    })

    expect(snapshot.totalCount).toBe(2)
    expect(snapshot.statusCounts).toEqual({
      completed: 1,
      failed: 1,
      cancelled: 0,
      inProgress: 0,
    })
    expect(snapshot.models).toEqual([
      expect.objectContaining({
        modelId: 'ch-a::model-a',
        count: 2,
      }),
    ])
  })

  it('counts in-place retry attempts from a single run', async () => {
    const repository = makeRepository(async () => {
      const conversation = makeConversation('conv-1', '2026-03-16T10:00:00.000Z')
      const baseRun = conversation.messages[0].runs![0]
      return {
        ...conversation,
        messages: [
          {
            ...conversation.messages[0],
            runs: [
              {
                ...baseRun,
                id: 'run-1',
                retryAttempt: 1,
                taskState: {
                  status: 'completed',
                  updatedAt: '2026-03-16T10:01:40.000Z',
                  generatingStartedAt: '2026-03-16T10:01:10.000Z',
                  completedAt: '2026-03-16T10:01:40.000Z',
                },
                attempts: [
                  {
                    attemptId: 'attempt-1',
                    source: 'initial',
                    createdAt: '2026-03-16T10:00:00.000Z',
                    updatedAt: '2026-03-16T10:00:30.000Z',
                    status: 'failed',
                    startedAt: '2026-03-16T10:00:10.000Z',
                    generatingStartedAt: '2026-03-16T10:00:10.000Z',
                    completedAt: '2026-03-16T10:00:30.000Z',
                    modelId: 'ch-a::model-a',
                    modelName: 'ch-a::model-a',
                    channelId: null,
                    channelName: null,
                  },
                  {
                    attemptId: 'attempt-2',
                    source: 'retry',
                    createdAt: '2026-03-16T10:01:00.000Z',
                    updatedAt: '2026-03-16T10:01:40.000Z',
                    status: 'completed',
                    startedAt: '2026-03-16T10:01:10.000Z',
                    generatingStartedAt: '2026-03-16T10:01:10.000Z',
                    completedAt: '2026-03-16T10:01:40.000Z',
                    modelId: 'ch-a::model-a',
                    modelName: 'ch-a::model-a',
                    channelId: null,
                    channelName: null,
                  },
                ],
              },
            ],
          },
        ],
      }
    })

    const snapshot = await loadModelUsageStats({
      repository,
      summaries: [
        { id: 'conv-1', title: 'one', createdAt: '', updatedAt: '', lastMessagePreview: '' },
      ],
      modelCatalog: { models: [] },
      range: 'week',
      granularity: 'day',
      timeZone: 'UTC',
      now: new Date('2026-03-16T12:00:00.000Z'),
    })

    expect(snapshot.totalCount).toBe(2)
    expect(snapshot.statusCounts).toEqual({
      completed: 1,
      failed: 1,
      cancelled: 0,
      inProgress: 0,
    })
  })
})
