import type { ProviderError, ProviderErrorCode } from '../../../types/provider'
import { toOriginLabel } from './urlBuilders'

export function buildUnsupportedModelMessage(
  channelBaseUrl: string,
  selectedModelId: string,
  attemptedModels: string[],
  cause: unknown,
): string {
  const reason = cause instanceof Error ? cause.message : 'unknown provider error'
  const channel = toOriginLabel(channelBaseUrl)
  const attempts = attemptedModels.join(', ')
  return [
    '当前渠道不支持所选图片模型。',
    `渠道: ${channel}`,
    `所选模型: ${selectedModelId}`,
    `已尝试: ${attempts}`,
    '建议: 切换到该渠道支持的图片模型，或更换支持该模型的渠道。',
    `原始错误: ${reason}`,
  ].join(' ')
}

export function buildUnsupportedSizeMessage(selectedSize: string): string {
  return `当前模型不支持 ${selectedSize} 尺寸，请切换别的尺寸重新尝试。`
}

export function isUnsupportedSizeError(status: number, detail: string): boolean {
  if (status !== 451) {
    return false
  }
  const normalized = detail.toLowerCase()
  return (
    normalized.includes('invalidparameter') &&
    normalized.includes('size') &&
    (normalized.includes('image size must be at least') || normalized.includes('`size`'))
  )
}

export function isSensitiveContentError(status: number, detail: string): boolean {
  if (status !== 451) {
    return false
  }
  const normalized = detail.toLowerCase()
  return (
    normalized.includes('outputimagesensitivecontentdetected') ||
    normalized.includes('sensitive content') ||
    normalized.includes('sensitiveinformation')
  )
}

export function createProviderError(input: {
  message: string
  code?: ProviderErrorCode
  status?: number
  detail?: string
  retriable?: boolean
}): ProviderError {
  return Object.assign(new Error(input.message), {
    code: input.code ?? 'unknown',
    status: input.status,
    detail: input.detail,
    retriable: input.retriable ?? false,
    providerId: 'openai-compatible',
  } satisfies Omit<ProviderError, keyof Error>)
}

export function isUnsupportedModelError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const msg = error.message.toLowerCase()
  return msg.includes('not supported model for image generation') || msg.includes('convert_request_failed')
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  return 'name' in error && (error as { name?: unknown }).name === 'AbortError'
}

export function isEndpointMismatchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const status =
    typeof (error as { status?: unknown }).status === 'number'
      ? ((error as { status?: number }).status as number)
      : undefined
  if (status === 404 || status === 405) {
    return true
  }
  const message = error.message.toLowerCase()
  return message.includes('invalid url (post') || message.includes('invalid url')
}
