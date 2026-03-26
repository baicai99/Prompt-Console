import { getMultiSideIds } from '../../../../domain/settingsNormalization'
import type { Side, SingleSideSettings, SideMode } from '../../../../../../types/conversation'
import { cloneSideSettings } from '../../../../../../utils/chat'
import type { ConversationAction, ConversationState } from '../../../../state/conversationState'

interface SideLayoutCommandsInput {
  dispatch: (action: ConversationAction) => void
  state: ConversationState
  activeSideMode: SideMode
  activeSideCount: number
  activeSettingsBySide: Record<Side, SingleSideSettings>
  isSideConfigLocked: boolean
  saveStagedSettings: (input: {
    mode: SideMode
    sideCount: number
    settingsBySide: Record<Side, SingleSideSettings>
  }) => void
  setActiveConversation: (conversationId: string | null) => void
  updateConversationState: (mode: SideMode, sideCount: number, settingsBySide: Record<Side, SingleSideSettings>) => void
}

export function createSideLayoutCommands(input: SideLayoutCommandsInput) {
  const seedMultiSideSettingsFromSingle = (nextSideCount: number): Record<Side, SingleSideSettings> => {
    const singleSeed = input.activeSettingsBySide.single
    if (!singleSeed) {
      return input.activeSettingsBySide
    }

    const seededSettings: Record<Side, SingleSideSettings> = {
      ...input.activeSettingsBySide,
      single: cloneSideSettings(singleSeed),
    }

    for (const side of getMultiSideIds(nextSideCount)) {
      seededSettings[side] = cloneSideSettings(singleSeed)
    }

    return seededSettings
  }

  const createNewConversation = () => {
    input.saveStagedSettings({
      mode: input.activeSideMode,
      sideCount: input.activeSideCount,
      settingsBySide: input.activeSettingsBySide,
    })

    input.setActiveConversation(null)
    input.dispatch({ type: 'send/clearError' })
    input.dispatch({ type: 'send/succeed' })
  }

  const updateSideMode = (mode: SideMode) => {
    if (input.isSideConfigLocked && mode !== input.activeSideMode) {
      return
    }
    const nextSideCount = mode === 'multi' && input.activeSideMode === 'single' ? 2 : input.activeSideCount
    const baseSettings =
      mode === 'multi' && input.activeSideMode === 'single'
        ? seedMultiSideSettingsFromSingle(nextSideCount)
        : input.activeSettingsBySide
    input.updateConversationState(mode, nextSideCount, baseSettings)
  }

  const updateSideCount = (count: number) => {
    if (input.isSideConfigLocked || input.activeSideMode !== 'multi') {
      return
    }

    input.updateConversationState(input.activeSideMode, Math.max(2, Math.floor(count)), input.activeSettingsBySide)
  }

  return {
    createNewConversation,
    updateSideMode,
    updateSideCount,
  }
}
