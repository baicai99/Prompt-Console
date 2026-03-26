import { describe, expect, it } from 'vitest'
import {
  buildFairResumableImageQueue,
  collectPendingImageTasks,
  collectRuns,
  findRunById,
  findRunMessageId,
  getRunsForSide,
} from '../../features/conversation/application/queries/conversationQueries'
import type { Conversation, ImageTask, Message } from '../../types/conversation'

const assistantMessage: Message = {
  id: 'm1',
  createdAt: '2026-01-01T00:00:00.000Z',
  role: 'assistant',
  content: 'done',
  runs: [
    {
      id: 'r1',
      batchId: 'b1',
      createdAt: '2026-01-01T00:00:00.000Z',
      sideMode: 'single',
      side: 'single',
      prompt: 'x',
      imageCount: 1,
      channelId: 'ch-1',
      channelName: 'main',
      modelId: 'model-a',
      modelName: 'Model A',
      templatePrompt: 'x',
      finalPrompt: 'x',
      variablesSnapshot: {},
      paramsSnapshot: {},
      settingsSnapshot: {
        resolution: '1K',
        aspectRatio: '1:1',
        imageCount: 1,
        gridColumns: 1,
        sizeMode: 'preset',
        customWidth: 1024,
        customHeight: 1024,
        autoSave: false,
      },
      retryAttempt: 0,
      images: [
        {
          id: 'i1',
          seq: 1,
          status: 'pending',
          serverTaskId: 'task-1',
          lastResumeAttemptAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'r2',
      batchId: 'b2',
      createdAt: '2026-01-01T00:00:00.000Z',
      sideMode: 'multi',
      side: 'win-2',
      prompt: 'y',
      imageCount: 1,
      channelId: 'ch-1',
      channelName: 'main',
      modelId: 'model-b',
      modelName: 'Model B',
      templatePrompt: 'y',
      finalPrompt: 'y',
      variablesSnapshot: {},
      paramsSnapshot: {},
      settingsSnapshot: {
        resolution: '1K',
        aspectRatio: '1:1',
        imageCount: 1,
        gridColumns: 1,
        sizeMode: 'preset',
        customWidth: 1024,
        customHeight: 1024,
        autoSave: false,
      },
      retryAttempt: 0,
      images: [
        {
          id: 'i2',
          seq: 1,
          status: 'success',
          fileRef: '/ok.png',
        },
      ],
    },
  ],
}

const conversation: Conversation = {
  id: 'c1',
  title: 'Conversation',
  titleMode: 'manual',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  sideMode: 'single',
  sideCount: 2,
  settingsBySide: {
    single: {
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount: 1,
      gridColumns: 1,
      sizeMode: 'preset',
      customWidth: 1024,
      customHeight: 1024,
      autoSave: false,
      channelId: 'ch-1',
      modelId: 'model-a',
      paramValues: {},
    },
  },
  messages: [assistantMessage],
}

describe('conversationQueries helpers', () => {
  it('finds runs and owning messages', () => {
    expect(collectRuns(conversation).map((run) => run.id)).toEqual(['r1', 'r2'])
    expect(findRunById(conversation, 'r2')?.modelId).toBe('model-b')
    expect(findRunMessageId(conversation, 'r1')).toBe('m1')
    expect(findRunMessageId(conversation, 'missing')).toBeNull()
  })

  it('filters message runs by side', () => {
    expect(getRunsForSide(assistantMessage, 'single').map((run) => run.id)).toEqual(['r1'])
    expect(getRunsForSide(assistantMessage, 'win-2').map((run) => run.id)).toEqual(['r2'])
  })

  it('collects pending persisted image tasks', () => {
    expect(collectPendingImageTasks(conversation)).toEqual([
      {
        id: 'c1:r1:i1',
        conversationId: 'c1',
        runId: 'r1',
        imageId: 'i1',
        seq: 1,
        channelId: 'ch-1',
        serverTaskId: 'task-1',
        serverTaskMeta: undefined,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ])
  })

  it('builds resumable queues from runtime tasks', () => {
    const runtimeTasks: Record<string, ImageTask> = {
      t1: {
        taskId: 't1',
        runId: 'r1',
        batchId: 'b1',
        side: 'single',
        seq: 1,
        finalPrompt: 'x',
        status: 'running',
        createdAt: '2026-01-01T00:00:00.000Z',
        queuedAt: '2026-01-01T00:00:00.000Z',
        startedAt: '2026-01-01T00:00:01.000Z',
        serverTaskId: 'task-1',
      },
    }

    const queue = buildFairResumableImageQueue(
      conversation,
      runtimeTasks,
      (value) => (value ? Date.parse(value) : 0),
    )

    expect(queue).toHaveLength(1)
    expect(queue[0]?.run.id).toBe('r1')
    expect(queue[0]?.task.taskId).toBe('t1')
  })
})
