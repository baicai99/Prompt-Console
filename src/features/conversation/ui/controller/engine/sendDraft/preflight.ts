import type { ApiChannel } from '../../../../../../types/channel'
import { JIMENG_VIRTUAL_CHANNEL_ID, buildJimengVirtualChannel, withJimengVirtualChannel } from '../../../../../../services/jimengVirtualChannel'
import type { ConversationState } from '../../../../state/conversationState'
import { conversationProviderSupportPort } from '../../../../application/ports/providerSupportPort'
import { resolveCurrentModeModelId } from '../../../../domain/generationMode'
import { getMultiSideIds } from '../../../../domain/settingsNormalization'
import type { Side, SingleSideSettings } from '../../../../../../types/conversation'
import { parseScopedModelId } from '../../../../../../utils/modelIdentity'
import { resolveSendGenerationMode } from '../sendFlowUtils'
import {
  buildSendBlockedAssistantActions,
  hasConfiguredApiChannel,
} from '../helpers'
import type {
  ActiveConversationState,
  SendBlockedReason,
  SendFlowDeps,
} from './types'

function isConfiguredChannel(channel: ApiChannel | undefined): channel is ApiChannel {
  return Boolean(channel?.baseUrl.trim() && channel.apiKey.trim())
}

function resolveSelectedModelId(settings: SingleSideSettings): string {
  return resolveCurrentModeModelId(settings).trim()
}

function resolveChannelForSettings(channels: ApiChannel[], settings: SingleSideSettings): ApiChannel | null {
  const configuredChannels = withJimengVirtualChannel(channels).filter(isConfiguredChannel)
  if (configuredChannels.length === 0) {
    return null
  }

  const boundChannel = configuredChannels.find((channel) => channel.id === settings.channelId)
  if (boundChannel) {
    return boundChannel
  }

  const selectedModelId = resolveSelectedModelId(settings)
  if (selectedModelId) {
    const scopedModel = parseScopedModelId(selectedModelId)
    if (scopedModel) {
      const scopedChannel = configuredChannels.find((channel) => channel.id === scopedModel.channelId)
      if (scopedChannel) {
        return scopedChannel
      }
    }
    const supportingChannel = configuredChannels.find((channel) =>
      Array.isArray(channel.models) && channel.models.includes(selectedModelId),
    )
    if (supportingChannel) {
      return supportingChannel
    }
  }

  return configuredChannels[0] ?? null
}

export function hydrateSettingsChannels(
  channels: ApiChannel[],
  settingsBySide: Record<Side, SingleSideSettings>,
  targetSides: Side[],
): Record<Side, SingleSideSettings> {
  let changed = false
  const nextSettingsBySide = { ...settingsBySide }

  for (const side of targetSides) {
    const settings = settingsBySide[side]
    if (!settings) {
      continue
    }
    const resolvedChannel = resolveChannelForSettings(channels, settings)
    if (!resolvedChannel || resolvedChannel.id === settings.channelId) {
      continue
    }
    nextSettingsBySide[side] = {
      ...settings,
      channelId: resolvedChannel.id,
    }
    changed = true
  }

  return changed ? nextSettingsBySide : settingsBySide
}

export function resolveSendBlockedReason(
  snapshot: ConversationState,
  modelCatalog: SendFlowDeps['modelCatalog'],
  activeState: ActiveConversationState,
): SendBlockedReason | null {
  const availableChannels = withJimengVirtualChannel(snapshot.channels)
  const targetSides = activeState.activeSideMode === 'single'
    ? (['single'] as Side[])
    : getMultiSideIds(activeState.activeSideCount)
  const selectedSettings = targetSides
    .map((side) => activeState.activeSettingsBySide[side])
    .filter((settings): settings is SingleSideSettings => Boolean(settings))
  const modelIds = selectedSettings.map((settings) => {
    const mode = settings.generationMode ?? 'text'
    const selectedModelId = mode === 'text' ? (settings.textModelId ?? settings.modelId) : settings.modelId
    return selectedModelId.trim()
  })
  const hasAvailableModels = modelCatalog.models.length > 0
  const isModelMissing = modelIds.some((modelId) => !modelId || !modelCatalog.models.some((model) => model.id === modelId))
  if (!hasAvailableModels || isModelMissing) {
    return {
      kind: 'missing-model',
      assistantContent: '当前还没有选择模型。请先在右侧 Settings 中选择渠道并刷新模型列表。',
      actions: buildSendBlockedAssistantActions('missing-model'),
    }
  }

  if (!hasConfiguredApiChannel(availableChannels)) {
    return {
      kind: 'missing-api',
      assistantContent: '还没有可用的 API 配置。请先在右侧 Settings 中添加 Base URL 与 API Key。',
      actions: buildSendBlockedAssistantActions('missing-api'),
    }
  }

  const missingBoundChannel = selectedSettings.find((settings) => {
    const channel =
      availableChannels.find((item) => item.id === settings.channelId)
      ?? (settings.channelId === JIMENG_VIRTUAL_CHANNEL_ID ? buildJimengVirtualChannel() : null)
    return !channel || !isConfiguredChannel(channel)
  })
  if (missingBoundChannel) {
    return {
      kind: 'missing-api',
      assistantContent: '当前窗口绑定的渠道不可用。请在右侧 Settings 中重新选择可用渠道。',
      actions: buildSendBlockedAssistantActions('missing-api'),
    }
  }

  const selectedChannels = selectedSettings
    .map((settings) =>
      availableChannels.find((item) => item.id === settings.channelId)
      ?? (settings.channelId === JIMENG_VIRTUAL_CHANNEL_ID ? buildJimengVirtualChannel() : null),
    )
    .filter((channel): channel is ApiChannel => Boolean(channel))

  const incompatibleChannel = selectedChannels.find((channel) => {
    if (!isConfiguredChannel(channel)) {
      return false
    }
    const adapter = conversationProviderSupportPort.resolveChannelProviderAdapter(channel)
    return !conversationProviderSupportPort.isBrowserDirectInvocationSupported(adapter)
  })

  if (incompatibleChannel) {
    return {
      kind: 'missing-api',
      assistantContent: conversationProviderSupportPort.buildBrowserUnsupportedAssistantContent(incompatibleChannel),
      actions: buildSendBlockedAssistantActions('requires-proxy'),
    }
  }

  return null
}

export function createAppendDraftSourceImagesHandler(
  deps: Pick<
    SendFlowDeps,
    'stateRef' | 'notifier' | 'draftSourceImagesRef' | 'appendSourceImageFiles' | 'maxSourceImages'
  >,
) {
  return (files: File[]) => {
    if (files.length === 0) {
      return
    }
    const snapshot = deps.stateRef.current
    const activeState = {
      activeSideMode: snapshot.activeId
        ? snapshot.contents[snapshot.activeId]?.sideMode ?? snapshot.stagedSideMode
        : snapshot.stagedSideMode,
      activeSideCount: snapshot.activeId
        ? snapshot.contents[snapshot.activeId]?.sideCount ?? snapshot.stagedSideCount
        : snapshot.stagedSideCount,
      activeSettingsBySide: snapshot.activeId
        ? snapshot.contents[snapshot.activeId]?.settingsBySide ?? snapshot.stagedSettingsBySide
        : snapshot.stagedSettingsBySide,
    }
    const modeResolution = resolveSendGenerationMode({
      sideMode: activeState.activeSideMode,
      sideCount: activeState.activeSideCount,
      settingsBySide: activeState.activeSettingsBySide,
    })
    if (!('error' in modeResolution) && modeResolution.mode === 'text') {
      deps.notifier.info('当前为文本模式，不支持上传参考图。')
      return
    }
    const current = deps.draftSourceImagesRef.current
    const remaining = Math.max(0, deps.maxSourceImages - current.length)
    if (remaining <= 0) {
      deps.notifier.warning(`最多只能上传 ${deps.maxSourceImages} 张参考图`)
      return
    }

    const appendResult = deps.appendSourceImageFiles(files)

    if (appendResult.invalidNames.length > 0) {
      deps.notifier.warning(`以下文件格式不支持：${appendResult.invalidNames.join('、')}`)
    }

    if (appendResult.droppedValidCount > 0) {
      deps.notifier.info(`超出上限，已仅保留前 ${remaining} 张可用参考图`)
    }
  }
}
