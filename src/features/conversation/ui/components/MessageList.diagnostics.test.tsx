import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Conversation } from '../../../../types/conversation'

function makeConversation(): Conversation {
  return {
    id: 'c-diagnostics',
    title: 'Diagnostics',
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
        id: 'm-diagnostics',
        createdAt: '2026-01-01T00:00:00.000Z',
        role: 'assistant',
        content: 'done',
        runs: [
          {
            id: 'run-diagnostics',
            batchId: 'batch-diagnostics',
            createdAt: '2026-01-01T00:00:00.000Z',
            sideMode: 'single',
            side: 'single',
            prompt: 'x',
            imageCount: 1,
            channelId: null,
            channelName: null,
            modelId: 'm',
            modelName: 'M',
            templatePrompt: 'template {{x}}',
            finalPrompt: 'template cat',
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
            images: [
              {
                id: 'img-diagnostics',
                seq: 1,
                status: 'success',
                fileRef: 'data:image/png;base64,AA0',
                thumbRef: 'data:image/png;base64,AA0',
                fullRef: 'data:image/png;base64,AA0',
              },
            ],
          },
        ],
      },
    ],
  }
}

async function loadMessageListWithDiagnostics(enabled: boolean) {
  vi.resetModules()
  const reportMessageListDiagnostics = vi.fn()

  vi.doMock('../../../performance/chatMemoryDiagnostics', async () => {
    const actual = await vi.importActual<typeof import('../../../performance/chatMemoryDiagnostics')>(
      '../../../performance/chatMemoryDiagnostics',
    )
    return {
      ...actual,
      isChatMemoryDiagnosticsEnabled: () => enabled,
      subscribeChatMemoryDiagnostics: () => () => {},
      reportMessageListDiagnostics,
      clearMessageListDiagnostics: vi.fn(),
      recordChatMemoryEvent: vi.fn(),
    }
  })

  const component = await import('./MessageList')
  return {
    MessageList: component.MessageList,
    reportMessageListDiagnostics,
  }
}

describe('MessageList diagnostics', () => {
  afterEach(() => {
    vi.doUnmock('../../../performance/chatMemoryDiagnostics')
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('does not report diagnostics when runtime monitoring is disabled', async () => {
    const { MessageList, reportMessageListDiagnostics } = await loadMessageListWithDiagnostics(false)
    const querySelectorAllSpy = vi.spyOn(Document.prototype, 'querySelectorAll')

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

    expect(reportMessageListDiagnostics).not.toHaveBeenCalled()
    expect(querySelectorAllSpy).not.toHaveBeenCalled()
  }, 60000)

  it('reports a lightweight diagnostics snapshot when runtime monitoring is enabled', async () => {
    const { MessageList, reportMessageListDiagnostics } = await loadMessageListWithDiagnostics(true)
    const querySelectorAllSpy = vi.spyOn(Document.prototype, 'querySelectorAll')

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

    await waitFor(() => {
      expect(reportMessageListDiagnostics).toHaveBeenCalled()
    })

    const firstSnapshot = reportMessageListDiagnostics.mock.calls[0]?.[0]
    expect(firstSnapshot).toBeTruthy()
    expect(firstSnapshot).not.toHaveProperty('totalDocumentNodes')
    expect(querySelectorAllSpy).not.toHaveBeenCalled()
  }, 60000)
})
