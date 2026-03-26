import { conversationModelCatalogPort } from '../../../../application/ports/modelCatalogPort'
import { normalizeSettingsBySide } from '../../../../domain/settingsNormalization'
import { resolveConversationTitleModelId } from '../../../../domain/conversationTitleDomain'
import type { ConversationAction, ConversationState } from '../../../../state/conversationState'
import type { ConversationActions, SaveStagedSettingsInput } from './types'
import type { Side, SideMode, SingleSideSettings } from '../../../../../../types/conversation'
import type { ConversationRepository } from '../../../../infra/conversationRepository'

interface ChannelCatalogCommandsInput {
  dispatch: (action: ConversationAction) => void
  actions: ConversationActions
  repository: ConversationRepository
  stateRef: import('react').MutableRefObject<ConversationState>
  activeSideMode: SideMode
  activeSideCount: number
  activeSettingsBySide: Record<Side, SingleSideSettings>
  saveStagedSettings: (input: SaveStagedSettingsInput) => void
  persistConversation: (conversation: import('../../../../../../types/conversation').Conversation) => void
}

export function createChannelCatalogCommands(input: ChannelCatalogCommandsInput) {
  const setChannels = (nextChannels: ConversationState['channels']) => {
    input.dispatch({ type: 'channels/set', payload: nextChannels })
    input.repository.saveChannels(nextChannels)

    const nextCatalog = conversationModelCatalogPort.getModelCatalogFromChannels(nextChannels)
    const normalized = normalizeSettingsBySide(input.activeSettingsBySide, nextChannels, nextCatalog, input.activeSideCount)
    const filteredFavoriteModelIds = input.stateRef.current.favoriteModelIds.filter((modelId) =>
      nextCatalog.models.some((model) => model.id === modelId),
    )
    const nextAutoRenameConversationTitleModelId = resolveConversationTitleModelId({
      current: input.stateRef.current.autoRenameConversationTitleModelId,
      models: nextCatalog.models,
    })

    input.saveStagedSettings({
      mode: input.activeSideMode,
      sideCount: input.activeSideCount,
      settingsBySide: normalized,
      overrides: {
        favoriteModelIds: filteredFavoriteModelIds,
        autoRenameConversationTitleModelId: nextAutoRenameConversationTitleModelId,
      },
    })

    input.dispatch({ type: 'settings/setFavoriteModels', payload: filteredFavoriteModelIds })
    input.actions.setAutoRenameConversationTitleModelId(nextAutoRenameConversationTitleModelId)
    input.stateRef.current = {
      ...input.stateRef.current,
      channels: nextChannels,
      favoriteModelIds: filteredFavoriteModelIds,
      autoRenameConversationTitleModelId: nextAutoRenameConversationTitleModelId,
      stagedSideMode: input.activeSideMode,
      stagedSideCount: input.activeSideCount,
      stagedSettingsBySide: normalized,
    }

    input.dispatch({
      type: 'settings/updateSide',
      payload: {
        sideMode: input.activeSideMode,
        sideCount: input.activeSideCount,
        settingsBySide: normalized,
      },
    })

    const current = input.stateRef.current
    const currentActive = current.activeId ? current.contents[current.activeId] ?? null : null
    if (currentActive) {
      input.persistConversation({
        ...currentActive,
        updatedAt: new Date().toISOString(),
        sideMode: input.activeSideMode,
        sideCount: input.activeSideCount,
        settingsBySide: normalized,
      })
    }
  }

  return {
    setChannels,
  }
}
