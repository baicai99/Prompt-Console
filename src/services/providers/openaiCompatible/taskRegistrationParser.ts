import type { NormalizedResumeResult } from '../../../types/provider'
import { buildGenerationUrl } from './urlBuilders'
import { toImageSrc, type RawImageItem } from './imagePayloadParser'

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function pickTaskId(source: Record<string, unknown> | null | undefined): string | undefined {
  if (!source) {
    return undefined
  }
  return (
    readString(source.task_id) ??
    readString(source.taskId) ??
    readString(source.job_id) ??
    readString(source.jobId) ??
    readString(source.request_id) ??
    readString(source.requestId) ??
    readString(source.id)
  )
}

export function pickResumeUrl(source: Record<string, unknown> | null | undefined): string | undefined {
  if (!source) {
    return undefined
  }
  return (
    readString(source.status_url) ??
    readString(source.statusUrl) ??
    readString(source.poll_url) ??
    readString(source.pollUrl) ??
    readString(source.result_url) ??
    readString(source.resultUrl)
  )
}

export function buildTaskMeta(input: {
  requestUrl?: string
  taskId?: string
  resumeUrl?: string
  location?: string
}): Record<string, string> | undefined {
  const meta: Record<string, string> = {}
  if (input.requestUrl) {
    meta.requestUrl = input.requestUrl
  }
  if (input.resumeUrl) {
    meta.resumeUrl = input.resumeUrl
  }
  if (input.location) {
    meta.location = input.location
  }
  return Object.keys(meta).length > 0 ? meta : undefined
}

export function hasAcceptedAsyncHandle(input: {
  taskId?: string
  taskMeta?: Record<string, string>
  providerTaskStatus?: string
}): boolean {
  const normalizedStatus = (input.providerTaskStatus ?? '').trim().toLowerCase()
  return Boolean(
    input.taskId
    || input.taskMeta?.resumeUrl
    || input.taskMeta?.location
    || ['queued', 'pending', 'submitted', 'accepted', 'waiting', 'in_queue', 'processing', 'running', 'in_progress'].includes(normalizedStatus),
  )
}

export function parseTaskRegistration(input: {
  baseUrl: string
  requestUrl?: string
  payload: unknown
  response: Response
}): { providerTaskStatus?: string; serverTaskId?: string; serverTaskMeta?: Record<string, string> } {
  const getHeader = (name: string): string | undefined => {
    const headers = (input.response as Response & { headers?: Headers }).headers
    if (!headers || typeof headers.get !== 'function') {
      return undefined
    }
    return readString(headers.get(name))
  }
  const payloadRecord =
    input.payload && typeof input.payload === 'object' ? (input.payload as Record<string, unknown>) : undefined
  const payloadData =
    Array.isArray(payloadRecord?.data)
      ? (payloadRecord?.data[0] as Record<string, unknown> | undefined)
      : payloadRecord?.data && typeof payloadRecord.data === 'object'
        ? (payloadRecord.data as Record<string, unknown>)
        : undefined
  const taskId =
    pickTaskId(payloadData) ??
    pickTaskId(payloadRecord) ??
    getHeader('x-task-id') ??
    getHeader('x-request-id')
  const resumeUrl =
    pickResumeUrl(payloadData) ??
    pickResumeUrl(payloadRecord) ??
    getHeader('location')
  const providerTaskStatus =
    readString(payloadRecord?.status) ??
    readString(payloadData?.status) ??
    readString(payloadData?.task_status)
  const serverTaskMeta = buildTaskMeta({
    requestUrl: input.requestUrl,
    taskId,
    resumeUrl: resumeUrl ?? (taskId ? `${buildGenerationUrl(input.baseUrl)}/${encodeURIComponent(taskId)}` : undefined),
    location: getHeader('location'),
  })
  return {
    providerTaskStatus,
    serverTaskId: taskId,
    serverTaskMeta: hasAcceptedAsyncHandle({
      taskId,
      taskMeta: serverTaskMeta,
      providerTaskStatus,
    })
      ? serverTaskMeta
      : (input.requestUrl ? { requestUrl: input.requestUrl } : undefined),
  }
}

export function isPendingTaskPayload(input: {
  payload: unknown
  response: Response
  taskId?: string
  taskMeta?: Record<string, string>
}): boolean {
  if (input.response.status === 202) {
    return true
  }
  if (input.taskId || input.taskMeta?.resumeUrl) {
    const payloadRecord =
      input.payload && typeof input.payload === 'object' ? (input.payload as Record<string, unknown>) : undefined
    const payloadData =
      Array.isArray(payloadRecord?.data)
        ? (payloadRecord?.data[0] as Record<string, unknown> | undefined)
        : payloadRecord?.data && typeof payloadRecord.data === 'object'
          ? (payloadRecord.data as Record<string, unknown>)
          : undefined
    const status =
      readString(payloadRecord?.status) ??
      readString(payloadData?.status) ??
      readString(payloadData?.task_status)
    if (!status) {
      return true
    }
    const normalized = status.toLowerCase()
    return [
      'queued',
      'pending',
      'processing',
      'running',
      'submitted',
      'accepted',
      'submitted（已提交）',
      'processing（处理中）',
    ].includes(normalized)
  }
  return false
}

export function resolveResumeUrl(channelBaseUrl: string, taskId?: string, taskMeta?: Record<string, string>): string | null {
  const explicit = taskMeta?.resumeUrl ?? taskMeta?.location
  if (explicit) {
    return explicit
  }
  if (!taskId) {
    return null
  }
  return `${buildGenerationUrl(channelBaseUrl)}/${encodeURIComponent(taskId)}`
}

export function resolveResumeResultFromPayload(input: {
  channelBaseUrl: string
  taskId?: string
  taskMeta?: Record<string, string>
  response: Response
  payload: unknown
}): NormalizedResumeResult {
  const taskRegistration = parseTaskRegistration({
    baseUrl: input.channelBaseUrl,
    payload: input.payload,
    response: input.response,
  })

  if (!input.response.ok) {
    if (input.response.status === 404 || input.response.status === 410) {
      return {
        state: 'failed',
        error: `HTTP ${input.response.status}`,
        providerTaskStatus: taskRegistration.providerTaskStatus,
        serverTaskId: taskRegistration.serverTaskId ?? input.taskId,
        serverTaskMeta: taskRegistration.serverTaskMeta ?? input.taskMeta,
      }
    }

    return {
      state: 'pending',
      providerTaskStatus: taskRegistration.providerTaskStatus,
      serverTaskId: taskRegistration.serverTaskId ?? input.taskId,
      serverTaskMeta: taskRegistration.serverTaskMeta ?? input.taskMeta,
    }
  }

  const payloadRecord = input.payload && typeof input.payload === 'object'
    ? (input.payload as { data?: unknown; error?: unknown })
    : {}
  const items = Array.isArray(payloadRecord.data) ? (payloadRecord.data as RawImageItem[]) : []
  const first = items.map((item) => toImageSrc(item)).find((value): value is string => Boolean(value))
  if (first) {
    return {
      state: 'success',
      src: first,
      serverTaskId: taskRegistration.serverTaskId ?? input.taskId,
      serverTaskMeta: taskRegistration.serverTaskMeta ?? input.taskMeta,
    }
  }

  if (isPendingTaskPayload({
    payload: input.payload,
    response: input.response,
    taskId: taskRegistration.serverTaskId ?? input.taskId,
    taskMeta: taskRegistration.serverTaskMeta ?? input.taskMeta,
  })) {
    return {
      state: 'pending',
      providerTaskStatus: taskRegistration.providerTaskStatus,
      serverTaskId: taskRegistration.serverTaskId ?? input.taskId,
      serverTaskMeta: taskRegistration.serverTaskMeta ?? input.taskMeta,
    }
  }

  const normalizedError =
    typeof payloadRecord.error === 'string' && payloadRecord.error.trim() ? payloadRecord.error.trim() : undefined
  return {
    state: 'failed',
    error: normalizedError ?? 'task completed without image payload',
    providerTaskStatus: taskRegistration.providerTaskStatus,
    serverTaskId: taskRegistration.serverTaskId ?? input.taskId,
    serverTaskMeta: taskRegistration.serverTaskMeta ?? input.taskMeta,
  }
}

export async function parseJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

export function parseSseDataBlocks(buffer: string): string[] {
  return buffer
    .split('\n\n')
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n'),
    )
    .filter(Boolean)
}
