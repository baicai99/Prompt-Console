import type { ImageTask } from '../../../../../types/conversation'
import type { ImageItem } from '../../../../../types/image'
import type { ImageLifecycleStatus } from './types'
import { isInsufficientBalanceMessage } from '../../../../../utils/insufficientBalance'

const RETRY_WAIT_PATTERNS = [
  /正在等待第\s*\d+\s*轮/i,
  /等待下一轮/i,
  /正在等待重试/i,
]
const CANCELLED_PATTERNS = [
  /已中断/i,
  /已取消/i,
  /任务已取消/i,
  /cancelled/i,
  /aborted/i,
]
const REQUEST_FAILURE_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /network error/i,
  /networkerror/i,
  /cors/i,
  /dns/i,
  /connection/i,
]
const QUEUE_FAILURE_PATTERNS = [
  /no usable image returned/i,
  /missing task/i,
  /missing job id/i,
  /empty queue response/i,
  /invalid queue response/i,
]
const RESULT_INVALID_PATTERNS = [
  /invalid base64/i,
  /broken image/i,
  /without image payload/i,
  /结果损坏/i,
  /结果异常/i,
]
const SERVICE_BUSY_PATTERNS = [
  /当前分组上游负载已饱和/i,
  /上游负载已饱和/i,
  /服务暂时繁忙/i,
  /server\s*busy/i,
  /temporar(?:y|ily)\s+unavailable/i,
  /overloaded/i,
]
const SHORT_REASON_MAX_CHARS = 18

export function isRetryWaitingMessage(message: string): boolean {
  return RETRY_WAIT_PATTERNS.some((pattern) => pattern.test(message))
}

export function isCancelledMessage(message: string): boolean {
  return CANCELLED_PATTERNS.some((pattern) => pattern.test(message))
}

function toSingleLineText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function stripQuotedWrapper(value: string): string {
  const normalized = value.trim()
  if (
    (normalized.startsWith('"') && normalized.endsWith('"'))
    || (normalized.startsWith('\'') && normalized.endsWith('\''))
    || (normalized.startsWith('`') && normalized.endsWith('`'))
  ) {
    return normalized.slice(1, -1).trim()
  }
  return normalized
}

function extractMessageField(value: string): string {
  const objectMessageMatch = value.match(/"message"\s*:\s*"([^"]+)"/i)
  if (objectMessageMatch?.[1]) {
    return objectMessageMatch[1].trim()
  }

  const plainMessageMatch = value.match(/\bmessage\s*:\s*(.+)$/i)
  if (plainMessageMatch?.[1]) {
    return plainMessageMatch[1].trim()
  }

  return value
}

function humanizeKnownFailureReason(value: string): string {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }

  if (isInsufficientBalanceMessage(normalized)) {
    return '余额不足'
  }

  if (
    /bad_response_status_code/i.test(normalized)
    || /openai_error/i.test(normalized)
    || /upstream.+status/i.test(normalized)
    || /unexpected status/i.test(normalized)
    || /status code/i.test(normalized)
    || /http\s*50\d/i.test(normalized)
  ) {
    return '上游服务器异常状态'
  }

  if (SERVICE_BUSY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return '上游繁忙'
  }

  if (
    REQUEST_FAILURE_PATTERNS.some((pattern) => pattern.test(normalized))
  ) {
    return '网络异常'
  }

  if (/invalid base64/i.test(normalized) || /broken image/i.test(normalized) || /without image payload/i.test(normalized)) {
    return '返回结果无效'
  }

  if (/size/i.test(normalized) || /aspect ratio/i.test(normalized) || /尺寸/i.test(normalized) || /比例/i.test(normalized)) {
    return '尺寸不支持'
  }

  if (/sensitive/i.test(normalized) || /敏感词/i.test(normalized) || /rejected/i.test(normalized)) {
    return '内容不合规'
  }

  if (/auth/i.test(normalized) || /unauthorized/i.test(normalized) || /forbidden/i.test(normalized) || /token/i.test(normalized)) {
    return '鉴权失败'
  }

  if (/[\u4e00-\u9fff]/.test(normalized) && !/^[a-z0-9_.-]+$/i.test(normalized)) {
    return normalized
  }

  return ''
}

function trimFailureReason(value: string): string {
  const normalized = toSingleLineText(value)
  if (!normalized) {
    return ''
  }
  if (normalized.length <= SHORT_REASON_MAX_CHARS) {
    return normalized
  }
  return `${normalized.slice(0, SHORT_REASON_MAX_CHARS).trimEnd()}...`
}

export function getLifecycleLabel(status: ImageLifecycleStatus, isDetached: boolean): string {
  if (isDetached) {
    switch (status) {
      case 'queued':
        return '后台排队中'
      case 'generating':
        return '后台生成中'
      case 'completed':
        return '后台已完成'
      default:
        break
    }
  }

  switch (status) {
    case 'waiting':
      return '等待中'
    case 'request_sending':
      return '请求发送中'
    case 'queued':
      return '排队中'
    case 'generating':
      return '生成中'
    case 'preview_ready':
      return '已生成'
    case 'completed':
      return '已完成'
    case 'request_failed':
      return '请求失败'
    case 'queue_failed':
      return '排队失败'
    case 'generation_failed':
      return '生成失败'
    case 'timeout':
      return '已超时'
    case 'cancelled':
      return '已取消'
    case 'sensitive_blocked':
      return '敏感词已拦截'
    case 'invalid_params':
      return '参数错误'
    case 'insufficient_balance':
      return '余额不足'
    case 'auth_failed':
      return '认证失败'
    case 'service_busy':
      return '服务繁忙'
    case 'result_invalid':
      return '结果异常'
    case 'retry_waiting':
      return '等待重试'
    default:
      return '请求发送中'
  }
}

export function getFailedStatusLabel(input: {
  lifecycleStatus: Exclude<ImageLifecycleStatus, 'waiting' | 'request_sending' | 'queued' | 'generating' | 'preview_ready' | 'completed' | 'retry_waiting' | 'timeout' | 'cancelled'>
  image: ImageItem
  task?: ImageTask
}): string {
  const rawMessage = input.image.error?.trim() || input.task?.error?.trim() || input.task?.providerTaskStatus?.trim() || ''
  const baseLabel = getLifecycleLabel(input.lifecycleStatus, false)
  if (!rawMessage) {
    return baseLabel
  }

  let normalized = rawMessage
    .replace(/^http\s*\d+\s*:\s*/i, '')
    .replace(/^error\s*:\s*/i, '')
    .replace(/^provider error\s*:\s*/i, '')
    .replace(/^request failed\s*:\s*/i, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bat\s+\S+\s*\(.+?\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  normalized = extractMessageField(normalized)
  normalized = stripQuotedWrapper(normalized)
  normalized = stripQuotedWrapper(normalized.replace(/^[{[]|[}\]]$/g, '').trim())
  normalized = normalized
    .replace(/^[A-Za-z_]+\s*:\s*/g, '')
    .replace(/[{}[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const compact = trimFailureReason(humanizeKnownFailureReason(normalized))
  if (!compact || compact === baseLabel) {
    return baseLabel
  }
  return `${baseLabel}：${compact}`
}

export function classifyMessagePatterns(input: {
  normalizedMessage: string
  hasAcceptedServerTask: boolean
  providerPhase: 'queued' | 'generating' | 'failed' | 'blocked' | 'done' | null
}): 'result_invalid' | 'queue_failed' | 'service_busy' | 'request_failed' | 'generation_failed' | 'insufficient_balance' {
  if (RESULT_INVALID_PATTERNS.some((pattern) => pattern.test(input.normalizedMessage))) {
    return 'result_invalid'
  }
  if (QUEUE_FAILURE_PATTERNS.some((pattern) => pattern.test(input.normalizedMessage))) {
    return 'queue_failed'
  }
  if (isInsufficientBalanceMessage(input.normalizedMessage)) {
    return 'insufficient_balance'
  }
  if (SERVICE_BUSY_PATTERNS.some((pattern) => pattern.test(input.normalizedMessage))) {
    return 'service_busy'
  }
  if (REQUEST_FAILURE_PATTERNS.some((pattern) => pattern.test(input.normalizedMessage))) {
    return 'request_failed'
  }
  if (input.hasAcceptedServerTask || input.providerPhase === 'generating') {
    return 'generation_failed'
  }
  return 'request_failed'
}
