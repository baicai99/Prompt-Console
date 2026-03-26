import { describe, expect, it } from 'vitest'
import {
  compactConversationForWindow,
  compactConversationForMemory,
  compressConversationForHighMemory,
  getBrowserMemoryPressure,
  prepareConversationForPersistence,
  resolveAdaptiveRunConcurrencyByPressure,
  touchConversationCache,
} from '../../features/conversation/application/runtime/conversationMemory'
import type { Conversation } from '../../types/conversation'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../utils/imageRuntimeSettings'

function createConversation(messageCount: number): Conversation {
  return {
    id: 'c1',
    title: 'Conversation',
    titleMode: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
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
        channelId: 'ch-1',
        modelId: 'model-a',
        paramValues: {},
      },
    },
    messages: Array.from({ length: messageCount }, (_, index) => ({
      id: `m${index}`,
      createdAt: `2026-01-0${(index % 9) + 1}T00:00:00.000Z`,
      role: 'assistant' as const,
      content: `message ${index}`,
      runs: [
        {
          id: `r${index}`,
          batchId: 'b1',
          createdAt: '2026-01-01T00:00:00.000Z',
          sideMode: 'single',
          side: 'single',
          prompt: 'p',
          imageCount: 1,
          channelId: 'ch-1',
          channelName: 'main',
          modelId: 'model-a',
          modelName: 'Model A',
          templatePrompt: 'p',
          finalPrompt: 'p',
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
              id: `i${index}`,
              seq: 1,
              status: 'success',
              fileRef: `file-${index}`,
              thumbRef: `thumb-${index}`,
              fullRef: `full-${index}`,
            },
          ],
        },
      ],
    })),
  }
}

describe('conversationMemory helpers', () => {
  it('updates cache order as LRU', () => {
    expect(touchConversationCache(['a', 'b', 'c'], 'b', 3)).toEqual(['b', 'a', 'c'])
    expect(touchConversationCache(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b'])
  })

  it('compacts non-recent messages for memory', () => {
    const compacted = compactConversationForMemory(createConversation(25))
    expect(compacted.messages[0].runs?.[0].images[0].fullRef).toBeUndefined()
    expect(compacted.messages[24].runs?.[0].images[0].fullRef).toBe('full-24')
  })

  it('compresses more aggressively under high memory pressure', () => {
    const compressed = compressConversationForHighMemory(createConversation(10))
    expect(compressed.messages[0].runs?.[0].images[0].fullRef).toBeUndefined()
    expect(compressed.messages[9].runs?.[0].images[0].fullRef).toBe('full-9')
  })

  it('keeps a larger hydrated tail for active history windows', () => {
    const compacted = compactConversationForWindow({
      conversation: createConversation(80),
      hydratedMessageCount: 40,
      pressure: 0.2,
    })

    expect(compacted.memoryState).toEqual({
      isCompacted: true,
      hydratedMessageCount: 40,
      totalMessageCount: 80,
    })
    expect(compacted.messages[0].runs?.[0].images[0].fullRef).toBeUndefined()
    expect(compacted.messages[79].runs?.[0].images[0].fullRef).toBe('full-79')
    expect(compacted.messages[40].runs?.[0].images[0].fullRef).toBe('full-40')
  })

  it('prepares active and inactive conversations differently', () => {
    const shortConversation = createConversation(10)
    const longConversation = createConversation(25)
    expect(prepareConversationForPersistence({ conversation: shortConversation, isActive: true, pressure: 0.5 })).toBe(shortConversation)
    expect(prepareConversationForPersistence({ conversation: shortConversation, isActive: true, pressure: 0.8 }).messages[0].runs?.[0].images[0].fullRef).toBeUndefined()
    expect(prepareConversationForPersistence({ conversation: longConversation, isActive: false, pressure: 0.1 }).messages[0].runs?.[0].images[0].fullRef).toBeUndefined()
  })

  it('uses runtime retention settings when compacting conversations', () => {
    const compacted = compactConversationForMemory(createConversation(20), {
      ...DEFAULT_IMAGE_RUNTIME_SETTINGS,
      recentMessageRetentionCount: 6,
    })
    const compressed = compressConversationForHighMemory(createConversation(20), {
      ...DEFAULT_IMAGE_RUNTIME_SETTINGS,
      highPressureMessageRetentionCount: 3,
    })

    expect(compacted.messages[13].runs?.[0].images[0].fullRef).toBeUndefined()
    expect(compacted.messages[19].runs?.[0].images[0].fullRef).toBe('full-19')
    expect(compressed.messages[16].runs?.[0].images[0].fullRef).toBeUndefined()
    expect(compressed.messages[19].runs?.[0].images[0].fullRef).toBe('full-19')
  })

  it('computes memory pressure and adaptive concurrency', () => {
    expect(getBrowserMemoryPressure({ memory: { usedJSHeapSize: 50, jsHeapSizeLimit: 100 } })).toBe(0.5)
    expect(getBrowserMemoryPressure()).toBe(0)
    expect(resolveAdaptiveRunConcurrencyByPressure(5, 0.8)).toBe(1)
    expect(resolveAdaptiveRunConcurrencyByPressure(5, 0.7)).toBe(2)
    expect(resolveAdaptiveRunConcurrencyByPressure(5, 0.3)).toBe(5)
  })
})
