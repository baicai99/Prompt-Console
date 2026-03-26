import type { ApiChannel } from '../../../../../types/channel'
import type { SingleSideSettings } from '../../../../../types/conversation'
import type { ModelSpec } from '../../../../../types/model'
import { parseScopedModelId } from '../../../../../utils/modelIdentity'
import {
  isBlockedImageModel,
  isBlockedTextModel,
  isBlockedVideoModel,
} from '../../../domain/modelCatalogDomain'

function isModelAvailableInChannel(model: Pick<ModelSpec, 'id' | 'rawId' | 'channelId'>, channel: ApiChannel): boolean {
  const scopedModel = parseScopedModelId(model.id)
  if (scopedModel) {
    return scopedModel.channelId === channel.id
  }
  if (model.channelId) {
    return model.channelId === channel.id
  }
  return Array.isArray(channel.models) && channel.models.includes(model.rawId ?? model.id)
}

export function buildChannelSelectionPatch(input: {
  value: string | undefined
  settings: SingleSideSettings
  channels: ApiChannel[]
  models: ModelSpec[]
}): Partial<SingleSideSettings> {
  const { value, settings, channels, models } = input
  const patch: Partial<SingleSideSettings> = {
    channelId: value ?? null,
  }

  const selectedChannel = channels.find((item) => item.id === value)
  if (!selectedChannel || !Array.isArray(selectedChannel.models) || selectedChannel.models.length === 0) {
    return patch
  }

  const fallbackImageModel = models.find(
    (item) => isModelAvailableInChannel(item, selectedChannel) && !isBlockedImageModel({ id: item.id, name: item.name }),
  )
  const fallbackTextModel = models.find(
    (item) => isModelAvailableInChannel(item, selectedChannel) && !isBlockedTextModel({ id: item.id, name: item.name }),
  )
  const fallbackVideoModel = models.find(
    (item) => isModelAvailableInChannel(item, selectedChannel) && !isBlockedVideoModel({ id: item.id, name: item.name }),
  )

  if (
    fallbackImageModel &&
    (!isModelAvailableInChannel({ id: settings.modelId }, selectedChannel) ||
      isBlockedImageModel({ id: settings.modelId, name: settings.modelId }))
  ) {
    patch.modelId = fallbackImageModel.id
    patch.paramValues = {}
  }
  if (
    fallbackTextModel &&
    (!isModelAvailableInChannel({ id: settings.textModelId ?? settings.modelId }, selectedChannel) ||
      isBlockedTextModel({
        id: settings.textModelId ?? settings.modelId,
        name: settings.textModelId ?? settings.modelId,
      }))
  ) {
    patch.textModelId = fallbackTextModel.id
  }
  if (
    fallbackVideoModel &&
    (!isModelAvailableInChannel({ id: settings.videoModelId ?? settings.modelId }, selectedChannel) ||
      isBlockedVideoModel({
        id: settings.videoModelId ?? settings.modelId,
        name: settings.videoModelId ?? settings.modelId,
      }))
  ) {
    patch.videoModelId = fallbackVideoModel.id
  }

  return patch
}
