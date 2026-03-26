import { describe, expect, it, vi } from 'vitest'
import type { Run } from '../../../../types/conversation'
import {
  formatElapsedDuration,
  getImageElapsedLabel,
  getPendingImageElapsedLabel,
  getResolvedImageElapsedLabel,
  getRunElapsedLabel,
  getRunElapsedMs,
} from '../requestDuration'

function makeRun(overrides?: Partial<Run>): Run {
  return {
    id: 'run-1',
    batchId: 'batch-1',
    createdAt: '2026-03-18T10:00:00.000Z',
    sideMode: 'single',
    side: 'single',
    prompt: 'prompt',
    imageCount: 1,
    channelId: null,
    channelName: null,
    modelId: 'model-1',
    modelName: 'Model 1',
    templatePrompt: 'template',
    finalPrompt: 'final prompt',
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
        id: 'image-1',
        seq: 1,
        status: 'success',
      },
    ],
    ...overrides,
  }
}

describe('requestDuration', () => {
  it('measures elapsed time from generating start to completion', () => {
    const run = makeRun({
      taskState: {
        status: 'completed',
        updatedAt: '2026-03-18T10:00:03.500Z',
        waitingStartedAt: '2026-03-18T10:00:00.000Z',
        generatingStartedAt: '2026-03-18T10:00:01.000Z',
        completedAt: '2026-03-18T10:00:03.500Z',
      },
    })

    expect(getRunElapsedMs(run)).toBe(2500)
    expect(getRunElapsedLabel(run)).toBe('3s')
  })

  it('falls back to waiting start when a run has not started generating yet', () => {
    const run = makeRun({
      images: [
        {
          id: 'image-1',
          seq: 1,
          status: 'pending',
        },
      ],
      taskState: {
        status: 'waiting',
        updatedAt: '2026-03-18T10:00:05.000Z',
        waitingStartedAt: '2026-03-18T10:00:00.000Z',
      },
    })

    expect(getRunElapsedMs(run, '2026-03-18T10:00:06.000Z')).toBe(6000)
    expect(getRunElapsedLabel(run, '2026-03-18T10:00:06.000Z')).toBe('6s')
  })

  it('formats long durations in minutes and seconds', () => {
    expect(formatElapsedDuration(125_000)).toBe('2m 5s')
  })

  it('uses one second as the minimum display unit', () => {
    expect(formatElapsedDuration(200)).toBe('1s')
  })

  it('falls back to image timestamps when settled task metadata is unavailable', () => {
    expect(getResolvedImageElapsedLabel({
      queuedAt: '2026-03-18T10:00:00.000Z',
      startedAt: '2026-03-18T10:00:01.000Z',
      completedAt: '2026-03-18T10:00:05.100Z',
    })).toBe('4s')
  })

  it('uses image startedAt for pending elapsed time when task timing is absent', () => {
    expect(getPendingImageElapsedLabel(
      {
        queuedAt: '2026-03-18T10:00:00.000Z',
        startedAt: '2026-03-18T10:00:03.000Z',
      },
      undefined,
      '2026-03-18T10:00:08.000Z',
    )).toBe('5s')
  })

  it('reads standalone image timing labels directly from image timestamps', () => {
    expect(getImageElapsedLabel(
      {
        queuedAt: '2026-03-18T10:00:00.000Z',
        startedAt: '2026-03-18T10:00:02.000Z',
        completedAt: '2026-03-18T10:01:12.000Z',
      },
    )).toBe('1m 10s')
  })

  it('returns null when timestamps are invalid', () => {
    const run = makeRun({
      createdAt: 'invalid-date',
      taskState: {
        status: 'completed',
        updatedAt: 'also-invalid',
      },
    })

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Number.NaN)
    expect(getRunElapsedMs(run)).toBeNull()
    nowSpy.mockRestore()
  })
})
