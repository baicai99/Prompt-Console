import { describe, expect, it, vi } from 'vitest'
import { createConversationOrchestrator } from '../conversationOrchestrator'

function makePlan(input: {
  id: string
  side?: 'single' | 'win-1' | 'win-2'
  sideMode?: 'single' | 'multi'
  imageCount?: number
  channel?: {
    id: string
    name: string
    baseUrl: string
    apiKey: string
    providerId?: string
  }
}) {
  const pendingRun = {
    id: input.id,
    createdAt: 't',
    batchId: 'b',
    sideMode: input.sideMode ?? 'single',
    side: input.side ?? 'single',
    prompt: 'p',
    imageCount: input.imageCount ?? 1,
    channelId: null,
    channelName: null,
    modelId: 'm',
    modelName: 'm',
    templatePrompt: 't',
    finalPrompt: 'f',
    variablesSnapshot: {},
    paramsSnapshot: {},
    settingsSnapshot: { resolution: '1K', aspectRatio: '1:1', imageCount: input.imageCount ?? 1, gridColumns: 1, sizeMode: 'preset' as const, customWidth: 1024, customHeight: 1024, autoSave: true },
    retryAttempt: 0,
    taskIds: Array.from({ length: input.imageCount ?? 1 }, (_, index) => `${input.id}-task-${index + 1}`),
    taskState: { status: 'waiting' as const, updatedAt: 't' },
    images: Array.from({ length: input.imageCount ?? 1 }, (_, index) => ({
      id: `${input.id}-img-${index + 1}`,
      seq: index + 1,
      status: 'pending' as const,
      threadState: 'active' as const,
    })),
  }
  return {
    batchId: 'b',
    sideMode: input.sideMode ?? 'single',
    side: input.side ?? 'single',
    settings: {
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount: input.imageCount ?? 1,
      gridColumns: 1,
      sizeMode: 'preset' as const,
      customWidth: 1024,
      customHeight: 1024,
      autoSave: true,
      channelId: null,
      modelId: 'm',
      paramValues: {},
    },
    templatePrompt: 't',
    finalPrompt: 'f',
    variablesSnapshot: {},
    modelId: 'm',
    modelName: 'm',
    paramsSnapshot: {},
    channel: input.channel,
    pendingRunId: input.id,
    pendingCreatedAt: 't',
    pendingRun,
  }
}

function makeTasks(plan: ReturnType<typeof makePlan>) {
  return plan.pendingRun.images.map((image, index) => ({
    taskId: `${plan.pendingRun.id}-task-${index + 1}`,
    runId: plan.pendingRun.id,
    batchId: plan.batchId,
    side: plan.side,
    seq: image.seq,
    finalPrompt: plan.finalPrompt,
    status: 'queued' as const,
    createdAt: 't',
    queuedAt: 't',
    threadState: 'active' as const,
  }))
}

function makeBatchTask(plan: ReturnType<typeof makePlan>) {
  return [{
    taskId: `${plan.pendingRun.id}-task-batch`,
    runId: plan.pendingRun.id,
    batchId: plan.batchId,
    side: plan.side,
    seq: 1,
    imageSeqs: plan.pendingRun.images.map((image) => image.seq),
    finalPrompt: plan.finalPrompt,
    status: 'queued' as const,
    createdAt: 't',
    queuedAt: 't',
    threadState: 'active' as const,
  }]
}

function makeSingleImageRun(input: {
  runId: string
  side?: 'single' | 'win-1' | 'win-2'
  sideMode?: 'single' | 'multi'
} = { runId: 'run' }) {
  return {
    id: input.runId,
    createdAt: 't',
    batchId: 'b',
    sideMode: input.sideMode ?? 'single',
    side: input.side ?? 'single',
    prompt: 'p',
    imageCount: 1,
    channelId: null,
    channelName: null,
    modelId: 'm',
    modelName: 'm',
    templatePrompt: 't',
    finalPrompt: 'f',
    variablesSnapshot: {},
    paramsSnapshot: {},
    settingsSnapshot: { resolution: '1K', aspectRatio: '1:1', imageCount: 1, gridColumns: 1, sizeMode: 'preset' as const, customWidth: 1024, customHeight: 1024, autoSave: true },
    retryAttempt: 0,
    images: [
      {
        id: `${input.runId}-img`,
        seq: 1,
        status: 'success' as const,
        threadState: 'settled' as const,
        thumbRef: `${input.runId}.png`,
        fileRef: `${input.runId}.png`,
        refKind: 'url' as const,
        refKey: `${input.runId}.png`,
      },
    ],
  }
}

describe('conversationOrchestrator', () => {
  it('maps completed runs back to pending ids', async () => {
    const createRun = vi.fn().mockImplementation(async (input: { runId: string }) => makeSingleImageRun({ runId: input.runId }))

    const orchestrator = createConversationOrchestrator({ createRun })

    const plans = [makePlan({ id: 'p1' }), makePlan({ id: 'p2' })]
    const completed = await orchestrator.executeRunPlans(plans, plans.flatMap(makeTasks))

    expect(createRun).toHaveBeenCalledTimes(2)
    expect(completed.map((item) => item.id)).toEqual(['p1', 'p2'])
  })

  it('limits concurrency when executing run plans', async () => {
    let active = 0
    let maxActive = 0

    const createRun = vi.fn().mockImplementation(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active -= 1
      return makeSingleImageRun()
    })

    const orchestrator = createConversationOrchestrator({ createRun })
    const plans = Array.from({ length: 12 }, (_, index) => makePlan({ id: `p-${index}` }))
    const completed = await orchestrator.executeRunPlans(plans, plans.flatMap(makeTasks), 4)

    expect(completed).toHaveLength(12)
    expect(maxActive).toBeLessThanOrEqual(4)
  })

  it('expands per-image tasks into one global pool', async () => {
    let active = 0
    let maxActive = 0
    const activeBySide = new Map<string, number>()

    const createRun = vi.fn().mockImplementation(async (input: { runId: string; side: string }) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      activeBySide.set(input.side, (activeBySide.get(input.side) ?? 0) + 1)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active -= 1
      activeBySide.set(input.side, (activeBySide.get(input.side) ?? 1) - 1)
      return makeSingleImageRun({
        runId: `${input.runId}-${input.side}`,
        side: input.side as 'win-1' | 'win-2',
        sideMode: 'multi',
      })
    })

    const orchestrator = createConversationOrchestrator({ createRun })
    const plans = [
      makePlan({ id: 'left', side: 'win-1', sideMode: 'multi', imageCount: 3 }),
      makePlan({ id: 'right', side: 'win-2', sideMode: 'multi', imageCount: 3 }),
    ]
    const completed = await orchestrator.executeRunPlans(plans, plans.flatMap(makeTasks), 2)

    expect(createRun).toHaveBeenCalledTimes(6)
    expect(maxActive).toBe(2)
    expect(activeBySide.get('win-1')).toBe(0)
    expect(activeBySide.get('win-2')).toBe(0)
    expect(completed[0]?.images).toHaveLength(3)
    expect(completed[1]?.images).toHaveLength(3)
  })

  it('submits Jimeng batch runs once with the full fixed image count', async () => {
    const createRun = vi.fn().mockImplementation(async (input: { runId: string; settings: { imageCount: number } }) => ({
      ...makeSingleImageRun({ runId: input.runId }),
      imageCount: input.settings.imageCount,
      settingsSnapshot: {
        resolution: '1K',
        aspectRatio: '1:1',
        imageCount: input.settings.imageCount,
        gridColumns: 4,
        sizeMode: 'preset' as const,
        customWidth: 1024,
        customHeight: 1024,
        autoSave: true,
      },
      images: Array.from({ length: input.settings.imageCount }, (_, index) => ({
        id: `${input.runId}-img-${index + 1}`,
        seq: index + 1,
        status: 'success' as const,
        threadState: 'settled' as const,
        fileRef: `${input.runId}-${index + 1}.png`,
        refKind: 'url' as const,
        refKey: `${input.runId}-${index + 1}.png`,
      })),
    }))

    const orchestrator = createConversationOrchestrator({ createRun })
    const plan = makePlan({
      id: 'run-4',
      imageCount: 4,
      channel: {
        id: 'main',
        name: 'Main',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'key',
        providerId: 'openai-compatible',
      },
    })
    const completed = await orchestrator.executeRunPlans([plan], makeBatchTask(plan), 1)

    expect(createRun).toHaveBeenCalledTimes(1)
    expect(createRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-4',
      settings: expect.objectContaining({ imageCount: 4 }),
    }))
    expect(completed[0]?.images).toHaveLength(4)
  })

  it('keeps async provider registrations in polling state instead of marking them failed', async () => {
    const createRun = vi.fn().mockResolvedValue({
      ...makeSingleImageRun({ runId: 'p1' }),
      images: [{
        id: 'p1-img',
        seq: 1,
        status: 'pending' as const,
        threadState: 'active' as const,
        serverTaskId: 'task-1',
        serverTaskMeta: { resumeUrl: 'https://example.com/tasks/task-1' },
      }],
    })
    const onTaskStateChange = vi.fn()

    const orchestrator = createConversationOrchestrator({ createRun })
    const plans = [makePlan({ id: 'p1' })]
    const completed = await orchestrator.executeRunPlans(plans, plans.flatMap(makeTasks), 1, {
      onTaskStateChange,
    })

    expect(completed[0]?.images[0]).toMatchObject({
      status: 'pending',
      threadState: 'active',
      serverTaskId: 'task-1',
    })
    expect(onTaskStateChange).toHaveBeenNthCalledWith(2, expect.objectContaining({
      taskId: 'p1-task-1',
      runId: 'p1',
      seq: 1,
      state: 'polling',
    }))
  })

  it('cancels only the aborted run while other runs keep progressing', async () => {
    const abortController = new AbortController()
    const createRun = vi.fn().mockImplementation(async (input: { runId: string; signal?: AbortSignal }) => {
      if (input.runId === 'p1') {
        return await new Promise((resolve, reject) => {
          const rejectAbort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          input.signal?.addEventListener('abort', rejectAbort, { once: true })
          setTimeout(() => {
            input.signal?.removeEventListener('abort', rejectAbort)
            resolve(makeSingleImageRun({ runId: input.runId }))
          }, 20)
        })
      }
      await new Promise((resolve) => setTimeout(resolve, 5))
      return makeSingleImageRun({ runId: input.runId })
    })
    const onTaskStateChange = vi.fn()
    const onTaskProgress = vi.fn()

    const orchestrator = createConversationOrchestrator({ createRun })
    const plans = [
      { ...makePlan({ id: 'p1' }), signal: abortController.signal },
      makePlan({ id: 'p2' }),
    ]

    const execution = orchestrator.executeRunPlans(plans, plans.flatMap(makeTasks), 2, {
      onTaskStateChange,
      onTaskProgress,
    })
    abortController.abort()
    const completed = await execution

    expect(completed[0]?.taskState?.status).toBe('failed')
    expect(completed[1]?.taskState?.status).toBe('completed')
    expect(onTaskStateChange).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'p1',
      state: 'cancelled',
    }))
    expect(onTaskStateChange).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'p2',
      state: 'succeeded',
    }))
    expect(onTaskProgress).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'p1',
      status: 'failed',
      error: '任务已取消',
    }))
  })

  it('ignores late successful completions for a run that was already aborted', async () => {
    const abortController = new AbortController()
    const createRun = vi.fn().mockImplementation(async (input: { runId: string }) => {
      await new Promise((resolve) => setTimeout(resolve, input.runId === 'p1' ? 20 : 5))
      return makeSingleImageRun({ runId: input.runId })
    })
    const onTaskStateChange = vi.fn()
    const onTaskProgress = vi.fn()

    const orchestrator = createConversationOrchestrator({ createRun })
    const plans = [
      { ...makePlan({ id: 'p1' }), signal: abortController.signal },
      makePlan({ id: 'p2' }),
    ]

    const execution = orchestrator.executeRunPlans(plans, plans.flatMap(makeTasks), 2, {
      onTaskStateChange,
      onTaskProgress,
    })
    abortController.abort()
    const completed = await execution

    expect(completed[0]?.images[0]).toMatchObject({
      status: 'failed',
      error: '任务已取消',
    })
    expect(completed[1]?.images[0]).toMatchObject({
      status: 'success',
      fileRef: 'p2.png',
    })
    expect(onTaskStateChange).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'p1',
      state: 'cancelled',
    }))
    expect(onTaskStateChange).not.toHaveBeenCalledWith(expect.objectContaining({
      runId: 'p1',
      state: 'succeeded',
    }))
  })
})
