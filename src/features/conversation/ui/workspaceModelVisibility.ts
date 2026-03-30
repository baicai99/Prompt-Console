import type { ApiChannel } from '../../../types/channel'
import type { Side, SingleSideSettings } from '../../../types/conversation'
import type { ModelSpec } from '../../../types/model'
import { buildJimengVirtualChannel, JIMENG_VIRTUAL_CHANNEL_ID } from '../../../services/jimengVirtualChannel'
import { parseScopedModelId } from '../../../utils/modelIdentity'

function resolveChannelFromSelectedModel(
  settings: SingleSideSettings | undefined,
  channels: ApiChannel[],
  models: ModelSpec[],
): ApiChannel | null {
  const selectedModelId = settings?.generationMode === 'text'
    ? (settings.textModelId ?? settings.modelId)
    : settings?.modelId
  const normalizedModelId = selectedModelId?.trim()
  if (!normalizedModelId) {
    return null
  }

  const scopedModel = parseScopedModelId(normalizedModelId)
  if (scopedModel) {
    return channels.find((channel) => channel.id === scopedModel.channelId) ?? null
  }

  const catalogModel = models.find((model) => model.id === normalizedModelId)
  if (catalogModel?.channelId) {
    if (catalogModel.channelId === JIMENG_VIRTUAL_CHANNEL_ID) {
      return buildJimengVirtualChannel()
    }
    return channels.find((channel) => channel.id === catalogModel.channelId) ?? null
  }

  const supportingChannels = channels.filter((channel) =>
    Array.isArray(channel.models) && channel.models.includes(normalizedModelId),
  )
  if (supportingChannels.length === 1) {
    return supportingChannels[0] ?? null
  }

  const rawModelMatch = models.find((model) => model.rawId === normalizedModelId)
  if (rawModelMatch?.channelId) {
    if (rawModelMatch.channelId === JIMENG_VIRTUAL_CHANNEL_ID) {
      return buildJimengVirtualChannel()
    }
    return channels.find((channel) => channel.id === rawModelMatch.channelId) ?? null
  }

  return null
}

export function resolveVisibleModelsForSide(input: {
  side: Side
  settingsBySide: Record<Side, SingleSideSettings>
  channels: ApiChannel[]
  models: ModelSpec[]
}): ModelSpec[] {
  const settings = input.settingsBySide[input.side]
  const boundChannelId = settings?.channelId?.trim()
  const channel =
    (boundChannelId
      ? input.channels.find((item) => item.id === boundChannelId) ?? (boundChannelId === JIMENG_VIRTUAL_CHANNEL_ID ? buildJimengVirtualChannel() : null)
      : null)
    ?? resolveChannelFromSelectedModel(settings, input.channels, input.models)
    ?? (input.channels.length === 1 ? input.channels[0] ?? null : null)
  if (!channel || !Array.isArray(channel.models) || channel.models.length === 0) {
    return []
  }

  const modelsById = new Map(input.models.map((model) => [model.id, model]))
  const modelsByChannelAndRawId = new Map(
    input.models.map((model) => [`${model.channelId ?? ''}::${model.rawId ?? model.id}`, model] as const),
  )
  return channel.models
    .map((modelId) => (
      modelsById.get(modelId)
      ?? modelsByChannelAndRawId.get(`${channel.id}::${modelId}`)
    ))
    .filter((model): model is ModelSpec => Boolean(model))
}
