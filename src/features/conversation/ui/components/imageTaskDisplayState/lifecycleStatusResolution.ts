import type { ImageTask, Run } from '../../../../../types/conversation'
import type { FailureCode, ImageItem } from '../../../../../types/image'
import { ensureRunTaskState } from '../../../domain/runTaskState'
import {
  classifyMessagePatterns,
  getFailedStatusLabel,
  getLifecycleLabel,
  isCancelledMessage,
  isRetryWaitingMessage,
} from './failureReasonParsing'
import type { ImageLifecycleStatus, ImagePlaceholderVariant } from './types'

function toEpoch(value: string | null | undefined): number {
  if (typeof value !== 'string' || !value.trim()) {
    return 0
  }
  const epoch = Date.parse(value)
  return Number.isFinite(epoch) ? epoch : 0
}

function resolvePendingAgeMs(image: ImageItem): number {
  const startedAtEpoch = Math.max(
    toEpoch(image.pendingStartedAt),
    toEpoch(image.detachedAt),
    toEpoch(image.lastResumeAttemptAt),
  )
  if (startedAtEpoch <= 0) {
    return 0
  }
  return Math.max(0, Date.now() - startedAtEpoch)
}

export function getResumeTransportLabel(task?: ImageTask, image?: ImageItem | null): string | null {
  const transport = task?.resumeTransport ?? image?.resumeTransport
  if (transport === 'stream') {
    return '链式传输'
  }
  if (transport === 'polling') {
    return '轮询'
  }
  const hasDirectResult = [
    task?.thumbRef,
    task?.fileRef,
    task?.fullRef,
    task?.refKey,
    image?.thumbRef,
    image?.fileRef,
    image?.fullRef,
    image?.refKey,
  ].some((value) => typeof value === 'string' && value.trim().length > 0)
  if (hasDirectResult) {
    return '直连'
  }
  return null
}

function normalizeProviderTaskStatus(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function getProviderTaskPhase(task?: ImageTask, image?: ImageItem): 'queued' | 'generating' | 'failed' | 'blocked' | 'done' | null {
  const status = normalizeProviderTaskStatus(task?.providerTaskStatus ?? image?.providerTaskStatus)
  if (!status) {
    return null
  }
  if (['queued', 'pending', 'submitted', 'accepted', 'waiting', 'in_queue'].includes(status)) {
    return 'queued'
  }
  if (['processing', 'running', 'in_progress', 'progress', 'generating', 'rendering', 'streaming', 'started'].includes(status)) {
    return 'generating'
  }
  if (['succeeded', 'success', 'completed', 'done', 'finished'].includes(status)) {
    return 'done'
  }
  if (['failed', 'error', 'timeout'].includes(status)) {
    return 'failed'
  }
  if (['rejected', 'blocked', 'policy_violation'].includes(status)) {
    return 'blocked'
  }
  return null
}

function hasAcceptedServerTask(task?: ImageTask, image?: ImageItem): boolean {
  return Boolean(
    task?.serverTaskId
    || task?.serverTaskMeta
    || image?.serverTaskId
    || image?.serverTaskMeta,
  )
}

function hasRenderableResult(image?: ImageItem | null, task?: ImageTask): boolean {
  const refs = [
    image?.thumbRef,
    image?.fileRef,
    image?.fullRef,
    image?.refKey,
    task?.thumbRef,
    task?.fileRef,
    task?.fullRef,
    task?.refKey,
  ]
  return refs.some((value) => typeof value === 'string' && value.trim().length > 0)
}

function inferFailureStatusFromCode(input: {
  code?: FailureCode
  message?: string
  task?: ImageTask
  image: ImageItem
}): Exclude<ImageLifecycleStatus, 'waiting' | 'request_sending' | 'queued' | 'generating' | 'preview_ready' | 'completed' | 'retry_waiting'> {
  const normalizedMessage = input.message?.trim().toLowerCase() ?? ''
  switch (input.code) {
    case 'timeout':
      return 'timeout'
    case 'auth':
      return 'auth_failed'
    case 'insufficient_balance':
      return 'insufficient_balance'
    case 'rate_limit':
      return 'service_busy'
    case 'unsupported_param':
      return 'invalid_params'
    case 'rejected':
      return 'sensitive_blocked'
    case 'request_failed':
      return 'request_failed'
    case 'queue_failed':
      return 'queue_failed'
    case 'result_invalid':
      return 'result_invalid'
    case 'cancelled':
      return 'cancelled'
    case 'generation_failed':
      return 'generation_failed'
    default:
      break
  }

  return classifyMessagePatterns({
    normalizedMessage,
    hasAcceptedServerTask: hasAcceptedServerTask(input.task, input.image),
    providerPhase: getProviderTaskPhase(input.task, input.image),
  })
}

export function resolveImageLifecycleStatus(input: {
  run?: Run
  image?: ImageItem | null
  task?: ImageTask
  missingReason?: string
}): ImageLifecycleStatus {
  const image = input.image
  const task = input.task
  if (!image) {
    return 'result_invalid'
  }

  if (image.status === 'success') {
    return hasRenderableResult(image, task) ? 'completed' : 'result_invalid'
  }

  if (image.status === 'failed') {
    if (task?.status === 'retry_waiting' || isRetryWaitingMessage(image.error?.trim() ?? '')) {
      return 'retry_waiting'
    }
    if (task?.status === 'cancelled' || (input.run && ensureRunTaskState(input.run).status === 'cancelled') || isCancelledMessage(image.error?.trim() ?? '')) {
      return 'cancelled'
    }
    return inferFailureStatusFromCode({
      code: image.errorCode ?? task?.errorCode,
      message: image.error ?? task?.error,
      task,
      image,
    })
  }

  const providerPhase = getProviderTaskPhase(task, image)
  if (task?.status === 'retry_waiting') {
    return 'retry_waiting'
  }
  if (task?.status === 'queued') {
    return 'waiting'
  }
  if (task?.status === 'submitting') {
    return 'request_sending'
  }
  if (providerPhase === 'queued') {
    return 'queued'
  }
  if (providerPhase === 'generating' || providerPhase === 'done') {
    return 'generating'
  }
  if (providerPhase === 'blocked') {
    return 'sensitive_blocked'
  }
  if (providerPhase === 'failed') {
    return inferFailureStatusFromCode({
      code: image.errorCode ?? task?.errorCode,
      message: image.error ?? task?.error ?? task?.providerTaskStatus,
      task,
      image,
    })
  }
  if (hasAcceptedServerTask(task, image)) {
    return 'queued'
  }
  if (task?.status === 'polling') {
    return 'queued'
  }
  if (task?.status === 'running') {
    return 'generating'
  }

  const taskState = input.run ? ensureRunTaskState(input.run) : null
  if (taskState?.status === 'waiting') {
    return 'waiting'
  }
  if (taskState?.status === 'timeout') {
    return 'timeout'
  }
  return 'request_sending'
}

function getPendingPlaceholderVariant(run: Run, image: ImageItem, task?: ImageTask): ImagePlaceholderVariant {
  const lifecycleStatus = resolveImageLifecycleStatus({ run, image, task })
  const isDetached = image.threadState === 'detached'
  if (lifecycleStatus === 'waiting' || lifecycleStatus === 'queued') {
    return isDetached ? 'pending-detached' : 'pending-waiting'
  }
  if (lifecycleStatus === 'retry_waiting') {
    return 'retry-waiting'
  }
  if (lifecycleStatus === 'request_sending' || lifecycleStatus === 'generating') {
    const pendingAgeMs = resolvePendingAgeMs(image)
    if (pendingAgeMs < 30_000) {
      return isDetached ? 'pending-detached' : 'pending-generating'
    }
    if (pendingAgeMs < 90_000) {
      return isDetached ? 'pending-detached-slow' : 'pending-slow'
    }
    if (pendingAgeMs < 180_000) {
      return isDetached ? 'pending-detached-slow-wait' : 'pending-slow-wait'
    }
    return isDetached ? 'pending-detached-long-wait' : 'pending-long-wait'
  }
  return isDetached ? 'pending-detached' : 'pending-generating'
}

function resolveFailurePlaceholderVariant(run: Run | undefined, image: ImageItem, task?: ImageTask): ImagePlaceholderVariant {
  const lifecycleStatus = resolveImageLifecycleStatus({ run, image, task })
  if (lifecycleStatus === 'cancelled') {
    return 'cancelled'
  }
  if (lifecycleStatus === 'retry_waiting') {
    return 'retry-waiting'
  }
  if (lifecycleStatus === 'timeout') {
    return 'timeout'
  }
  if (lifecycleStatus === 'result_invalid') {
    return 'missing'
  }
  return 'failed'
}

export function getPendingStatusLabel(run: Run, image: ImageItem, task?: ImageTask): string {
  return getLifecycleLabel(resolveImageLifecycleStatus({ run, image, task }), image.threadState === 'detached')
}

export function resolveImageDisplayState(input: {
  run?: Run
  image?: ImageItem | null
  task?: ImageTask
  missingReason?: string
}): {
  variant: ImagePlaceholderVariant
  label: string
  summaryLabel: string
  isBackground: boolean
  isTerminal: boolean
} {
  const image = input.image
  if (!image) {
    return {
      variant: 'missing',
      label: '结果异常',
      summaryLabel: '结果异常',
      isBackground: false,
      isTerminal: true,
    }
  }

  const lifecycleStatus = resolveImageLifecycleStatus(input)
  const isDetached = image.threadState === 'detached'
  const label = getLifecycleLabel(lifecycleStatus, isDetached)

  if (image.status === 'pending' && input.run) {
    const variant = getPendingPlaceholderVariant(input.run, image, input.task)
    return {
      variant,
      label,
      summaryLabel: label,
      isBackground: variant.startsWith('pending-detached'),
      isTerminal: false,
    }
  }

  if (image.status === 'failed') {
    const variant = resolveFailurePlaceholderVariant(input.run, image, input.task)
    const failedLabel = (
      lifecycleStatus === 'request_failed'
      || lifecycleStatus === 'queue_failed'
      || lifecycleStatus === 'generation_failed'
      || lifecycleStatus === 'invalid_params'
      || lifecycleStatus === 'insufficient_balance'
      || lifecycleStatus === 'service_busy'
      || lifecycleStatus === 'result_invalid'
    )
      ? getFailedStatusLabel({
          lifecycleStatus,
          image,
          task: input.task,
        })
      : label

    return {
      variant,
      label: failedLabel,
      summaryLabel: failedLabel,
      isBackground: false,
      isTerminal: variant !== 'retry-waiting',
    }
  }

  return {
    variant: lifecycleStatus === 'result_invalid' ? 'missing' : 'failed',
    label: lifecycleStatus === 'completed' ? '已完成' : label,
    summaryLabel: lifecycleStatus === 'completed' ? '已完成' : label,
    isBackground: false,
    isTerminal: true,
  }
}
