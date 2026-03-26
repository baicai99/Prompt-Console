import { describe, expect, it, vi } from 'vitest'
import type { MutableRefObject } from 'react'
import type { Conversation } from '../../../../../types/conversation'
import type { ConversationState } from '../../../state/conversationState'
import { buildRunLocationIndex } from '../../../application/queries/conversationIndexes'
import { createRunMutationModule } from './runMutation'
import { DEFAULT_LOGGING_SETTINGS } from '../../../../../utils/loggingSettings'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../../../../utils/imageRuntimeSettings'

function makeConversation(): Conversation {
  return {
    id: 'conv-1',
    title: 'Test',
    titleMode: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
        channelId: null,
        modelId: 'model-1',
        paramValues: {},
      },
    },
    tasksById: {
      'task-1': {
        taskId: 'task-1',
        runId: 'run-1',
        batchId: 'batch-1',
        side: 'single',
        seq: 1,
        finalPrompt: 'prompt',
        status: 'polling',
        providerTaskStatus: 'queued',
        createdAt: '2026-01-01T00:00:00.000Z',
        queuedAt: '2026-01-01T00:00:00.000Z',
        serverTaskId: 'server-task-1',
        serverTaskMeta: { resumeUrl: 'https://example.com/tasks/server-task-1' },
        threadState: 'active',
      },
    },
    messages: [{
      id: 'msg-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      role: 'assistant',
      content: 'pending',
      runs: [{
        id: 'run-1',
        batchId: 'batch-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        sideMode: 'single',
        side: 'single',
        prompt: 'prompt',
        imageCount: 1,
        channelId: 'channel-1',
        channelName: 'channel-1',
        modelId: 'model-1',
        modelName: 'Model 1',
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
        taskIds: ['task-1'],
        images: [{
          id: 'img-1',
          seq: 1,
          status: 'pending',
          threadState: 'active',
          serverTaskId: 'server-task-1',
          serverTaskMeta: { resumeUrl: 'https://example.com/tasks/server-task-1' },
        }],
      }],
    }],
  }
}

function makeStateRef(conversation: Conversation): MutableRefObject<ConversationState> {
  return {
    current: {
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
      dynamicPromptEnabled: false,
      autoRenameConversationTitle: false,
      autoRenameConversationTitleModelId: null,
      panelValueFormat: 'json',
      panelVariables: [],
      favoriteModelIds: [],
      runConcurrency: 1,
      runConcurrencyUnlimited: false,
      imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
      loggingSettings: DEFAULT_LOGGING_SETTINGS,
      stagedSideMode: 'single',
      stagedSideCount: 1,
      stagedSettingsBySide: conversation.settingsBySide,
      channels: [],
    },
  }
}

describe('runMutation', () => {
  it('does not downgrade polling tasks back to request sending when a pending image patch arrives', () => {
    const conversation = makeConversation()
    const stateRef = makeStateRef(conversation)
    const persistConversation = vi.fn((nextConversation: Conversation) => {
      stateRef.current.contents[nextConversation.id] = {
        ...nextConversation,
        tasksById: {
          ...(stateRef.current.runtimeTasksByConversationId[nextConversation.id] ?? nextConversation.tasksById ?? {}),
        },
      }
    })
    const upsertRuntimeTask = vi.fn((conversationId: string, task: NonNullable<Conversation['tasksById']>[string]) => {
      const nextTasks = {
        ...(stateRef.current.runtimeTasksByConversationId[conversationId] ?? {}),
        [task.taskId]: task,
      }
      stateRef.current.runtimeTasksByConversationId[conversationId] = nextTasks
      stateRef.current.contents[conversationId] = {
        ...stateRef.current.contents[conversationId]!,
        tasksById: nextTasks,
      }
    })
    const replaceRuntimeTasksForConversation = vi.fn((conversationId: string, tasksById: NonNullable<Conversation['tasksById']>) => {
      stateRef.current.runtimeTasksByConversationId[conversationId] = tasksById
      stateRef.current.contents[conversationId] = {
        ...stateRef.current.contents[conversationId]!,
        tasksById,
      }
    })

    const runMutation = createRunMutationModule({
      stateRef,
      runLocationByConversationRef: {
        current: { [conversation.id]: buildRunLocationIndex(conversation) },
      },
      upsertRuntimeTask,
      replaceRuntimeTasksForConversation,
      persistConversation,
      scheduleConversationPersistence: vi.fn(),
      notifyRunCompleted: vi.fn(),
    })

    runMutation.updateRunImageInConversation(conversation.id, {
      runId: 'run-1',
      seq: 1,
      status: 'pending',
    })

    const nextTask = stateRef.current.contents[conversation.id]?.tasksById?.['task-1']
    expect(nextTask?.status).toBe('polling')
    expect(nextTask?.serverTaskId).toBe('server-task-1')
    expect(nextTask?.serverTaskMeta).toEqual({ resumeUrl: 'https://example.com/tasks/server-task-1' })
  })

  it('keeps existing task handles when partial task updates omit them', () => {
    const conversation = makeConversation()
    const stateRef = makeStateRef(conversation)
    const persistConversation = vi.fn((nextConversation: Conversation) => {
      stateRef.current.contents[nextConversation.id] = {
        ...nextConversation,
        tasksById: {
          ...(stateRef.current.runtimeTasksByConversationId[nextConversation.id] ?? nextConversation.tasksById ?? {}),
        },
      }
    })
    const upsertRuntimeTask = vi.fn((conversationId: string, task: NonNullable<Conversation['tasksById']>[string]) => {
      const nextTasks = {
        ...(stateRef.current.runtimeTasksByConversationId[conversationId] ?? {}),
        [task.taskId]: task,
      }
      stateRef.current.runtimeTasksByConversationId[conversationId] = nextTasks
      stateRef.current.contents[conversationId] = {
        ...stateRef.current.contents[conversationId]!,
        tasksById: nextTasks,
      }
    })
    const replaceRuntimeTasksForConversation = vi.fn((conversationId: string, tasksById: NonNullable<Conversation['tasksById']>) => {
      stateRef.current.runtimeTasksByConversationId[conversationId] = tasksById
      stateRef.current.contents[conversationId] = {
        ...stateRef.current.contents[conversationId]!,
        tasksById,
      }
    })

    const runMutation = createRunMutationModule({
      stateRef,
      runLocationByConversationRef: {
        current: { [conversation.id]: buildRunLocationIndex(conversation) },
      },
      upsertRuntimeTask,
      replaceRuntimeTasksForConversation,
      persistConversation,
      scheduleConversationPersistence: vi.fn(),
      notifyRunCompleted: vi.fn(),
    })

    runMutation.updateImageTaskInConversation(conversation.id, {
      taskId: 'task-1',
      runId: 'run-1',
      seq: 1,
      status: 'running',
      providerTaskStatus: 'processing',
    })

    const nextTask = stateRef.current.contents[conversation.id]?.tasksById?.['task-1']
    expect(nextTask?.serverTaskId).toBe('server-task-1')
    expect(nextTask?.serverTaskMeta).toEqual({ resumeUrl: 'https://example.com/tasks/server-task-1' })
    expect(nextTask?.providerTaskStatus).toBe('processing')
  })

  it('mirrors queued, started, and completed timestamps onto the run image', () => {
    const conversation = makeConversation()
    const stateRef = makeStateRef(conversation)
    const persistConversation = vi.fn((nextConversation: Conversation) => {
      stateRef.current.contents[nextConversation.id] = {
        ...nextConversation,
        tasksById: {
          ...(stateRef.current.runtimeTasksByConversationId[nextConversation.id] ?? nextConversation.tasksById ?? {}),
        },
      }
    })
    const upsertRuntimeTask = vi.fn((conversationId: string, task: NonNullable<Conversation['tasksById']>[string]) => {
      const nextTasks = {
        ...(stateRef.current.runtimeTasksByConversationId[conversationId] ?? {}),
        [task.taskId]: task,
      }
      stateRef.current.runtimeTasksByConversationId[conversationId] = nextTasks
      stateRef.current.contents[conversationId] = {
        ...stateRef.current.contents[conversationId]!,
        tasksById: nextTasks,
      }
    })

    const runMutation = createRunMutationModule({
      stateRef,
      runLocationByConversationRef: {
        current: { [conversation.id]: buildRunLocationIndex(conversation) },
      },
      upsertRuntimeTask,
      replaceRuntimeTasksForConversation: vi.fn(),
      persistConversation,
      scheduleConversationPersistence: vi.fn(),
      notifyRunCompleted: vi.fn(),
    })

    runMutation.updateRunImageInConversation(conversation.id, {
      runId: 'run-1',
      seq: 1,
      status: 'pending',
      startedAt: '2026-01-01T00:00:03.000Z',
    })

    runMutation.updateRunImageInConversation(conversation.id, {
      runId: 'run-1',
      seq: 1,
      status: 'success',
      completedAt: '2026-01-01T00:00:08.000Z',
      fileRef: 'data:image/png;base64,AA==',
    })

    const nextRun = stateRef.current.contents[conversation.id]?.messages[0]?.runs?.[0]
    expect(nextRun?.images[0]).toMatchObject({
      queuedAt: '2026-01-01T00:00:00.000Z',
      startedAt: '2026-01-01T00:00:03.000Z',
      completedAt: '2026-01-01T00:00:08.000Z',
      status: 'success',
      fileRef: 'data:image/png;base64,AA==',
    })
  })
})
