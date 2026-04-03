import { describe, expect, it } from 'vitest'
import type { Run } from '../../../../types/conversation'
import { buildImageTasksForPlannedRuns } from '../imageTaskPlanning'
import type { PlannedRun } from '../runPlanningTypes'

function createPlan(input: {
  runId: string
  side?: 'single' | 'win-1' | 'win-2'
  imageCount: number
  channel?: PlannedRun['channel']
}): PlannedRun {
  const pendingRun: Run = {
    id: input.runId,
    batchId: 'batch-1',
    createdAt: '2026-03-10T00:00:00.000Z',
    sideMode: input.side === 'single' || !input.side ? 'single' : 'multi',
    side: input.side ?? 'single',
    prompt: 'p',
    imageCount: input.imageCount,
    channelId: null,
    channelName: null,
    modelId: 'model-1',
    modelName: 'Model 1',
    templatePrompt: 't',
    finalPrompt: `prompt-${input.runId}`,
    variablesSnapshot: {},
    paramsSnapshot: {},
    sourceImages: [],
    settingsSnapshot: {
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount: input.imageCount,
      gridColumns: input.imageCount,
      sizeMode: 'preset',
      customWidth: 1024,
      customHeight: 1024,
      autoSave: false,
    },
    retryAttempt: 0,
    taskIds: [],
    images: Array.from({ length: input.imageCount }, (_, index) => ({
      id: `${input.runId}-img-${index + 1}`,
      seq: index + 1,
      status: 'pending',
      threadState: 'active',
    })),
  }

  return {
    side: pendingRun.side,
    settings: {
      generationMode: 'image',
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount: input.imageCount,
      gridColumns: input.imageCount,
      sizeMode: 'preset',
      customWidth: 1024,
      customHeight: 1024,
      autoSave: false,
      channelId: null,
      modelId: 'model-1',
      textModelId: 'model-1',
      paramValues: {},
    },
    modelId: 'model-1',
    modelName: 'Model 1',
    paramsSnapshot: {},
    sourceImages: [],
    channel: input.channel,
    pendingRun,
  }
}

describe('buildImageTasksForPlannedRuns', () => {
  it('queues all images within a run before moving to the next run', () => {
    const plans = [
      createPlan({ runId: 'run-1', side: 'win-1', imageCount: 4 }),
      createPlan({ runId: 'run-2', side: 'win-2', imageCount: 4 }),
      createPlan({ runId: 'run-3', side: 'single', imageCount: 2 }),
    ]

    const tasks = buildImageTasksForPlannedRuns(plans)

    expect(tasks.map((task) => `${task.runId}:${task.seq}`)).toEqual([
      'run-1:1',
      'run-1:2',
      'run-1:3',
      'run-1:4',
      'run-2:1',
      'run-2:2',
      'run-2:3',
      'run-2:4',
      'run-3:1',
      'run-3:2',
    ])
    expect(plans.map((plan) => (plan.pendingRun.taskIds ?? []).length)).toEqual([4, 4, 2])
  })

  it('creates one queued task per image for multi-image runs', () => {
    const plans = [
      createPlan({
        runId: 'run-4',
        imageCount: 4,
        channel: {
          id: 'openai',
          name: 'OpenAI',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'key',
          providerId: 'openai-compatible',
        },
      }),
    ]

    const tasks = buildImageTasksForPlannedRuns(plans)

    expect(tasks.map((task) => task.seq)).toEqual([1, 2, 3, 4])
    expect(tasks.every((task) => task.runId === 'run-4')).toBe(true)
    expect(plans[0]?.pendingRun.taskIds).toEqual(tasks.map((task) => task.taskId))
  })
})
