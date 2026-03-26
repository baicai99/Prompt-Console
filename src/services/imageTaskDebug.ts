import type { ApiChannel } from '../types/channel'
import type { LogDetailLevel, LoggingFeatureKey, LoggingSettings } from '../types/conversation'
import { DEFAULT_LOGGING_SETTINGS } from '../utils/loggingSettings'

export interface ImageTaskDebugEvent {
  stage: string
  timestamp?: string
  runId?: string
  batchId?: string
  taskId?: string
  imageId?: string
  seq?: number
  conversationId?: string
  provider?: string
  model?: string
  channelId?: string | null
  channelName?: string | null
  state?: string
  previousState?: string
  nextState?: string
  branch?: string
  label?: string
  uiUpdated?: boolean
  pollTriggered?: boolean
  responseSummary?: unknown
  parsed?: Record<string, unknown>
  error?: unknown
  detail?: Record<string, unknown>
}

export interface LoggingEntry {
  id: string
  feature: LoggingFeatureKey
  level: LogDetailLevel
  timestamp: string
  stage: string
  runId: string | null
  batchId: string | null
  taskId: string | null
  imageId: string | null
  seq: number | null
  conversationId: string | null
  provider: string | null
  model: string | null
  channelId: string | null
  channelName: string | null
  state: string | null
  previousState: string | null
  nextState: string | null
  branch: string | null
  label: string | null
  uiUpdated: boolean | null
  pollTriggered: boolean | null
  responseSummary?: unknown
  parsed?: unknown
  error?: unknown
  detail?: unknown
}

const UI_RENDER_CACHE = new Map<string, string>()
const LOG_BUFFER_LIMIT = 600
const listeners = new Set<() => void>()
let entrySequence = 0
let loggingSettings: LoggingSettings = DEFAULT_LOGGING_SETTINGS
let entries: LoggingEntry[] = []

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value == null) {
    return value
  }
  if (depth > 2) {
    return '[truncated]'
  }
  if (typeof value === 'string') {
    return value.length > 280 ? `${value.slice(0, 280)}…` : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.split('\n').slice(0, 3).join('\n'),
    }
  }
  if (Array.isArray(value)) {
    return value.slice(0, 6).map((item) => sanitizeValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 16)
        .map(([key, item]) => [key, sanitizeValue(item, depth + 1)]),
    )
  }
  return String(value)
}

function notify(): void {
  listeners.forEach((listener) => listener())
}

function detailRank(level: LogDetailLevel): number {
  switch (level) {
    case 'brief':
      return 0
    case 'standard':
      return 1
    case 'verbose':
    default:
      return 2
  }
}

function resolveStageLevel(stage: string): LogDetailLevel {
  if ([
    'provider_first_response_raw',
    'executor_progress_received',
    'task_progress_received',
    'stream_event_received',
    'ui_placeholder_rendered',
    'run_image_update_skipped',
    'task_progress_ignored',
    'task_state_ignored',
  ].includes(stage)) {
    return 'verbose'
  }
  if ([
    'global_pool_task_registered',
    'local_queue_entered',
    'task_state_received',
    'task_registry_updated',
    'run_image_state_updated',
    'run_task_state_updated',
    'provider_gateway_generate_start',
    'provider_gateway_resume_start',
    'provider_gateway_stream_start',
    'resume_flow_entered',
    'resume_state_applied',
    'executor_task_state_emitted',
    'ui_run_summary_rendered',
  ].includes(stage)) {
    return 'standard'
  }
  return 'brief'
}

function shouldRecord(feature: LoggingFeatureKey, stage: string): boolean {
  if (!loggingSettings.enabled) {
    return false
  }
  if (!loggingSettings.features[feature]) {
    return false
  }
  return detailRank(loggingSettings.detailLevel) >= detailRank(resolveStageLevel(stage))
}

function appendEntry(feature: LoggingFeatureKey, event: ImageTaskDebugEvent): void {
  if (!shouldRecord(feature, event.stage)) {
    return
  }
  entrySequence += 1
  const nextEntry: LoggingEntry = {
    id: `${event.timestamp ?? Date.now()}-${entrySequence}`,
    feature,
    level: resolveStageLevel(event.stage),
    timestamp: event.timestamp ?? new Date().toISOString(),
    stage: event.stage,
    runId: event.runId ?? null,
    batchId: event.batchId ?? null,
    taskId: event.taskId ?? null,
    imageId: event.imageId ?? null,
    seq: event.seq ?? null,
    conversationId: event.conversationId ?? null,
    provider: event.provider ?? null,
    model: event.model ?? null,
    channelId: event.channelId ?? null,
    channelName: event.channelName ?? null,
    state: event.state ?? null,
    previousState: event.previousState ?? null,
    nextState: event.nextState ?? null,
    branch: event.branch ?? null,
    label: event.label ?? null,
    uiUpdated: event.uiUpdated ?? null,
    pollTriggered: event.pollTriggered ?? null,
    responseSummary: sanitizeValue(event.responseSummary),
    parsed: sanitizeValue(event.parsed),
    error: sanitizeValue(event.error),
    detail: sanitizeValue(event.detail),
  }
  entries = [...entries.slice(-(LOG_BUFFER_LIMIT - 1)), nextEntry]
  notify()
}

export function summarizeProviderPayload(payload: unknown): unknown {
  return sanitizeValue(payload)
}

export function getChannelDebugMeta(
  channel: Pick<ApiChannel, 'id' | 'name' | 'providerId'> | null | undefined,
): Pick<ImageTaskDebugEvent, 'provider' | 'channelId' | 'channelName'> {
  return {
    provider: channel?.providerId ?? 'unknown',
    channelId: channel?.id ?? null,
    channelName: channel?.name ?? null,
  }
}

export function setLoggingSettingsForRuntime(next: LoggingSettings): void {
  loggingSettings = next
}

export function getLoggingEntries(): LoggingEntry[] {
  return entries
}

export function subscribeLoggingEntries(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function clearLoggingEntries(): void {
  entries = []
  notify()
}

export function getLoggingDebugStats() {
  return {
    entryCount: entries.length,
    bufferLimit: LOG_BUFFER_LIMIT,
    uiRenderCacheSize: UI_RENDER_CACHE.size,
    subscriberCount: listeners.size,
    loggingEnabled: loggingSettings.enabled,
    detailLevel: loggingSettings.detailLevel,
  }
}

export function emitImageTaskDebug(event: ImageTaskDebugEvent): void {
  appendEntry('imageGeneration', event)
}

export function emitUiRenderDebug(input: {
  cacheKey: string
  stage: string
  label: string
  runId?: string
  batchId?: string
  taskId?: string
  imageId?: string
  seq?: number
  provider?: string
  model?: string
  channelId?: string | null
  channelName?: string | null
  state?: string
  detail?: Record<string, unknown>
}): void {
  const nextSignature = JSON.stringify({
    label: input.label,
    state: input.state ?? null,
    detail: sanitizeValue(input.detail),
  })
  if (UI_RENDER_CACHE.get(input.cacheKey) === nextSignature) {
    return
  }
  UI_RENDER_CACHE.set(input.cacheKey, nextSignature)
  emitImageTaskDebug({
    stage: input.stage,
    runId: input.runId,
    batchId: input.batchId,
    taskId: input.taskId,
    imageId: input.imageId,
    seq: input.seq,
    provider: input.provider,
    model: input.model,
    channelId: input.channelId,
    channelName: input.channelName,
    state: input.state,
    label: input.label,
    uiUpdated: true,
    detail: input.detail,
  })
}
