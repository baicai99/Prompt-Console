import { DEFAULT_CHAT_MEMORY_DIAGNOSTICS_ENABLED } from './flags'

const CHAT_MEMORY_DIAGNOSTICS_STORAGE_KEY = 'm3:chat-memory-diagnostics-enabled'
const MAX_EVENTS = 40

export interface MessageListDiagnosticsSnapshot {
  key: string
  conversationId: string | null
  sideView: string
  totalMessages: number
  historyMessages: number
  hydratedMessages: number
  renderedMessages: number
  mountedMessages: number
  visibleMessages: number
  imgNodes: number
  viewportNodes: number
  scrollTop: number
  scrollHeight: number
  viewportHeight: number
  virtualRangeStart: number
  virtualRangeEnd: number
}

export interface PreviewServiceDiagnosticsSnapshot {
  cacheSize: number
  totalRefs: number
  inflightCount: number
  createdObjectUrls: number
  revokedObjectUrls: number
  activeObjectUrls: number
}

export interface ChatMemoryDiagnosticsEvent {
  id: string
  name: string
  at: string
  detail?: string
}

export interface ChatMemoryDiagnosticsState {
  messageLists: Record<string, MessageListDiagnosticsSnapshot>
  previewService: PreviewServiceDiagnosticsSnapshot | null
  events: ChatMemoryDiagnosticsEvent[]
}

let diagnosticsEnabled = readInitialDiagnosticsEnabled()

let state: ChatMemoryDiagnosticsState = {
  messageLists: {},
  previewService: null,
  events: [],
}

const listeners = new Set<() => void>()

function readInitialDiagnosticsEnabled() {
  if (typeof window === 'undefined') {
    return DEFAULT_CHAT_MEMORY_DIAGNOSTICS_ENABLED
  }

  try {
    const stored = window.localStorage.getItem(CHAT_MEMORY_DIAGNOSTICS_STORAGE_KEY)
    if (stored === 'true') {
      return true
    }
    if (stored === 'false') {
      return false
    }
  } catch {
    return DEFAULT_CHAT_MEMORY_DIAGNOSTICS_ENABLED
  }

  return DEFAULT_CHAT_MEMORY_DIAGNOSTICS_ENABLED
}

function emit() {
  listeners.forEach((listener) => listener())
}

function resetState() {
  state = {
    messageLists: {},
    previewService: null,
    events: [],
  }
}

function setState(next: ChatMemoryDiagnosticsState) {
  if (!diagnosticsEnabled) {
    return
  }
  state = next
  emit()
}

function persistDiagnosticsEnabled(next: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(CHAT_MEMORY_DIAGNOSTICS_STORAGE_KEY, String(next))
  } catch {
    // Ignore storage failures and keep the in-memory toggle working.
  }
}

export function subscribeChatMemoryDiagnostics(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getChatMemoryDiagnosticsState(): ChatMemoryDiagnosticsState {
  return state
}

export function isChatMemoryDiagnosticsEnabled() {
  return diagnosticsEnabled
}

export function setChatMemoryDiagnosticsEnabled(next: boolean) {
  if (diagnosticsEnabled === next) {
    return
  }

  diagnosticsEnabled = next
  persistDiagnosticsEnabled(next)

  if (!next) {
    resetState()
  }

  emit()
}

export function reportMessageListDiagnostics(snapshot: MessageListDiagnosticsSnapshot | null) {
  if (!diagnosticsEnabled || !snapshot) {
    return
  }
  setState({
    ...state,
    messageLists: {
      ...state.messageLists,
      [snapshot.key]: snapshot,
    },
  })
}

export function clearMessageListDiagnostics(key: string) {
  if (!diagnosticsEnabled || !(key in state.messageLists)) {
    return
  }
  const nextLists = { ...state.messageLists }
  delete nextLists[key]
  setState({
    ...state,
    messageLists: nextLists,
  })
}

export function reportPreviewServiceDiagnostics(snapshot: PreviewServiceDiagnosticsSnapshot) {
  if (!diagnosticsEnabled) {
    return
  }
  setState({
    ...state,
    previewService: snapshot,
  })
}

export function recordChatMemoryEvent(name: string, detail?: string) {
  if (!diagnosticsEnabled) {
    return
  }
  const event: ChatMemoryDiagnosticsEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    at: new Date().toISOString(),
    detail,
  }
  setState({
    ...state,
    events: [event, ...state.events].slice(0, MAX_EVENTS),
  })
}

export function summarizeChatMemoryDiagnostics(input: ChatMemoryDiagnosticsState) {
  const lists = Object.values(input.messageLists)
  return {
    messageListCount: lists.length,
    totalMessages: lists.reduce((sum, item) => sum + item.totalMessages, 0),
    hydratedMessages: lists.reduce((sum, item) => sum + item.hydratedMessages, 0),
    renderedMessages: lists.reduce((sum, item) => sum + item.renderedMessages, 0),
    mountedMessages: lists.reduce((sum, item) => sum + item.mountedMessages, 0),
    visibleMessages: lists.reduce((sum, item) => sum + item.visibleMessages, 0),
    imgNodes: lists.reduce((sum, item) => sum + item.imgNodes, 0),
    viewportNodes: lists.reduce((sum, item) => sum + item.viewportNodes, 0),
    scrollHeight: lists.reduce((max, item) => Math.max(max, item.scrollHeight), 0),
    viewportHeight: lists.reduce((max, item) => Math.max(max, item.viewportHeight), 0),
    previewService: input.previewService,
  }
}
