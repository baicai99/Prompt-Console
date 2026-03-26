import type { MutableRefObject } from 'react'
import { normalizeSettingsBySide } from '../../../../domain/settingsNormalization'
import type { ConversationState } from '../../../../state/conversationState'
import type {
  Conversation,
  Side,
  SideMode,
  SingleSideSettings,
} from '../../../../../../types/conversation'
import type { ModelCatalog } from '../../../../../../types/model'
import type { SaveStagedSettingsInput } from './types'

interface CreateUpdateConversationStateInput {
  state: ConversationState
  stateRef: MutableRefObject<ConversationState>
  modelCatalog: ModelCatalog
  saveStagedSettings: (input: SaveStagedSettingsInput) => void
  persistConversation: (conversation: Conversation) => void
}

export function createUpdateConversationState(input: CreateUpdateConversationStateInput) {
  return (
    mode: SideMode,
    sideCount: number,
    settingsBySide: Record<Side, SingleSideSettings>,
  ) => {
    const normalizedCount = Math.max(2, Math.floor(sideCount))
    const normalizedSettings = normalizeSettingsBySide(settingsBySide, input.state.channels, input.modelCatalog, normalizedCount)

    input.saveStagedSettings({
      mode,
      sideCount: normalizedCount,
      settingsBySide: normalizedSettings,
    })

    const current = input.stateRef.current
    const currentActive = current.activeId ? current.contents[current.activeId] ?? null : null
    if (!currentActive) {
      return
    }

    input.persistConversation({
      ...currentActive,
      updatedAt: new Date().toISOString(),
      sideMode: mode,
      sideCount: normalizedCount,
      settingsBySide: normalizedSettings,
    })
  }
}

interface PersistPreferenceOverrideInput {
  stateRef: MutableRefObject<ConversationState>
  activeSideMode: SideMode
  activeSideCount: number
  activeSettingsBySide: Record<Side, SingleSideSettings>
  saveStagedSettings: (input: SaveStagedSettingsInput) => void
}

export function createPersistPreferenceOverride(input: PersistPreferenceOverrideInput) {
  return (
    snapshot: ConversationState,
    overrides: NonNullable<SaveStagedSettingsInput['overrides']>,
    patch: Partial<ConversationState>,
  ) => {
    input.saveStagedSettings({
      mode: input.activeSideMode,
      sideCount: input.activeSideCount,
      settingsBySide: input.activeSettingsBySide,
      overrides,
    })

    input.stateRef.current = {
      ...snapshot,
      ...patch,
    }
  }
}
