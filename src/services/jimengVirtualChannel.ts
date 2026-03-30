import type { ApiChannel } from '../types/channel'
import { JIMENG_VIRTUAL_CHANNEL_ID, loadJimengModelCatalog } from './jimengModelMapping'
import { loadJimengProxyBaseUrl } from './jimengProxy'

export const JIMENG_PROXY_PROVIDER_ID = 'jimeng-proxy'
export { JIMENG_VIRTUAL_CHANNEL_ID } from './jimengModelMapping'
const JIMENG_VIRTUAL_CHANNEL_NAME = '即梦本地代理'

export function hasJimengVirtualModels(): boolean {
  return loadJimengModelCatalog().models.length > 0
}

export function buildJimengVirtualChannel(): ApiChannel | null {
  const catalog = loadJimengModelCatalog()
  if (catalog.models.length === 0) {
    return null
  }

  return {
    id: JIMENG_VIRTUAL_CHANNEL_ID,
    name: JIMENG_VIRTUAL_CHANNEL_NAME,
    baseUrl: loadJimengProxyBaseUrl(),
    apiKey: 'local-session',
    providerId: JIMENG_PROXY_PROVIDER_ID,
    models: catalog.models.map((model) => model.rawId ?? model.id),
  }
}

export function withJimengVirtualChannel(channels: ApiChannel[]): ApiChannel[] {
  const virtualChannel = buildJimengVirtualChannel()
  if (!virtualChannel) {
    return channels
  }

  const withoutVirtual = channels.filter((channel) => channel.id !== JIMENG_VIRTUAL_CHANNEL_ID)
  return [...withoutVirtual, virtualChannel]
}

export function resolveJimengVirtualChannel(channelId: string | null | undefined): ApiChannel | null {
  const normalized = typeof channelId === 'string' ? channelId.trim() : ''
  if (normalized !== JIMENG_VIRTUAL_CHANNEL_ID) {
    return null
  }
  return buildJimengVirtualChannel()
}
