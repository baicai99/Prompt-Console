import type { FailureCode } from '../../../types/image'
import type { ProviderErrorCode } from '../../../types/provider'
import { isInsufficientBalanceMessage } from '../../../utils/insufficientBalance'

export function classifyFailure(message: string): FailureCode {
  const normalized = message.toLowerCase()
  if (
    normalized.includes('cancelled')
    || normalized.includes('canceled')
    || normalized.includes('aborted')
    || normalized.includes('已取消')
    || normalized.includes('已中断')
  ) {
    return 'cancelled'
  }
  if (normalized.includes('timeout') || normalized.includes('timed out') || normalized.includes('超时')) {
    return 'timeout'
  }
  if (isInsufficientBalanceMessage(message)) {
    return 'insufficient_balance'
  }
  if (normalized.includes('unauthorized') || normalized.includes('forbidden') || normalized.includes('鉴权') || normalized.includes('api key') || normalized.includes('api_key') || normalized.includes('401') || normalized.includes('403')) {
    return 'auth'
  }
  if (
    normalized.includes('rate')
    || normalized.includes('429')
    || normalized.includes('限流')
    || normalized.includes('too many requests')
    || normalized.includes('server busy')
    || normalized.includes('temporarily unavailable')
    || normalized.includes('temporarily overloaded')
    || normalized.includes('服务暂时繁忙')
    || normalized.includes('上游负载已饱和')
  ) {
    return 'rate_limit'
  }
  if (
    normalized.includes('size') ||
    normalized.includes('resolution') ||
    normalized.includes('aspect ratio') ||
    normalized.includes('不支持尺寸') ||
    normalized.includes('invalid_dimensions') ||
    normalized.includes('unsupported')
  ) {
    return 'unsupported_param'
  }
  if (
    normalized.includes('sensitive')
    || normalized.includes('rejected')
    || normalized.includes('内容违规')
    || normalized.includes('safety')
    || normalized.includes('policy violation')
    || normalized.includes('blocked')
  ) {
    return 'rejected'
  }
  if (
    normalized.includes('failed to fetch')
    || normalized.includes('networkerror')
    || normalized.includes('network error')
    || normalized.includes('load failed')
    || normalized.includes('dns')
    || normalized.includes('cors')
    || normalized.includes('fetch failed')
    || normalized.includes('connection refused')
    || normalized.includes('connection reset')
  ) {
    return 'request_failed'
  }
  if (
    normalized.includes('missing task')
    || normalized.includes('missing task id')
    || normalized.includes('missing job id')
    || normalized.includes('queue failed')
    || normalized.includes('invalid queue response')
    || normalized.includes('empty queue response')
  ) {
    return 'queue_failed'
  }
  if (
    normalized.includes('result invalid')
    || normalized.includes('invalid base64')
    || normalized.includes('broken image')
    || normalized.includes('missing image payload')
    || normalized.includes('task completed without image payload')
  ) {
    return 'result_invalid'
  }
  if (
    normalized.includes('generation failed')
    || normalized.includes('render failed')
    || normalized.includes('processing failed')
  ) {
    return 'generation_failed'
  }
  return 'unknown'
}

export function classifyProviderErrorCode(code: ProviderErrorCode | null | undefined): FailureCode | null {
  switch (code) {
    case 'auth':
      return 'auth'
    case 'insufficient_balance':
      return 'insufficient_balance'
    case 'rate_limit':
      return 'rate_limit'
    case 'timeout':
      return 'timeout'
    case 'unsupported_param':
      return 'unsupported_param'
    case 'rejected':
      return 'rejected'
    default:
      return null
  }
}

export function classifyFailureFromError(error: unknown): FailureCode {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = classifyProviderErrorCode((error as { code?: ProviderErrorCode }).code)
    if (code) {
      return code
    }
  }

  if (typeof error === 'string') {
    return classifyFailure(error)
  }

  return classifyFailure(error instanceof Error ? error.message : '')
}
