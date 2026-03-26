import type { ApiChannel } from '../../types/channel'
import type { ProviderAdapter, ProviderId } from '../../types/provider'
import { getProviderAdapterById, getProviderAdapterForChannel } from './providerRegistry'
import { resolveProviderId } from './providerId'

function hasExplicitProviderId(channel: Pick<ApiChannel, 'providerId'>): boolean {
  return typeof channel.providerId === 'string' && channel.providerId.trim().length > 0
}

function isOpenAICompatibleProvider(channel: Pick<ApiChannel, 'providerId' | 'baseUrl' | 'apiKey'>): boolean {
  return resolveProviderId({
    providerId: channel.providerId,
    baseUrl: channel.baseUrl,
    apiKey: channel.apiKey,
  }) === 'openai-compatible'
}

export function resolveChannelProviderId(channel: Pick<ApiChannel, 'providerId' | 'baseUrl' | 'apiKey'>): ProviderId {
  return resolveProviderId({
    providerId: channel.providerId,
    baseUrl: channel.baseUrl,
    apiKey: channel.apiKey,
  })
}

export function resolveChannelProviderAdapter(channel: Pick<ApiChannel, 'providerId' | 'baseUrl' | 'apiKey'>): ProviderAdapter {
  return getProviderAdapterForChannel(channel)
}

export function shouldPreferMidjourneyByModel(modelId: string): boolean {
  const value = modelId.trim().toLowerCase()
  if (!value) {
    return false
  }
  return value.includes('midjourney') || value.includes('niji') || value.startsWith('mj_') || value === 'mj'
}

function shouldPreferMidjourneyByResumeHint(input: {
  taskId?: string
  taskMeta?: Record<string, string>
}): boolean {
  const hint = `${input.taskMeta?.resumeUrl ?? ''} ${input.taskMeta?.location ?? ''} ${input.taskId ?? ''}`.toLowerCase()
  return hint.includes('/mj/') || hint.includes('midjourney') || hint.includes('niji')
}

export function resolveProviderAdapterForImageRequest(input: {
  channel: Pick<ApiChannel, 'providerId' | 'baseUrl' | 'apiKey'>
  modelId: string
}): ProviderAdapter {
  if (shouldPreferMidjourneyByModel(input.modelId)) {
    const canOverride = !hasExplicitProviderId(input.channel) || isOpenAICompatibleProvider(input.channel)
    if (canOverride) {
      return getProviderAdapterById('midjourney-proxy') ?? getProviderAdapterForChannel(input.channel)
    }
  }

  return getProviderAdapterForChannel(input.channel)
}

export function resolveProviderAdapterForResumeTask(input: {
  channel: Pick<ApiChannel, 'providerId' | 'baseUrl' | 'apiKey'>
  taskId?: string
  taskMeta?: Record<string, string>
}): ProviderAdapter {
  if (shouldPreferMidjourneyByResumeHint(input)) {
    const canOverride = !hasExplicitProviderId(input.channel) || isOpenAICompatibleProvider(input.channel)
    if (canOverride) {
      return getProviderAdapterById('midjourney-proxy') ?? getProviderAdapterForChannel(input.channel)
    }
  }

  return getProviderAdapterForChannel(input.channel)
}
