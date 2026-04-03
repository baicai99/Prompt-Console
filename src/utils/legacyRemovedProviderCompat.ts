import type { ApiChannel } from '../types/channel'
import type { Run, Side, SingleSideSettings } from '../types/conversation'
import { safeRemoveStorage } from './safeStorage'

const REMOVED_CHANNEL_ID = '__jimeng-proxy__'
const REMOVED_PROVIDER_ID = 'jimeng-proxy'
const REMOVED_MODEL_ID_PREFIX = `${REMOVED_CHANNEL_ID}::`
const REMOVED_CHANNEL_NAME = '即梦本地代理'
const REMOVED_MODEL_NAME_KEYWORD = '即梦'
const REMOVED_STORAGE_KEYS = ['jimeng:proxy-base-url', 'jimeng:model-catalog']

export const REMOVED_PROVIDER_RESUME_ERROR = '即梦已移除，无法恢复该任务。'

export function clearRemovedProviderStorage(): void {
  for (const key of REMOVED_STORAGE_KEYS) {
    safeRemoveStorage(key)
  }
}

export function isRemovedProviderChannel(
  channel: Pick<ApiChannel, 'id' | 'providerId' | 'name'> | null | undefined,
): boolean {
  return channel?.id === REMOVED_CHANNEL_ID
    || channel?.providerId === REMOVED_PROVIDER_ID
    || channel?.name?.trim() === REMOVED_CHANNEL_NAME
}

export function isRemovedProviderChannelId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() === REMOVED_CHANNEL_ID
}

export function isRemovedProviderModelId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().startsWith(REMOVED_MODEL_ID_PREFIX)
}

export function isRemovedProviderRun(
  run: Pick<Run, 'channelId' | 'channelName' | 'modelId' | 'modelName'> | null | undefined,
): boolean {
  return isRemovedProviderChannelId(run?.channelId)
    || isRemovedProviderModelId(run?.modelId)
    || (typeof run?.channelName === 'string' && run.channelName.includes(REMOVED_MODEL_NAME_KEYWORD))
    || (typeof run?.modelName === 'string' && run.modelName.includes(REMOVED_MODEL_NAME_KEYWORD))
}

export function sanitizeChannels(channels: ApiChannel[]): ApiChannel[] {
  return channels.filter((channel) => !isRemovedProviderChannel(channel))
}

function sanitizeModelRef(value: string | undefined): string | undefined {
  if (isRemovedProviderModelId(value)) {
    return ''
  }
  return value
}

export function sanitizeSettingsBySide(
  settingsBySide: Partial<Record<Side, SingleSideSettings>> | undefined,
): Partial<Record<Side, SingleSideSettings>> | undefined {
  if (!settingsBySide) {
    return settingsBySide
  }

  const next = Object.fromEntries(
    Object.entries(settingsBySide).map(([side, settings]) => {
      if (!settings) {
        return [side, settings]
      }
      return [side, {
        ...settings,
        channelId: isRemovedProviderChannelId(settings.channelId) ? null : settings.channelId,
        modelId: sanitizeModelRef(settings.modelId) ?? '',
        textModelId: sanitizeModelRef(settings.textModelId),
        videoModelId: sanitizeModelRef(settings.videoModelId),
      } satisfies SingleSideSettings]
    }),
  )

  return next as Partial<Record<Side, SingleSideSettings>>
}

export function sanitizeFavoriteModelIds(ids: string[] | undefined): string[] | undefined {
  return ids?.filter((id) => !isRemovedProviderModelId(id))
}

export function sanitizeAutoRenameModelId(value: string | null | undefined): string | null | undefined {
  if (value === null) {
    return null
  }
  if (value === undefined) {
    return undefined
  }
  return isRemovedProviderModelId(value) ? null : value
}
