import type { ApiChannel } from '../../types/channel'
import type { ProviderAdapter, ProviderCapabilities, ProviderId } from '../../types/provider'
import { byteplusArkAdapter } from './byteplusArkAdapter'
import { geminiAdapter } from './geminiAdapter'
import { jimengProxyAdapter } from './jimengProxyAdapter'
import { midjourneyAdapter } from './midjourneyAdapter'
import { openAICompatibleAdapter } from './openaiCompatibleAdapter'
import { resolveProviderId } from './providerId'

const providerMap = new Map<ProviderId, ProviderAdapter>([
  [openAICompatibleAdapter.id, openAICompatibleAdapter],
  [byteplusArkAdapter.id, byteplusArkAdapter],
  [geminiAdapter.id, geminiAdapter],
  [jimengProxyAdapter.id, jimengProxyAdapter],
  [midjourneyAdapter.id, midjourneyAdapter],
])

export function getProviderAdapterById(providerId: ProviderId): ProviderAdapter | undefined {
  return providerMap.get(providerId)
}

export function getProviderAdapterForChannel(channel: Pick<ApiChannel, 'providerId' | 'baseUrl' | 'apiKey'>): ProviderAdapter {
  const providerId = resolveProviderId({
    providerId: channel.providerId,
    baseUrl: channel.baseUrl,
    apiKey: channel.apiKey,
  })
  return getProviderAdapterById(providerId) ?? openAICompatibleAdapter
}

export function getProviderCapabilitiesByChannel(channel: Pick<ApiChannel, 'providerId' | 'baseUrl' | 'apiKey'>): ProviderCapabilities {
  return getProviderAdapterForChannel(channel).capabilities
}

export function listRegisteredProviders(): ProviderAdapter[] {
  return Array.from(providerMap.values())
}
