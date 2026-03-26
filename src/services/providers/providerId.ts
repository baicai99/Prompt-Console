import type { ProviderId } from '../../types/provider'

const OPENAI_COMPATIBLE_PROVIDER_ID: ProviderId = 'openai-compatible'
const MIDJOURNEY_PROVIDER_ID: ProviderId = 'midjourney-proxy'
const GEMINI_PROVIDER_ID: ProviderId = 'gemini-api'
const BYTEPLUS_PROVIDER_ID: ProviderId = 'byteplus-ark'

function normalizeProviderId(value: unknown): ProviderId | null {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }
  return normalized as ProviderId
}

function inferProviderFromBaseUrl(baseUrl: string, apiKey?: string): ProviderId {
  const value = baseUrl.toLowerCase()
  const normalizedApiKey = typeof apiKey === 'string' ? apiKey.trim() : ''
  if (value.includes('midjourney') || value.includes('/mj') || value.includes('mjapi')) {
    return MIDJOURNEY_PROVIDER_ID
  }
  if (
    value.includes('bytepluses.com') ||
    value.includes('console.byteplus.com')
  ) {
    return BYTEPLUS_PROVIDER_ID
  }
  if (
    value.includes('generativelanguage.googleapis.com') ||
    value.includes('/v1beta/models') ||
    value.includes('/v1/models') ||
    normalizedApiKey.startsWith('AIza')
  ) {
    return GEMINI_PROVIDER_ID
  }
  return OPENAI_COMPATIBLE_PROVIDER_ID
}

export function resolveProviderId(input: { providerId?: string | null; baseUrl?: string; apiKey?: string }): ProviderId {
  const explicit = normalizeProviderId(input.providerId)
  const inferred = inferProviderFromBaseUrl(input.baseUrl ?? '', input.apiKey)
  if (explicit && explicit !== OPENAI_COMPATIBLE_PROVIDER_ID) {
    return explicit
  }
  if (explicit === OPENAI_COMPATIBLE_PROVIDER_ID && inferred !== OPENAI_COMPATIBLE_PROVIDER_ID) {
    return inferred
  }
  return explicit ?? inferred
}

export function getDefaultProviderId(): ProviderId {
  return OPENAI_COMPATIBLE_PROVIDER_ID
}
