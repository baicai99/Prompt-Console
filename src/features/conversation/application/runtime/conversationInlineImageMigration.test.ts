import { describe, expect, it, vi } from 'vitest'
import type { Conversation } from '../../../../types/conversation'
import { migrateConversationInlineImages } from './conversationInlineImageMigration'

const inlineImage = 'data:image/png;base64,aGVsbG8='

function createConversation(): Conversation {
  return {
    id: 'conv-inline',
    title: 'Inline',
    titleMode: 'manual',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
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
        modelId: 'model-a',
        textModelId: 'text-a',
        videoModelId: 'video-a',
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
        finalPrompt: 'cat',
        status: 'polling',
        createdAt: '2026-03-01T00:00:00.000Z',
        queuedAt: '2026-03-01T00:00:00.000Z',
        fileRef: inlineImage,
        thumbRef: inlineImage,
        refKind: 'inline',
      },
    },
    messages: [
      {
        id: 'assistant-1',
        createdAt: '2026-03-01T00:00:00.000Z',
        role: 'assistant',
        content: 'done',
        runs: [
          {
            id: 'run-1',
            batchId: 'batch-1',
            createdAt: '2026-03-01T00:00:00.000Z',
            sideMode: 'single',
            side: 'single',
            prompt: 'cat',
            imageCount: 1,
            channelId: 'ch-1',
            channelName: 'Default',
            modelId: 'model-a',
            modelName: 'Model A',
            templatePrompt: 'cat',
            finalPrompt: 'cat',
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
                fileRef: inlineImage,
                thumbRef: inlineImage,
                refKind: 'inline',
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('migrateConversationInlineImages', () => {
  it('converts legacy inline refs into indexeddb-backed refs', async () => {
    const putImageBlobFn = vi.fn().mockResolvedValue(undefined)

    const result = await migrateConversationInlineImages(createConversation(), {
      putImageBlobFn,
    })

    expect(result.changed).toBe(true)
    expect(putImageBlobFn).toHaveBeenCalledTimes(1)
    expect(result.conversation.messages[0]?.runs?.[0]?.images[0]).toMatchObject({
      refKind: 'idb-blob',
    })
    expect(result.conversation.messages[0]?.runs?.[0]?.images[0]?.fileRef).toBeUndefined()
    expect(result.conversation.tasksById?.['task-1']).toMatchObject({
      refKind: 'idb-blob',
    })
    expect(result.conversation.tasksById?.['task-1']?.fileRef).toBeUndefined()
  })
})
