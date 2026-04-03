import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ConversationState } from '../../../state/conversationState'
import type { Conversation, ImageTask, Run } from '../../../../../types/conversation'
import { acquireWindowLease, releaseWindowLease } from '../../../../../services/windowLease'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../../../../utils/imageRuntimeSettings'
import { DEFAULT_LOGGING_SETTINGS } from '../../../../../utils/loggingSettings'
import { clearImageTasks, upsertImageTask } from '../../../../../services/imageTaskStore'
import {
  buildFairResumableImageQueue,
  processBackgroundPendingTaskConversations,
  processPendingImageResumes,
  useResumeFlow,
} from './useResumeFlow'

function createPendingRun(input: {
  runId: string
  imageId: string
  seq: number
  channelId?: string
  side?: Run['side']
  sideMode?: Run['sideMode']
}): Run {
  return {
    id: input.runId,
    batchId: 'batch-1',
    createdAt: new Date(Date.now() - 10_000).toISOString(),
    sideMode: input.sideMode ?? 'single',
    side: input.side ?? 'single',
    prompt: 'prompt',
    imageCount: 1,
    channelId: input.channelId ?? 'ch-1',
    channelName: 'main',
    modelId: 'model-1',
    modelName: 'model-1',
    templatePrompt: 'prompt',
    finalPrompt: 'prompt',
    variablesSnapshot: {},
    paramsSnapshot: {},
    sourceImages: [],
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
    taskIds: [`task-entry-${input.seq}`],
    images: [{
      id: input.imageId,
      seq: input.seq,
      status: 'pending',
      threadState: 'active',
      serverTaskId: `task-${input.seq}`,
      serverTaskMeta: { resumeUrl: `https://example.com/tasks/task-${input.seq}` },
    }],
  }
}

function withTaskPool(conversation: Conversation): Conversation {
  const tasksById: Record<string, ImageTask> = {}
  const messages = conversation.messages.map((message) => {
    const taskIds = (message.runs ?? []).flatMap((run) => run.images.map((image) => {
      const taskId = run.taskIds?.find((_id, index) => index === image.seq - 1) ?? `task-entry-${run.id}-${image.seq}`
      tasksById[taskId] = {
        taskId,
        runId: run.id,
        batchId: run.batchId,
        side: run.side,
        seq: image.seq,
        finalPrompt: run.finalPrompt,
        status: 'running',
        createdAt: run.createdAt,
        queuedAt: run.createdAt,
        startedAt: run.createdAt,
        threadState: image.threadState,
        serverTaskId: image.serverTaskId,
        serverTaskMeta: image.serverTaskMeta,
      }
      return taskId
    }))

    return {
      ...message,
      taskIds,
      liveFeed: [],
    }
  })

  return {
    ...conversation,
    messages,
    tasksById,
  }
}

function createLegacyRemovedProviderConversation(): Conversation {
  const run: Run = {
    id: 'run-jimeng',
    batchId: 'batch-jimeng',
    createdAt: new Date(Date.now() - 10_000).toISOString(),
    sideMode: 'single',
    side: 'single',
    prompt: 'prompt',
    imageCount: 4,
    channelId: '__jimeng-proxy__',
    channelName: '即梦本地代理',
    modelId: '__jimeng-proxy__::model',
    modelName: '即梦图片',
    templatePrompt: 'prompt',
    finalPrompt: 'prompt',
    variablesSnapshot: {},
    paramsSnapshot: {},
    sourceImages: [],
    settingsSnapshot: {
      resolution: '2K',
      aspectRatio: '1:1',
      imageCount: 4,
      gridColumns: 4,
      sizeMode: 'preset',
      customWidth: 1024,
      customHeight: 1024,
      autoSave: false,
    },
    retryAttempt: 0,
    taskIds: ['task-jimeng', 'task-jimeng', 'task-jimeng', 'task-jimeng'],
    images: Array.from({ length: 4 }, (_, index) => ({
      id: `img-jimeng-${index + 1}`,
      seq: index + 1,
      status: 'pending' as const,
      threadState: 'active' as const,
      serverTaskId: 'history-1',
      serverTaskMeta: {
        historyId: 'history-1',
        resolutionType: '2k',
        itemIndex: String(index),
      },
    })),
  }

  return {
      id: 'conv-legacy',
      title: 'Legacy',
    titleMode: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sideMode: 'single',
    sideCount: 1,
    settingsBySide: {
      single: {
        generationMode: 'image',
        resolution: '2K',
        aspectRatio: '1:1',
        imageCount: 4,
        gridColumns: 4,
        sizeMode: 'preset',
        customWidth: 1024,
        customHeight: 1024,
        autoSave: false,
        channelId: '__jimeng-proxy__',
        modelId: '__jimeng-proxy__::model',
        textModelId: '__jimeng-proxy__::model',
        videoModelId: '__jimeng-proxy__::model',
        paramValues: {},
      },
    },
    messages: [{
      id: 'msg-jimeng',
      createdAt: '2026-01-01T00:00:00.000Z',
      role: 'assistant',
      content: '',
      taskIds: ['task-jimeng'],
      runs: [run],
    }],
    tasksById: {
      'task-jimeng': {
        taskId: 'task-jimeng',
        runId: run.id,
        batchId: run.batchId,
        side: run.side,
        seq: 1,
        imageSeqs: [1, 2, 3, 4],
        finalPrompt: run.finalPrompt,
        status: 'polling',
        createdAt: run.createdAt,
        queuedAt: run.createdAt,
        startedAt: run.createdAt,
        threadState: 'active',
        serverTaskId: 'history-1',
        serverTaskMeta: {
          historyId: 'history-1',
          resolutionType: '2k',
        },
      },
    },
  }
}

function createSnapshot(conversation: Conversation): ConversationState {
  return {
    summaries: [],
    contents: { [conversation.id]: conversation },
    runtimeTasksByConversationId: {
      [conversation.id]: { ...(conversation.tasksById ?? {}) },
    },
    activeId: conversation.id,
    draft: '',
    sendError: '',
    isSending: false,
    showAdvancedVariables: false,
    dynamicPromptEnabled: true,
    autoRenameConversationTitle: true,
    autoRenameConversationTitleModelId: null,
    panelValueFormat: 'json',
    panelVariables: [],
    favoriteModelIds: [],
    runConcurrency: 4,
    runConcurrencyUnlimited: false,
    imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
    loggingSettings: DEFAULT_LOGGING_SETTINGS,
    stagedSideMode: 'single',
    stagedSideCount: 2,
    stagedSettingsBySide: {
      single: {
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
        modelId: 'model-1',
        textModelId: 'model-1',
        videoModelId: 'model-1',
        paramValues: {},
      },
    },
    channels: [{
      id: 'ch-1',
      name: 'main',
      baseUrl: 'https://example.com',
      apiKey: 'key',
    }],
  }
}

function createActiveRunRegistry() {
  const activeRuns = new Map<string, { messageId: string; controller: AbortController }>()

  return {
    registerActiveRun: (conversationId: string, messageId: string, runId: string, controller: AbortController) => {
      activeRuns.set(`${conversationId}:${runId}`, { messageId, controller })
    },
    unregisterActiveRun: (conversationId: string, runId: string) => {
      activeRuns.delete(`${conversationId}:${runId}`)
    },
    isRunStillActive: (conversationId: string, runId: string) => activeRuns.has(`${conversationId}:${runId}`),
    isRunOwnedByMessage: (conversationId: string, runId: string, messageId: string) =>
      activeRuns.get(`${conversationId}:${runId}`)?.messageId === messageId,
    clearRun: (conversationId: string, runId: string) => {
      activeRuns.delete(`${conversationId}:${runId}`)
    },
  }
}

function createResumeFlowDeps(input?: {
  activeConversationHasResumableWork?: boolean
  state?: ConversationState
}) {
  const conversation = withTaskPool({
    id: 'conv-hook',
    title: 'Hook',
    titleMode: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sideMode: 'single',
    sideCount: 2,
    settingsBySide: {
      single: {
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
        modelId: 'model-1',
        textModelId: 'model-1',
        videoModelId: 'model-1',
        paramValues: {},
      },
    },
    messages: [{
      id: 'msg-hook',
      createdAt: '2026-01-01T00:00:00.000Z',
      role: 'assistant',
      content: '',
      runs: [createPendingRun({ runId: 'run-hook', imageId: 'img-hook', seq: 1 })],
    }],
    tasksById: {},
  })
  const state = input?.state ?? createSnapshot(conversation)
  const activeRunRegistry = createActiveRunRegistry()

  return {
    stateActiveId: state.activeId,
    activeConversationHasResumableWork: input?.activeConversationHasResumableWork ?? true,
    stateRef: { current: state },
    imageRuntimeSettings: state.imageRuntimeSettings,
    resolveAdaptiveRunConcurrency: vi.fn((requested: number) => requested),
    resumePollTimerRef: { current: null },
    backgroundResumePollTimerRef: { current: null },
    resumePollInFlightRef: { current: false },
    backgroundResumePollInFlightRef: { current: false },
    backgroundPollOwnerIdRef: { current: 'window-a' },
    resumingImageIdsRef: { current: new Set<string>() },
    taskResumeService: {
      resumeTask: vi.fn().mockResolvedValue({ state: 'unsupported' as const }),
      streamTask: vi.fn().mockResolvedValue({ state: 'unsupported' as const }),
    },
    ...activeRunRegistry,
    ensureConversationLoaded: vi.fn().mockResolvedValue(undefined),
    updateImageTaskInConversation: vi.fn(),
    updateRunImageInConversation: vi.fn(),
    updateRunTaskStateInConversation: vi.fn(),
    replaceRuntimeTasksForConversation: vi.fn(),
    persistConversation: vi.fn(),
    flushPendingPersistence: vi.fn().mockResolvedValue(undefined),
  }
}

describe('processPendingImageResumes', () => {
  it('resumes multiple pending images concurrently', async () => {
    const conversation: Conversation = {
      id: 'conv-1',
      title: 'Test',
      titleMode: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sideMode: 'single',
      sideCount: 2,
      settingsBySide: {
        single: {
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
          modelId: 'model-1',
          textModelId: 'model-1',
          videoModelId: 'model-1',
          paramValues: {},
        },
      },
      messages: [{
        id: 'msg-1',
        createdAt: new Date().toISOString(),
        role: 'assistant',
        content: '',
        runs: [
          createPendingRun({ runId: 'run-1', imageId: 'img-1', seq: 1 }),
          createPendingRun({ runId: 'run-2', imageId: 'img-2', seq: 2 }),
          createPendingRun({ runId: 'run-3', imageId: 'img-3', seq: 3 }),
        ],
      }],
    }

    const snapshot = createSnapshot(withTaskPool(conversation))
    let activeResumes = 0
    let maxActiveResumes = 0
    const resumeTask = vi.fn().mockImplementation(async ({ taskId }: { taskId?: string }) => {
      activeResumes += 1
      maxActiveResumes = Math.max(maxActiveResumes, activeResumes)
      await new Promise((resolve) => setTimeout(resolve, 10))
      activeResumes -= 1
      return {
        state: 'success' as const,
        src: `https://img.example/${taskId}.png`,
        serverTaskId: taskId,
        serverTaskMeta: { resumeUrl: `https://example.com/tasks/${taskId}` },
      }
    })
    const streamTask = vi.fn().mockResolvedValue({ state: 'unsupported' as const })
    const updateRunImageInConversation = vi.fn()
    const activeRunRegistry = createActiveRunRegistry()

    await processPendingImageResumes({
      conversationId: conversation.id,
      snapshot,
      requestedConcurrency: 3,
      resumeOwnerId: 'window-a',
      resumingImageIdsRef: { current: new Set<string>() },
      taskResumeService: { resumeTask, streamTask },
      ...activeRunRegistry,
      updateImageTaskInConversation: vi.fn(),
      updateRunImageInConversation,
      updateRunTaskStateInConversation: vi.fn(),
    })

    expect(resumeTask).toHaveBeenCalledTimes(3)
    expect(maxActiveResumes).toBeGreaterThan(1)
    const successUpdates = updateRunImageInConversation.mock.calls
      .map(([, input]) => input)
      .filter((input) => input.status === 'success')

    expect(successUpdates).toHaveLength(3)
    successUpdates.forEach((input) => {
      expect(input.queuedAt).toBeTruthy()
      expect(input.startedAt).toBeTruthy()
      expect(input.completedAt).toBeTruthy()
    })
  })

  it('marks legacy removed-provider tasks as failed when the channel no longer exists', async () => {
    const conversation = createLegacyRemovedProviderConversation()
    const snapshot = createSnapshot(conversation)
    snapshot.channels = []
    const activeRunRegistry = createActiveRunRegistry()
    const resumeTask = vi.fn()
    const updateImageTaskInConversation = vi.fn()
    const updateRunImageInConversation = vi.fn()

    await processPendingImageResumes({
      conversationId: conversation.id,
      snapshot,
      requestedConcurrency: 4,
      resumeOwnerId: 'window-a',
      resumingImageIdsRef: { current: new Set<string>() },
      taskResumeService: {
        resumeTask,
        streamTask: vi.fn().mockResolvedValue({ state: 'unsupported' as const }),
      },
      ...activeRunRegistry,
      updateImageTaskInConversation,
      updateRunImageInConversation,
      updateRunTaskStateInConversation: vi.fn(),
    })

    expect(resumeTask).not.toHaveBeenCalled()
    expect(updateImageTaskInConversation).not.toHaveBeenCalled()
    expect(updateRunImageInConversation).toHaveBeenCalledWith(conversation.id, expect.objectContaining({
      runId: 'run-jimeng',
      seq: 1,
      status: 'failed',
      error: '即梦已移除，无法恢复该任务。',
    }))
  })

  it('starts resume work from the global task pool order', async () => {
    let releaseResumes: (() => void) | null = null
    const startedTaskIds: string[] = []
    const allStarted = new Promise<void>((resolve) => {
      releaseResumes = resolve
    })

    const conversation: Conversation = {
      id: 'conv-multi',
      title: 'Test',
      titleMode: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sideMode: 'multi',
      sideCount: 2,
      settingsBySide: {
        single: {
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
          modelId: 'model-1',
          textModelId: 'model-1',
          videoModelId: 'model-1',
          paramValues: {},
        },
        'win-1': {
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
          modelId: 'model-1',
          textModelId: 'model-1',
          videoModelId: 'model-1',
          paramValues: {},
        },
        'win-2': {
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
          modelId: 'model-1',
          textModelId: 'model-1',
          videoModelId: 'model-1',
          paramValues: {},
        },
      },
      messages: [{
        id: 'msg-1',
        createdAt: new Date().toISOString(),
        role: 'assistant',
        content: '',
        runs: [
          createPendingRun({ runId: 'run-1a', imageId: 'img-1a', seq: 1, side: 'win-1', sideMode: 'multi' }),
          createPendingRun({ runId: 'run-1b', imageId: 'img-1b', seq: 2, side: 'win-1', sideMode: 'multi' }),
          createPendingRun({ runId: 'run-1c', imageId: 'img-1c', seq: 3, side: 'win-1', sideMode: 'multi' }),
          createPendingRun({ runId: 'run-1d', imageId: 'img-1d', seq: 4, side: 'win-1', sideMode: 'multi' }),
          createPendingRun({ runId: 'run-2a', imageId: 'img-2a', seq: 5, side: 'win-2', sideMode: 'multi' }),
          createPendingRun({ runId: 'run-2b', imageId: 'img-2b', seq: 6, side: 'win-2', sideMode: 'multi' }),
          createPendingRun({ runId: 'run-2c', imageId: 'img-2c', seq: 7, side: 'win-2', sideMode: 'multi' }),
          createPendingRun({ runId: 'run-2d', imageId: 'img-2d', seq: 8, side: 'win-2', sideMode: 'multi' }),
        ],
      }],
    }

    const snapshot = createSnapshot(withTaskPool(conversation))
    const resumeTask = vi.fn().mockImplementation(async ({ taskId }: { taskId?: string }) => {
      startedTaskIds.push(taskId ?? 'missing')
      if (startedTaskIds.length < 4) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      if (startedTaskIds.length === 4 && releaseResumes) {
        releaseResumes()
      }
      await allStarted
      return {
        state: 'success' as const,
        src: `https://img.example/${taskId}.png`,
        serverTaskId: taskId,
        serverTaskMeta: { resumeUrl: `https://example.com/tasks/${taskId}` },
      }
    })
    const streamTask = vi.fn().mockResolvedValue({ state: 'unsupported' as const })
    const activeRunRegistry = createActiveRunRegistry()

    const processing = processPendingImageResumes({
      conversationId: conversation.id,
      snapshot,
      requestedConcurrency: 4,
      resumeOwnerId: 'window-a',
      resumingImageIdsRef: { current: new Set<string>() },
      taskResumeService: { resumeTask, streamTask },
      ...activeRunRegistry,
      updateImageTaskInConversation: vi.fn(),
      updateRunImageInConversation: vi.fn(),
      updateRunTaskStateInConversation: vi.fn(),
    })

    await allStarted
    expect(startedTaskIds.slice(0, 4)).toEqual(['task-1', 'task-2', 'task-3', 'task-4'])
    await processing
  })

  it('uses the configured generation timeout when deciding timed out tasks', async () => {
    const oldDateNow = Date.now
    Date.now = vi.fn(() => new Date('2026-03-18T10:10:00.000Z').getTime())

    try {
      const run = createPendingRun({ runId: 'run-timeout', imageId: 'img-timeout', seq: 1 })
      run.createdAt = '2026-03-18T10:00:00.000Z'

      const conversation: Conversation = withTaskPool({
        id: 'conv-timeout',
        title: 'Timeout',
        titleMode: 'default',
        createdAt: '2026-03-18T10:00:00.000Z',
        updatedAt: '2026-03-18T10:00:00.000Z',
        sideMode: 'single',
        sideCount: 2,
        settingsBySide: {
          single: {
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
            modelId: 'model-1',
            textModelId: 'model-1',
            videoModelId: 'model-1',
            paramValues: {},
          },
        },
        messages: [{
          id: 'msg-timeout',
          createdAt: '2026-03-18T10:00:00.000Z',
          role: 'assistant',
          content: '',
          runs: [run],
        }],
      })

      const snapshot = createSnapshot(conversation)
      snapshot.imageRuntimeSettings = {
        ...DEFAULT_IMAGE_RUNTIME_SETTINGS,
        generationTimeoutMinutes: 5,
      }

      const updateImageTaskInConversation = vi.fn()
      const updateRunImageInConversation = vi.fn()
      const updateRunTaskStateInConversation = vi.fn()

      await processPendingImageResumes({
        conversationId: conversation.id,
        snapshot,
        requestedConcurrency: 1,
        resumeOwnerId: 'window-a',
        resumingImageIdsRef: { current: new Set<string>() },
        taskResumeService: {
          resumeTask: vi.fn(),
          streamTask: vi.fn(),
        },
        ...createActiveRunRegistry(),
        updateImageTaskInConversation,
        updateRunImageInConversation,
        updateRunTaskStateInConversation,
      })

      expect(updateImageTaskInConversation).toHaveBeenCalledWith('conv-timeout', expect.objectContaining({
        taskId: 'task-entry-1',
        status: 'timeout',
        errorCode: 'timeout',
      }))
      expect(updateRunImageInConversation).toHaveBeenCalledWith('conv-timeout', expect.objectContaining({
        runId: 'run-timeout',
        seq: 1,
        status: 'failed',
        queuedAt: '2026-03-18T10:00:00.000Z',
        startedAt: '2026-03-18T10:00:00.000Z',
        completedAt: expect.any(String),
        errorCode: 'timeout',
      }))
      expect(updateRunTaskStateInConversation).toHaveBeenCalledWith('conv-timeout', {
        runId: 'run-timeout',
        status: 'timeout',
        reason: 'generating-timeout',
      })
    } finally {
      Date.now = oldDateNow
    }
  })

  it('skips a pending image when another window already holds its resume lease', async () => {
    const conversation: Conversation = {
      id: 'conv-lease',
      title: 'Lease',
      titleMode: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sideMode: 'single',
      sideCount: 2,
      settingsBySide: {
        single: {
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
          modelId: 'model-1',
          textModelId: 'model-1',
          videoModelId: 'model-1',
          paramValues: {},
        },
      },
      messages: [{
        id: 'msg-1',
        createdAt: new Date().toISOString(),
        role: 'assistant',
        content: '',
        runs: [createPendingRun({ runId: 'run-1', imageId: 'img-1', seq: 1 })],
      }],
    }

    const leaseKey = 'm3:image-resume:conv-lease:run-1:task-entry-1'
    acquireWindowLease({
      leaseKey,
      ownerId: 'window-b',
      ttlMs: 60_000,
    })

    const resumeTask = vi.fn()
    const streamTask = vi.fn().mockResolvedValue({ state: 'unsupported' as const })
    const updateRunImageInConversation = vi.fn()
    const activeRunRegistry = createActiveRunRegistry()

    await processPendingImageResumes({
      conversationId: conversation.id,
      snapshot: createSnapshot(withTaskPool(conversation)),
      requestedConcurrency: 1,
      resumeOwnerId: 'window-a',
      resumingImageIdsRef: { current: new Set<string>() },
      taskResumeService: { resumeTask, streamTask },
      ...activeRunRegistry,
      updateImageTaskInConversation: vi.fn(),
      updateRunImageInConversation,
      updateRunTaskStateInConversation: vi.fn(),
    })

    expect(resumeTask).not.toHaveBeenCalled()
    expect(updateRunImageInConversation).not.toHaveBeenCalled()

    releaseWindowLease({ leaseKey, ownerId: 'window-b' })
  })

  it('prefers stream transport and falls back to polling when the stream is unsupported', async () => {
    const conversation: Conversation = {
      id: 'conv-stream',
      title: 'Stream',
      titleMode: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sideMode: 'single',
      sideCount: 1,
      settingsBySide: {
        single: {
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
          modelId: 'model-1',
          textModelId: 'model-1',
          videoModelId: 'model-1',
          paramValues: {},
        },
      },
      messages: [{
        id: 'msg-1',
        createdAt: new Date().toISOString(),
        role: 'assistant',
        content: '',
        runs: [createPendingRun({ runId: 'run-1', imageId: 'img-1', seq: 1 })],
      }],
    }

    const updateImageTaskInConversation = vi.fn()
    const updateRunImageInConversation = vi.fn()
    const streamTask = vi.fn().mockResolvedValue({ state: 'unsupported' as const })
    const resumeTask = vi.fn().mockResolvedValue({
      state: 'pending' as const,
      serverTaskId: 'task-1',
      serverTaskMeta: { resumeUrl: 'https://example.com/tasks/task-1' },
    })
    const activeRunRegistry = createActiveRunRegistry()

    await processPendingImageResumes({
      conversationId: conversation.id,
      snapshot: createSnapshot(withTaskPool(conversation)),
      requestedConcurrency: 1,
      resumeOwnerId: 'window-a',
      resumingImageIdsRef: { current: new Set<string>() },
      taskResumeService: { resumeTask, streamTask },
      ...activeRunRegistry,
      updateImageTaskInConversation,
      updateRunImageInConversation,
      updateRunTaskStateInConversation: vi.fn(),
    })

    expect(streamTask).toHaveBeenCalledTimes(1)
    expect(resumeTask).toHaveBeenCalledTimes(1)
    expect(
      updateImageTaskInConversation.mock.calls.some(([, payload]) => payload.resumeTransport === 'stream'),
    ).toBe(true)
    expect(
      updateImageTaskInConversation.mock.calls.some(([, payload]) => payload.resumeTransport === 'polling'),
    ).toBe(true)
    expect(
      updateRunImageInConversation.mock.calls.some(([, payload]) => payload.resumeTransport === 'polling'),
    ).toBe(true)
  })

  it('drops late resume updates after the run is cancelled for its assistant message', async () => {
    const conversation: Conversation = {
      id: 'conv-cancelled-resume',
      title: 'Cancelled',
      titleMode: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sideMode: 'single',
      sideCount: 1,
      settingsBySide: {
        single: {
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
          modelId: 'model-1',
          textModelId: 'model-1',
          videoModelId: 'model-1',
          paramValues: {},
        },
      },
      messages: [{
        id: 'msg-1',
        createdAt: new Date().toISOString(),
        role: 'assistant',
        content: '',
        runs: [createPendingRun({ runId: 'run-1', imageId: 'img-1', seq: 1 })],
      }],
    }

    const activeRunRegistry = createActiveRunRegistry()
    const updateImageTaskInConversation = vi.fn()
    const updateRunImageInConversation = vi.fn()
    const streamTask = vi.fn().mockImplementation(async ({ onEvent }: { onEvent: (event: { state: 'pending' | 'success'; src?: string }) => void }) => {
      onEvent({ state: 'pending' })
      activeRunRegistry.clearRun(conversation.id, 'run-1')
      onEvent({ state: 'success', src: 'https://img.example/task-1.png' })
      return { state: 'completed' as const }
    })

    await processPendingImageResumes({
      conversationId: conversation.id,
      snapshot: createSnapshot(withTaskPool(conversation)),
      requestedConcurrency: 1,
      resumeOwnerId: 'window-a',
      resumingImageIdsRef: { current: new Set<string>() },
      taskResumeService: {
        resumeTask: vi.fn(),
        streamTask,
      },
      ...activeRunRegistry,
      updateImageTaskInConversation,
      updateRunImageInConversation,
      updateRunTaskStateInConversation: vi.fn(),
    })

    expect(
      updateRunImageInConversation.mock.calls.some(([, payload]) => payload.status === 'success'),
    ).toBe(false)
    expect(
      updateImageTaskInConversation.mock.calls.some(([, payload]) => payload.status === 'succeeded'),
    ).toBe(false)
  })

  it('persists resumed inline images as indexeddb-backed refs before updating state', async () => {
    const conversation: Conversation = {
      id: 'conv-inline-resume',
      title: 'Inline Resume',
      titleMode: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sideMode: 'single',
      sideCount: 1,
      settingsBySide: {
        single: {
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
          modelId: 'model-1',
          textModelId: 'model-1',
          videoModelId: 'model-1',
          paramValues: {},
        },
      },
      messages: [{
        id: 'msg-1',
        createdAt: new Date().toISOString(),
        role: 'assistant',
        content: '',
        runs: [createPendingRun({ runId: 'run-inline', imageId: 'img-inline', seq: 1 })],
      }],
    }

    const updateImageTaskInConversation = vi.fn()
    const updateRunImageInConversation = vi.fn()
    const activeRunRegistry = createActiveRunRegistry()

    await processPendingImageResumes({
      conversationId: conversation.id,
      snapshot: createSnapshot(withTaskPool(conversation)),
      requestedConcurrency: 1,
      resumeOwnerId: 'window-a',
      resumingImageIdsRef: { current: new Set<string>() },
      taskResumeService: {
        resumeTask: vi.fn().mockResolvedValue({
          state: 'success',
          src: 'data:image/png;base64,aGVsbG8=',
          serverTaskId: 'task-1',
        }),
        streamTask: vi.fn().mockResolvedValue({ state: 'unsupported' }),
      },
      ...activeRunRegistry,
      updateImageTaskInConversation,
      updateRunImageInConversation,
      updateRunTaskStateInConversation: vi.fn(),
    })

    expect(updateImageTaskInConversation).toHaveBeenCalledWith('conv-inline-resume', expect.objectContaining({
      status: 'succeeded',
      refKind: 'idb-blob',
      refKey: expect.stringMatching(/^asset:/),
      fileRef: undefined,
      thumbRef: undefined,
    }))
    expect(updateRunImageInConversation).toHaveBeenCalledWith('conv-inline-resume', expect.objectContaining({
      status: 'success',
      refKind: 'idb-blob',
      refKey: expect.stringMatching(/^asset:/),
      fileRef: undefined,
      thumbRef: undefined,
    }))
  })
})

describe('useResumeFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearImageTasks()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })

  afterEach(() => {
    clearImageTasks()
    vi.useRealTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })

  it('does not register active polling when the active conversation has no resumable work', () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
    const deps = createResumeFlowDeps({ activeConversationHasResumableWork: false })

    renderHook(() => useResumeFlow(deps))

    expect(setTimeoutSpy).toHaveBeenCalledTimes(0)
    expect(deps.resumePollTimerRef.current).toBeNull()
  })

  it('registers active polling with the first-stage default interval when resumable work exists', async () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
    const deps = createResumeFlowDeps({ activeConversationHasResumableWork: true })

    renderHook(() => useResumeFlow(deps))
    await act(async () => {
      await Promise.resolve()
    })

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500)
    expect(deps.resumePollTimerRef.current).not.toBeNull()
  })

  it('switches the next delay to later schedule stages based on pending elapsed time', async () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
    const oldDateNow = Date.now
    Date.now = vi.fn(() => new Date('2026-03-20T10:00:45.000Z').getTime())

    try {
      const deps = createResumeFlowDeps({ activeConversationHasResumableWork: true })
      const conversation = deps.stateRef.current.contents['conv-hook']
      const run = conversation?.messages[0]?.runs?.[0]
      const taskId = run?.taskIds?.[0] ?? 'task-entry-1'
      if (!conversation || !run) {
        throw new Error('Expected seeded conversation state')
      }
      run.createdAt = '2026-03-20T10:00:00.000Z'
      run.images[0] = {
        ...run.images[0]!,
        pendingStartedAt: '2026-03-20T10:00:00.000Z',
      }
      deps.stateRef.current.runtimeTasksByConversationId['conv-hook'][taskId] = {
        ...deps.stateRef.current.runtimeTasksByConversationId['conv-hook'][taskId]!,
        queuedAt: '2026-03-20T10:00:00.000Z',
        startedAt: '2026-03-20T10:00:00.000Z',
      }

      renderHook(() => useResumeFlow(deps))
      await act(async () => {
        await Promise.resolve()
      })

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1500)

      ;(Date.now as typeof Date.now) = vi.fn(() => new Date('2026-03-20T10:01:05.000Z').getTime())
      deps.resumePollTimerRef.current = null
      setTimeoutSpy.mockClear()

      renderHook(() => useResumeFlow(deps))
      await act(async () => {
        await Promise.resolve()
      })

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000)
    } finally {
      Date.now = oldDateNow
    }
  })

  it('uses the hidden-page multiplier for the current polling stage', async () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
    const deps = createResumeFlowDeps({ activeConversationHasResumableWork: true })

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })

    renderHook(() => useResumeFlow(deps))
    await act(async () => {
      await Promise.resolve()
    })

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000)
  })

  it('triggers a background poll when the page becomes visible again', async () => {
    const deps = createResumeFlowDeps({ activeConversationHasResumableWork: false })
    upsertImageTask({
      id: 'conv-hook:run-hook:img-hook',
      conversationId: 'conv-hook',
      runId: 'run-hook',
      imageId: 'img-hook',
      seq: 1,
      channelId: 'ch-1',
      serverTaskId: 'task-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    renderHook(() => useResumeFlow(deps))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    const initialCallCount = deps.ensureConversationLoaded.mock.calls.length

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
    })

    expect(deps.ensureConversationLoaded.mock.calls.length).toBeGreaterThan(initialCallCount)
  })
})

describe('buildFairResumableImageQueue', () => {
  it('builds a flat global resume queue from tasksById', () => {
    const conversation: Conversation = {
      id: 'conv-order',
      title: 'Order',
      titleMode: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sideMode: 'multi',
      sideCount: 2,
      settingsBySide: {
        single: {
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
          modelId: 'model-1',
          textModelId: 'model-1',
          videoModelId: 'model-1',
          paramValues: {},
        },
        'win-1': {
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
          modelId: 'model-1',
          textModelId: 'model-1',
          videoModelId: 'model-1',
          paramValues: {},
        },
        'win-2': {
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
          modelId: 'model-1',
          textModelId: 'model-1',
          videoModelId: 'model-1',
          paramValues: {},
        },
      },
      messages: [{
        id: 'msg-1',
        createdAt: new Date().toISOString(),
        role: 'assistant',
        content: '',
        runs: [
          createPendingRun({ runId: 'run-1', imageId: 'img-1', seq: 1, side: 'win-1', sideMode: 'multi' }),
          createPendingRun({ runId: 'run-2', imageId: 'img-2', seq: 2, side: 'win-1', sideMode: 'multi' }),
          createPendingRun({ runId: 'run-3', imageId: 'img-3', seq: 3, side: 'win-2', sideMode: 'multi' }),
          createPendingRun({ runId: 'run-4', imageId: 'img-4', seq: 4, side: 'win-2', sideMode: 'multi' }),
        ],
      }],
    }

    const queue = buildFairResumableImageQueue(withTaskPool(conversation))

    expect(queue.map((entry) => `${entry.run.side}:${entry.run.id}:${entry.image.seq}`)).toEqual([
      'win-1:run-1:1',
      'win-1:run-2:2',
      'win-2:run-3:3',
      'win-2:run-4:4',
    ])
  })
})

describe('processBackgroundPendingTaskConversations', () => {
  it('processes conversations with controlled concurrency instead of strict serialization', async () => {
    let activeConversations = 0
    let maxActiveConversations = 0
    const visited: string[] = []

    const ensureConversationLoaded = vi.fn(async () => {})
    const resumePendingImagesForConversation = vi.fn(async (conversationId: string) => {
      visited.push(conversationId)
      activeConversations += 1
      maxActiveConversations = Math.max(maxActiveConversations, activeConversations)
      await new Promise((resolve) => setTimeout(resolve, 10))
      activeConversations -= 1
    })

    await processBackgroundPendingTaskConversations({
      conversationIds: ['c1', 'c2', 'c3'],
      ensureConversationLoaded,
      resumePendingImagesForConversation,
    })

    expect(ensureConversationLoaded).toHaveBeenCalledTimes(3)
    expect(resumePendingImagesForConversation).toHaveBeenCalledTimes(3)
    expect(maxActiveConversations).toBeGreaterThan(1)
    expect(visited.sort()).toEqual(['c1', 'c2', 'c3'])
  })

  it('deduplicates repeated conversation ids from the shared task registry', async () => {
    const ensureConversationLoaded = vi.fn(async () => {})
    const resumePendingImagesForConversation = vi.fn(async () => {})

    await processBackgroundPendingTaskConversations({
      conversationIds: ['c1', 'c1', 'c2'],
      ensureConversationLoaded,
      resumePendingImagesForConversation,
    })

    expect(ensureConversationLoaded).toHaveBeenCalledTimes(2)
    expect(resumePendingImagesForConversation).toHaveBeenCalledTimes(2)
  })
})
