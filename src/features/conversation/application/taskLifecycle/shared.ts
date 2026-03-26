import { createRunTaskState, resolveRunTaskStatusFromImages } from '../../domain/runTaskState'
import type { FailureCode } from '../../../../types/image'
import type { Run } from '../../../../types/conversation'

export type TaskExecutionState =
  'queued' | 'running' | 'retry_waiting' | 'polling' | 'succeeded' | 'failed' | 'timeout' | 'cancelled'

const IMAGE_CONCURRENCY_DEBUG_FLAG = '__ENABLE_IMAGE_CONCURRENCY_DEBUG__'

export function isImageConcurrencyDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return (window as Window & { __ENABLE_IMAGE_CONCURRENCY_DEBUG__?: boolean })[IMAGE_CONCURRENCY_DEBUG_FLAG] === true
}

export function logImageTaskLifecycleBoundary(input: {
  phase: 'start' | 'finish'
  queueIndex: number
  seq: number
  context: 'generate' | 'resume'
}) {
  if (!isImageConcurrencyDebugEnabled()) {
    return
  }

  const prefix = input.context === 'resume' ? '（恢复，当前 Run 内第 ' : '（当前 Run 内第 '
  const suffix = input.context === 'resume' ? ' 张）' : ' 张）'
  if (input.phase === 'start') {
    console.debug(`[debug]正在生成第 ${input.queueIndex + 1} 张${prefix}${input.seq}${suffix}`)
    return
  }
  console.debug(`[debug]第${input.queueIndex + 1}张生成完毕${prefix}${input.seq}${suffix}`)
}

export function patchRunImage(run: Run, seq: number, patch: Partial<Run['images'][number]>): Run {
  return {
    ...run,
    images: run.images.map((image) => (
      image.seq === seq
        ? {
            ...image,
            ...patch,
          }
        : image
    )),
  }
}

export function settleRunTaskState(run: Run): Run {
  return {
    ...run,
    taskState: createRunTaskState({
      status: resolveRunTaskStatusFromImages(run),
      now: new Date().toISOString(),
      previous: run.taskState,
    }),
  }
}

export function buildCancelledRunImagePatch(input?: {
  error?: string
  errorCode?: FailureCode
  completedAt?: string
}): Partial<Run['images'][number]> {
  return {
    status: 'failed',
    threadState: 'settled',
    error: input?.error ?? '任务已取消',
    errorCode: input?.errorCode ?? 'unknown',
    completedAt: input?.completedAt,
  }
}

export function buildFailedRunImagePatch(input: {
  error: string
  errorCode?: FailureCode
  requestUrl?: string
  providerTaskStatus?: string
  serverTaskId?: string
  serverTaskMeta?: Record<string, string>
  resumeTransport?: Run['images'][number]['resumeTransport']
  queuedAt?: string
  startedAt?: string
  completedAt?: string
}): Partial<Run['images'][number]> {
  return {
    status: 'failed',
    threadState: 'settled',
    queuedAt: input.queuedAt,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    error: input.error,
    errorCode: input.errorCode ?? 'unknown',
    requestUrl: input.requestUrl,
    providerTaskStatus: input.providerTaskStatus,
    serverTaskId: input.serverTaskId,
    serverTaskMeta: input.serverTaskMeta,
    resumeTransport: input.resumeTransport,
  }
}

export function buildPendingRunImagePatch(input: {
  providerTaskStatus?: string
  serverTaskId?: string
  serverTaskMeta?: Record<string, string>
  resumeTransport?: Run['images'][number]['resumeTransport']
  queuedAt?: string
  startedAt?: string
}): Partial<Run['images'][number]> {
  return {
    status: 'pending',
    threadState: 'active',
    queuedAt: input.queuedAt,
    startedAt: input.startedAt,
    completedAt: undefined,
    providerTaskStatus: input.providerTaskStatus,
    serverTaskId: input.serverTaskId,
    serverTaskMeta: input.serverTaskMeta,
    resumeTransport: input.resumeTransport,
  }
}

export function buildSucceededRunImagePatch(input: {
  requestUrl?: string
  providerTaskStatus?: string
  fileRef?: string
  thumbRef?: string
  fullRef?: string
  refKind?: Run['images'][number]['refKind']
  refKey?: string
  serverTaskId?: string
  serverTaskMeta?: Record<string, string>
  bytes?: number
  resumeTransport?: Run['images'][number]['resumeTransport']
  queuedAt?: string
  startedAt?: string
  completedAt?: string
}): Partial<Run['images'][number]> {
  return {
    status: 'success',
    threadState: 'settled',
    queuedAt: input.queuedAt,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    requestUrl: input.requestUrl,
    providerTaskStatus: input.providerTaskStatus,
    fileRef: input.fileRef,
    thumbRef: input.thumbRef,
    fullRef: input.fullRef,
    refKind: input.refKind,
    refKey: input.refKey,
    serverTaskId: input.serverTaskId,
    serverTaskMeta: input.serverTaskMeta,
    bytes: input.bytes,
    resumeTransport: input.resumeTransport,
    error: undefined,
    errorCode: undefined,
  }
}
