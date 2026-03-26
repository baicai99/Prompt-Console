const RUNTIME_ERROR_STORAGE_KEY = 'm3:runtime-error-events'
const MAX_RUNTIME_ERROR_EVENTS = 30

export type RuntimeErrorEventKind = 'error' | 'resource-error' | 'unhandledrejection'

export interface RuntimeErrorEventRecord {
  id: string
  kind: RuntimeErrorEventKind
  at: string
  message: string
  stack?: string | null
  filename?: string | null
  lineno?: number | null
  colno?: number | null
  href: string
  userAgent: string
  version: string
}

export interface RuntimeErrorState {
  events: RuntimeErrorEventRecord[]
}

let state: RuntimeErrorState = {
  events: readPersistedRuntimeErrorEvents(),
}

const listeners = new Set<() => void>()
let monitoringInitialized = false

function getRuntimeEnvironmentDetails() {
  if (typeof window === 'undefined') {
    return {
      href: 'server',
      userAgent: 'server',
    }
  }

  return {
    href: window.location.href,
    userAgent: window.navigator.userAgent,
  }
}

function readPersistedRuntimeErrorEvents(): RuntimeErrorEventRecord[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(RUNTIME_ERROR_STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as RuntimeErrorEventRecord[] : []
  } catch {
    return []
  }
}

function persistRuntimeErrorEvents(events: RuntimeErrorEventRecord[]) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(RUNTIME_ERROR_STORAGE_KEY, JSON.stringify(events))
  } catch {
    // Ignore persistence failures and keep the in-memory buffer available.
  }
}

function emit() {
  listeners.forEach((listener) => listener())
}

function setState(next: RuntimeErrorState) {
  state = next
  persistRuntimeErrorEvents(next.events)
  emit()
}

function readErrorMessage(error: unknown): { message: string; stack?: string | null } {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || 'Unknown runtime error',
      stack: error.stack ?? null,
    }
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  if (error && typeof error === 'object') {
    try {
      return { message: JSON.stringify(error) }
    } catch {
      return { message: String(error) }
    }
  }

  return { message: String(error ?? 'Unknown runtime error') }
}

function recordRuntimeErrorEvent(event: RuntimeErrorEventRecord) {
  setState({
    events: [event, ...state.events].slice(0, MAX_RUNTIME_ERROR_EVENTS),
  })
}

function buildBaseRecord(kind: RuntimeErrorEventKind, message: string, extra?: Partial<RuntimeErrorEventRecord>): RuntimeErrorEventRecord {
  const environment = getRuntimeEnvironmentDetails()
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    at: new Date().toISOString(),
    message,
    href: environment.href,
    userAgent: environment.userAgent,
    version: __APP_VERSION__,
    ...extra,
  }
}

function describeResourceError(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) {
    return null
  }

  if (target instanceof HTMLImageElement) {
    return `Resource load failed: img ${target.currentSrc || target.src || '(empty src)'}`
  }
  if (target instanceof HTMLScriptElement) {
    return `Resource load failed: script ${target.src || '(empty src)'}`
  }
  if (target instanceof HTMLLinkElement) {
    return `Resource load failed: link ${target.href || '(empty href)'}`
  }

  return `Resource load failed: ${target.tagName.toLowerCase()}`
}

export function subscribeRuntimeErrorState(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getRuntimeErrorState(): RuntimeErrorState {
  return state
}

export function clearRuntimeErrorState() {
  setState({ events: [] })
}

export function reportRuntimeError(input: {
  kind: RuntimeErrorEventKind
  message: string
  stack?: string | null
  filename?: string | null
  lineno?: number | null
  colno?: number | null
}) {
  recordRuntimeErrorEvent(buildBaseRecord(input.kind, input.message, input))
}

export function initializeRuntimeErrorMonitoring() {
  if (monitoringInitialized || typeof window === 'undefined') {
    return
  }

  monitoringInitialized = true

  window.addEventListener('error', (event) => {
    const resourceMessage = describeResourceError(event.target)
    if (resourceMessage) {
      reportRuntimeError({
        kind: 'resource-error',
        message: resourceMessage,
      })
      return
    }

    const details = readErrorMessage(event.error ?? event.message)
    reportRuntimeError({
      kind: 'error',
      message: details.message,
      stack: details.stack,
      filename: event.filename || null,
      lineno: event.lineno || null,
      colno: event.colno || null,
    })
  }, true)

  window.addEventListener('unhandledrejection', (event) => {
    const details = readErrorMessage(event.reason)
    reportRuntimeError({
      kind: 'unhandledrejection',
      message: details.message,
      stack: details.stack,
    })
  })
}
