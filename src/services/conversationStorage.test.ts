import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversation } from '../types/conversation'
import {
  clearConversationsFromStorage,
  loadChannelsFromStorage,
  loadConversationContentById,
  loadConversationIndexFromStorage,
  loadStagedSettingsFromStorage,
  migrateLegacyConversationContent,
  removeConversationContentFromStorage,
  saveActiveConversationId,
  saveChannelsToStorage,
  saveConversationContent,
  saveIndex,
  saveStagedSettingsToStorage,
} from './conversationStorage'

function makeConversation(overrides?: Partial<Conversation>): Conversation {
  return {
    id: 'conv-1',
    title: 'Test',
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
        channelId: null,
        modelId: 'model-a',
        textModelId: 'text-a',
        paramValues: {},
      },
    },
    messages: [],
    ...overrides,
  }
}

describe('conversationStorage', () => {
  beforeEach(async () => {
    localStorage.clear()
    if (typeof indexedDB !== 'undefined') {
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('m3-conversations-db')
        request.onsuccess = () => resolve()
        request.onerror = () => resolve()
        request.onblocked = () => resolve()
      })
    }
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads index and preserves empty active conversation sentinel', () => {
    saveIndex([
      {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        lastMessagePreview: 'hello',
      },
    ])
    saveActiveConversationId(null)

    expect(loadConversationIndexFromStorage()).toEqual({
      summaries: [
        {
          id: 'conv-1',
          title: 'Test',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
          lastMessagePreview: 'hello',
        },
      ],
      activeId: null,
    })
  })

  it('saves and loads conversation content through localStorage fallback when indexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const conversation = makeConversation({
      id: 'conv-local',
      messages: [
        { id: 'm1', createdAt: '2026-03-01T00:00:00.000Z', role: 'user', content: 'hello' },
      ],
    })

    await saveConversationContent(conversation)
    const loaded = await loadConversationContentById('conv-local')

    expect(loaded?.id).toBe('conv-local')
    expect(loaded?.messages[0]?.titleEligible).toBe(true)
  })

  it('compacts oversized conversations when saving to fallback localStorage', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const runImage = {
      id: 'img-1',
      seq: 1,
      status: 'success' as const,
      threadState: 'settled' as const,
      thumbRef: 'thumb',
      fileRef: 'file',
      fullRef: 'full',
    }
    const oldMessages = Array.from({ length: 30 }, (_, index) => ({
      id: `m-${index}`,
      createdAt: '2026-03-01T00:00:00.000Z',
      role: 'assistant' as const,
      content: '',
      runs: [{
        id: `run-${index}`,
        batchId: `batch-${index}`,
        createdAt: '2026-03-01T00:00:00.000Z',
        sideMode: 'single' as const,
        side: 'single',
        prompt: 'p',
        imageCount: 1,
        channelId: null,
        channelName: null,
        modelId: 'model-a',
        modelName: 'Model A',
        templatePrompt: 'p',
        finalPrompt: 'p',
        variablesSnapshot: {},
        paramsSnapshot: {},
        settingsSnapshot: makeConversation().settingsBySide.single,
        retryAttempt: 0,
        images: [runImage],
      }],
    }))
    const hugeConversation = makeConversation({
      id: 'conv-big',
      messages: oldMessages,
      title: `Test-${'x'.repeat(2_700_000)}`,
    })

    await saveConversationContent(hugeConversation)
    const raw = localStorage.getItem('m1:conversation:conv-big')
    const parsed = JSON.parse(raw ?? '{}') as Conversation

    expect(raw).toContain('"thumbRef":"thumb"')
    expect(parsed.messages[0]?.runs?.[0]?.images[0]?.fullRef).toBeUndefined()
    expect(parsed.messages.at(-1)?.runs?.[0]?.images[0]?.fullRef).toBe('full')
  })

  it('migrates legacy localStorage content into indexedDB-backed storage', async () => {
    const conversation = makeConversation({ id: 'legacy-conv' })
    localStorage.setItem('m1:conversation:legacy-conv', JSON.stringify(conversation))

    await migrateLegacyConversationContent(['legacy-conv'])

    const loaded = await loadConversationContentById('legacy-conv')
    expect(loaded?.id).toBe('legacy-conv')
    await Promise.resolve()
    expect(localStorage.getItem('m1:conversation:legacy-conv')).toBeNull()
  })

  it('saves, loads and removes channel and staged settings storage', async () => {
    saveChannelsToStorage([
      { id: 'ch-1', name: 'main', baseUrl: 'https://api.example.com', apiKey: 'key', models: ['a', '', 'b'] },
    ])
    saveStagedSettingsToStorage({
      sideMode: 'multi',
      sideCount: 3,
      runConcurrency: 4,
      runConcurrencyUnlimited: true,
      dynamicPromptEnabled: true,
      autoRenameConversationTitle: true,
      autoRenameConversationTitleModelId: 'model-a',
      panelValueFormat: 'json',
      panelVariables: [{ id: 'p1', key: 'style', valuesText: '["a"]', selectedValue: '' }],
      favoriteModelIds: ['model-a', '', 'model-b'],
      imageRuntimeSettings: {
        resumePollStrategyMode: 'custom',
        resumePollSchedule: [{ elapsedSeconds: 0, intervalSeconds: 2 }],
      },
      loggingSettings: { enabled: true },
    })

    expect(loadChannelsFromStorage()[0]).toMatchObject({
      id: 'ch-1',
      models: ['a', 'b'],
    })
    expect(loadStagedSettingsFromStorage()).toMatchObject({
      sideMode: 'multi',
      sideCount: 3,
      runConcurrencyUnlimited: true,
      panelValueFormat: 'json',
      favoriteModelIds: ['model-a', 'model-b'],
    })

    await removeConversationContentFromStorage('conv-1')
    await clearConversationsFromStorage()
    expect(localStorage.getItem('m1:conversation:conv-1')).toBeNull()
    expect(localStorage.getItem('m3:channels')).not.toBeNull()
    expect(localStorage.getItem('m3:staged-settings')).not.toBeNull()
  })

  it('strips legacy removed-provider state while loading persisted settings', () => {
    localStorage.setItem('jimeng:proxy-base-url', 'http://127.0.0.1:8787')
    localStorage.setItem('jimeng:model-catalog', '{"models":[]}')

    saveChannelsToStorage([
      { id: '__jimeng-proxy__', name: '即梦本地代理', baseUrl: 'http://127.0.0.1:8787', apiKey: 'local-session', providerId: 'jimeng-proxy' },
      { id: 'ch-1', name: 'main', baseUrl: 'https://api.example.com', apiKey: 'key', models: ['model-a'] },
    ])
    saveStagedSettingsToStorage({
      sideMode: 'single',
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
          channelId: '__jimeng-proxy__',
          modelId: '__jimeng-proxy__::model',
          textModelId: '__jimeng-proxy__::text-model',
          videoModelId: '__jimeng-proxy__::video-model',
          paramValues: {},
        },
      },
      runConcurrency: 1,
      runConcurrencyUnlimited: false,
      dynamicPromptEnabled: true,
      autoRenameConversationTitle: true,
      autoRenameConversationTitleModelId: '__jimeng-proxy__::title-model',
      panelValueFormat: 'json',
      panelVariables: [],
      favoriteModelIds: ['model-a', '__jimeng-proxy__::favorite-model'],
    })

    expect(loadChannelsFromStorage()).toEqual([
      expect.objectContaining({ id: 'ch-1' }),
    ])
    expect(loadStagedSettingsFromStorage()).toMatchObject({
      settingsBySide: {
        single: expect.objectContaining({
          channelId: null,
          modelId: '',
          textModelId: '',
          videoModelId: '',
        }),
      },
      autoRenameConversationTitleModelId: null,
      favoriteModelIds: ['model-a'],
    })
    expect(localStorage.getItem('jimeng:proxy-base-url')).toBeNull()
    expect(localStorage.getItem('jimeng:model-catalog')).toBeNull()
  })
})
