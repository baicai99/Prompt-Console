import type { ProviderError, ProviderErrorCode } from '../../types/provider'

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function createProviderErrorFactory(providerId: string) {
  return (input: {
    message: string
    code?: ProviderErrorCode
    status?: number
    detail?: string
    retriable?: boolean
  }): ProviderError =>
    Object.assign(new Error(input.message), {
      code: input.code ?? 'unknown',
      status: input.status,
      detail: input.detail,
      retriable: input.retriable ?? false,
      providerId,
    } satisfies Omit<ProviderError, keyof Error>)
}
