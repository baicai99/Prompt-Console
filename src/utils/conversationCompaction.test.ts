import { describe, expect, it } from 'vitest'
import type { Conversation } from '../types/conversation'
import { compactConversationImages } from './conversationCompaction'

function createConversation(): Conversation {
  return {
    id: 'conv-compact',
    title: 'Compact',
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
    messages: [
      {
        id: 'assistant-1',
        createdAt: '2026-03-01T00:00:00.000Z',
        role: 'assistant',
        content: 'old',
        runs: [
          {
            id: 'run-old',
            batchId: 'batch-old',
            createdAt: '2026-03-01T00:00:00.000Z',
            sideMode: 'single',
            side: 'single',
            prompt: 'cat',
            imageCount: 1,
            channelId: 'ch-1',
            channelName: 'main',
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
                id: 'image-old',
                seq: 1,
                status: 'success',
                refKind: 'idb-blob',
                refKey: 'asset:old',
                fileRef: 'https://img.example/file.png',
                thumbRef: 'https://img.example/thumb.png',
                fullRef: 'https://img.example/full.png',
              },
            ],
          },
        ],
      },
      {
        id: 'assistant-2',
        createdAt: '2026-03-02T00:00:00.000Z',
        role: 'assistant',
        content: 'recent',
        runs: [
          {
            id: 'run-recent',
            batchId: 'batch-recent',
            createdAt: '2026-03-02T00:00:00.000Z',
            sideMode: 'single',
            side: 'single',
            prompt: 'dog',
            imageCount: 1,
            channelId: 'ch-1',
            channelName: 'main',
            modelId: 'model-a',
            modelName: 'Model A',
            templatePrompt: 'dog',
            finalPrompt: 'dog',
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
                id: 'image-recent',
                seq: 1,
                status: 'success',
                refKind: 'idb-blob',
                refKey: 'asset:recent',
                fileRef: 'https://img.example/recent-file.png',
                thumbRef: 'https://img.example/recent-thumb.png',
                fullRef: 'https://img.example/recent-full.png',
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('compactConversationImages', () => {
  it('drops redundant direct refs for compacted idb-backed images', () => {
    const compacted = compactConversationImages(createConversation(), {
      retainedMessageCount: 1,
    })

    expect(compacted.messages[0]?.runs?.[0]?.images[0]).toMatchObject({
      refKind: 'idb-blob',
      refKey: 'asset:old',
      fileRef: undefined,
      thumbRef: undefined,
      fullRef: undefined,
    })
    expect(compacted.messages[1]?.runs?.[0]?.images[0]?.fileRef).toBe('https://img.example/recent-file.png')
  })
})
