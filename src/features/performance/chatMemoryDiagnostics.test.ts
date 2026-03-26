import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('chatMemoryDiagnostics', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  afterEach(async () => {
    const diagnostics = await import('./chatMemoryDiagnostics')
    diagnostics.setChatMemoryDiagnosticsEnabled(false)
    vi.restoreAllMocks()
  })

  it('starts disabled by default and persists toggle changes', async () => {
    const diagnostics = await import('./chatMemoryDiagnostics')

    expect(diagnostics.isChatMemoryDiagnosticsEnabled()).toBe(false)

    diagnostics.setChatMemoryDiagnosticsEnabled(true)

    expect(diagnostics.isChatMemoryDiagnosticsEnabled()).toBe(true)
    expect(window.localStorage.getItem('m3:chat-memory-diagnostics-enabled')).toBe('true')
  })

  it('clears collected diagnostics when monitoring is turned off', async () => {
    const diagnostics = await import('./chatMemoryDiagnostics')

    diagnostics.setChatMemoryDiagnosticsEnabled(true)
    diagnostics.reportMessageListDiagnostics({
      key: 'list-1',
      conversationId: 'c1',
      sideView: 'single',
      totalMessages: 10,
      historyMessages: 10,
      hydratedMessages: 10,
      renderedMessages: 5,
      mountedMessages: 5,
      visibleMessages: 3,
      imgNodes: 1,
      viewportNodes: 30,
      scrollTop: 0,
      scrollHeight: 1000,
      viewportHeight: 500,
      virtualRangeStart: 0,
      virtualRangeEnd: 4,
    })

    expect(Object.keys(diagnostics.getChatMemoryDiagnosticsState().messageLists)).toHaveLength(1)

    diagnostics.setChatMemoryDiagnosticsEnabled(false)

    expect(diagnostics.getChatMemoryDiagnosticsState()).toEqual({
      messageLists: {},
      previewService: null,
      events: [],
    })
  })
})
