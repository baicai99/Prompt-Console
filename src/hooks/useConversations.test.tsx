import { act, renderHook, waitFor } from '@testing-library/react'
import { message, notification } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createConversationCommandGroups } from '../features/conversation/ui/controller/conversationControllerBindings'
import { useConversationControllerState } from '../features/conversation/ui/controller/useConversationControllerState'
import { createConversationRepository } from '../features/conversation/infra/conversationRepository'
import * as imageAssetStore from '../services/imageAssetStore'
import { loadImageTasks } from '../services/imageTaskStore'
import type { Conversation, Run } from '../types/conversation'
import { buildScopedModelId } from '../utils/modelIdentity'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../utils/imageRuntimeSettings'

const mockCreateRun = vi.hoisted(() => vi.fn())
const mockResumeImageTaskByProvider = vi.hoisted(() => vi.fn())
const mockStreamImageTaskByProvider = vi.hoisted(() => vi.fn())
const mockStreamTextByProvider = vi.hoisted(() => vi.fn())

vi.mock('../features/conversation/application/runExecutor', () => ({
  createRunExecutor: () => ({
    createRun: mockCreateRun,
    releaseObjectUrls: vi.fn(),
  }),
}))

vi.mock('../services/providerGateway', async () => {
  const actual = await vi.importActual<typeof import('../services/providerGateway')>('../services/providerGateway')
  return {
    ...actual,
    resumeImageTaskByProvider: mockResumeImageTaskByProvider,
    streamImageTaskByProvider: mockStreamImageTaskByProvider,
    streamTextByProvider: mockStreamTextByProvider,
  }
})

async function resetStorage() {
  localStorage.clear()
  if (typeof indexedDB !== 'undefined') {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('m3-conversations-db')
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  }
}

async function seedConversation(input: { conversation: Conversation; activeId?: string | null }) {
  const repo = createConversationRepository()
  await repo.saveConversation(input.conversation)
  repo.saveIndex([
    {
      id: input.conversation.id,
      title: input.conversation.title,
      createdAt: input.conversation.createdAt,
      updatedAt: input.conversation.updatedAt,
      lastMessagePreview: input.conversation.messages[0]?.content ?? '',
    },
  ])
  repo.saveActiveId('activeId' in input ? (input.activeId ?? null) : input.conversation.id)
}

function seedChannels(input?: {
  channels?: Array<{
    id: string
    name: string
    baseUrl: string
    apiKey: string
    models: string[]
  }>
  settingsOverride?: Partial<Conversation['settingsBySide']['single']>
}) {
  const repo = createConversationRepository()
  repo.saveChannels(input?.channels ?? [{
    id: 'ch',
    name: 'main',
    baseUrl: 'https://example.com',
    apiKey: 'key',
    models: ['model-a', 'gpt-4o-mini', 'gpt-4o', 'gemini-2.5-flash-image', 'gpt-image-1'],
  }])
  repo.saveStagedSettings({
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
        channelId: 'ch',
        modelId: 'model-a',
        paramValues: {},
        ...input?.settingsOverride,
      },
    },
    runConcurrency: 1,
    runConcurrencyUnlimited: false,
    dynamicPromptEnabled: false,
    autoRenameConversationTitle: true,
    autoRenameConversationTitleModelId: 'model-a',
    panelValueFormat: 'json',
    panelVariables: [{ id: 'v1', key: '', valuesText: '', selectedValue: '' }],
    favoriteModelIds: [],
    imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
  })
}

function createSeedConversation(input: { id: string; title: string; prompt?: string }): Conversation {
  const now = '2026-03-06T00:00:00.000Z'
  const prompt = input.prompt ?? `${input.title} prompt`
  return {
    id: input.id,
    title: input.title,
    titleMode: input.title === '未命名' ? 'default' : 'manual',
    createdAt: now,
    updatedAt: now,
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
        channelId: 'ch',
        modelId: 'model-a',
        paramValues: {},
      },
    },
    messages: [
      {
        id: `${input.id}-m1`,
        createdAt: now,
        role: 'user',
        content: prompt,
      },
    ],
  }
}

function buildSuccessfulRunFromInput(input: {
  runId: string
  batchId?: string
  createdAt: string
  sideMode?: 'single' | 'multi'
  side?: string
  channel?: { id?: string; name?: string } | null
  modelId: string
  modelName?: string
  templatePrompt: string
  finalPrompt: string
  variablesSnapshot?: Record<string, string>
  paramsSnapshot?: Record<string, string | number | boolean>
  settings: {
    resolution: string
    aspectRatio: string
    imageCount: number
    gridColumns: number
    sizeMode: 'preset' | 'custom'
    customWidth: number
    customHeight: number
    autoSave: boolean
    saveDirectory?: string
  }
}): Run {
  return {
    id: input.runId,
    batchId: input.batchId ?? 'batch-success',
    createdAt: input.createdAt,
    sideMode: input.sideMode ?? 'single',
    side: input.side ?? 'single',
    prompt: input.finalPrompt,
    imageCount: Math.max(1, Math.floor(input.settings.imageCount)),
    channelId: input.channel?.id ?? 'ch',
    channelName: input.channel?.name ?? 'main',
    modelId: input.modelId,
    modelName: input.modelName ?? input.modelId,
    templatePrompt: input.templatePrompt,
    finalPrompt: input.finalPrompt,
    variablesSnapshot: input.variablesSnapshot ?? {},
    paramsSnapshot: input.paramsSnapshot ?? {},
    settingsSnapshot: {
      resolution: input.settings.resolution,
      aspectRatio: input.settings.aspectRatio,
      imageCount: input.settings.imageCount,
      gridColumns: input.settings.gridColumns,
      sizeMode: input.settings.sizeMode,
      customWidth: input.settings.customWidth,
      customHeight: input.settings.customHeight,
      autoSave: input.settings.autoSave,
      ...(input.settings.saveDirectory ? { saveDirectory: input.settings.saveDirectory } : {}),
    },
    retryAttempt: 0,
    images: [{ id: `${input.runId}-img-1`, seq: 1, status: 'success', threadState: 'settled', fileRef: '/ok.png' }],
  }
}

type SuccessfulRunInput = Parameters<typeof buildSuccessfulRunFromInput>[0]

function useLegacyConversationControllerForTest() {
  const controller = useConversationControllerState()
  const groups = createConversationCommandGroups(controller.dispatch)

  return {
    ...controller,
    queries: controller.read,
    commands: {
      ...groups.draft,
      ...groups.presentation,
      ...groups.lifecycle,
      ...groups.settings,
      ...groups.run,
      ...groups.download,
    },
    maintenance: {
      flushPendingPersistence: () => controller.runSystemJob({ type: 'persistence/flush-pending' }),
    },
  }
}

describe('useConversations', () => {
  beforeEach(async () => {
    await resetStorage()
    mockCreateRun.mockReset()
    mockResumeImageTaskByProvider.mockReset()
    mockStreamImageTaskByProvider.mockReset()
    mockStreamTextByProvider.mockReset()
    mockStreamImageTaskByProvider.mockResolvedValue({ state: 'unsupported' })
    mockStreamTextByProvider.mockImplementation(async (input: { request: { messages: Array<{ role: string; content: string }> }; onDelta: (chunk: string) => void }) => {
      const systemPrompt = input.request.messages.find((message) => message.role === 'system')?.content ?? ''
      if (!systemPrompt.includes('对话标题生成器')) {
        return
      }
      const firstQuestion = input.request.messages.find((message) => message.role === 'user')?.content?.trim() ?? ''
      if (firstQuestion) {
        input.onDelta(firstQuestion)
      }
    })
    vi.restoreAllMocks()
    vi.useRealTimers()
    seedChannels()
  })

  it('supports controller v2 read/dispatch contract', async () => {
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    expect(result.current.read.draft).toBe('')

    await act(async () => {
      await result.current.dispatch({ type: 'draft/set', value: 'hello' })
    })

    expect(result.current.read.draft).toBe('hello')

    await act(async () => {
      await result.current.runSystemJob({ type: 'persistence/flush-pending' })
    })
  })

  it('only confirms create-new when the active conversation has active image threads', async () => {

    const settledConversation: Conversation = {
      id: 'c1',
      title: 'settled',
      titleMode: 'manual',
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z',
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
          channelId: 'ch',
          modelId: 'model-a',
          paramValues: {},
        },
      },
      messages: [
        {
          id: 'm1',
          createdAt: '2026-03-06T00:00:00.000Z',
          role: 'assistant',
          content: 'done',
          runs: [{
            id: 'r1',
            batchId: 'b1',
            createdAt: '2026-03-06T00:00:00.000Z',
            sideMode: 'single',
            side: 'single',
            prompt: 'done',
            imageCount: 1,
            channelId: 'ch',
            channelName: 'main',
            modelId: 'model-a',
            modelName: 'model-a',
            templatePrompt: 'done',
            finalPrompt: 'done',
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
            images: [{ id: 'i1', seq: 1, status: 'success', threadState: 'settled', fileRef: '/a.png' }],
          }],
        },
      ],
    }

    await seedConversation({ conversation: settledConversation })
    const settledHook = renderHook(() => useLegacyConversationControllerForTest())
    await waitFor(() => expect(settledHook.result.current.queries.activeConversation?.id).toBe('c1'))
    expect(settledHook.result.current.queries.shouldConfirmCreateConversation).toBe(false)
    settledHook.unmount()

    await resetStorage()
    seedChannels()

    const activeConversation: Conversation = {
      ...settledConversation,
      id: 'c2',
      title: 'active',
      messages: [
        {
          ...settledConversation.messages[0],
          id: 'm2',
          runs: [{
            ...settledConversation.messages[0].runs![0],
            id: 'r2',
            images: [{ id: 'i2', seq: 1, status: 'pending', threadState: 'active' }],
          }],
        },
      ],
    }
    await seedConversation({ conversation: activeConversation })
    const activeHook = renderHook(() => useLegacyConversationControllerForTest())
    await waitFor(() => expect(activeHook.result.current.queries.activeConversation?.id).toBe('c2'))
    expect(activeHook.result.current.queries.shouldConfirmCreateConversation).toBe(true)
  })

  it('keeps draft when creating a new conversation', async () => {
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('do not clear me')
    })
    act(() => {
      result.current.commands.createNewConversation()
    })

    expect(result.current.queries.activeId).toBeNull()
    expect(result.current.queries.draft).toBe('do not clear me')
  })

  it('keeps empty active conversation after refresh when history exists', async () => {
    const conversation = createSeedConversation({ id: 'history-1', title: 'History 1' })
    await seedConversation({ conversation, activeId: null })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    await waitFor(() => expect(result.current.queries.summaries).toHaveLength(1))
    expect(result.current.queries.activeId).toBeNull()
    expect(result.current.queries.activeConversation).toBeNull()
  })

  it('keeps draft when switching conversations', async () => {
    const repo = createConversationRepository()
    const conversationA = createSeedConversation({ id: 'conv-a', title: 'A' })
    const conversationB = createSeedConversation({ id: 'conv-b', title: 'B' })
    await repo.saveConversation(conversationA)
    await repo.saveConversation(conversationB)
    repo.saveIndex([
      {
        id: conversationA.id,
        title: conversationA.title,
        createdAt: conversationA.createdAt,
        updatedAt: conversationA.updatedAt,
        lastMessagePreview: conversationA.messages[0]?.content ?? '',
      },
      {
        id: conversationB.id,
        title: conversationB.title,
        createdAt: conversationB.createdAt,
        updatedAt: conversationB.updatedAt,
        lastMessagePreview: conversationB.messages[0]?.content ?? '',
      },
    ])
    repo.saveActiveId(conversationA.id)
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    await waitFor(() => expect(result.current.queries.activeId).toBe(conversationA.id))

    act(() => {
      result.current.commands.setDraft('persist when switch')
    })
    act(() => {
      result.current.commands.switchConversation(conversationB.id)
    })

    await waitFor(() => expect(result.current.queries.activeId).toBe(conversationB.id))
    expect(result.current.queries.draft).toBe('persist when switch')
  })

  it('cancels pending images for one assistant message and removes resumable tasks', async () => {
    mockResumeImageTaskByProvider.mockResolvedValue({ state: 'pending' })
    const now = new Date().toISOString()
    const conversation: Conversation = {
      id: 'cancel-message-conv',
      title: 'cancel message',
      titleMode: 'manual',
      createdAt: now,
      updatedAt: now,
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
          channelId: 'ch',
          modelId: 'model-a',
          paramValues: {},
        },
      },
      tasksById: {
        'task-cancel': {
          taskId: 'task-cancel',
          runId: 'run-cancel',
          batchId: 'batch-cancel',
          side: 'single',
          seq: 1,
          finalPrompt: 'cancel me',
          status: 'running',
          createdAt: now,
          queuedAt: now,
          startedAt: now,
          threadState: 'active',
          serverTaskId: 'server-task-cancel',
        },
      },
      messages: [
        {
          id: 'message-cancel',
          createdAt: now,
          role: 'assistant',
          content: 'cancel me',
          runs: [{
            id: 'run-cancel',
            batchId: 'batch-cancel',
            createdAt: now,
            sideMode: 'single',
            side: 'single',
            prompt: 'cancel me',
            imageCount: 1,
            channelId: 'ch',
            channelName: 'main',
            modelId: 'model-a',
            modelName: 'model-a',
            templatePrompt: 'cancel me',
            finalPrompt: 'cancel me',
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
            taskState: {
              status: 'generating',
              updatedAt: now,
              generatingStartedAt: now,
            },
            images: [{
              id: 'image-cancel',
              seq: 1,
              status: 'pending',
              threadState: 'active',
              serverTaskId: 'server-task-cancel',
            }],
          }],
        },
      ],
    }

    await seedConversation({ conversation })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    await waitFor(() => expect(result.current.queries.activeConversation?.id).toBe(conversation.id))
    await act(async () => {
      await result.current.commands.cancelMessageRuns(conversation.id, 'message-cancel', ['run-cancel'])
    })

    await waitFor(() =>
      expect(result.current.queries.activeConversation?.messages[0]?.runs?.[0]).toMatchObject({
        taskState: {
          status: 'cancelled',
          reason: 'message-aborted',
        },
        images: [{
          status: 'failed',
          threadState: 'settled',
          error: '图片生成已中断',
          errorCode: 'unknown',
        }],
      }),
    )
    expect(result.current.queries.activeConversation?.tasksById ?? {}).toEqual({})
    expect(loadImageTasks()).toHaveLength(0)
  })

  it('cancels only the selected side runs inside one assistant message', async () => {
    mockResumeImageTaskByProvider.mockResolvedValue({ state: 'pending' })
    const now = new Date().toISOString()
    const conversation: Conversation = {
      id: 'cancel-one-side-conv',
      title: 'cancel one side',
      titleMode: 'manual',
      createdAt: now,
      updatedAt: now,
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
          channelId: 'ch',
          modelId: 'model-a',
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
          channelId: 'ch',
          modelId: 'model-a',
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
          channelId: 'ch',
          modelId: 'model-a',
          paramValues: {},
        },
      },
      tasksById: {
        'task-left': {
          taskId: 'task-left',
          runId: 'run-left',
          batchId: 'batch-left',
          side: 'win-1',
          seq: 1,
          finalPrompt: 'left prompt',
          status: 'running',
          createdAt: now,
          queuedAt: now,
          startedAt: now,
          threadState: 'active',
          serverTaskId: 'server-task-left',
        },
        'task-right': {
          taskId: 'task-right',
          runId: 'run-right',
          batchId: 'batch-right',
          side: 'win-2',
          seq: 1,
          finalPrompt: 'right prompt',
          status: 'running',
          createdAt: now,
          queuedAt: now,
          startedAt: now,
          threadState: 'active',
          serverTaskId: 'server-task-right',
        },
      },
      messages: [
        {
          id: 'message-cancel-sides',
          createdAt: now,
          role: 'assistant',
          content: 'two sides',
          runs: [
            {
              id: 'run-left',
              batchId: 'batch-left',
              createdAt: now,
              sideMode: 'multi',
              side: 'win-1',
              prompt: 'left prompt',
              imageCount: 1,
              channelId: 'ch',
              channelName: 'main',
              modelId: 'model-a',
              modelName: 'model-a',
              templatePrompt: 'left prompt',
              finalPrompt: 'left prompt',
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
              taskState: {
                status: 'generating',
                updatedAt: now,
                generatingStartedAt: now,
              },
              images: [{
                id: 'image-left',
                seq: 1,
                status: 'pending',
                threadState: 'active',
                serverTaskId: 'server-task-left',
              }],
            },
            {
              id: 'run-right',
              batchId: 'batch-right',
              createdAt: now,
              sideMode: 'multi',
              side: 'win-2',
              prompt: 'right prompt',
              imageCount: 1,
              channelId: 'ch',
              channelName: 'main',
              modelId: 'model-a',
              modelName: 'model-a',
              templatePrompt: 'right prompt',
              finalPrompt: 'right prompt',
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
              taskState: {
                status: 'generating',
                updatedAt: now,
                generatingStartedAt: now,
              },
              images: [{
                id: 'image-right',
                seq: 1,
                status: 'pending',
                threadState: 'active',
                serverTaskId: 'server-task-right',
              }],
            },
          ],
        },
      ],
    }

    await seedConversation({ conversation })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    await waitFor(() => expect(result.current.queries.activeConversation?.id).toBe(conversation.id))

    await act(async () => {
      await result.current.commands.cancelMessageRuns(conversation.id, 'message-cancel-sides', ['run-left'])
    })

    const runs = result.current.queries.activeConversation?.messages[0]?.runs ?? []
    expect(runs.find((run) => run.id === 'run-left')).toMatchObject({
      taskState: {
        status: 'cancelled',
        reason: 'message-aborted',
      },
      images: [{
        status: 'failed',
        threadState: 'settled',
        error: '图片生成已中断',
      }],
    })
    expect(runs.find((run) => run.id === 'run-right')).toMatchObject({
      taskState: {
        status: 'generating',
      },
      images: [{
        status: 'pending',
        threadState: 'active',
      }],
    })
    expect(result.current.queries.activeConversation?.tasksById).toMatchObject({
      'task-right': expect.objectContaining({
        runId: 'run-right',
        status: 'polling',
      }),
    })
    expect(result.current.queries.activeConversation?.tasksById?.['task-left']).toBeUndefined()
  })

  it('keeps cancelled message state when a late run completion arrives after abort', async () => {
    let resolveRun!: (value: Run) => void
    const deferred = new Promise<Run>((resolve) => {
      resolveRun = resolve
    })
    mockCreateRun.mockImplementation((input: { runId: string; createdAt: string }) => deferred.then((run) => ({
      ...run,
      id: input.runId,
      createdAt: input.createdAt,
    })))
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('draw a late cat')
    })

    const sendPromise = result.current.commands.sendDraft()

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(2))
    const activeConversationId = result.current.queries.activeConversation!.id
    const assistantMessageId = result.current.queries.activeConversation!.messages[1]!.id

    await act(async () => {
      const runIds = result.current.queries.activeConversation!.messages[1]!.runs!.map((run) => run.id)
      await result.current.commands.cancelMessageRuns(activeConversationId, assistantMessageId, runIds)
    })

    act(() => {
      resolveRun({
        id: 'late-run',
        batchId: 'batch',
        createdAt: '2026-03-06T00:00:00.000Z',
        sideMode: 'single',
        side: 'single',
        prompt: 'draw a late cat',
        imageCount: 1,
        channelId: 'ch',
        channelName: 'main',
        modelId: 'model-a',
        modelName: 'model-a',
        templatePrompt: 'draw a late cat',
        finalPrompt: 'draw a late cat',
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
        images: [{ id: 'late-image', seq: 1, status: 'success', threadState: 'settled', fileRef: '/late.png' }],
      })
    })

    await act(async () => {
      await sendPromise
    })

    expect(result.current.queries.activeConversation?.messages[1]?.runs?.[0]).toMatchObject({
      taskState: {
        status: 'cancelled',
        reason: 'message-aborted',
      },
      images: [{
        status: 'failed',
        threadState: 'settled',
        error: '图片生成已中断',
      }],
    })
  })

  it('removes a conversation without restoring late completions from aborted runs', async () => {
    let resolveRun!: (value: Run) => void
    const deferred = new Promise<Run>((resolve) => {
      resolveRun = resolve
    })
    mockCreateRun.mockImplementation((input: { runId: string; createdAt: string }) => deferred.then((run) => ({
      ...run,
      id: input.runId,
      createdAt: input.createdAt,
    })))
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('draw and delete')
    })

    const sendPromise = result.current.commands.sendDraft()

    await waitFor(() => expect(result.current.queries.summaries).toHaveLength(1))
    const conversationId = result.current.queries.summaries[0]!.id

    act(() => {
      result.current.commands.removeConversation(conversationId)
    })

    act(() => {
      resolveRun(buildSuccessfulRunFromInput({
        runId: 'late-remove-run',
        createdAt: '2026-03-06T00:00:00.000Z',
        modelId: 'model-a',
        templatePrompt: 'draw and delete',
        finalPrompt: 'draw and delete',
        settings: {
          resolution: '1K',
          aspectRatio: '1:1',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
        },
      }))
    })

    await act(async () => {
      await sendPromise
    })

    expect(result.current.queries.summaries.find((item) => item.id === conversationId)).toBeUndefined()
    expect(result.current.queries.activeConversation?.id).not.toBe(conversationId)
  })

  it('clears all conversations without restoring late completions from aborted runs', async () => {
    let resolveRun!: (value: Run) => void
    const deferred = new Promise<Run>((resolve) => {
      resolveRun = resolve
    })
    mockCreateRun.mockImplementation((input: { runId: string; createdAt: string }) => deferred.then((run) => ({
      ...run,
      id: input.runId,
      createdAt: input.createdAt,
    })))
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('draw and clear')
    })

    const sendPromise = result.current.commands.sendDraft()

    await waitFor(() => expect(result.current.queries.summaries).toHaveLength(1))

    act(() => {
      result.current.commands.clearAllConversations()
    })

    act(() => {
      resolveRun(buildSuccessfulRunFromInput({
        runId: 'late-clear-run',
        createdAt: '2026-03-06T00:00:00.000Z',
        modelId: 'model-a',
        templatePrompt: 'draw and clear',
        finalPrompt: 'draw and clear',
        settings: {
          resolution: '1K',
          aspectRatio: '1:1',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
        },
      }))
    })

    await act(async () => {
      await sendPromise
    })

    expect(result.current.queries.summaries).toHaveLength(0)
    expect(result.current.queries.activeConversation).toBeNull()
  })

  it('deletes conversation-scoped image blobs when removing a conversation', async () => {
    const deleteImageBlobSpy = vi.spyOn(imageAssetStore, 'deleteImageBlob').mockResolvedValue()
    const conversation: Conversation = {
      ...createSeedConversation({ id: 'asset-remove', title: 'Asset Remove' }),
      messages: [
        {
          id: 'asset-remove-user',
          createdAt: '2026-03-06T00:00:00.000Z',
          role: 'user',
          content: 'prompt',
          sourceImages: [{
            id: 'src-1',
            assetKey: 'source:asset-1',
            fileName: 'source.png',
            mimeType: 'image/png',
            size: 10,
          }],
        },
        {
          id: 'asset-remove-assistant',
          createdAt: '2026-03-06T00:00:01.000Z',
          role: 'assistant',
          content: 'done',
          runs: [{
            id: 'run-asset-remove',
            batchId: 'batch',
            createdAt: '2026-03-06T00:00:01.000Z',
            sideMode: 'single',
            side: 'single',
            prompt: 'prompt',
            imageCount: 1,
            channelId: 'ch',
            channelName: 'main',
            modelId: 'model-a',
            modelName: 'model-a',
            templatePrompt: 'prompt',
            finalPrompt: 'prompt',
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
            sourceImages: [{
              id: 'src-2',
              assetKey: 'source:asset-2',
              fileName: 'source-2.png',
              mimeType: 'image/png',
              size: 12,
            }],
            images: [{
              id: 'img-asset',
              seq: 1,
              status: 'success',
              threadState: 'settled',
              refKind: 'idb-blob',
              refKey: 'asset:image-1',
              fileRef: 'thumb',
              thumbRef: 'thumb',
            }],
          }],
        },
      ],
    }
    await seedConversation({ conversation })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    await waitFor(() => expect(result.current.queries.activeConversation?.id).toBe(conversation.id))

    act(() => {
      result.current.commands.removeConversation(conversation.id)
    })

    await waitFor(() => {
      expect(deleteImageBlobSpy).toHaveBeenCalledWith('source:asset-1')
      expect(deleteImageBlobSpy).toHaveBeenCalledWith('source:asset-2')
      expect(deleteImageBlobSpy).toHaveBeenCalledWith('asset:image-1')
    })
  })

  it('clears image blobs when clearing all conversations', async () => {
    const clearImageBlobsSpy = vi.spyOn(imageAssetStore, 'clearImageBlobs').mockResolvedValue()
    const conversation = createSeedConversation({ id: 'asset-clear', title: 'Asset Clear' })
    await seedConversation({ conversation })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.clearAllConversations()
    })

    await waitFor(() => expect(clearImageBlobsSpy).toHaveBeenCalled())
  })

  it('keeps background generation running after close-and-new and applies late completion to the old conversation', async () => {
    const notificationSuccessSpy = vi.spyOn(notification, 'success').mockImplementation(() => undefined)
    let resolveRun!: (value: Run) => void
    const deferred = new Promise<Run>((resolve) => {
      resolveRun = resolve
    })
    mockCreateRun.mockImplementation((input: { runId: string; createdAt: string }) => deferred.then((run) => ({
      ...run,
      id: input.runId,
      createdAt: input.createdAt,
    })))
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('draw a cat')
    })
    act(() => {
      void result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.summaries).toHaveLength(1))
    await waitFor(() => expect(result.current.queries.shouldConfirmCreateConversation).toBe(true))

    const conversationId = result.current.queries.summaries[0]!.id
    act(() => {
      result.current.commands.createNewConversation()
    })

    expect(result.current.queries.activeId).toBeNull()
    expect(result.current.queries.summaries.map((item) => item.id)).toContain(conversationId)

    act(() => {
      resolveRun({
        id: 'late-run',
        batchId: 'batch',
        createdAt: '2026-03-06T00:00:00.000Z',
        sideMode: 'single',
        side: 'single',
        prompt: 'draw a cat',
        imageCount: 1,
        channelId: 'ch',
        channelName: 'main',
        modelId: 'model-a',
        modelName: 'model-a',
        templatePrompt: 'draw a cat',
        finalPrompt: 'draw a cat',
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
        images: [{ id: 'late-image', seq: 1, status: 'success', threadState: 'settled', fileRef: '/late.png' }],
      })
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(notificationSuccessSpy).toHaveBeenCalledTimes(1)
    const config = notificationSuccessSpy.mock.calls[0]?.[0]
    expect(config).toMatchObject({
      placement: 'topRight',
      title: '任务已完成',
    })
    expect(String(config?.description)).toContain('点击跳转查看')

    act(() => {
      config?.onClick?.()
    })

    await waitFor(() => expect(result.current.queries.activeId).toBe(conversationId))
    await waitFor(() =>
      expect(result.current.queries.activeConversation?.messages[1]?.runs?.[0]?.images[0]).toMatchObject({
        status: 'success',
        threadState: 'settled',
        fileRef: '/late.png',
      }),
    )
  })

  it('uses error notification when all images fail', async () => {
    const notificationSuccessSpy = vi.spyOn(notification, 'success').mockImplementation(() => undefined)
    const notificationErrorSpy = vi.spyOn(notification, 'error').mockImplementation(() => undefined)
    const notificationWarningSpy = vi.spyOn(notification, 'warning').mockImplementation(() => undefined)

    mockCreateRun.mockImplementation(async (input: { runId: string; createdAt: string }) => ({
      ...buildSuccessfulRunFromInput({
        runId: input.runId,
        createdAt: input.createdAt,
        modelId: 'model-a',
        templatePrompt: 'draw a failed cat',
        finalPrompt: 'draw a failed cat',
        settings: {
          resolution: '1K',
          aspectRatio: '1:1',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
        },
      }),
      images: [{ id: 'failed-image', seq: 1, status: 'failed', threadState: 'settled', error: 'boom' }],
    }))

    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    act(() => {
      result.current.commands.setDraft('draw a failed cat')
    })

    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() =>
      expect(
        notificationSuccessSpy.mock.calls.length +
        notificationErrorSpy.mock.calls.length +
        notificationWarningSpy.mock.calls.length,
      ).toBeGreaterThan(0),
    )
    expect(notificationWarningSpy).not.toHaveBeenCalled()
    expect(notificationSuccessSpy).not.toHaveBeenCalled()
    expect(notificationErrorSpy).toHaveBeenCalledTimes(1)
    expect(notificationErrorSpy.mock.calls[0]?.[0]).toMatchObject({
      placement: 'topRight',
      title: '任务执行失败',
    })
  })

  it('keeps detached pending images pending while the remote task is still running', async () => {
    mockResumeImageTaskByProvider.mockResolvedValue({ state: 'pending' })
    const now = new Date().toISOString()

    const conversation: Conversation = {
      id: 'c3',
      title: 'resume',
      titleMode: 'manual',
      createdAt: now,
      updatedAt: now,
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
          channelId: 'ch',
          modelId: 'model-a',
          paramValues: {},
        },
      },
      messages: [
        {
          id: 'm3',
          createdAt: now,
          role: 'assistant',
          content: 'resume',
          runs: [{
            id: 'r3',
            batchId: 'b3',
            createdAt: now,
            sideMode: 'single',
            side: 'single',
            prompt: 'resume',
            imageCount: 1,
            channelId: 'ch',
            channelName: 'main',
            modelId: 'model-a',
            modelName: 'model-a',
            templatePrompt: 'resume',
            finalPrompt: 'resume',
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
            images: [{
              id: 'i3',
              seq: 1,
              status: 'pending',
              threadState: 'detached',
              serverTaskId: 'task-1',
            }],
          }],
        },
      ],
    }
    await seedConversation({ conversation })

    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    await waitFor(() =>
      expect(result.current.queries.activeConversation?.messages[0]?.runs?.[0]?.images[0]).toMatchObject({
        status: 'pending',
        threadState: 'active',
      }),
    )
    expect(mockResumeImageTaskByProvider.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(mockResumeImageTaskByProvider.mock.calls[0]?.[0]).toMatchObject({
      taskId: 'task-1',
    })

    await act(async () => {
      window.dispatchEvent(new Event('pageshow'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.queries.activeConversation?.messages[0]?.runs?.[0]?.images[0]).toMatchObject({
      status: 'pending',
      threadState: 'active',
    })
  })

  it('marks pending images as failed after waiting longer than 10 minutes', async () => {
    const now = Date.now()
    const oldCreatedAt = new Date(now - (10 * 60_000 + 5_000)).toISOString()
    const conversation: Conversation = {
      id: 'c4',
      title: 'timeout',
      titleMode: 'manual',
      createdAt: oldCreatedAt,
      updatedAt: oldCreatedAt,
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
          channelId: 'ch',
          modelId: 'model-a',
          paramValues: {},
        },
      },
      messages: [
        {
          id: 'm4',
          createdAt: oldCreatedAt,
          role: 'assistant',
          content: 'timeout',
          runs: [{
            id: 'r4',
            batchId: 'b4',
            createdAt: oldCreatedAt,
            sideMode: 'single',
            side: 'single',
            prompt: 'timeout',
            imageCount: 1,
            channelId: 'ch',
            channelName: 'main',
            modelId: 'model-a',
            modelName: 'model-a',
            templatePrompt: 'timeout',
            finalPrompt: 'timeout',
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
            images: [{
              id: 'i4',
              seq: 1,
              status: 'pending',
              threadState: 'active',
              serverTaskId: 'task-timeout',
            }],
          }],
        },
      ],
    }
    await seedConversation({ conversation })

    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    await waitFor(() =>
      expect(result.current.queries.activeConversation?.messages[0]?.runs?.[0]?.images[0]).toMatchObject({
        status: 'failed',
        threadState: 'settled',
        error: '图片生成超时（超过 10 分钟）',
        errorCode: 'timeout',
      }),
    )
    expect(
      mockResumeImageTaskByProvider.mock.calls.some(([input]) => input.taskId === 'task-timeout'),
    ).toBe(false)
  })

  it('permanently switches model when sending only @model command and appends assistant confirmation', async () => {
    const messageSuccessSpy = vi.spyOn(message, 'success').mockImplementation(() => {
      const close = () => {}
      return close as unknown as ReturnType<typeof message.success>
    })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    const initialScrollTrigger = result.current.queries.sendScrollTrigger

    act(() => {
      result.current.commands.setDraft('@gemini-2.5-flash-image')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(2))
    expect(result.current.queries.activeConversation?.messages[0]?.content).toBe('@gemini-2.5-flash-image')
    expect(result.current.queries.activeConversation?.messages[1]?.content).toContain('模型已切换为 gemini-2.5-flash-image')
    expect(result.current.queries.activeConversation?.messages[1]?.runs ?? []).toHaveLength(0)
    expect(result.current.queries.activeConversation?.title).toBe('未命名')
    expect(result.current.queries.activeSettingsBySide.single.modelId).toBe(buildScopedModelId('ch', 'gemini-2.5-flash-image'))
    expect(result.current.queries.draft).toBe('')
    expect(result.current.queries.sendScrollTrigger).toBe(initialScrollTrigger + 1)
    expect(messageSuccessSpy).toHaveBeenCalled()
  })

  it('keeps first real prompt eligible after permanent @model command', async () => {
    mockCreateRun.mockImplementation(async (input: SuccessfulRunInput) => buildSuccessfulRunFromInput({
      runId: input.runId,
      createdAt: input.createdAt,
      sideMode: input.sideMode,
      side: input.side,
      channel: input.channel,
      modelId: input.modelId,
      modelName: input.modelName,
      templatePrompt: input.templatePrompt,
      finalPrompt: input.finalPrompt,
      variablesSnapshot: input.variablesSnapshot,
      paramsSnapshot: input.paramsSnapshot,
      settings: input.settings,
    }))
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('@gemini-2.5-flash-image')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(2))
    expect(result.current.queries.activeConversation?.title).toBe('未命名')

    act(() => {
      result.current.commands.setDraft('draw a cat')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(mockCreateRun).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.queries.activeConversation?.title).toBe('draw a cat'))
  })

  it('temporarily switches model for @model prompt send and keeps user command in history', async () => {
    mockCreateRun.mockImplementation(async (input: { modelId: string; runId: string; createdAt: string; finalPrompt: string }) => ({
      id: input.runId,
      batchId: 'batch-temp',
      createdAt: input.createdAt,
      sideMode: 'single',
      side: 'single',
      prompt: input.finalPrompt,
      imageCount: 1,
      channelId: 'ch',
      channelName: 'main',
      modelId: input.modelId,
      modelName: input.modelId,
      templatePrompt: input.finalPrompt,
      finalPrompt: input.finalPrompt,
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
      images: [{ id: 'tmp-image', seq: 1, status: 'success', threadState: 'settled', fileRef: '/tmp.png' }],
    }))
    const messageSuccessSpy = vi.spyOn(message, 'success').mockImplementation(() => {
      const close = () => {}
      return close as unknown as ReturnType<typeof message.success>
    })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    const previousModelId = result.current.queries.activeSettingsBySide.single.modelId

    act(() => {
      result.current.commands.setDraft('@gpt-image-1 draw a cat')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(2))
    expect(result.current.queries.activeConversation?.messages[0]?.content).toBe('@gpt-image-1 draw a cat')
    expect(result.current.queries.activeConversation?.messages[1]?.content).toContain('已临时切换到 gpt-image-1')
    expect(result.current.queries.activeConversation?.messages[1]?.runs?.[0]?.modelId).toBe(buildScopedModelId('ch', 'gpt-image-1'))
    await waitFor(() => expect(result.current.queries.activeConversation?.title).toBe('draw a cat'))
    expect(result.current.queries.activeSettingsBySide.single.modelId).toBe(previousModelId)
    expect(messageSuccessSpy).toHaveBeenCalledWith('本次已临时切换到 gpt-image-1（main）')
  })

  it('applies --ar as one-shot override without mutating staged side settings', async () => {
    mockCreateRun.mockImplementation(async (input: SuccessfulRunInput) => buildSuccessfulRunFromInput({
      runId: input.runId,
      createdAt: input.createdAt,
      sideMode: input.sideMode,
      side: input.side,
      channel: input.channel,
      modelId: input.modelId,
      modelName: input.modelName,
      templatePrompt: input.templatePrompt,
      finalPrompt: input.finalPrompt,
      variablesSnapshot: input.variablesSnapshot,
      paramsSnapshot: input.paramsSnapshot,
      settings: input.settings,
    }))
    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    const previousAspectRatio = result.current.queries.activeSettingsBySide.single.aspectRatio

    act(() => {
      result.current.commands.setDraft('portrait photo --ar 16:9')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(mockCreateRun).toHaveBeenCalledTimes(1))
    const callInput = mockCreateRun.mock.calls[0]?.[0]
    expect(callInput.settings.sizeMode).toBe('preset')
    expect(callInput.settings.aspectRatio).toBe('16:9')
    expect(callInput.paramsSnapshot.size).toBe('1344x768')
    expect(callInput.finalPrompt).toBe('portrait photo')
    expect(result.current.queries.activeSettingsBySide.single.aspectRatio).toBe(previousAspectRatio)
  })

  it('applies --size as one-shot override and strips command from final prompt', async () => {
    mockCreateRun.mockImplementation(async (input: SuccessfulRunInput) => buildSuccessfulRunFromInput({
      runId: input.runId,
      createdAt: input.createdAt,
      sideMode: input.sideMode,
      side: input.side,
      channel: input.channel,
      modelId: input.modelId,
      modelName: input.modelName,
      templatePrompt: input.templatePrompt,
      finalPrompt: input.finalPrompt,
      variablesSnapshot: input.variablesSnapshot,
      paramsSnapshot: input.paramsSnapshot,
      settings: input.settings,
    }))
    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    const previousResolution = result.current.queries.activeSettingsBySide.single.resolution

    act(() => {
      result.current.commands.setDraft('poster concept --size 4K')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(mockCreateRun).toHaveBeenCalledTimes(1))
    const callInput = mockCreateRun.mock.calls[0]?.[0]
    expect(callInput.settings.sizeMode).toBe('preset')
    expect(callInput.settings.resolution).toBe('4K')
    expect(callInput.paramsSnapshot.size).toBe('4096x4096')
    expect(callInput.finalPrompt).toBe('poster concept')
    expect(result.current.queries.activeSettingsBySide.single.resolution).toBe(previousResolution)
  })

  it('applies --wh as one-shot custom size override', async () => {
    mockCreateRun.mockImplementation(async (input: SuccessfulRunInput) => buildSuccessfulRunFromInput({
      runId: input.runId,
      createdAt: input.createdAt,
      sideMode: input.sideMode,
      side: input.side,
      channel: input.channel,
      modelId: input.modelId,
      modelName: input.modelName,
      templatePrompt: input.templatePrompt,
      finalPrompt: input.finalPrompt,
      variablesSnapshot: input.variablesSnapshot,
      paramsSnapshot: input.paramsSnapshot,
      settings: input.settings,
    }))
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('draw skyline --wh 640x960')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(mockCreateRun).toHaveBeenCalledTimes(1))
    const callInput = mockCreateRun.mock.calls[0]?.[0]
    expect(callInput.settings.sizeMode).toBe('custom')
    expect(callInput.settings.customWidth).toBe(640)
    expect(callInput.settings.customHeight).toBe(960)
    expect(callInput.paramsSnapshot.size).toBe('640x960')
    expect(callInput.finalPrompt).toBe('draw skyline')
    await waitFor(() => expect(result.current.queries.activeConversation?.title).toBe('draw skyline'))
  })

  it('blocks send when --size and --wh are both provided', async () => {
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('draw city --size 2K --wh 1024x1536')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    expect(mockCreateRun).not.toHaveBeenCalled()
    expect(result.current.queries.sendError).toContain('不能同时使用 --size 和 --wh')
  })

  it('applies @model with --wh together and keeps command text in user message', async () => {
    const messageSuccessSpy = vi.spyOn(message, 'success').mockImplementation(() => {
      const close = () => {}
      return close as unknown as ReturnType<typeof message.success>
    })
    mockCreateRun.mockImplementation(async (input: SuccessfulRunInput) => buildSuccessfulRunFromInput({
      runId: input.runId,
      createdAt: input.createdAt,
      sideMode: input.sideMode,
      side: input.side,
      channel: input.channel,
      modelId: input.modelId,
      modelName: input.modelName,
      templatePrompt: input.templatePrompt,
      finalPrompt: input.finalPrompt,
      variablesSnapshot: input.variablesSnapshot,
      paramsSnapshot: input.paramsSnapshot,
      settings: input.settings,
    }))
    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    const previousModelId = result.current.queries.activeSettingsBySide.single.modelId

    act(() => {
      result.current.commands.setDraft('@gpt-image-1 draw a cat --wh 640x960')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(mockCreateRun).toHaveBeenCalledTimes(1))
    const callInput = mockCreateRun.mock.calls[0]?.[0]
    expect(callInput.modelId).toBe(buildScopedModelId('ch', 'gpt-image-1'))
    expect(callInput.settings.sizeMode).toBe('custom')
    expect(callInput.settings.customWidth).toBe(640)
    expect(callInput.settings.customHeight).toBe(960)
    expect(callInput.finalPrompt).toBe('draw a cat')
    await waitFor(() => expect(result.current.queries.activeConversation?.title).toBe('draw a cat'))
    expect(result.current.queries.activeConversation?.messages[0]?.content).toBe('@gpt-image-1 draw a cat --wh 640x960')
    expect(result.current.queries.activeSettingsBySide.single.modelId).toBe(previousModelId)
    expect(messageSuccessSpy).toHaveBeenCalledWith('本次已临时切换到 gpt-image-1（main）')
  })

  it('applies one-shot override to all sides in multi mode', async () => {
    mockCreateRun.mockImplementation(async (input: SuccessfulRunInput) => buildSuccessfulRunFromInput({
      runId: input.runId,
      createdAt: input.createdAt,
      sideMode: input.sideMode,
      side: input.side,
      channel: input.channel,
      modelId: input.modelId,
      modelName: input.modelName,
      templatePrompt: input.templatePrompt,
      finalPrompt: input.finalPrompt,
      variablesSnapshot: input.variablesSnapshot,
      paramsSnapshot: input.paramsSnapshot,
      settings: input.settings,
    }))
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.updateSideMode('multi')
      result.current.commands.setDraft('wide shot --ar 16:9')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(mockCreateRun).toHaveBeenCalledTimes(2))
    for (const call of mockCreateRun.mock.calls) {
      const callInput = call[0]
      expect(callInput.settings.aspectRatio).toBe('16:9')
      expect(callInput.paramsSnapshot.size).toBe('1344x768')
      expect(callInput.finalPrompt).toBe('wide shot')
    }
  })

  it('appends assistant guidance when sending without a selected model', async () => {
    await resetStorage()
    seedChannels({
      channels: [{
        id: 'ch',
        name: 'main',
        baseUrl: 'https://example.com',
        apiKey: 'key',
        models: [],
      }],
      settingsOverride: {
        channelId: 'ch',
        modelId: '',
      },
    })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('draw a cat')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(2))
    expect(mockCreateRun).not.toHaveBeenCalled()
    expect(result.current.queries.activeConversation?.messages[0]?.content).toBe('draw a cat')
    expect(result.current.queries.activeConversation?.title).toBe('draw a cat')
    expect(result.current.queries.activeConversation?.messages[1]?.content).toContain('当前还没有选择模型')
    expect(result.current.queries.activeConversation?.messages[1]?.actions).toEqual([
      expect.objectContaining({ type: 'select-model', label: '选择模型' }),
    ])
    expect(result.current.queries.draft).toBe('')
  })

  it('keeps new conversation title unchanged when auto-rename is disabled', async () => {
    await resetStorage()
    seedChannels({
      channels: [{
        id: 'ch',
        name: 'main',
        baseUrl: 'https://example.com',
        apiKey: 'key',
        models: [],
      }],
      settingsOverride: {
        channelId: 'ch',
        modelId: '',
      },
    })
    const first = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      first.result.current.commands.setAutoRenameConversationTitle(false)
      first.result.current.commands.setDraft('this title should not be auto renamed')
    })
    await act(async () => {
      await first.result.current.commands.sendDraft()
    })

    await waitFor(() => expect(first.result.current.queries.activeConversation?.messages).toHaveLength(2))
    const createdConversationId = first.result.current.queries.activeConversation?.id
    expect(createdConversationId).toBeTruthy()
    expect(first.result.current.queries.autoRenameConversationTitle).toBe(false)
    expect(first.result.current.queries.activeConversation?.title).toBe('未命名')

    first.unmount()
    const second = renderHook(() => useLegacyConversationControllerForTest())
    await waitFor(() =>
      expect(second.result.current.queries.summaries.some((item) => item.id === createdConversationId)).toBe(true),
    )
    expect(second.result.current.queries.autoRenameConversationTitle).toBe(false)
    expect(second.result.current.queries.summaries.find((item) => item.id === createdConversationId)?.title).toBe('未命名')
  })

  it('appends assistant guidance when model exists but api is not configured', async () => {
    await resetStorage()
    seedChannels({
      channels: [{
        id: 'ch',
        name: 'main',
        baseUrl: '',
        apiKey: '',
        models: ['model-a'],
      }],
      settingsOverride: {
        channelId: 'ch',
        modelId: 'model-a',
      },
    })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('draw a dog')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(2))
    expect(mockCreateRun).not.toHaveBeenCalled()
    expect(result.current.queries.activeConversation?.messages[1]?.content).toContain('还没有可用的 API 配置')
    expect(result.current.queries.activeConversation?.messages[1]?.actions).toEqual([
      expect.objectContaining({ type: 'add-api', label: '添加 API' }),
    ])
    expect(result.current.queries.draft).toBe('')
  })

  it('sends successfully after selecting api channel in a fresh conversation', async () => {
    await resetStorage()
    seedChannels({
      settingsOverride: {
        channelId: null,
        modelId: 'model-a',
      },
    })
    mockCreateRun.mockImplementation(async (input: { runId: string; createdAt: string; finalPrompt: string }) => ({
      id: input.runId,
      batchId: 'batch-selected-api',
      createdAt: input.createdAt,
      sideMode: 'single',
      side: 'single',
      prompt: input.finalPrompt,
      imageCount: 1,
      channelId: 'ch',
      channelName: 'main',
      modelId: 'model-a',
      modelName: 'model-a',
      templatePrompt: input.finalPrompt,
      finalPrompt: input.finalPrompt,
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
      images: [{ id: 'selected-api-image', seq: 1, status: 'success', threadState: 'settled', fileRef: '/ok.png' }],
    }))
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('draw with selected api')
    })

    await act(async () => {
      result.current.commands.updateSideSettings('single', { channelId: 'ch' })
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(mockCreateRun).toHaveBeenCalledTimes(1))
    expect(result.current.queries.activeConversation?.messages[1]?.content).not.toContain('还没有可用的 API 配置')
  })

  it('preserves the selected api channel when switching from single to compare mode', async () => {
    await resetStorage()
    seedChannels({
      settingsOverride: {
        channelId: 'ch',
        modelId: 'model-a',
      },
    })
    mockCreateRun.mockImplementation(async (input: { runId: string; createdAt: string; finalPrompt: string; side: string }) =>
      buildSuccessfulRunFromInput({
        runId: input.runId,
        createdAt: input.createdAt,
        sideMode: 'multi',
        side: input.side,
        channel: { id: 'ch', name: 'main' },
        modelId: 'model-a',
        modelName: 'model-a',
        templatePrompt: input.finalPrompt,
        finalPrompt: input.finalPrompt,
        settings: {
          resolution: '1K',
          aspectRatio: '1:1',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
        },
      }),
    )
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.updateSideMode('multi')
      result.current.commands.setDraft('compare prompt')
    })

    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(mockCreateRun).toHaveBeenCalledTimes(2))
    expect(result.current.queries.activeConversation?.messages[1]?.content).not.toContain('还没有可用的 API 配置')
  })

  it('syncs staged window settings across all compare-mode sides through controller commands', async () => {
    await resetStorage()
    seedChannels()
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.updateSideMode('multi')
    })

    await waitFor(() => {
      expect(result.current.queries.activeSideMode).toBe('multi')
      expect(result.current.queries.activeSettingsBySide['win-1']?.sizeMode).toBe('preset')
      expect(result.current.queries.activeSettingsBySide['win-2']?.sizeMode).toBe('preset')
    })

    act(() => {
      result.current.commands.updateSideSettings('win-2', { sizeMode: 'custom' })
    })

    await waitFor(() => {
      expect(result.current.queries.activeSettingsBySide['win-2']?.sizeMode).toBe('custom')
      const stagedSettings = JSON.parse(localStorage.getItem('m3:staged-settings') ?? '{}')
      expect(stagedSettings.settingsBySide?.['win-2']?.sizeMode).toBe('custom')
    })

    act(() => {
      result.current.commands.updateSidesSettings(['win-1', 'win-2'], { sizeMode: 'custom' })
    })

    await waitFor(() => {
      expect(result.current.queries.activeSettingsBySide.single?.sizeMode).toBe('custom')
      expect(result.current.queries.activeSettingsBySide['win-1']?.sizeMode).toBe('custom')
      expect(result.current.queries.activeSettingsBySide['win-2']?.sizeMode).toBe('custom')
      const stagedSettings = JSON.parse(localStorage.getItem('m3:staged-settings') ?? '{}')
      expect(stagedSettings.settingsBySide?.single?.sizeMode).toBe('custom')
      expect(stagedSettings.settingsBySide?.['win-1']?.sizeMode).toBe('custom')
      expect(stagedSettings.settingsBySide?.['win-2']?.sizeMode).toBe('custom')
    })
  })

  it('falls back to a configured api channel when compare mode sides have no explicit channel binding', async () => {
    await resetStorage()
    seedChannels({
      settingsOverride: {
        channelId: null,
        modelId: 'model-a',
      },
    })
    mockCreateRun.mockImplementation(async (input: { runId: string; createdAt: string; finalPrompt: string; side: string }) =>
      buildSuccessfulRunFromInput({
        runId: input.runId,
        createdAt: input.createdAt,
        sideMode: 'multi',
        side: input.side,
        channel: { id: 'ch', name: 'main' },
        modelId: 'model-a',
        modelName: 'model-a',
        templatePrompt: input.finalPrompt,
        finalPrompt: input.finalPrompt,
        settings: {
          resolution: '1K',
          aspectRatio: '1:1',
          imageCount: 1,
          gridColumns: 1,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
        },
      }),
    )
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.updateSideMode('multi')
      result.current.commands.setDraft('compare prompt with inferred channel')
    })

    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(mockCreateRun).toHaveBeenCalledTimes(2))
    expect(mockCreateRun).toHaveBeenCalledWith(expect.objectContaining({
      channel: expect.objectContaining({ id: 'ch', name: 'main' }),
    }))
    expect(result.current.queries.activeConversation?.messages[1]?.content).not.toContain('还没有可用的 API 配置')
  })

  it('clears draft source images right after message bubble is appended', async () => {
    let resolveRun!: () => void
    const deferred = new Promise<void>((resolve) => {
      resolveRun = resolve
    })

    mockCreateRun.mockImplementation((input: SuccessfulRunInput) =>
      deferred.then(() =>
        buildSuccessfulRunFromInput({
          runId: input.runId,
          createdAt: input.createdAt,
          sideMode: input.sideMode,
          side: input.side,
          channel: input.channel,
          modelId: input.modelId,
          modelName: input.modelName,
          templatePrompt: input.templatePrompt,
          finalPrompt: input.finalPrompt,
          variablesSnapshot: input.variablesSnapshot,
          paramsSnapshot: input.paramsSnapshot,
          settings: input.settings,
        }),
      ),
    )
    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    const file = new File(['ref-image'], 'ref.png', { type: 'image/png' })

    act(() => {
      result.current.commands.appendDraftSourceImages([file])
      result.current.commands.setDraft('draw a cat')
    })
    expect(result.current.queries.draftSourceImages).toHaveLength(1)

    act(() => {
      void result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(2))
    expect(result.current.queries.draftSourceImages).toHaveLength(0)
    expect(result.current.queries.activeConversation?.messages[0]?.sourceImages).toHaveLength(1)

    act(() => {
      resolveRun()
    })

    await waitFor(() =>
      expect(result.current.queries.activeConversation?.messages[1]?.runs?.[0]?.images[0]).toMatchObject({
        status: 'success',
        threadState: 'settled',
      }),
    )
  })

  it('streams assistant text in text generation mode without creating image runs', async () => {
    await resetStorage()
    seedChannels({
      settingsOverride: {
        generationMode: 'text',
        modelId: 'gpt-4o',
      },
    })

    mockStreamTextByProvider.mockImplementation(async (input: { onDelta: (chunk: string) => void }) => {
      input.onDelta('你好，')
      input.onDelta('我是流式回复。')
    })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('介绍一下你自己')
    })

    act(() => {
      void result.current.commands.sendDraft()
    })

    await waitFor(() => {
      const assistant = result.current.queries.activeConversation?.messages[1]
      expect(assistant?.role).toBe('assistant')
      expect(assistant?.content).toBe('你好，我是流式回复。')
      expect(assistant?.runs ?? []).toHaveLength(0)
    })

    expect(mockCreateRun).not.toHaveBeenCalled()
    expect(mockStreamTextByProvider).toHaveBeenCalledTimes(2)
  })

  it('splits temporary @model text switch notice and streamed reply into separate assistant bubbles', async () => {
    await resetStorage()
    seedChannels({
      settingsOverride: {
        generationMode: 'text',
        modelId: 'gpt-4o',
        textModelId: 'gpt-4o',
      },
    })
    const messageSuccessSpy = vi.spyOn(message, 'success').mockImplementation(() => {
      const close = () => {}
      return close as unknown as ReturnType<typeof message.success>
    })

    mockStreamTextByProvider.mockImplementation(async (input: {
      request: { modelId: string; messages: Array<{ role: string; content: string }> }
      onDelta: (chunk: string) => void
    }) => {
      const systemPrompt = input.request.messages.find((message) => message.role === 'system')?.content ?? ''
      if (systemPrompt.includes('对话标题生成器')) {
        input.onDelta('你是谁')
        return
      }

      expect(input.request.modelId).toBe('gpt-4o-mini')
      expect(input.request.messages[input.request.messages.length - 1]?.content).toBe('你是谁')
      input.onDelta('我是')
      input.onDelta(' gpt-4o-mini。')
    })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())
    const previousModelId = result.current.queries.activeSettingsBySide.single.modelId

    act(() => {
      result.current.commands.setDraft('@gpt-4o-mini 你是谁')
    })

    act(() => {
      void result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(3))
    expect(result.current.queries.activeConversation?.messages[0]?.content).toBe('@gpt-4o-mini 你是谁')
    expect(result.current.queries.activeConversation?.messages[1]?.content).toBe('已临时切换到 gpt-4o-mini（main） 执行本次文本请求。')
    expect(result.current.queries.activeConversation?.messages[2]?.content).toBe('我是 gpt-4o-mini。')
    expect(result.current.queries.activeConversation?.messages[2]?.runs ?? []).toHaveLength(0)
    expect(result.current.queries.activeSettingsBySide.single.modelId).toBe(previousModelId)
    expect(result.current.queries.activeSettingsBySide.single.textModelId).toBe(previousModelId)
    expect(messageSuccessSpy).toHaveBeenCalledWith('本次已临时切换到 gpt-4o-mini（main）')
    expect(mockCreateRun).not.toHaveBeenCalled()
  })

  it('generates new conversation title asynchronously with the configured title model', async () => {
    mockCreateRun.mockImplementation(async (input: SuccessfulRunInput) => buildSuccessfulRunFromInput({
      runId: input.runId,
      createdAt: input.createdAt,
      sideMode: input.sideMode,
      side: input.side,
      channel: input.channel,
      modelId: input.modelId,
      modelName: input.modelName,
      templatePrompt: input.templatePrompt,
      finalPrompt: input.finalPrompt,
      variablesSnapshot: input.variablesSnapshot,
      paramsSnapshot: input.paramsSnapshot,
      settings: input.settings,
    }))
    mockStreamTextByProvider.mockImplementation(async (input: { request: { messages: Array<{ role: string; content: string }> }; onDelta: (chunk: string) => void }) => {
      const systemPrompt = input.request.messages.find((message) => message.role === 'system')?.content ?? ''
      if (!systemPrompt.includes('对话标题生成器')) {
        return
      }
      input.onDelta('猫咪海报创意')
    })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('draw a cat wearing sunglasses on a poster')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(2))
    await waitFor(() => expect(result.current.queries.activeConversation?.title).toBe('猫咪海报创意'))
  })

  it('prefers the current send channel for title generation when multiple channels support the same model', async () => {
    await resetStorage()
    seedChannels({
      channels: [
        {
          id: 'ch-fallback',
          name: 'fallback',
          baseUrl: 'https://example.com',
          apiKey: 'key-a',
          models: ['gpt-4o-mini', 'model-a'],
        },
        {
          id: 'ch-preferred',
          name: 'preferred',
          baseUrl: 'https://example.com',
          apiKey: 'key-b',
          models: ['gpt-4o-mini', 'model-a'],
        },
      ],
      settingsOverride: {
        generationMode: 'text',
        channelId: 'ch-preferred',
        modelId: buildScopedModelId('ch-preferred', 'gpt-4o-mini'),
        textModelId: buildScopedModelId('ch-preferred', 'gpt-4o-mini'),
      },
    })

    mockStreamTextByProvider.mockImplementation(async (input: {
      channel: { id: string }
      request: { messages: Array<{ role: string; content: string }> }
      onDelta: (chunk: string) => void
    }) => {
      const systemPrompt = input.request.messages.find((message) => message.role === 'system')?.content ?? ''
      if (!systemPrompt.includes('对话标题生成器')) {
        input.onDelta('这里是正文回答')
        return
      }
      if (input.channel.id !== 'ch-preferred') {
        throw new Error(`unexpected title channel: ${input.channel.id}`)
      }
      input.onDelta('LLM 重写标题')
    })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('请帮我总结一下 React 19 和 React 18 的差异')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(2))
    await waitFor(() => expect(result.current.queries.activeConversation?.title).toBe('LLM 重写标题'))
  })


  it('falls back to first prompt summary when title model returns no text', async () => {
    mockCreateRun.mockImplementation(async (input: SuccessfulRunInput) => buildSuccessfulRunFromInput({
      runId: input.runId,
      createdAt: input.createdAt,
      sideMode: input.sideMode,
      side: input.side,
      channel: input.channel,
      modelId: input.modelId,
      modelName: input.modelName,
      templatePrompt: input.templatePrompt,
      finalPrompt: input.finalPrompt,
      variablesSnapshot: input.variablesSnapshot,
      paramsSnapshot: input.paramsSnapshot,
      settings: input.settings,
    }))
    mockStreamTextByProvider.mockImplementation(async () => {})
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('请介绍一下人工智能的发展历史和未来趋势')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(2))
    await waitFor(() => expect(result.current.queries.activeConversation?.title).toBe('请介绍一下人工智能的发展历史和未来趋势'))
  })

  it('does not overwrite a manual title when async title generation resolves later', async () => {
    mockCreateRun.mockImplementation(async (input: SuccessfulRunInput) => buildSuccessfulRunFromInput({
      runId: input.runId,
      createdAt: input.createdAt,
      sideMode: input.sideMode,
      side: input.side,
      channel: input.channel,
      modelId: input.modelId,
      modelName: input.modelName,
      templatePrompt: input.templatePrompt,
      finalPrompt: input.finalPrompt,
      variablesSnapshot: input.variablesSnapshot,
      paramsSnapshot: input.paramsSnapshot,
      settings: input.settings,
    }))

    let resolveTitleRequest: (() => void) | null = null
    mockStreamTextByProvider.mockImplementation(async (input: { request: { messages: Array<{ role: string; content: string }> }; onDelta: (chunk: string) => void }) => {
      const systemPrompt = input.request.messages.find((message) => message.role === 'system')?.content ?? ''
      if (!systemPrompt.includes('对话标题生成器')) {
        return
      }
      await new Promise<void>((resolve) => {
        resolveTitleRequest = () => {
          input.onDelta('自动标题')
          resolve()
        }
      })
    })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.setDraft('draw a cat')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(2))

    act(() => {
      result.current.commands.renameConversation(result.current.queries.activeConversation?.id ?? '', '手动标题')
    })
    await waitFor(() => expect(result.current.queries.activeConversation?.title).toBe('手动标题'))

    await act(async () => {
      resolveTitleRequest?.()
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.title).toBe('手动标题'))
  })

  it('persists the selected auto-rename title model across remounts', async () => {
    const first = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      first.result.current.commands.setAutoRenameConversationTitleModelId(buildScopedModelId('ch', 'gpt-4o-mini'))
    })

    expect(first.result.current.queries.autoRenameConversationTitleModelId).toBe(buildScopedModelId('ch', 'gpt-4o-mini'))

    first.unmount()
    const second = renderHook(() => useLegacyConversationControllerForTest())
    expect(second.result.current.queries.autoRenameConversationTitleModelId).toBe(buildScopedModelId('ch', 'gpt-4o-mini'))
  })

  it('persists favorite model ids in staged settings', async () => {
    const first = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      first.result.current.commands.setFavoriteModelIds([
        buildScopedModelId('ch', 'gpt-image-1'),
        buildScopedModelId('ch', 'gemini-2.5-flash-image'),
      ])
    })

    expect(first.result.current.queries.favoriteModelIds).toEqual([
      buildScopedModelId('ch', 'gpt-image-1'),
      buildScopedModelId('ch', 'gemini-2.5-flash-image'),
    ])
    first.unmount()

    const second = renderHook(() => useLegacyConversationControllerForTest())
    await waitFor(() => {
      expect(second.result.current.queries.favoriteModelIds).toEqual([
        buildScopedModelId('ch', 'gpt-image-1'),
        buildScopedModelId('ch', 'gemini-2.5-flash-image'),
      ])
    })
  })

  it('renames conversation title and persists after remount', async () => {
    await resetStorage()
    seedChannels()

    const conversation: Conversation = {
      id: 'rename-c1',
      title: '旧标题',
      titleMode: 'manual',
      pinnedAt: null,
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z',
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
          channelId: 'ch',
          modelId: 'model-a',
          paramValues: {},
        },
      },
      messages: [],
    }
    await seedConversation({ conversation })
    const first = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      first.result.current.commands.renameConversation('rename-c1', '  新标题  ')
    })

    await waitFor(() => {
      expect(first.result.current.queries.summaries.find((item) => item.id === 'rename-c1')?.title).toBe('新标题')
    })
    first.unmount()

    const second = renderHook(() => useLegacyConversationControllerForTest())
    await waitFor(() => {
      expect(second.result.current.queries.summaries.find((item) => item.id === 'rename-c1')?.title).toBe('新标题')
    })
  })

  it('keeps manual title after subsequent sends', async () => {
    await resetStorage()
    seedChannels({
      channels: [{
        id: 'ch',
        name: 'main',
        baseUrl: 'https://example.com',
        apiKey: 'key',
        models: [],
      }],
      settingsOverride: {
        channelId: 'ch',
        modelId: '',
      },
    })

    const conversation: Conversation = {
      id: 'manual-title-c1',
      title: '未命名',
      titleMode: 'default',
      pinnedAt: null,
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z',
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
          channelId: 'ch',
          modelId: '',
          paramValues: {},
        },
      },
      messages: [],
    }
    await seedConversation({ conversation })
    const { result } = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      result.current.commands.renameConversation('manual-title-c1', '手动标题')
    })
    await waitFor(() => {
      expect(result.current.queries.activeConversation?.title).toBe('手动标题')
    })

    act(() => {
      result.current.commands.setDraft('draw a cat')
    })
    await act(async () => {
      await result.current.commands.sendDraft()
    })

    await waitFor(() => expect(result.current.queries.activeConversation?.messages).toHaveLength(2))
    expect(result.current.queries.activeConversation?.title).toBe('手动标题')
  })

  it('toggles pin and keeps pinned conversation at top after remount', async () => {
    await resetStorage()
    seedChannels()
    const repo = createConversationRepository()

    const baseConversation = (id: string, title: string, updatedAt: string): Conversation => ({
      id,
      title,
      titleMode: 'manual',
      pinnedAt: null,
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt,
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
          channelId: 'ch',
          modelId: 'model-a',
          paramValues: {},
        },
      },
      messages: [],
    })

    await repo.saveConversation(baseConversation('pin-c1', '较旧', '2026-03-06T00:00:00.000Z'))
    await repo.saveConversation(baseConversation('pin-c2', '较新', '2026-03-07T00:00:00.000Z'))
    repo.saveIndex([
      {
        id: 'pin-c1',
        title: '较旧',
        pinnedAt: null,
        createdAt: '2026-03-06T00:00:00.000Z',
        updatedAt: '2026-03-06T00:00:00.000Z',
        lastMessagePreview: '',
      },
      {
        id: 'pin-c2',
        title: '较新',
        pinnedAt: null,
        createdAt: '2026-03-06T00:00:00.000Z',
        updatedAt: '2026-03-07T00:00:00.000Z',
        lastMessagePreview: '',
      },
    ])
    repo.saveActiveId('pin-c2')
    const first = renderHook(() => useLegacyConversationControllerForTest())

    act(() => {
      first.result.current.commands.togglePinConversation('pin-c1')
    })
    await waitFor(() => {
      expect(first.result.current.queries.summaries[0]?.id).toBe('pin-c1')
      expect(first.result.current.queries.summaries[0]?.pinnedAt).toBeTruthy()
    })
    first.unmount()

    const second = renderHook(() => useLegacyConversationControllerForTest())
    await waitFor(() => {
      expect(second.result.current.queries.summaries[0]?.id).toBe('pin-c1')
      expect(second.result.current.queries.summaries[0]?.pinnedAt).toBeTruthy()
    })
  })
})
