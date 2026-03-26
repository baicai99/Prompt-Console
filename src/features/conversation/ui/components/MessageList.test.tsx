import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { message } from 'antd'
import { afterEach, vi } from 'vitest'
import { MessageList } from './MessageList'
import { summarizeRunPrompt } from './runPromptSummary'
import type { Conversation } from '../../../../types/conversation'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../../../utils/imageRuntimeSettings'

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeConversation(finalPrompts: string[] = ['template cat']): Conversation {
  const runs = finalPrompts.map((finalPrompt, index) => ({
    id: `r${index + 1}`,
    batchId: `b${index + 1}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    sideMode: 'single' as const,
    side: 'single',
    prompt: 'x',
    imageCount: 1,
    channelId: null,
    channelName: null,
    modelId: 'm',
    modelName: 'M',
    templatePrompt: 'template {{x}}',
    finalPrompt,
    variablesSnapshot: {},
    paramsSnapshot: {},
    settingsSnapshot: {
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount: 1,
      gridColumns: 1,
      sizeMode: 'preset' as const,
      customWidth: 1024,
      customHeight: 1024,
      autoSave: true,
    },
    retryAttempt: 0,
    images: [
      {
        id: `i${index + 1}`,
        seq: 1,
        status: 'failed' as const,
        errorCode: 'unknown' as const,
        error: index === 0 ? 'test failure reason' : 'another failure reason',
      },
    ],
  }))

  return {
    id: 'c1',
    title: 'T',
    titleMode: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
        autoSave: true,
        channelId: null,
        modelId: 'm',
        paramValues: {},
      },
    },
    messages: [
      {
        id: 'm1',
        createdAt: '2026-01-01T00:00:00.000Z',
        role: 'assistant',
        content: 'done',
        runs,
      },
    ],
  }
}

function makeUserConversation(
  content = 'user prompt content',
  sourceImages: Array<{ id: string; assetKey: string; fileName: string; mimeType: string; size: number }> = [],
): Conversation {
  return {
    id: 'c-user',
    title: 'User Conversation',
    titleMode: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
        autoSave: true,
        channelId: null,
        modelId: 'm',
        paramValues: {},
      },
    },
    messages: [
      {
        id: 'm-user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        role: 'user',
        content,
        sourceImages,
        runs: [],
      },
    ],
  }
}

function makeStreamingConversation(content = ''): Conversation {
  return {
    id: 'c-streaming',
    title: 'Streaming Conversation',
    titleMode: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
        autoSave: true,
        channelId: null,
        modelId: 'm',
        paramValues: {},
      },
    },
    messages: [
      {
        id: 'm-stream-user',
        createdAt: '2026-01-01T00:00:00.000Z',
        role: 'user',
        content: '@gpt-4o-mini 你是谁',
      },
      {
        id: 'm-stream-assistant',
        createdAt: '2026-01-01T00:00:01.000Z',
        role: 'assistant',
        content,
      },
    ],
  }
}

function makeMultiConversationWithSideOnlyRun(targetSide: string): Conversation {
  return {
    id: 'c-multi',
    title: 'Multi Conversation',
    titleMode: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sideMode: 'multi',
    sideCount: 2,
    settingsBySide: {
      side_1: {
        resolution: '1K',
        aspectRatio: '1:1',
        imageCount: 1,
        gridColumns: 1,
        sizeMode: 'preset',
        customWidth: 1024,
        customHeight: 1024,
        autoSave: true,
        channelId: null,
        modelId: 'm',
        paramValues: {},
      },
      side_2: {
        resolution: '1K',
        aspectRatio: '1:1',
        imageCount: 1,
        gridColumns: 1,
        sizeMode: 'preset',
        customWidth: 1024,
        customHeight: 1024,
        autoSave: true,
        channelId: null,
        modelId: 'm',
        paramValues: {},
      },
    },
    messages: [
      {
        id: 'm-side-only',
        createdAt: '2026-01-01T00:00:00.000Z',
        role: 'assistant',
        content: 'Replay request submitted. Click images to preview.',
        runs: [
          {
            id: 'r-side-only',
            batchId: 'b-side-only',
            createdAt: '2026-01-01T00:00:00.000Z',
            sideMode: 'multi',
            side: targetSide,
            prompt: 'p',
            imageCount: 1,
            channelId: null,
            channelName: null,
            modelId: 'm',
            modelName: 'M',
            templatePrompt: 'template',
            finalPrompt: 'final',
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
              autoSave: true,
            },
            retryAttempt: 0,
            images: [{ id: 'i-side-only', seq: 1, status: 'pending' }],
          },
        ],
      },
    ],
  }
}

function makeMultiConversationWithManyRunsAndImages(input: {
  targetSide: string
  runCount: number
  imageCount: number
}): Conversation {
  const { targetSide, runCount, imageCount } = input
  const runs = Array.from({ length: runCount }, (_, runIndex) => ({
    id: `r-many-${runIndex + 1}`,
    batchId: 'b-many',
    createdAt: '2026-01-01T00:00:00.000Z',
    sideMode: 'multi' as const,
    side: targetSide,
    prompt: `prompt-${runIndex + 1}`,
    imageCount,
    channelId: null,
    channelName: null,
    modelId: 'm',
    modelName: 'M',
    templatePrompt: `template-${runIndex + 1}`,
    finalPrompt: `final-${runIndex + 1}`,
    variablesSnapshot: {},
    paramsSnapshot: {},
    settingsSnapshot: {
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount,
      gridColumns: 4,
      sizeMode: 'preset' as const,
      customWidth: 1024,
      customHeight: 1024,
      autoSave: true,
    },
    retryAttempt: 0,
    images: Array.from({ length: imageCount }, (_, imageIndex) => ({
      id: `img-${runIndex + 1}-${imageIndex + 1}`,
      seq: imageIndex + 1,
      status: 'success' as const,
      fileRef: 'data:image/png;base64,AA==',
    })),
  }))

  return {
    id: 'c-many',
    title: 'Many Runs',
    titleMode: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sideMode: 'multi',
    sideCount: 2,
    settingsBySide: {
      side_1: {
        resolution: '1K',
        aspectRatio: '1:1',
        imageCount: 1,
        gridColumns: 1,
        sizeMode: 'preset',
        customWidth: 1024,
        customHeight: 1024,
        autoSave: true,
        channelId: null,
        modelId: 'm',
        paramValues: {},
      },
      side_2: {
        resolution: '1K',
        aspectRatio: '1:1',
        imageCount: 1,
        gridColumns: 1,
        sizeMode: 'preset',
        customWidth: 1024,
        customHeight: 1024,
        autoSave: true,
        channelId: null,
        modelId: 'm',
        paramValues: {},
      },
    },
    messages: [
      {
        id: 'm-many',
        createdAt: '2026-01-01T00:00:00.000Z',
        role: 'assistant',
        content: 'Replay request submitted. Click images to preview.',
        runs,
      },
    ],
  }
}

function makeSingleConversationWithManyRunsAndImages(input: {
  runCount: number
  imageCount: number
}): Conversation {
  const { runCount, imageCount } = input
  const runs = Array.from({ length: runCount }, (_, runIndex) => ({
    id: `r-single-many-${runIndex + 1}`,
    batchId: 'b-single-many',
    createdAt: '2026-01-01T00:00:00.000Z',
    sideMode: 'single' as const,
    side: 'single' as const,
    prompt: `prompt-${runIndex + 1}`,
    imageCount,
    channelId: null,
    channelName: null,
    modelId: 'm',
    modelName: 'M',
    templatePrompt: `template-${runIndex + 1}`,
    finalPrompt: `final-${runIndex + 1}`,
    variablesSnapshot: {},
    paramsSnapshot: {},
    settingsSnapshot: {
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount,
      gridColumns: 4,
      sizeMode: 'preset' as const,
      customWidth: 1024,
      customHeight: 1024,
      autoSave: true,
    },
    retryAttempt: 0,
    images: Array.from({ length: imageCount }, (_, imageIndex) => ({
      id: `single-img-${runIndex + 1}-${imageIndex + 1}`,
      seq: imageIndex + 1,
      status: 'success' as const,
      fileRef: 'data:image/png;base64,AA==',
    })),
  }))

  return {
    id: 'c-single-many',
    title: 'Many Single Runs',
    titleMode: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
        autoSave: true,
        channelId: null,
        modelId: 'm',
        paramValues: {},
      },
    },
    messages: [
      {
        id: 'm-single-many',
        createdAt: '2026-01-01T00:00:00.000Z',
        role: 'assistant',
        content: 'Replay request submitted. Click images to preview.',
        runs,
      },
    ],
  }
}

function makeLongConversation(messageCount: number): Conversation {
  return {
    id: 'c-long',
    title: 'Long Conversation',
    titleMode: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
        autoSave: true,
        channelId: null,
        modelId: 'm',
        paramValues: {},
      },
    },
    messages: Array.from({ length: messageCount }, (_, index) => ({
      id: `m-long-${index + 1}`,
      createdAt: '2026-01-01T00:00:00.000Z',
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `long message ${index + 1}`,
      runs: [],
    })),
  }
}

function makeHistoryNavigationConversation(promptCount: number): Conversation {
  return {
    id: 'c-history-nav',
    title: 'History Navigation',
    titleMode: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
        autoSave: true,
        channelId: null,
        modelId: 'm',
        paramValues: {},
      },
    },
    messages: Array.from({ length: promptCount * 2 }, (_, index) => {
      const sequence = Math.floor(index / 2) + 1
      return {
        id: index % 2 === 0 ? `m-nav-user-${sequence}` : `m-nav-assistant-${sequence}`,
        createdAt: '2026-01-01T00:00:00.000Z',
        role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: index % 2 === 0 ? `history prompt ${sequence}` : `assistant reply ${sequence}`,
        runs: [],
      }
    }),
  }
}

function createResizeObserverController() {
  const callbackByElement = new Map<Element, ResizeObserverCallback>()

  class ResizeObserverMock {
    private callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe(target: Element) {
      callbackByElement.set(target, this.callback)
    }

    unobserve(target: Element) {
      callbackByElement.delete(target)
    }

    disconnect() {
      for (const [target, callback] of callbackByElement.entries()) {
        if (callback === this.callback) {
          callbackByElement.delete(target)
        }
      }
    }
  }

  return {
    ResizeObserverMock,
    trigger(target: Element) {
      const callback = callbackByElement.get(target)
      if (!callback) {
        return
      }
      callback([{ target } as ResizeObserverEntry], {} as ResizeObserver)
    },
  }
}

describe('MessageList', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function installRafWithFakeTimers() {
    let frameTime = 0
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      return window.setTimeout(() => {
        frameTime += 16
        callback(frameTime)
      }, 16)
    })
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle: number) => {
      window.clearTimeout(handle)
    })

    return { requestAnimationFrameSpy, cancelAnimationFrameSpy }
  }

  it('renders pending image hints for server generation and resume states', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:40.000Z'))
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'p1',
            seq: 1,
            status: 'pending',
            pendingStartedAt: '2026-01-01T00:00:00.000Z',
            threadState: 'active',
            serverTaskId: 'task-1',
          },
        ],
      },
      {
        ...conversation.messages[0].runs![0],
        id: 'r2',
        images: [{ id: 'p2', seq: 1, status: 'pending', threadState: 'detached', serverTaskId: 'task-2', detachedAt: '2026-01-01T00:00:00.000Z' }],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          imageRuntimeSettings={{ ...DEFAULT_IMAGE_RUNTIME_SETTINGS, showRequestMethodBadge: true }}
        />
      </div>,
    )

    expect(screen.getByText('排队中 · 耗时 40s')).toBeInTheDocument()
    expect(screen.getByText('后台排队中')).toBeInTheDocument()
  })

  it('shows queued images as concurrency waiting instead of generating', () => {
    const conversation = makeConversation()
    conversation.tasksById = {
      'task-q1': {
        taskId: 'task-q1',
        runId: 'r1',
        batchId: 'b1',
        side: 'single',
        seq: 1,
        finalPrompt: 'template cat',
        status: 'queued',
        createdAt: '2026-01-01T00:00:00.000Z',
        queuedAt: '2026-01-01T00:00:00.000Z',
        threadState: 'active',
      },
    }
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        taskState: { status: 'waiting', updatedAt: '2026-01-01T00:00:00.000Z' },
        taskIds: ['task-q1'],
        images: [
          {
            id: 'queued-1',
            seq: 1,
            status: 'pending',
            threadState: 'active',
          },
        ],
      },
    ]

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          imageRuntimeSettings={{ ...DEFAULT_IMAGE_RUNTIME_SETTINGS, showRequestMethodBadge: true }}
        />
      </div>,
    )

    const runGrid = container.querySelector('.run-grid')
    expect(runGrid).not.toBeNull()
    expect(runGrid).toHaveTextContent('等待中')
    expect(screen.queryByText(/^生成中$/)).not.toBeInTheDocument()
  })

  it('shows polling images as result polling instead of generating', () => {
    const conversation = makeConversation()
    conversation.tasksById = {
      'task-p1': {
        taskId: 'task-p1',
        runId: 'r1',
        batchId: 'b1',
        side: 'single',
        seq: 1,
        finalPrompt: 'template cat',
        status: 'polling',
        providerTaskStatus: 'polling',
        createdAt: '2026-01-01T00:00:00.000Z',
        queuedAt: '2026-01-01T00:00:00.000Z',
        startedAt: '2026-01-01T00:00:05.000Z',
        threadState: 'active',
        resumeTransport: 'polling',
      },
    }
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        taskState: { status: 'generating', updatedAt: '2026-01-01T00:00:10.000Z' },
        taskIds: ['task-p1'],
        images: [
          {
            id: 'polling-1',
            seq: 1,
            status: 'pending',
            threadState: 'active',
            resumeTransport: 'polling',
            serverTaskId: 'server-1',
          },
        ],
      },
    ]

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          imageRuntimeSettings={{ ...DEFAULT_IMAGE_RUNTIME_SETTINGS, showRequestMethodBadge: true }}
        />
      </div>,
    )

    const runGrid = container.querySelector('.run-grid')
    expect(runGrid).not.toBeNull()
    expect(runGrid).toHaveTextContent('排队中')
    expect(runGrid).toHaveTextContent('轮询')
    expect(container.querySelector('.run-image-transport-overlay')).not.toBeNull()
  })

  it('resolves idb-backed generated images on demand and releases preview urls on unmount', async () => {
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'img-idb-1',
            seq: 1,
            status: 'success',
            refKind: 'idb-blob',
            refKey: 'asset:image-1',
          },
        ],
      },
    ]

    const cleanup = vi.fn()
    const resolveImagePreviewSource = vi.fn().mockResolvedValue({
      src: 'blob:generated-1',
      cleanup,
    })

    const view = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          resolveImagePreviewSource={resolveImagePreviewSource}
          imageRuntimeSettings={{ ...DEFAULT_IMAGE_RUNTIME_SETTINGS, showRequestMethodBadge: true }}
        />
      </div>,
    )

    await waitFor(() => {
      expect(screen.getByAltText('image-1')).toHaveAttribute('src', 'blob:generated-1')
    })

    expect(resolveImagePreviewSource).toHaveBeenCalledWith(
      expect.objectContaining({
        refKind: 'idb-blob',
        refKey: 'asset:image-1',
      }),
      undefined,
    )

    view.unmount()

    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('does not render transport summary text at run level', () => {
    const conversation = makeConversation()
    conversation.tasksById = {
      'task-s1': {
        taskId: 'task-s1',
        runId: 'r1',
        batchId: 'b1',
        side: 'single',
        seq: 1,
        finalPrompt: 'template cat',
        status: 'succeeded',
        createdAt: '2026-01-01T00:00:00.000Z',
        queuedAt: '2026-01-01T00:00:00.000Z',
        threadState: 'settled',
        resumeTransport: 'stream',
      },
      'task-s2': {
        taskId: 'task-s2',
        runId: 'r1',
        batchId: 'b1',
        side: 'single',
        seq: 2,
        finalPrompt: 'template cat',
        status: 'succeeded',
        createdAt: '2026-01-01T00:00:00.000Z',
        queuedAt: '2026-01-01T00:00:00.000Z',
        threadState: 'settled',
        resumeTransport: 'stream',
      },
      'task-p3': {
        taskId: 'task-p3',
        runId: 'r1',
        batchId: 'b1',
        side: 'single',
        seq: 3,
        finalPrompt: 'template cat',
        status: 'succeeded',
        createdAt: '2026-01-01T00:00:00.000Z',
        queuedAt: '2026-01-01T00:00:00.000Z',
        threadState: 'settled',
        resumeTransport: 'polling',
      },
    }
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        imageCount: 3,
        taskIds: ['task-s1', 'task-s2', 'task-p3'],
        images: [
          {
            id: 'img-1',
            seq: 1,
            status: 'success',
            threadState: 'settled',
            fileRef: 'https://img.example/1.png',
            resumeTransport: 'stream',
          },
          {
            id: 'img-2',
            seq: 2,
            status: 'success',
            threadState: 'settled',
            fileRef: 'https://img.example/2.png',
            resumeTransport: 'stream',
          },
          {
            id: 'img-3',
            seq: 3,
            status: 'success',
            threadState: 'settled',
            fileRef: 'https://img.example/3.png',
            resumeTransport: 'polling',
          },
        ],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          imageRuntimeSettings={{ ...DEFAULT_IMAGE_RUNTIME_SETTINGS, showRequestMethodBadge: true }}
        />
      </div>,
    )

    expect(screen.queryByText('恢复方式: 2 张链式传输 / 1 张轮询')).not.toBeInTheDocument()
  })

  it('shows direct request method on successful images without resume transport', () => {
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        taskIds: ['task-direct-1'],
        images: [
          {
            id: 'direct-1',
            seq: 1,
            status: 'success',
            threadState: 'settled',
            fileRef: 'https://img.example/direct-1.png',
          },
        ],
      },
    ]
    conversation.tasksById = {
      'task-direct-1': {
        taskId: 'task-direct-1',
        runId: 'r1',
        batchId: 'b1',
        side: 'single',
        seq: 1,
        finalPrompt: 'template cat',
        status: 'succeeded',
        createdAt: '2026-01-01T00:00:00.000Z',
        queuedAt: '2026-01-01T00:00:00.000Z',
        threadState: 'settled',
        fileRef: 'https://img.example/direct-1.png',
      },
    }

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          imageRuntimeSettings={{ ...DEFAULT_IMAGE_RUNTIME_SETTINGS, showRequestMethodBadge: true }}
        />
      </div>,
    )

    expect(screen.getByText('直连')).toBeInTheDocument()
  })

  it('keeps pending hints independent per image within the same run', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:02:20.000Z'))
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        imageCount: 2,
        settingsSnapshot: {
          ...conversation.messages[0].runs![0].settingsSnapshot,
          imageCount: 2,
          gridColumns: 2,
        },
        images: [
          {
            id: 'pending-fast',
            seq: 1,
            status: 'pending',
            pendingStartedAt: '2026-01-01T00:02:10.000Z',
            threadState: 'active',
            serverTaskId: 'task-fast',
          },
          {
            id: 'pending-slow',
            seq: 2,
            status: 'pending',
            pendingStartedAt: '2026-01-01T00:00:00.000Z',
            threadState: 'active',
            serverTaskId: 'task-slow',
          },
        ],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByText((text) => text.includes('耗时 10s'))).toBeInTheDocument()
    expect(screen.getAllByText((text) => text.includes('耗时 2m 20s')).length).toBeGreaterThan(0)
  })

  it('shows per-image elapsed time instead of request-sending copy', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:06.000Z'))
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'pending-submit',
            seq: 1,
            status: 'pending',
            pendingStartedAt: '2026-01-01T00:00:01.000Z',
            threadState: 'active',
          },
        ],
      },
    ]
    conversation.tasksById = {
      'task-submit': {
        taskId: 'task-submit',
        runId: 'r1',
        batchId: 'b1',
        side: 'single',
        seq: 1,
        finalPrompt: 'template cat',
        status: 'submitting',
        createdAt: '2026-01-01T00:00:01.000Z',
        queuedAt: '2026-01-01T00:00:01.000Z',
      },
    }

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByText('耗时 5s')).toBeInTheDocument()
    expect(screen.queryByText('请求发送中')).not.toBeInTheDocument()
  })

  it('renders retry-oriented timeout hint for failed images', () => {
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [{ id: 'f1', seq: 1, status: 'failed', errorCode: 'timeout', error: '图片生成超时，请重试' }],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getAllByText('已超时').length).toBeGreaterThan(0)
  })

  it('renders one aggregated assistant image bubble even when persisted live-feed entries exist', () => {
    const conversation = makeConversation()
    conversation.messages[0] = {
      ...conversation.messages[0],
      content: '已完成生成请求，点击图片可预览。',
      runs: [
        {
          ...conversation.messages[0].runs![0],
          id: 'run-aggregate',
          batchId: 'batch-aggregate',
          imageCount: 4,
          settingsSnapshot: {
            ...conversation.messages[0].runs![0].settingsSnapshot,
            imageCount: 4,
            gridColumns: 4,
          },
          images: Array.from({ length: 4 }, (_, index) => ({
            id: `run-image-${index + 1}`,
            seq: index + 1,
            status: 'success' as const,
            fileRef: `data:image/png;base64,AA${index}`,
            thumbRef: `data:image/png;base64,AA${index}`,
            fullRef: `data:image/png;base64,AA${index}`,
          })),
        },
      ],
      liveFeed: Array.from({ length: 4 }, (_, index) => ({
        id: `feed-${index + 1}`,
        taskId: `task-${index + 1}`,
        runId: 'run-aggregate',
        batchId: 'batch-aggregate',
        side: 'single',
        seq: index + 1,
        finalPrompt: 'template cat',
        status: 'succeeded' as const,
        completedAt: '2026-01-01T00:00:00.000Z',
        image: {
          id: `feed-image-${index + 1}`,
          seq: index + 1,
          status: 'success' as const,
          fileRef: `data:image/png;base64,BB${index}`,
          thumbRef: `data:image/png;base64,BB${index}`,
          fullRef: `data:image/png;base64,BB${index}`,
        },
      })),
    }

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(container.querySelectorAll('.message-card-shell.assistant')).toHaveLength(1)
    expect(screen.getAllByRole('img', { name: /image-/i })).toHaveLength(4)
    expect(screen.queryByRole('img', { name: /feed-/i })).not.toBeInTheDocument()
  })

  it('virtualizes long message lists instead of mounting every message node', async () => {
    const conversation = makeLongConversation(180)
    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          initialMessageLimit={180}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await waitFor(() => {
      const renderedNodes = container.querySelectorAll('[data-message-id]')
      expect(renderedNodes.length).toBeGreaterThan(0)
      expect(renderedNodes.length).toBeLessThan(180)
    })
  })

  it('hides run number when the assistant message has only one prompt', () => {
    const conversation = makeConversation(['only prompt'])
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        id: 'run-single',
        batchId: 'batch-single',
        images: [
          {
            id: 'run-single-image-1',
            seq: 1,
            status: 'success',
            fileRef: 'data:image/png;base64,AA0',
            thumbRef: 'data:image/png;base64,AA0',
            fullRef: 'data:image/png;base64,AA0',
          },
        ],
      },
    ]

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(container.querySelectorAll('.run-meta-title-fixed')).toHaveLength(0)
  })

  it('shows run numbers when the assistant message has multiple prompts', () => {
    const conversation = makeConversation(['first prompt', 'second prompt'])
    conversation.messages[0].runs = conversation.messages[0].runs!.map((run, index) => ({
      ...run,
      batchId: 'batch-shared',
      images: [
        {
          id: `run-multi-image-${index + 1}`,
          seq: 1,
          status: 'success' as const,
          fileRef: `data:image/png;base64,CC${index}`,
          thumbRef: `data:image/png;base64,CC${index}`,
          fullRef: `data:image/png;base64,CC${index}`,
        },
      ],
    }))

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const runNumberNodes = Array.from(container.querySelectorAll('.run-meta-title-fixed'))
    expect(runNumberNodes).toHaveLength(2)
    expect(runNumberNodes.map((node) => node.textContent?.trim())).toEqual(['1', '2'])
  })

  it('uses the submitted run aspect ratio for assistant images instead of forcing square', () => {
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        settingsSnapshot: {
          ...conversation.messages[0].runs![0].settingsSnapshot,
          aspectRatio: '16:9',
        },
        images: [
          {
            id: 'wide-image',
            seq: 1,
            status: 'success',
            fileRef: 'data:image/png;base64,AA==',
          },
        ],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByRole('img', { name: /image-1/i })).toHaveStyle({ aspectRatio: '16 / 9' })
  })

  it('renders assistant images inside the dedicated run image shell', () => {
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'shell-image',
            seq: 1,
            status: 'success',
            fileRef: 'data:image/png;base64,AA==',
          },
        ],
      },
    ]

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const image = screen.getByRole('img', { name: /image-1/i })
    expect(image.closest('button')).toHaveClass('run-image-button')
    expect(container.querySelector('.run-image-frame .run-image-button')).not.toBeNull()
  })

  it('uses human-friendly copy for upstream overload failures', () => {
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'f-overload-1',
            seq: 1,
            status: 'failed',
            errorCode: 'unknown',
            error: 'HTTP 500: {"message":"当前分组上游负载已饱和，请稍后再试"}',
          },
          {
            id: 'f-overload-2',
            seq: 2,
            status: 'failed',
            errorCode: 'unknown',
            error: 'HTTP 500: {"message":"当前分组上游负载已饱和，请稍后再试"}',
          },
          {
            id: 'f-overload-3',
            seq: 3,
            status: 'failed',
            errorCode: 'unknown',
            error: 'HTTP 500: {"message":"当前分组上游负载已饱和，请稍后再试"}',
          },
          {
            id: 'f-overload-4',
            seq: 4,
            status: 'failed',
            errorCode: 'unknown',
            error: 'HTTP 500: {"message":"当前分组上游负载已饱和，请稍后再试"}',
          },
        ],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.queryByText('当前生成请求较多，服务暂时繁忙。请稍后再试。')).not.toBeInTheDocument()
    expect(screen.queryByText('HTTP 500: {"message":"当前分组上游负载已饱和，请稍后再试"}')).not.toBeInTheDocument()
    expect(document.querySelector('.run-grid')).toHaveTextContent('服务繁忙：上游繁忙')
    expect(document.querySelector('.run-record')).toHaveTextContent('服务繁忙')
    expect(screen.getByRole('button', { name: /重试失败项/ })).toBeInTheDocument()
  })

  it('shows insufficient balance consistently across bubble, placeholder, and copied failure text', async () => {
    const user = userEvent.setup()
    const successSpy = vi.spyOn(message, 'success').mockImplementation(() => {
      return {} as never
    })
    const clipboardWrite = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    })

    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'f-balance-1',
            seq: 1,
            status: 'failed',
            errorCode: 'unknown',
            error: 'HTTP 402: {"message":"insufficient_quota, please recharge"}',
          },
        ],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(document.querySelector('.run-grid')).toHaveTextContent('余额不足')
    expect(document.querySelector('.run-record')).toHaveTextContent('余额不足')

    await user.click(screen.getByRole('button', { name: /复制报错与参数/ }))

    await waitFor(() => {
      expect(clipboardWrite).toHaveBeenCalledTimes(1)
    })

    const copiedText = clipboardWrite.mock.calls[0]?.[0] as string
    expect(copiedText).toContain('#1 | insufficient_balance | 余额不足')
    expect(successSpy).toHaveBeenCalledWith('已复制报错与生成参数')
  })

  it('shows product-style partial completion summary', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:02:20.000Z'))
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        createdAt: '2026-01-01T00:00:00.000Z',
        images: [
          { id: 'ok-1', seq: 1, status: 'success', fileRef: 'data:image/png;base64,AA==' },
          {
            id: 'pending-2',
            seq: 2,
            status: 'pending',
            pendingStartedAt: '2026-01-01T00:00:00.000Z',
            threadState: 'active',
            serverTaskId: 'task-2',
          },
        ],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByText('已完成 1 张，1 张排队中')).toBeInTheDocument()
  })

  it('escalates pending copy when waiting becomes very long', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:04:10.000Z'))
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        createdAt: '2026-01-01T00:00:00.000Z',
        images: [
          {
            id: 'pending-1',
            seq: 1,
            status: 'pending',
            pendingStartedAt: '2026-01-01T00:00:00.000Z',
            threadState: 'active',
            serverTaskId: 'task-1',
          },
        ],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByText('排队中 · 耗时 4m 10s')).toBeInTheDocument()
  })

  it('triggers replay/retry callbacks for run actions', async () => {
    const user = userEvent.setup()
    const onReplayRun = vi.fn()
    const onRetryRun = vi.fn()

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={onRetryRun}
          onReplayRun={onReplayRun}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /生成操作/ }))
    await user.click(screen.getByRole('menuitem', { name: /再来一次/ }))
    await user.click(screen.getByRole('button', { name: /重试失败项/ }))

    await waitFor(() => {
      expect(onReplayRun).toHaveBeenCalledWith('r1')
      expect(onRetryRun).toHaveBeenCalledWith('r1')
    })
  })

  it('shows copy failure button beside retry button for failed run', () => {
    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByRole('button', { name: /重试失败项/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /复制报错与参数/ })).toBeInTheDocument()
  })

  it('copies structured failure and params text via navigator clipboard', async () => {
    const user = userEvent.setup()
    const successSpy = vi.spyOn(message, 'success').mockImplementation(() => {
      return {} as never
    })
    const clipboardWrite = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    })
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        paramsSnapshot: { seed: 42, quality: 'high' },
        settingsSnapshot: {
          ...conversation.messages[0].runs![0].settingsSnapshot,
          gridColumns: 2,
        },
        images: [{ id: 'failed-1', seq: 1, status: 'failed', errorCode: 'timeout', error: '请求超时' }],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /复制报错与参数/ }))

    await waitFor(() => {
      expect(clipboardWrite).toHaveBeenCalledTimes(1)
    })

    const copiedText = clipboardWrite.mock.calls[0]?.[0] as string
    expect(copiedText).toContain('失败 Run 复现信息')
    expect(copiedText).toContain('失败信息:')
    expect(copiedText).toContain('#1 | timeout | 请求超时')
    expect(copiedText).toContain('生成参数(JSON):')
    expect(copiedText).toContain('"seed": 42')
    expect(copiedText).toContain('生成设置(JSON):')
    expect(copiedText).toContain('"gridColumns": 2')
    expect(successSpy).toHaveBeenCalledWith('已复制报错与生成参数')
  })

  it('falls back to execCommand copy when navigator clipboard is unavailable', async () => {
    const user = userEvent.setup()
    const successSpy = vi.spyOn(message, 'success').mockImplementation(() => {
      return {} as never
    })
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    const originalExecCommand = document.execCommand
    const execCommandMock = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommandMock,
    })

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /复制报错与参数/ }))

    await waitFor(() => {
      expect(execCommandMock).toHaveBeenCalledWith('copy')
      expect(successSpy).toHaveBeenCalledWith('已复制报错与生成参数')
    })

    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: originalExecCommand,
    })
  })

  it('shows copy failure toast when clipboard and fallback both fail', async () => {
    const user = userEvent.setup()
    const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => {
      return {} as never
    })
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('write denied')),
      },
    })
    const originalExecCommand = document.execCommand
    const execCommandMock = vi.fn().mockReturnValue(false)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommandMock,
    })

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /复制报错与参数/ }))

    await waitFor(() => {
      expect(execCommandMock).toHaveBeenCalledWith('copy')
      expect(errorSpy).toHaveBeenCalledWith('复制失败，请手动复制')
    })

    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: originalExecCommand,
    })
  })

  it('does not show copy button when run has no failed images', () => {
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [{ id: 's1', seq: 1, status: 'success', fileRef: 'data:image/png;base64,AA==' }],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.queryByRole('button', { name: /复制报错与参数/ })).not.toBeInTheDocument()
  })

  it('retries all failed runs without waiting previous run to finish', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<void>()
    const onRetryRun = vi.fn((runId: string) => {
      if (runId === 'r1') {
        return deferred.promise
      }
      return Promise.resolve()
    })

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation(['first failed', 'second failed'])}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={onRetryRun}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /生成操作/ }))
    await user.click(screen.getByRole('menuitem', { name: /重试所有失败项/ }))

    await waitFor(() => {
      expect(onRetryRun).toHaveBeenCalledTimes(2)
      expect(onRetryRun.mock.calls[0]?.[0]).toBe('r1')
      expect(onRetryRun.mock.calls[1]?.[0]).toBe('r2')
    })
  })

  it('disables replay button while run is replaying', () => {
    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          replayingRunIds={['r1']}
        />
      </div>,
    )

    expect(screen.getByRole('button', { name: /生成操作/ })).toBeInTheDocument()
  })

  it('triggers download-all callback', async () => {
    const user = userEvent.setup()
    const onDownloadAllRun = vi.fn()
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [{ id: 's1', seq: 1, status: 'success', fileRef: 'data:image/png;base64,AA==' }],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          onDownloadAllRun={onDownloadAllRun}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /下载全部/ }))
    await waitFor(() => {
      expect(onDownloadAllRun).toHaveBeenCalledWith('r1')
    })
  })

  it('shows loading state while downloading message images', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<void>()
    const onDownloadMessageImages = vi.fn(() => deferred.promise)
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [{ id: 's1', seq: 1, status: 'success', fileRef: 'data:image/png;base64,AA==' }],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          onDownloadMessageImages={onDownloadMessageImages}
        />
      </div>,
    )

    const button = screen.getByRole('button', { name: /下载全部/ })
    await user.click(button)

    await waitFor(() => {
      expect(onDownloadMessageImages).toHaveBeenCalledWith(['r1'])
      expect(button).toBeDisabled()
    })

    deferred.resolve()
    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })
  })

  it('disables download-all when the run uses url response format', () => {
    const onDownloadAllRun = vi.fn()
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        paramsSnapshot: { responseFormat: 'url' },
        images: [{ id: 's1', seq: 1, status: 'success', fileRef: 'https://img.example/a.png' }],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          onDownloadAllRun={onDownloadAllRun}
        />
      </div>,
    )

    expect(screen.getByRole('button', { name: /下载全部/ })).toBeDisabled()
    expect(onDownloadAllRun).not.toHaveBeenCalled()
  })

  it('uses compact assistant card layout in single view', () => {
    const conversation = makeSingleConversationWithManyRunsAndImages({
      runCount: 1,
      imageCount: 1,
    })

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.queryByRole('button', { name: /下载这张/ })).not.toBeInTheDocument()
    expect(container.querySelector('.message-card.assistant.assistant-compact')).not.toBeNull()
    expect(container.querySelector('.run-record-compact')).not.toBeNull()
  })

  it('shows failure reason under summary, not inside image placeholder', () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.queryByText('test failure reason')).not.toBeInTheDocument()
    expect(container.querySelector('.run-record')).toHaveTextContent('请求失败')
    const runGrid = container.querySelector('.run-grid')
    expect(runGrid).not.toBeNull()
    expect(runGrid).not.toHaveTextContent('test failure reason')
  })

  it('shows waiting-to-retry text inside failed image placeholder when another round is pending', () => {
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'timeout-1',
            seq: 1,
            status: 'failed',
            errorCode: 'timeout',
            error: '第1轮超时，图片已标记超时，正在等待第2轮（60s）',
          },
        ],
      },
    ]

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const runGrid = container.querySelector('.run-grid')
    expect(runGrid).not.toBeNull()
    expect(runGrid).toHaveTextContent('等待重试')
    expect(container.querySelector('.run-image-placeholder.is-retry-waiting')).not.toBeNull()
    expect(container.querySelector('.run-image-skeleton-label')).not.toBeNull()
  })

  it('shows waiting-to-retry text for timeout images that are queued for another round', () => {
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'retry-wait-1',
            seq: 1,
            status: 'failed',
            errorCode: 'timeout',
            error: '第1轮超时，图片已标记超时，正在等待第2轮（60s）',
          },
        ],
      },
    ]

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const runGrid = container.querySelector('.run-grid')
    expect(runGrid).not.toBeNull()
    expect(runGrid).toHaveTextContent('等待重试')
    expect(container.querySelector('.run-image-placeholder.is-retry-waiting')).not.toBeNull()
  })

  it('shows cancelled text for cancelled runs', () => {
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        taskState: {
          status: 'cancelled',
          updatedAt: '2026-01-01T00:00:00.000Z',
          completedAt: '2026-01-01T00:00:00.000Z',
          reason: 'message-aborted',
        },
        images: [
          {
            id: 'cancelled-1',
            seq: 1,
            status: 'failed',
            errorCode: 'unknown',
            error: '图片生成已中断',
          },
        ],
      },
    ]

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(container.querySelector('.run-image-placeholder.is-cancelled')).not.toBeNull()
    expect(screen.getAllByText('已取消').length).toBeGreaterThan(0)
  })

  it('shows final prompt summary in run title', () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation(['template cat'])}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(container.querySelector('.run-meta-title-fixed')).toBeNull()
    expect(screen.getByText('template cat')).toBeInTheDocument()
    expect(container.querySelector('.run-meta-compact-main')).not.toBeNull()
    expect(container.querySelector('.run-meta-inline-actions')).not.toBeNull()
  })

  it('does not show completed run elapsed time in the assistant bubble', () => {
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'success-1',
            seq: 1,
            status: 'success',
          },
        ],
        taskState: {
          status: 'completed',
          updatedAt: '2026-01-01T00:00:03.500Z',
          waitingStartedAt: '2026-01-01T00:00:00.000Z',
          generatingStartedAt: '2026-01-01T00:00:01.000Z',
          completedAt: '2026-01-01T00:00:03.500Z',
        },
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.queryByText('耗时 3s')).not.toBeInTheDocument()
  })

  it('keeps pending image elapsed text without rendering a separate run elapsed line', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:06.000Z'))

    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'pending-1',
            seq: 1,
            status: 'pending',
            pendingStartedAt: '2026-01-01T00:00:01.000Z',
            threadState: 'active',
          },
        ],
        taskState: {
          status: 'generating',
          updatedAt: '2026-01-01T00:00:06.000Z',
          generatingStartedAt: '2026-01-01T00:00:01.000Z',
        },
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getAllByText('耗时 5s')).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getAllByText('耗时 6s')).toHaveLength(1)
  })

  it('shows single-image download button and elapsed badge on hover', async () => {
    const user = userEvent.setup()
    const onDownloadSingleImage = vi.fn()
    const conversation = makeConversation()
    conversation.tasksById = {
      'task-1': {
        taskId: 'task-1',
        runId: 'r1',
        batchId: 'b1',
        side: 'single',
        seq: 1,
        finalPrompt: 'template cat',
        status: 'succeeded',
        createdAt: '2026-01-01T00:00:00.000Z',
        queuedAt: '2026-01-01T00:00:00.000Z',
        startedAt: '2026-01-01T00:00:01.000Z',
        completedAt: '2026-01-01T00:00:03.500Z',
        threadState: 'settled',
        fileRef: 'data:image/png;base64,AA==',
      },
    }
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'success-1',
            seq: 1,
            status: 'success',
            fileRef: 'data:image/png;base64,AA==',
          },
        ],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          onDownloadSingleImage={onDownloadSingleImage}
        />
      </div>,
    )

    expect(screen.queryByRole('button', { name: '下载' })).not.toBeInTheDocument()
    const frame = document.querySelector('.run-image-frame')
    expect(frame).not.toBeNull()

    await user.hover(frame as Element)

    expect(within(frame as HTMLElement).getByRole('button', { name: /下载/ })).toBeInTheDocument()
    expect(screen.getByText('耗时 3s')).toBeInTheDocument()

    fireEvent.click(within(frame as HTMLElement).getByRole('button', { name: /下载/ }))

    await waitFor(() => {
      expect(onDownloadSingleImage).toHaveBeenCalledWith('r1', 'success-1')
    })
  })

  it('shows per-image elapsed fallback for successful images without settled task records', async () => {
    const user = userEvent.setup()
    const conversation = makeConversation()
    conversation.tasksById = undefined
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'success-with-image-timing',
            seq: 1,
            status: 'success',
            fileRef: 'data:image/png;base64,AA==',
            queuedAt: '2026-01-01T00:00:00.000Z',
            startedAt: '2026-01-01T00:00:02.000Z',
            completedAt: '2026-01-01T00:00:05.100Z',
          },
          {
            id: 'success-with-image-timing-2',
            seq: 2,
            status: 'success',
            fileRef: 'data:image/png;base64,AA==',
            queuedAt: '2026-01-01T00:00:00.000Z',
            startedAt: '2026-01-01T00:00:04.000Z',
            completedAt: '2026-01-01T00:00:10.400Z',
          },
        ],
        imageCount: 2,
        settingsSnapshot: {
          ...conversation.messages[0].runs![0].settingsSnapshot,
          imageCount: 2,
          gridColumns: 2,
        },
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const frames = Array.from(document.querySelectorAll('.run-image-frame'))
    await user.hover(frames[0] as Element)
    expect(screen.getByText('耗时 3s')).toBeInTheDocument()

    await user.unhover(frames[0] as Element)
    await user.hover(frames[1] as Element)
    expect(screen.getByText('耗时 6s')).toBeInTheDocument()
  })

  it('blurs the clicked assistant image button after opening preview', async () => {
    const user = userEvent.setup()
    const onOpenPreview = vi.fn()
    const conversation = makeConversation()
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        images: [
          {
            id: 'success-1',
            seq: 1,
            status: 'success',
            fileRef: 'data:image/png;base64,AA==',
          },
        ],
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={onOpenPreview}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const imageButton = document.querySelector<HTMLButtonElement>('.run-image-frame .run-image-button')
    expect(imageButton).not.toBeNull()

    await user.click(imageButton as HTMLButtonElement)

    expect(onOpenPreview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r1' }),
      'success-1',
      undefined,
    )
    expect(imageButton).not.toHaveFocus()
  })

  it('renders assistant message actions outside the bubble footer area', () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation(['template cat'])}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(container.querySelector('.assistant-message-topbar .assistant-message-toolbar')).toBeNull()
    expect(container.querySelector('.message-card.assistant .assistant-message-outside-actions')).toBeNull()
    expect(container.querySelector('.message-card-shell.assistant > .assistant-message-outside-actions .message-bottom-actions')).not.toBeNull()
  })

  it('renders long prompt summary in run title and can toggle full prompt', async () => {
    const user = userEvent.setup()
    const longPrompt = `template ${'x'.repeat(150)}`
    const summary = summarizeRunPrompt(longPrompt)

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation([longPrompt])}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByText(summary)).toBeInTheDocument()
    expect(screen.queryByText(longPrompt)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看完整提示词' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制提示词' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '查看完整提示词' }))

    await waitFor(() => {
      expect(screen.getByText((text) => text === longPrompt)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '收起提示词' })).toBeInTheDocument()
    })
  })

  it('keeps long mixed prompt content within run containers after expansion', async () => {
    const user = userEvent.setup()
    const longPrompt = `办公空间氛围，${'superlongrunpromptwithoutspaces'.repeat(8)}，柔和木色与浅灰墙面，${'ABCDEF'.repeat(20)}`
    const summary = summarizeRunPrompt(longPrompt)

    const { container } = render(
      <div style={{ height: 600, width: 320 }}>
        <MessageList
          activeConversation={makeConversation([longPrompt])}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const promptNode = container.querySelector('.run-meta-title-prompt')
    const compactMetaNode = container.querySelector('.run-meta-compact')
    const collapseNode = container.querySelector('.run-meta-collapse')

    expect(promptNode).not.toBeNull()
    expect(promptNode).toHaveTextContent(summary)
    expect(promptNode).toHaveClass('run-meta-title-prompt')
    expect(compactMetaNode).not.toBeNull()
    expect(compactMetaNode).toHaveClass('run-meta-compact')
    expect(collapseNode).toBeNull()

    await user.click(screen.getByRole('button', { name: '查看完整提示词' }))

    await waitFor(() => {
      expect(screen.getByText((text) => text === longPrompt)).toBeInTheDocument()
      expect(container.querySelector('.run-prompt-expanded')).not.toBeNull()
    })
  })

  it('copies the full run prompt from compact prompt actions', async () => {
    const user = userEvent.setup()
    const clipboardWrite = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    })
    const successSpy = vi.spyOn(message, 'success').mockImplementation(() => {
      return {} as never
    })
    const longPrompt = `template ${'copy-me '.repeat(24).trim()}`

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation([longPrompt])}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '复制提示词' }))

    await waitFor(() => {
      expect(clipboardWrite).toHaveBeenCalledWith(longPrompt)
    })
    expect(successSpy).toHaveBeenCalledWith('已复制 Prompt')
  })

  it('renders distinct prompt titles for multiple runs', () => {
    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation(['prompt one', 'prompt two'])}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('prompt one')).toBeInTheDocument()
    expect(screen.getByText('prompt two')).toBeInTheDocument()
  })

  it('shows batch-download button for dynamic multi-loop runs', () => {
    const conversation = makeConversation(['prompt one', 'prompt two'])
    conversation.messages[0].runs = conversation.messages[0].runs!.map((run) => ({
      ...run,
      batchId: 'same-batch',
      variablesSnapshot: { subject: 'cat' },
      images: [{ id: `${run.id}-img`, seq: 1, status: 'success' as const, fileRef: 'data:image/png;base64,AA==' }],
    }))

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          onDownloadBatchRun={() => {}}
        />
      </div>,
    )

    const buttons = screen.getAllByRole('button', { name: /下载这一批次/ })
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('sends user prompt text back via callback', async () => {
    const user = userEvent.setup()
    const onUseUserPrompt = vi.fn()
    const prompt = 'user prompt content'

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeUserConversation(prompt)}
          sideView="single"
          onOpenPreview={() => {}}
          onUseUserPrompt={onUseUserPrompt}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /发送到输入框/ }))
    expect(onUseUserPrompt).toHaveBeenCalledWith(prompt)
  })

  it('shows copy button beside reuse action for user messages', () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeUserConversation('user prompt content')}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByRole('button', { name: /发送到输入框/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /复制/ })).toBeInTheDocument()
    expect(container.querySelector('.user-message-topbar .user-message-actions')).toBeNull()
    expect(container.querySelector('.message-card-shell.user > .user-message-outside-actions .user-message-actions')).not.toBeNull()
  })

  it('copies user message content via navigator clipboard', async () => {
    const user = userEvent.setup()
    const successSpy = vi.spyOn(message, 'success').mockImplementation(() => {
      return {} as never
    })
    const clipboardWrite = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    })

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeUserConversation('copy this user prompt')}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /^复制$/ }))

    await waitFor(() => {
      expect(clipboardWrite).toHaveBeenCalledTimes(1)
    })

    expect(clipboardWrite).toHaveBeenCalledWith('copy this user prompt')
    expect(successSpy).toHaveBeenCalledWith('已复制内容')
  })

  it('falls back to execCommand when copying user message without navigator clipboard', async () => {
    const user = userEvent.setup()
    const successSpy = vi.spyOn(message, 'success').mockImplementation(() => {
      return {} as never
    })
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    const originalExecCommand = document.execCommand
    const execCommandMock = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommandMock,
    })

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeUserConversation('copy fallback prompt')}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /^复制$/ }))

    await waitFor(() => {
      expect(execCommandMock).toHaveBeenCalledWith('copy')
      expect(successSpy).toHaveBeenCalledWith('已复制内容')
    })

    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: originalExecCommand,
    })
  })

  it('shows copy failure toast when user message copy fails', async () => {
    const user = userEvent.setup()
    const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => {
      return {} as never
    })
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('write denied')),
      },
    })
    const originalExecCommand = document.execCommand
    const execCommandMock = vi.fn().mockReturnValue(false)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommandMock,
    })

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeUserConversation('copy failure prompt')}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /^复制$/ }))

    await waitFor(() => {
      expect(execCommandMock).toHaveBeenCalledWith('copy')
      expect(errorSpy).toHaveBeenCalledWith('复制失败，请手动复制')
    })

    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: originalExecCommand,
    })
  })

  it('disables user copy button when message text is blank', () => {
    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeUserConversation('   ')}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByRole('button', { name: /^复制$/ })).toBeDisabled()
  })

  it('renders user source image preview inside user bubble', async () => {
    const cleanup = vi.fn()
    const resolveImagePreviewSource = vi.fn().mockResolvedValue({
      src: 'blob:user-source',
      cleanup,
    })
    const conversation = makeUserConversation('user with image', [
      {
        id: 'source-1',
        assetKey: 'source:key:1',
        fileName: 'ref.png',
        mimeType: 'image/png',
        size: 3,
      },
    ])

    const { unmount } = render(
      <MessageList
        activeConversation={conversation}
        sideView="single"
        onOpenPreview={vi.fn()}
        onRetryRun={vi.fn()}
        onReplayRun={vi.fn()}
        resolveImagePreviewSource={resolveImagePreviewSource}
      />,
    )

    const previewImage = await screen.findByRole('img', { name: 'ref.png' })
    expect(previewImage).toHaveAttribute('src', 'blob:user-source')
    expect(resolveImagePreviewSource).toHaveBeenCalledWith(
      expect.objectContaining({ refKind: 'idb-blob', refKey: 'source:key:1' }),
      undefined,
    )
    const textNode = screen.getByText('user with image')
    const order = previewImage.compareDocumentPosition(textNode)
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    unmount()
    expect(cleanup).toHaveBeenCalled()
  })

  it('releases previous user source preview URLs when the visible message window changes', async () => {
    const cleanupFirst = vi.fn()
    const cleanupSecond = vi.fn()
    const resolveImagePreviewSource = vi.fn().mockImplementation(async (source: { refKey?: string }) => {
      if (source.refKey === 'source:key:2') {
        return {
          src: 'blob:user-source-2',
          cleanup: cleanupSecond,
        }
      }

      return {
        src: 'blob:user-source-1',
        cleanup: cleanupFirst,
      }
    })

    const conversation = {
      ...makeUserConversation('latest user with image', [
        {
          id: 'source-2',
          assetKey: 'source:key:2',
          fileName: 'ref-2.png',
          mimeType: 'image/png',
          size: 3,
        },
      ]),
      messages: [
        {
          id: 'm-user-older',
          createdAt: '2026-01-01T00:00:00.000Z',
          role: 'user' as const,
          content: 'older user with image',
          sourceImages: [
            {
              id: 'source-1',
              assetKey: 'source:key:1',
              fileName: 'ref-1.png',
              mimeType: 'image/png',
              size: 3,
            },
          ],
        },
        ...makeUserConversation('latest user with image', [
          {
            id: 'source-2',
            assetKey: 'source:key:2',
            fileName: 'ref-2.png',
            mimeType: 'image/png',
            size: 3,
          },
        ]).messages,
      ],
    }

    const { rerender } = render(
      <MessageList
        activeConversation={conversation}
        sideView="single"
        initialMessageLimit={1}
        onOpenPreview={vi.fn()}
        onRetryRun={vi.fn()}
        onReplayRun={vi.fn()}
        resolveImagePreviewSource={resolveImagePreviewSource}
      />,
    )

    expect(await screen.findByRole('img', { name: 'ref-2.png' })).toHaveAttribute('src', 'blob:user-source-2')

    rerender(
      <MessageList
        activeConversation={conversation}
        sideView="single"
        initialMessageLimit={2}
        onOpenPreview={vi.fn()}
        onRetryRun={vi.fn()}
        onReplayRun={vi.fn()}
        resolveImagePreviewSource={resolveImagePreviewSource}
      />,
    )

    expect(await screen.findByRole('img', { name: 'ref-1.png' })).toHaveAttribute('src', 'blob:user-source-1')
    expect(cleanupSecond).toHaveBeenCalled()
    expect(resolveImagePreviewSource).toHaveBeenCalledWith(
      expect.objectContaining({ refKey: 'source:key:1' }),
      undefined,
    )
  })

  it('strips trailing run-count suffix when sending prompt back to input', async () => {
    const user = userEvent.setup()
    const onUseUserPrompt = vi.fn()
    const prompt = 'cinematic portrait, soft light (11 runs)'

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeUserConversation(prompt)}
          sideView="single"
          onOpenPreview={() => {}}
          onUseUserPrompt={onUseUserPrompt}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /发送到输入框/ }))
    expect(onUseUserPrompt).toHaveBeenCalledWith('cinematic portrait, soft light')
  })
  it('hides assistant messages that have no run for current multi side', () => {
    const conversation = makeMultiConversationWithSideOnlyRun('side_2')
    const { rerender } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="side_1"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.queryByText('Replay request submitted. Click images to preview.')).not.toBeInTheDocument()

    rerender(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="side_2"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByText('Replay request submitted. Click images to preview.')).toBeInTheDocument()
  })

  it('does not schedule scroll frame updates when windowing is inactive and bottom callback is absent', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const viewport = container.querySelector('.message-list-viewport') as HTMLDivElement
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 180, writable: true })
    fireEvent.scroll(viewport)

    expect(rafSpy).not.toHaveBeenCalled()
    rafSpy.mockRestore()
  })

  it('keeps near-bottom callback behavior after scroll optimization', () => {
    const onReachBottom = vi.fn()
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          onReachBottom={onReachBottom}
        />
      </div>,
    )

    const viewport = container.querySelector('.message-list-viewport') as HTMLDivElement
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 800 })
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 190, writable: true })
    fireEvent.scroll(viewport)

    expect(onReachBottom).toHaveBeenCalledTimes(1)
    rafSpy.mockRestore()
  })

  it('shows parameter modal for assistant message without removing run card', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation(['portrait of a girl'])}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(container.querySelector('.run-meta-title-fixed')).toBeNull()
    await user.click(screen.getByRole('button', { name: /显示参数/ }))

    expect(await screen.findByText('生成参数')).toBeInTheDocument()
    expect(await screen.findByText('Run #1')).toBeInTheDocument()
    expect(await screen.findByText(/模型 ID: m/)).toBeInTheDocument()
    expect(screen.getByText(/请求地址: 未记录/)).toBeInTheDocument()
    expect(screen.getByText(/最终 prompt: portrait of a girl/)).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'b1' })).toBeInTheDocument()
    expect(screen.getByText('基础信息')).toBeInTheDocument()
    expect(screen.getByText('Prompt 信息')).toBeInTheDocument()
    expect(screen.getByText('生成设置')).toBeInTheDocument()
  })

  it('shows one selected run detail at a time in multi-run parameter modal', async () => {
    const user = userEvent.setup()

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation(['first prompt', 'second prompt'])}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /显示参数/ }))

    expect(await screen.findByRole('tab', { name: /Run #1/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Run #2/ })).toBeInTheDocument()
    expect(screen.getByText('最终 prompt: first prompt')).toBeInTheDocument()
    expect(screen.queryByText('最终 prompt: second prompt')).not.toBeInTheDocument()
    expect(screen.queryByText('模型 ID: m')).not.toBeInTheDocument()
    expect(screen.getByText('Prompt 信息')).toBeInTheDocument()
    expect(screen.queryByText('参数: 无')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Run #2/ }))
    const activePanel = screen
      .getAllByRole('tabpanel', { hidden: true })
      .find((panel) => panel.getAttribute('aria-hidden') !== 'true')

    expect(activePanel).toBeDefined()
    expect(await within(activePanel as HTMLElement).findByText('最终 prompt: second prompt')).toBeVisible()
    expect(screen.getAllByText('最终 prompt: first prompt')[0]).not.toBeVisible()
    expect(within(activePanel as HTMLElement).getByRole('cell', { name: 'b2' })).toBeInTheDocument()

    await user.click(within(activePanel as HTMLElement).getByText('参数快照'))
    expect(await within(activePanel as HTMLElement).findByText('参数: 无')).toBeInTheDocument()
    expect(within(activePanel as HTMLElement).getByText('变量: 无')).toBeInTheDocument()
  })

  it('shows fallback values for missing template prompt in parameter modal', async () => {
    const user = userEvent.setup()
    const conversation = makeConversation(['portrait of a girl'])
    conversation.messages[0].runs = [
      {
        ...conversation.messages[0].runs![0],
        templatePrompt: '',
      },
    ]

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /显示参数/ }))

    expect(await screen.findByText(/模板 prompt: 无/)).toBeInTheDocument()
  })

  it('renders assistant inline config actions and forwards clicks', async () => {
    const user = userEvent.setup()
    const onAssistantMessageAction = vi.fn()
    const conversation = makeConversation()
    conversation.messages[0] = {
      ...conversation.messages[0],
      runs: [],
      content: '当前还没有选择模型，请先选择模型，再重新发送这条消息。',
      actions: [{ id: 'a1', type: 'select-model', label: '选择模型' }],
    }

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          onAssistantMessageAction={onAssistantMessageAction}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '选择模型' }))
    expect(onAssistantMessageAction).toHaveBeenCalledWith({
      id: 'a1',
      type: 'select-model',
      label: '选择模型',
    })
  })

  it('shows cancel-generation button for assistant message with pending images and forwards clicks', async () => {
    const user = userEvent.setup()
    const onCancelMessageRuns = vi.fn().mockResolvedValue(undefined)
    const conversation = makeConversation()
    conversation.messages[0] = {
      ...conversation.messages[0],
      runs: [{
        ...conversation.messages[0].runs![0],
        images: [{ id: 'pending-image', seq: 1, status: 'pending', threadState: 'active' }],
      }],
    }

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          onCancelMessageRuns={onCancelMessageRuns}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '中断生成' }))
    await waitFor(() => expect(onCancelMessageRuns).toHaveBeenCalledWith('m1', ['r1']))
  })

  it('forwards only current side run ids in comparison mode when cancelling', async () => {
    const user = userEvent.setup()
    const onCancelMessageRuns = vi.fn().mockResolvedValue(undefined)
    const conversation = makeConversation()
    conversation.sideMode = 'multi'
    conversation.messages[0] = {
      ...conversation.messages[0],
      runs: [
        {
          ...conversation.messages[0].runs![0],
          id: 'left-run',
          sideMode: 'multi',
          side: 'win-1',
          images: [{ id: 'pending-left', seq: 1, status: 'pending', threadState: 'active' }],
        },
        {
          ...conversation.messages[0].runs![0],
          id: 'right-run',
          sideMode: 'multi',
          side: 'win-2',
          images: [{ id: 'pending-right', seq: 1, status: 'pending', threadState: 'active' }],
        },
      ],
    }

    const { rerender } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="win-1"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          onCancelMessageRuns={onCancelMessageRuns}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '中断生成' }))
    await waitFor(() => expect(onCancelMessageRuns).toHaveBeenCalledWith('m1', ['left-run']))

    onCancelMessageRuns.mockClear()
    rerender(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="win-2"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          onCancelMessageRuns={onCancelMessageRuns}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '中断生成' }))
    await waitFor(() => expect(onCancelMessageRuns).toHaveBeenCalledWith('m1', ['right-run']))
  })

  it('does not show cancel-generation button when assistant message has no unfinished images', () => {
    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.queryByRole('button', { name: '中断生成' })).not.toBeInTheDocument()
  })

  it('snaps the viewport to the bottom when auto scroll is triggered', () => {
    vi.useFakeTimers()
    const { requestAnimationFrameSpy } = installRafWithFakeTimers()

    const { container, rerender } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          autoScrollTrigger={0}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const viewport = container.querySelector('.message-list-viewport') as HTMLDivElement
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1200 })
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 0, writable: true })

    rerender(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          autoScrollTrigger={1}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(requestAnimationFrameSpy).toHaveBeenCalled()
    expect(viewport.scrollTop).toBe(600)
  })

  it('anchors long conversations to the last message when auto scroll is triggered', () => {
    vi.useFakeTimers()
    installRafWithFakeTimers()
    const conversation = makeLongConversation(60)

    const { container, rerender } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          autoScrollTrigger={0}
          initialMessageLimit={100}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const viewport = container.querySelector('.message-list-viewport') as HTMLDivElement
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 13200 })
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 0, writable: true })

    rerender(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          autoScrollTrigger={1}
          initialMessageLimit={100}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    act(() => {
      vi.advanceTimersByTime(32)
    })

    expect(viewport.scrollTop).toBe(12600)
    expect(screen.getByText('long message 60')).toBeInTheDocument()
  })

  it('keeps the enter-chat scroll request pending until conversation messages load', () => {
    vi.useFakeTimers()
    installRafWithFakeTimers()
    const conversation = makeLongConversation(60)

    const { container, rerender } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={null}
          sideView="single"
          autoScrollTrigger={0}
          initialMessageLimit={100}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    rerender(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={null}
          sideView="single"
          autoScrollTrigger={1}
          initialMessageLimit={100}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const viewport = container.querySelector('.message-list-viewport') as HTMLDivElement
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 13200 })
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 0, writable: true })

    rerender(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          autoScrollTrigger={1}
          initialMessageLimit={100}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    act(() => {
      vi.advanceTimersByTime(32)
    })

    expect(viewport.scrollTop).toBe(12600)
    expect(screen.getByText('long message 60')).toBeInTheDocument()
  })

  it('does not schedule enter-chat auto scroll work for empty conversations', () => {
    vi.useFakeTimers()
    const { requestAnimationFrameSpy } = installRafWithFakeTimers()

    const { rerender } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={null}
          sideView="single"
          autoScrollTrigger={0}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    requestAnimationFrameSpy.mockClear()

    rerender(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={null}
          sideView="single"
          autoScrollTrigger={1}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByText('我可以怎么帮你？')).toBeInTheDocument()
    expect(requestAnimationFrameSpy).not.toHaveBeenCalled()
  })

  it('aligns the requested assistant bubble to the top when assistant auto scroll is triggered', () => {
    vi.useFakeTimers()
    installRafWithFakeTimers()
    const scrollIntoViewSpy = vi.spyOn(Element.prototype, 'scrollIntoView')

    const { rerender } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeStreamingConversation('我是 gpt-4o-mini。')}
          sideView="single"
          assistantAutoScrollTrigger={0}
          assistantAutoScrollMessageId="m-stream-assistant"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    rerender(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeStreamingConversation('我是 gpt-4o-mini。')}
          sideView="single"
          assistantAutoScrollTrigger={1}
          assistantAutoScrollMessageId="m-stream-assistant"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    act(() => {
      vi.advanceTimersByTime(20)
    })

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
  })

  it('does not auto scroll when the requested assistant message is hidden for the current side', () => {
    vi.useFakeTimers()
    installRafWithFakeTimers()
    const scrollIntoViewSpy = vi.spyOn(Element.prototype, 'scrollIntoView')

    const { rerender } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeMultiConversationWithSideOnlyRun('side_1')}
          sideView="side_2"
          assistantAutoScrollTrigger={0}
          assistantAutoScrollMessageId="m-side-only"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    rerender(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeMultiConversationWithSideOnlyRun('side_1')}
          sideView="side_2"
          assistantAutoScrollTrigger={1}
          assistantAutoScrollMessageId="m-side-only"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    act(() => {
      vi.advanceTimersByTime(20)
    })

    expect(scrollIntoViewSpy).not.toHaveBeenCalled()
  })

  it('shows scroll-to-bottom button away from bottom and scrolls the viewport on click', async () => {
    vi.useFakeTimers()
    installRafWithFakeTimers()

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const shell = container.querySelector('.message-list-shell') as HTMLDivElement
    const viewport = container.querySelector('.message-list-viewport') as HTMLDivElement
    const contentInner = container.querySelector('.message-list-content-inner') as HTMLDivElement
    const content = container.querySelector('.message-list-content') as HTMLDivElement
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1200 })
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 120, writable: true })
    fireEvent.scroll(viewport)
    fireEvent(window, new Event('resize'))

    expect(contentInner).not.toBeNull()
    expect(contentInner).toContainElement(content)
    expect(shell).toContainElement(viewport)
    const jumpButton = screen.getByRole('button', { name: '回到底部' })
    expect(jumpButton).toBeInTheDocument()
    expect(jumpButton).toHaveClass('message-scroll-to-bottom-btn', 'is-visible')
    expect(shell).toContainElement(jumpButton)

    fireEvent.click(jumpButton)

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(viewport.scrollTop).toBeGreaterThan(120)
    expect(viewport.scrollTop).toBeLessThan(600)

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(viewport.scrollTop).toBe(600)
  })

  it('keeps the scroll-to-bottom button independent from composer layout measurements', async () => {
    const { container } = render(
      <div className="chat-stage" style={{ position: 'relative', height: 700 }}>
        <div style={{ height: 600 }}>
          <MessageList
            activeConversation={makeConversation()}
            sideView="single"
            onOpenPreview={() => {}}
            onRetryRun={() => {}}
            onReplayRun={() => {}}
          />
        </div>
      </div>,
    )

    const shell = container.querySelector('.message-list-shell') as HTMLDivElement
    const viewport = container.querySelector('.message-list-viewport') as HTMLDivElement
    const layer = container.querySelector('.message-scroll-to-bottom-layer') as HTMLDivElement
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1200 })
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 120, writable: true })

    fireEvent.scroll(viewport)
    fireEvent(window, new Event('resize'))

    await waitFor(() => {
      expect(shell).toContainElement(layer)
      expect(layer.style.getPropertyValue('--message-scroll-to-bottom-offset')).toBe('')
      expect(screen.getByRole('button', { name: '回到底部' })).toHaveClass('is-visible')
    })
  })

  it('restarts the slow scroll-to-bottom animation when triggered again mid-flight', () => {
    vi.useFakeTimers()
    const { cancelAnimationFrameSpy } = installRafWithFakeTimers()

    const { container, rerender } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const viewport = container.querySelector('.message-list-viewport') as HTMLDivElement
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1200, writable: true })
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 120, writable: true })
    fireEvent.scroll(viewport)

    const jumpButton = screen.getByRole('button', { name: '回到底部' })
    fireEvent.click(jumpButton)

    act(() => {
      vi.advanceTimersByTime(240)
    })
    const midAnimationTop = viewport.scrollTop
    expect(midAnimationTop).toBeGreaterThan(120)
    expect(midAnimationTop).toBeLessThan(600)

    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1400, writable: true })
    rerender(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation()}
          sideView="single"
          autoScrollTrigger={1}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(cancelAnimationFrameSpy).toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(viewport.scrollTop).toBe(800)
  })

  it('keeps rendering the tail window when a long conversation reports an oversized scrollTop', () => {
    vi.useFakeTimers()
    installRafWithFakeTimers()
    const conversation = makeLongConversation(60)

    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const viewport = container.querySelector('.message-list-viewport') as HTMLDivElement
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 32000, writable: true })

    fireEvent.scroll(viewport)
    act(() => {
      vi.advanceTimersByTime(20)
    })

    expect(screen.getByText('long message 60')).toBeInTheDocument()
    expect(container.querySelectorAll('.message-card-shell').length).toBeGreaterThan(0)
  })

  it('clamps an oversized scrollTop after appending a new user message in a long conversation', () => {
    vi.useFakeTimers()
    installRafWithFakeTimers()
    const conversation = makeLongConversation(60)

    const { container, rerender } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          autoScrollTrigger={0}
          initialMessageLimit={100}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const viewport = container.querySelector('.message-list-viewport') as HTMLDivElement
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 32000, writable: true })

    fireEvent.scroll(viewport)

    const nextConversation = {
      ...conversation,
      messages: [
        ...conversation.messages,
        {
          id: 'm-long-61',
          createdAt: '2026-01-01T00:01:00.000Z',
          role: 'user' as const,
          content: 'newly appended prompt',
          runs: [],
        },
      ],
    }

    rerender(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={nextConversation}
          sideView="single"
          autoScrollTrigger={1}
          initialMessageLimit={100}
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    act(() => {
      vi.advanceTimersByTime(32)
    })

    expect(screen.getByText('newly appended prompt')).toBeInTheDocument()
    expect(viewport.scrollTop).toBeLessThan(32000)
  })

  it('re-measures virtual rows when a mounted message grows after initial render', async () => {
    const resizeController = createResizeObserverController()
    const originalResizeObserver = window.ResizeObserver
    ;(window as typeof window & { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      resizeController.ResizeObserverMock as unknown as typeof ResizeObserver
    try {
      const conversation = makeLongConversation(60)
      const { container } = render(
        <div style={{ height: 600 }}>
          <MessageList
            activeConversation={conversation}
            sideView="single"
            onOpenPreview={() => {}}
            onRetryRun={() => {}}
            onReplayRun={() => {}}
          />
        </div>,
      )

      const content = container.querySelector('.message-list-content') as HTMLDivElement
      const targetText = screen.getByText('long message 1')
      const targetRow = targetText.closest('[data-message-id]') as HTMLDivElement

      expect(content).not.toBeNull()
      expect(targetRow).not.toBeNull()
      expect(content.style.height).toBe('13200px')

      Object.defineProperty(targetRow, 'offsetHeight', { configurable: true, value: 520 })
      Object.defineProperty(targetRow, 'scrollHeight', { configurable: true, value: 520 })
      targetRow.getBoundingClientRect = () => ({ height: 520 } as DOMRect)

      resizeController.trigger(targetRow)

      await waitFor(() => {
        expect(Number.parseFloat(content.style.height)).toBeGreaterThan(13200)
      })
    } finally {
      ;(window as typeof window & { ResizeObserver: typeof ResizeObserver }).ResizeObserver = originalResizeObserver
    }
  })

  it('paginates images per run in multi view and can load more', async () => {
    const user = userEvent.setup()
    const conversation = makeMultiConversationWithManyRunsAndImages({
      targetSide: 'side_1',
      runCount: 1,
      imageCount: 30,
    })
    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="side_1"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          multiImageInitialLimit={12}
          multiImagePageSize={12}
        />
      </div>,
    )

    expect(container.querySelectorAll('img.run-image')).toHaveLength(12)
    await user.click(screen.getByRole('button', { name: /加载更多图片/ }))
    await waitFor(() => {
      expect(container.querySelectorAll('img.run-image')).toHaveLength(24)
    })
  })

  it('paginates images per run in single view and can load more', async () => {
    const user = userEvent.setup()
    const conversation = makeSingleConversationWithManyRunsAndImages({
      runCount: 1,
      imageCount: 30,
    })
    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          multiImageInitialLimit={12}
          multiImagePageSize={12}
        />
      </div>,
    )

    expect(container.querySelectorAll('img.run-image')).toHaveLength(12)
    await user.click(screen.getByRole('button', { name: /加载更多图片/ }))
    await waitFor(() => {
      expect(container.querySelectorAll('img.run-image')).toHaveLength(24)
    })
  })

  it('renders all runs in multi view without load more', () => {
    const conversation = makeMultiConversationWithManyRunsAndImages({
      targetSide: 'side_1',
      runCount: 18,
      imageCount: 1,
    })
    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="side_1"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(container.querySelectorAll('.run-meta-title-fixed')).toHaveLength(18)
    expect(screen.queryByRole('button', { name: /加载更多 Run/ })).not.toBeInTheDocument()
  })

  it('renders all runs in single view without load more', () => {
    const conversation = makeSingleConversationWithManyRunsAndImages({
      runCount: 18,
      imageCount: 1,
    })
    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(container.querySelectorAll('.run-meta-title-fixed')).toHaveLength(18)
    expect(screen.queryByRole('button', { name: /加载更多 Run/ })).not.toBeInTheDocument()
  })

  it('uses compact image actions in multi view to reduce node count', () => {
    const conversation = makeMultiConversationWithManyRunsAndImages({
      targetSide: 'side_1',
      runCount: 1,
      imageCount: 1,
    })

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="side_1"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.queryByRole('button', { name: /下载这张/ })).not.toBeInTheDocument()
  })

  it('reserves top clearance for the floating model selector in single view', () => {
    const { container } = render(
      <div className="chat-body" style={{ height: 600 }}>
        <div className="chat-stage">
          <MessageList
            activeConversation={makeConversation(['portrait girl'])}
            sideView="single"
            onOpenPreview={() => {}}
            onRetryRun={() => {}}
            onReplayRun={() => {}}
          />
        </div>
      </div>,
    )

    const chatBody = container.querySelector('.chat-body') as HTMLDivElement
    const viewport = container.querySelector('.message-list-viewport') as HTMLDivElement
    const chatBodyStyle = window.getComputedStyle(chatBody)
    const viewportStyle = window.getComputedStyle(viewport)

    expect(chatBodyStyle.getPropertyValue('--message-list-top-clearance').trim()).toBe('104px')
    expect(viewportStyle.paddingTop).toBe('var(--message-list-top-clearance, 12px)')
    expect(viewportStyle.scrollPaddingTop).toBe('var(--message-list-top-clearance, 12px)')
  })

  it('uses fixed bottom padding in multi view without composer safe-area coupling', () => {
    const conversation = makeMultiConversationWithManyRunsAndImages({
      targetSide: 'side_1',
      runCount: 1,
      imageCount: 1,
    })

    const { container } = render(
      <div className="chat-body chat-body-multi" style={{ height: 600 }}>
        <div className="ab-window-shell">
          <MessageList
            activeConversation={conversation}
            sideView="side_1"
            onOpenPreview={() => {}}
            onRetryRun={() => {}}
            onReplayRun={() => {}}
          />
        </div>
      </div>,
    )

    const viewport = container.querySelector('.message-list-viewport') as HTMLDivElement
    const contentInner = container.querySelector('.message-list-content-inner') as HTMLDivElement
    const viewportStyle = window.getComputedStyle(viewport)
    const contentInnerStyle = window.getComputedStyle(contentInner)

    expect(viewportStyle.paddingBottom).toBe('16px')
    expect(viewportStyle.scrollPaddingBottom).toBe('16px')
    expect(contentInnerStyle.width).toBe('calc(100% - 28px)')
    expect(contentInnerStyle.maxWidth).toBe('calc(100% - 28px)')
  })

  it('renders a loading animation for empty assistant streaming bubbles', () => {
    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeStreamingConversation('')}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByRole('status', { name: '模型响应中' })).toBeInTheDocument()
    expect(document.querySelectorAll('.message-streaming-dot')).toHaveLength(3)
  })

  it('replaces the loading animation once streamed text arrives', () => {
    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeStreamingConversation('我是 gpt-4o-mini。')}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.queryByRole('status', { name: '模型响应中' })).not.toBeInTheDocument()
    expect(screen.getByText('我是 gpt-4o-mini。')).toBeInTheDocument()
  })

  it('renders common markdown structures inside assistant bubbles', () => {
    const conversation = makeConversation()
    conversation.messages[0].content = [
      '# 标题',
      '',
      '普通段落包含 **加粗** 和 `inline code`。',
      '',
      '- 列表项 1',
      '- 列表项 2',
      '',
      '> 引用内容',
      '',
      '```ts',
      'const answer = 42',
      '```',
      '',
      '| 列 | 值 |',
      '| --- | --- |',
      '| A | B |',
      '',
      '[OpenAI](https://openai.com)',
    ].join('\n')

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByRole('heading', { level: 1, name: '标题' })).toBeInTheDocument()
    expect(screen.getByText('加粗').tagName).toBe('STRONG')
    expect(screen.getByText('inline code').tagName).toBe('CODE')
    expect(screen.getByText('列表项 1').closest('li')).not.toBeNull()
    expect(screen.getByText('引用内容').closest('blockquote')).not.toBeNull()
    expect(screen.getByText('const answer = 42').closest('pre')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'OpenAI' })).toHaveAttribute('href', 'https://openai.com')
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('treats single line breaks as visible line breaks in assistant markdown', () => {
    const conversation = makeConversation()
    conversation.messages[0].content = '第一行\n第二行'

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const markdown = screen.getByTestId('assistant-markdown')
    expect(markdown.querySelector('br')).not.toBeNull()
    expect(markdown).toHaveTextContent('第一行')
    expect(markdown).toHaveTextContent('第二行')
  })

  it('does not render raw html from assistant content as live dom nodes', () => {
    const conversation = makeConversation()
    conversation.messages[0].content = '<span data-testid="raw-html-node">unsafe</span>'

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.queryByTestId('raw-html-node')).not.toBeInTheDocument()
    expect(screen.getByText('<span data-testid="raw-html-node">unsafe</span>')).toBeInTheDocument()
  })

  it('keeps user bubbles as plain text instead of markdown', () => {
    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeUserConversation('**not bold**')}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    expect(screen.getByText('**not bold**')).toBeInTheDocument()
    expect(screen.queryByText('not bold', { selector: 'strong' })).not.toBeInTheDocument()
  })

  it('preserves user input whitespace in user bubbles', () => {
    const content = '第一行\n  第二行'

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeUserConversation(content)}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    const userBubble = document.querySelector('.message-card.user .ant-typography')
    expect(userBubble).not.toBeNull()
    expect(userBubble?.textContent).toBe(content)
    expect(userBubble).toBeInTheDocument()
    expect(userBubble).toHaveStyle({ whiteSpace: 'pre-wrap' })
  })

  it('opens the history navigator and jumps to an older user prompt outside the default render window', async () => {
    const user = userEvent.setup()
    const conversation = makeHistoryNavigationConversation(12)
    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          windowSize={4}
        />
      </div>,
    )

    expect(container.querySelector('[data-message-id="m-nav-user-1"]')).toBeNull()

    await user.click(screen.getByRole('button', { name: '聊天记录导航' }))
    await user.click(within(document.body).getByRole('button', { name: /^输入 1 history prompt 1$/i }))

    await waitFor(() => {
      const targetRow = container.querySelector('[data-message-id="m-nav-user-1"]')
      expect(targetRow).toBeInTheDocument()
      expect(targetRow?.className).toContain('is-history-nav-highlighted')
    })
  })

  it('lists history navigator items from oldest to newest', async () => {
    const user = userEvent.setup()

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeHistoryNavigationConversation(3)}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '聊天记录导航' }))

    const navItems = within(document.body).getAllByRole('button', { name: /^输入 \d history prompt \d$/i })
    expect(navItems.map((item) => item.textContent)).toEqual([
      '输入 1history prompt 1',
      '输入 2history prompt 2',
      '输入 3history prompt 3',
    ])
  })

  it('requests older history before navigating when the target prompt is outside the current message limit', async () => {
    const user = userEvent.setup()
    const onLoadOlderMessages = vi.fn()
    const conversation = makeHistoryNavigationConversation(6)

    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={conversation}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          initialMessageLimit={2}
          onLoadOlderMessages={onLoadOlderMessages}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '聊天记录导航' }))
    await user.click(within(document.body).getByRole('button', { name: /^输入 1 history prompt 1$/i }))

    await waitFor(() => {
      expect(onLoadOlderMessages).toHaveBeenCalled()
    })
  })
})
