import type { ImageItem, ImagePreviewSource } from '../types/image'
import { emitImageTaskDebug } from './imageTaskDebug'

export interface ImageChainTraceEvent {
  file: string
  module: string
  fn: string
  stage: string
  level?: 'log' | 'warn' | 'error'
  timestamp?: string
  traceId?: string
  runId?: string
  batchId?: string
  conversationId?: string
  taskId?: string
  imageId?: string
  seq?: number
  branch?: string
  detail?: Record<string, unknown>
  error?: unknown
}

const STRING_PREVIEW_LIMIT = 80

function sanitizeTraceValue(value: unknown, depth = 0): unknown {
  if (value == null) {
    return value
  }
  if (depth > 2) {
    return '[truncated]'
  }
  if (typeof value === 'string') {
    return value.length > 280 ? `${value.slice(0, 280)}...` : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Blob) {
    return summarizeBlob(value)
  }
  if (value instanceof Error) {
    return summarizeError(value)
  }
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => sanitizeTraceValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 20)
        .map(([key, item]) => [key, sanitizeTraceValue(item, depth + 1)]),
    )
  }
  return String(value)
}

export function isImageChainTraceEnabled(): boolean {
  return true
}

export function summarizeString(value: unknown, maxPreview = STRING_PREVIEW_LIMIT): Record<string, unknown> {
  if (typeof value !== 'string') {
    return {
      present: false,
      type: value == null ? 'nullish' : typeof value,
    }
  }
  const trimmed = value.trim()
  return {
    present: true,
    isEmpty: trimmed.length === 0,
    length: value.length,
    trimmedLength: trimmed.length,
    preview: trimmed.slice(0, maxPreview),
  }
}

export function summarizeBlob(blob: Blob | null | undefined): Record<string, unknown> {
  if (!blob) {
    return {
      present: false,
    }
  }
  return {
    present: true,
    type: blob.type || 'application/octet-stream',
    size: blob.size,
  }
}

export function summarizeImagePayload(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') {
    return {
      present: false,
      type: value == null ? 'nullish' : typeof value,
    }
  }

  const trimmed = value.trim()
  const summary: Record<string, unknown> = {
    present: true,
    isEmpty: trimmed.length === 0,
    length: value.length,
    trimmedLength: trimmed.length,
    preview: trimmed.slice(0, STRING_PREVIEW_LIMIT),
  }

  if (!trimmed) {
    return summary
  }

  if (/^data:/i.test(trimmed)) {
    const commaIndex = trimmed.indexOf(',')
    const header = commaIndex >= 0 ? trimmed.slice(0, commaIndex) : trimmed
    const payload = commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : ''
    return {
      ...summary,
      kind: 'data-url',
      mimeType: header.match(/^data:([^;,]+)/i)?.[1] ?? 'unknown',
      isBase64: /;base64/i.test(header),
      headerPreview: header.slice(0, STRING_PREVIEW_LIMIT),
      payloadLength: payload.length,
      payloadPreview: payload.slice(0, STRING_PREVIEW_LIMIT),
    }
  }

  if (/^blob:/i.test(trimmed)) {
    return {
      ...summary,
      kind: 'blob-url',
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return {
      ...summary,
      kind: 'remote-url',
    }
  }

  if (/^[A-Za-z0-9+/=_-]+$/.test(trimmed)) {
    return {
      ...summary,
      kind: 'base64-like',
    }
  }

  return {
    ...summary,
    kind: 'unknown-string',
  }
}

export function summarizeImagePreviewSource(source: ImagePreviewSource | null | undefined): Record<string, unknown> {
  if (!source) {
    return {
      present: false,
    }
  }

  return {
    present: true,
    refKind: source.refKind ?? null,
    src: summarizeImagePayload(source.src),
    refKey: summarizeString(source.refKey),
  }
}

export function summarizeImageRefs(
  image:
    | Pick<ImageItem, 'status' | 'requestUrl' | 'thumbRef' | 'fileRef' | 'fullRef' | 'refKind' | 'refKey' | 'bytes' | 'error'>
    | null
    | undefined,
): Record<string, unknown> {
  if (!image) {
    return {
      present: false,
    }
  }

  return {
    present: true,
    status: image.status,
    requestUrl: summarizeString(image.requestUrl),
    thumbRef: summarizeImagePayload(image.thumbRef),
    fileRef: summarizeImagePayload(image.fileRef),
    fullRef: summarizeImagePayload(image.fullRef),
    refKind: image.refKind ?? null,
    refKey: summarizeString(image.refKey),
    bytes: image.bytes ?? null,
    error: summarizeString(image.error),
  }
}

export function summarizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 4).join('\n') ?? null,
    }
  }
  if (error && typeof error === 'object') {
    return Object.fromEntries(
      Object.entries(error as Record<string, unknown>)
        .slice(0, 12)
        .map(([key, value]) => [key, sanitizeTraceValue(value, 1)]),
    )
  }
  return {
    value: sanitizeTraceValue(error),
  }
}

function getMemorySnapshot(): Record<string, unknown> | undefined {
  if (typeof performance === 'undefined') {
    return undefined
  }
  const perf = performance as Performance & {
    memory?: {
      usedJSHeapSize?: number
      totalJSHeapSize?: number
      jsHeapSizeLimit?: number
    }
  }
  if (!perf.memory) {
    return undefined
  }
  return {
    usedJSHeapSize: perf.memory.usedJSHeapSize ?? null,
    totalJSHeapSize: perf.memory.totalJSHeapSize ?? null,
    jsHeapSizeLimit: perf.memory.jsHeapSizeLimit ?? null,
  }
}

export function emitImageChainTrace(event: ImageChainTraceEvent): void {
  if (!isImageChainTraceEnabled()) {
    return
  }

  const timestamp = event.timestamp ?? new Date().toISOString()
  const sanitizedDetail = sanitizeTraceValue(event.detail)
  emitImageTaskDebug({
    stage: event.stage,
    timestamp,
    runId: event.runId,
    batchId: event.batchId,
    conversationId: event.conversationId,
    taskId: event.taskId,
    imageId: event.imageId,
    seq: event.seq,
    branch: event.branch,
    error: event.error ? summarizeError(event.error) : undefined,
    detail: {
      scope: 'image-chain',
      traceId: event.traceId ?? event.runId ?? null,
      file: event.file,
      module: event.module,
      fn: event.fn,
      level: event.level ?? 'log',
      memory: getMemorySnapshot() ?? null,
      ...(sanitizedDetail && typeof sanitizedDetail === 'object'
        ? sanitizedDetail as Record<string, unknown>
        : {}),
    },
  })
}

export function emitStorageEstimateTrace(input: Omit<ImageChainTraceEvent, 'detail'> & {
  detail?: Record<string, unknown>
}): void {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return
  }

  void navigator.storage.estimate()
    .then((estimate) => {
      emitImageChainTrace({
        ...input,
        detail: {
          ...input.detail,
          storageEstimate: {
            usage: estimate.usage ?? null,
            quota: estimate.quota ?? null,
          },
        },
      })
    })
    .catch((error) => {
      emitImageChainTrace({
        ...input,
        level: 'warn',
        stage: `${input.stage}_storage_estimate_failed`,
        error,
        detail: input.detail,
      })
    })
}
