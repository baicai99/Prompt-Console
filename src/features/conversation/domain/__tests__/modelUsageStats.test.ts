import { describe, expect, it } from 'vitest'
import type { Run } from '../../../../types/conversation'
import { aggregateModelUsageStats } from '../modelUsageStats'

function makeRun(overrides?: Partial<Run>): Run {
  return {
    id: overrides?.id ?? 'run-1',
    batchId: 'batch-1',
    createdAt: overrides?.createdAt ?? '2026-03-16T10:00:00.000Z',
    sideMode: 'single',
    side: 'single',
    prompt: 'prompt',
    imageCount: overrides?.imageCount ?? 1,
    channelId: null,
    channelName: null,
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
    taskState: overrides?.taskState ?? { status: 'completed', updatedAt: '2026-03-16T10:01:00.000Z' },
    images: overrides?.images ?? [{ id: 'img-1', seq: 1, status: 'pending', threadState: 'active' }],
  }
}

describe('aggregateModelUsageStats', () => {
  it('aggregates hourly buckets and merges failed plus timeout into failed', () => {
    const snapshot = aggregateModelUsageStats({
      runs: [
        makeRun({
          id: 'run-1',
          createdAt: '2026-03-16T09:15:00.000Z',
          modelId: 'ch-a::model-a',
          modelName: 'Model A',
          taskState: {
            status: 'completed',
            updatedAt: '2026-03-16T09:16:00.000Z',
            generatingStartedAt: '2026-03-16T09:15:30.000Z',
            completedAt: '2026-03-16T09:16:00.000Z',
          },
        }),
        makeRun({
          id: 'run-2',
          createdAt: '2026-03-16T09:45:00.000Z',
          modelId: 'ch-a::model-a',
          modelName: 'Model A',
          taskState: {
            status: 'timeout',
            updatedAt: '2026-03-16T09:50:00.000Z',
            generatingStartedAt: '2026-03-16T09:46:00.000Z',
            timedOutAt: '2026-03-16T09:50:00.000Z',
          },
        }),
        makeRun({
          id: 'run-3',
          createdAt: '2026-03-16T10:15:00.000Z',
          modelId: 'ch-b::model-b',
          modelName: 'Model B',
          taskState: {
            status: 'cancelled',
            updatedAt: '2026-03-16T10:16:00.000Z',
            generatingStartedAt: '2026-03-16T10:15:15.000Z',
            completedAt: '2026-03-16T10:16:00.000Z',
          },
        }),
      ],
      modelCatalog: { models: [] },
      range: 'day',
      granularity: 'hour',
      timeZone: 'UTC',
      now: new Date('2026-03-16T10:30:00.000Z'),
    })

    expect(snapshot.totalCount).toBe(3)
    expect(snapshot.totalElapsedMs).toBe(315000)
    expect(snapshot.averageElapsedMs).toBe(105000)
    expect(snapshot.statusCounts).toEqual({
      completed: 1,
      failed: 1,
      cancelled: 1,
      inProgress: 0,
    })
    expect(snapshot.models.map((item) => [item.modelName, item.count])).toEqual([
      ['Model A', 2],
      ['Model B', 1],
    ])
    expect(snapshot.models[0]).toMatchObject({
      modelName: 'Model A',
      totalElapsedMs: 270000,
      averageElapsedMs: 135000,
    })
    expect(snapshot.buckets.find((bucket) => bucket.label === '03/16 09:00')).toMatchObject({
      label: '03/16 09:00',
      totalCount: 2,
      totalElapsedMs: 270000,
      averageElapsedMs: 135000,
      statusCounts: {
        completed: 1,
        failed: 1,
        cancelled: 0,
        inProgress: 0,
      },
    })
  })

  it('uses the current natural day window when day range is selected', () => {
    const snapshot = aggregateModelUsageStats({
      runs: [
        makeRun({ id: 'older-run', createdAt: '2026-03-15T23:00:00.000Z', modelId: 'ch-a::model-a' }),
        makeRun({ id: 'day-run', createdAt: '2026-03-16T08:00:00.000Z', modelId: 'ch-a::model-a' }),
        makeRun({ id: 'late-run', createdAt: '2026-03-16T23:00:00.000Z', modelId: 'ch-b::model-b' }),
        makeRun({ id: 'current-day-run', createdAt: '2026-03-17T08:00:00.000Z', modelId: 'ch-c::model-c' }),
      ],
      modelCatalog: { models: [] },
      range: 'day',
      granularity: 'day',
      timeZone: 'UTC',
      now: new Date('2026-03-17T10:30:00.000Z'),
    })

    expect(snapshot.totalCount).toBe(1)
    expect(snapshot.range.start).toBe('2026-03-17T00:00:00')
    expect(snapshot.range.end).toBe('2026-03-18T00:00:00')
    expect(snapshot.buckets.map((bucket) => [bucket.label, bucket.totalCount])).toEqual([['03/17', 1]])
  })

  it('uses the current natural week window and keeps stable ordering for ties', () => {
    const snapshot = aggregateModelUsageStats({
      runs: [
        makeRun({ id: 'run-a', createdAt: '2026-03-02T08:00:00.000Z', modelId: 'ch-z::z', modelName: 'Zeta' }),
        makeRun({ id: 'run-b', createdAt: '2026-03-03T08:00:00.000Z', modelId: 'ch-a::a', modelName: 'Alpha' }),
        makeRun({ id: 'run-c', createdAt: '2026-03-16T08:00:00.000Z', modelId: 'ch-b::b', modelName: 'Beta' }),
        makeRun({ id: 'run-d', createdAt: '2026-03-17T08:00:00.000Z', modelId: 'ch-c::c', modelName: 'Gamma' }),
      ],
      modelCatalog: { models: [] },
      range: 'week',
      granularity: 'day',
      timeZone: 'UTC',
      now: new Date('2026-03-09T12:00:00.000Z'),
    })

    expect(snapshot.range.start).toBe('2026-03-09T00:00:00')
    expect(snapshot.range.end).toBe('2026-03-10T00:00:00')
    expect(snapshot.buckets.map((bucket) => [bucket.label, bucket.totalCount])).toEqual([['03/09', 0]])

    const currentWeekSnapshot = aggregateModelUsageStats({
      runs: [
        makeRun({ id: 'run-a', createdAt: '2026-03-16T08:00:00.000Z', modelId: 'ch-z::z', modelName: 'Zeta' }),
        makeRun({ id: 'run-b', createdAt: '2026-03-17T08:00:00.000Z', modelId: 'ch-a::a', modelName: 'Alpha' }),
      ],
      modelCatalog: { models: [] },
      range: 'week',
      granularity: 'day',
      timeZone: 'UTC',
      now: new Date('2026-03-17T12:00:00.000Z'),
    })

    expect(currentWeekSnapshot.range.start).toBe('2026-03-16T00:00:00')
    expect(currentWeekSnapshot.range.end).toBe('2026-03-18T00:00:00')
    expect(currentWeekSnapshot.buckets.map((bucket) => [bucket.label, bucket.totalCount])).toEqual([
      ['03/16', 1],
      ['03/17', 1],
    ])
    expect(currentWeekSnapshot.models.map((item) => item.modelName)).toEqual(['Alpha', 'Zeta'])
  })

  it('uses the current natural month window and keeps historical names for off-catalog models', () => {
    const snapshot = aggregateModelUsageStats({
      runs: [
        makeRun({ id: 'run-old', createdAt: '2026-02-10T10:00:00.000Z', modelId: 'legacy::old-model', modelName: '已下线模型' }),
        makeRun({ id: 'run-current', createdAt: '2026-03-16T10:00:00.000Z', modelId: 'legacy::current-model', modelName: '当前模型' }),
      ],
      modelCatalog: { models: [] },
      range: 'month',
      granularity: 'day',
      timeZone: 'UTC',
      now: new Date('2026-03-16T10:30:00.000Z'),
    })

    expect(snapshot.range.start).toBe('2026-03-01T00:00:00')
    expect(snapshot.range.end).toBe('2026-03-17T00:00:00')
    expect(snapshot.models).toEqual([
      expect.objectContaining({
        modelId: 'legacy::current-model',
        modelName: '当前模型',
        count: 1,
      }),
    ])
    expect(snapshot.buckets.find((bucket) => bucket.label === '03/16')?.totalCount).toBe(1)
  })

  it('extracts channel label and strips source suffix from the display name', () => {
    const snapshot = aggregateModelUsageStats({
      runs: [
        makeRun({
          id: 'run-source',
          createdAt: '2026-03-16T10:00:00.000Z',
          modelId: 'channel-1::chatgpt-4o-latest',
          modelName: 'chatgpt-4o-latest（https://ai.t8star.cn）',
          channelName: 'https://ai.t8star.cn',
        }),
      ],
      modelCatalog: {
        models: [{
          id: 'channel-1::chatgpt-4o-latest',
          name: 'chatgpt-4o-latest（https://ai.t8star.cn）',
          rawId: 'chatgpt-4o-latest',
          sourceName: 'https://ai.t8star.cn',
          params: [],
        }],
      },
      range: 'day',
      granularity: 'hour',
      timeZone: 'UTC',
      now: new Date('2026-03-16T10:30:00.000Z'),
    })

    expect(snapshot.models).toEqual([
      expect.objectContaining({
        modelName: 'chatgpt-4o-latest',
        channelLabel: 'ai.t8star.cn',
        detailSourceLabel: 'ai.t8star.cn',
      }),
    ])
    expect(snapshot.sources).toEqual(['ai.t8star.cn'])
  })

  it('collects available sources and filters stats by the selected source', () => {
    const snapshot = aggregateModelUsageStats({
      runs: [
        makeRun({
          id: 'run-openai',
          createdAt: '2026-03-16T10:00:00.000Z',
          modelId: 'openai::gpt-image-1',
          modelName: 'gpt-image-1（https://ai.t8star.cn）',
          channelName: 'https://ai.t8star.cn',
        }),
        makeRun({
          id: 'run-gemini',
          createdAt: '2026-03-16T11:00:00.000Z',
          modelId: 'gemini::gemini-2.5-flash-image',
          modelName: 'gemini-2.5-flash-image（Gemini）',
          channelName: 'Gemini',
          taskState: { status: 'failed', updatedAt: '2026-03-16T11:01:00.000Z' },
        }),
      ],
      modelCatalog: {
        models: [
          { id: 'openai::gpt-image-1', name: 'gpt-image-1（https://ai.t8star.cn）', rawId: 'gpt-image-1', sourceName: 'https://ai.t8star.cn', params: [] },
          { id: 'gemini::gemini-2.5-flash-image', name: 'gemini-2.5-flash-image（Gemini）', rawId: 'gemini-2.5-flash-image', sourceName: 'Gemini', params: [] },
        ],
      },
      range: 'day',
      granularity: 'hour',
      timeZone: 'UTC',
      now: new Date('2026-03-16T12:00:00.000Z'),
    })

    expect(snapshot.sources).toEqual(['ai.t8star.cn', 'Gemini'])
    expect(snapshot.totalCount).toBe(2)

    const filtered = aggregateModelUsageStats({
      runs: [
        makeRun({
          id: 'run-openai',
          createdAt: '2026-03-16T10:00:00.000Z',
          modelId: 'openai::gpt-image-1',
          modelName: 'gpt-image-1（https://ai.t8star.cn）',
          channelName: 'https://ai.t8star.cn',
        }),
        makeRun({
          id: 'run-gemini',
          createdAt: '2026-03-16T11:00:00.000Z',
          modelId: 'gemini::gemini-2.5-flash-image',
          modelName: 'gemini-2.5-flash-image（Gemini）',
          channelName: 'Gemini',
          taskState: { status: 'failed', updatedAt: '2026-03-16T11:01:00.000Z' },
        }),
      ],
      modelCatalog: {
        models: [
          { id: 'openai::gpt-image-1', name: 'gpt-image-1（https://ai.t8star.cn）', rawId: 'gpt-image-1', sourceName: 'https://ai.t8star.cn', params: [] },
          { id: 'gemini::gemini-2.5-flash-image', name: 'gemini-2.5-flash-image（Gemini）', rawId: 'gemini-2.5-flash-image', sourceName: 'Gemini', params: [] },
        ],
      },
      range: 'day',
      granularity: 'hour',
      timeZone: 'UTC',
      sourceFilter: 'https://ai.t8star.cn',
      now: new Date('2026-03-16T12:00:00.000Z'),
    })

    expect(filtered.sources).toEqual(['ai.t8star.cn', 'Gemini'])
    expect(filtered.totalCount).toBe(1)
    expect(filtered.statusCounts).toEqual({
      completed: 1,
      failed: 0,
      cancelled: 0,
      inProgress: 0,
    })
    expect(filtered.models.map((item) => item.modelName)).toEqual(['gpt-image-1'])
    expect(filtered.buckets.find((bucket) => bucket.label === '03/16 10:00')?.totalCount).toBe(1)
    expect(filtered.buckets.find((bucket) => bucket.label === '03/16 11:00')?.totalCount).toBe(0)
  })

  it('filters by run source even when the model is not present in the catalog', () => {
    const snapshot = aggregateModelUsageStats({
      runs: [
        makeRun({
          id: 'run-legacy',
          createdAt: '2026-03-16T10:00:00.000Z',
          modelId: 'legacy::archived-model',
          modelName: 'archived-model（https://legacy.example.com）',
          channelName: 'https://legacy.example.com',
        }),
      ],
      modelCatalog: { models: [] },
      range: 'day',
      granularity: 'hour',
      timeZone: 'UTC',
      sourceFilter: 'legacy.example.com',
      now: new Date('2026-03-16T12:00:00.000Z'),
    })

    expect(snapshot.totalCount).toBe(1)
    expect(snapshot.sources).toEqual(['legacy.example.com'])
    expect(snapshot.models).toEqual([
      expect.objectContaining({
        modelId: 'legacy::archived-model',
        channelLabel: 'legacy.example.com',
      }),
    ])
  })

  it('tracks elapsed time per model independently', () => {
    const snapshot = aggregateModelUsageStats({
      runs: [
        makeRun({
          id: 'fast-model-run',
          createdAt: '2026-03-16T10:00:00.000Z',
          modelId: 'model::fast',
          modelName: 'Fast',
          taskState: {
            status: 'completed',
            updatedAt: '2026-03-16T10:00:10.000Z',
            generatingStartedAt: '2026-03-16T10:00:00.000Z',
            completedAt: '2026-03-16T10:00:10.000Z',
          },
        }),
        makeRun({
          id: 'slow-model-run',
          createdAt: '2026-03-16T10:05:00.000Z',
          modelId: 'model::slow',
          modelName: 'Slow',
          taskState: {
            status: 'completed',
            updatedAt: '2026-03-16T10:06:00.000Z',
            generatingStartedAt: '2026-03-16T10:05:00.000Z',
            completedAt: '2026-03-16T10:06:00.000Z',
          },
        }),
      ],
      modelCatalog: { models: [] },
      range: 'week',
      granularity: 'day',
      timeZone: 'UTC',
      now: new Date('2026-03-16T12:00:00.000Z'),
    })

    expect(snapshot.models).toEqual([
      expect.objectContaining({
        modelId: 'model::fast',
        totalElapsedMs: 10000,
        averageElapsedMs: 10000,
      }),
      expect.objectContaining({
        modelId: 'model::slow',
        totalElapsedMs: 60000,
        averageElapsedMs: 60000,
      }),
    ])
  })

  it('counts failed-item retries as independent requests with their own status and elapsed time', () => {
    const snapshot = aggregateModelUsageStats({
      runs: [
        makeRun({
          id: 'run-original',
          createdAt: '2026-03-16T10:00:00.000Z',
          modelId: 'openai::gpt-image-1',
          modelName: 'gpt-image-1',
          taskState: {
            status: 'failed',
            updatedAt: '2026-03-16T10:00:40.000Z',
            generatingStartedAt: '2026-03-16T10:00:10.000Z',
            completedAt: '2026-03-16T10:00:40.000Z',
          },
        }),
        makeRun({
          id: 'run-retry',
          createdAt: '2026-03-16T10:01:00.000Z',
          modelId: 'openai::gpt-image-1',
          modelName: 'gpt-image-1',
          retryOfRunId: 'run-original',
          retryAttempt: 1,
          taskState: {
            status: 'completed',
            updatedAt: '2026-03-16T10:01:50.000Z',
            generatingStartedAt: '2026-03-16T10:01:20.000Z',
            completedAt: '2026-03-16T10:01:50.000Z',
          },
        }),
      ],
      modelCatalog: { models: [] },
      range: 'day',
      granularity: 'hour',
      timeZone: 'UTC',
      now: new Date('2026-03-16T10:30:00.000Z'),
    })

    expect(snapshot.totalCount).toBe(2)
    expect(snapshot.statusCounts).toEqual({
      completed: 1,
      failed: 1,
      cancelled: 0,
      inProgress: 0,
    })
    expect(snapshot.totalElapsedMs).toBe(60_000)
    expect(snapshot.averageElapsedMs).toBe(30_000)
    expect(snapshot.models).toEqual([
      expect.objectContaining({
        modelId: 'openai::gpt-image-1',
        count: 2,
        totalElapsedMs: 60_000,
        averageElapsedMs: 30_000,
        statusCounts: {
          completed: 1,
          failed: 1,
          cancelled: 0,
          inProgress: 0,
        },
      }),
    ])
  })

  it('counts in-flight retries as in-progress requests', () => {
    const snapshot = aggregateModelUsageStats({
      runs: [
        makeRun({
          id: 'run-original',
          createdAt: '2026-03-16T10:00:00.000Z',
          taskState: {
            status: 'failed',
            updatedAt: '2026-03-16T10:00:40.000Z',
            generatingStartedAt: '2026-03-16T10:00:10.000Z',
            completedAt: '2026-03-16T10:00:40.000Z',
          },
        }),
        makeRun({
          id: 'run-retry-waiting',
          createdAt: '2026-03-16T10:02:00.000Z',
          retryOfRunId: 'run-original',
          retryAttempt: 1,
          taskState: {
            status: 'waiting',
            updatedAt: '2026-03-16T10:02:05.000Z',
            waitingStartedAt: '2026-03-16T10:02:00.000Z',
          },
        }),
      ],
      modelCatalog: { models: [] },
      range: 'day',
      granularity: 'hour',
      timeZone: 'UTC',
      now: new Date('2026-03-16T10:02:30.000Z'),
    })

    expect(snapshot.totalCount).toBe(2)
    expect(snapshot.statusCounts).toEqual({
      completed: 0,
      failed: 1,
      cancelled: 0,
      inProgress: 1,
    })
  })

})
