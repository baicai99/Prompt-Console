import type { ApiChannel } from '../../types/channel'
import { safeReadStorage, safeWriteStorage } from '../../utils/safeStorage'
import { resolveProviderId } from '../providers/providerId'
import { STORAGE_CHANNELS_KEY } from './constants'

export function loadChannelsFromStorage(): ApiChannel[] {
  const raw = safeReadStorage(STORAGE_CHANNELS_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as ApiChannel[]
    return parsed
      .filter(
        (item) =>
          typeof item?.id === 'string' &&
          typeof item?.name === 'string' &&
          typeof item?.baseUrl === 'string' &&
          typeof item?.apiKey === 'string',
      )
      .map((item) => ({
        ...item,
        providerId: resolveProviderId({ providerId: item.providerId, baseUrl: item.baseUrl, apiKey: item.apiKey }),
        models: Array.isArray(item.models)
          ? item.models.filter((model): model is string => typeof model === 'string' && Boolean(model.trim()))
          : undefined,
      }))
  } catch {
    return []
  }
}

export function saveChannelsToStorage(channels: ApiChannel[]): void {
  safeWriteStorage(
    STORAGE_CHANNELS_KEY,
    JSON.stringify(
      channels.map((item) => ({
        ...item,
        providerId: resolveProviderId({ providerId: item.providerId, baseUrl: item.baseUrl, apiKey: item.apiKey }),
      })),
    ),
  )
}
