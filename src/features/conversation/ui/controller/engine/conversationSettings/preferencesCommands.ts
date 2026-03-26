import { reformatRowsForPanelFormat } from '../../../../domain/panelVariableParsing'
import { normalizeImageRuntimeSettings } from '../../../../../../utils/imageRuntimeSettings'
import { normalizeLoggingSettings } from '../../../../../../utils/loggingSettings'
import type { ConversationAction, ConversationState } from '../../../../state/conversationState'
import type {
  ConversationActions,
  SaveStagedSettingsInput,
} from './types'
import type {
  ImageRuntimeSettings,
  LoggingSettings,
  Side,
  SideMode,
  SingleSideSettings,
} from '../../../../../../types/conversation'
import type { PanelValueFormat, PanelVariableRow } from '../../../../domain/types'
import type { ModelCatalog } from '../../../../../../types/model'

interface PreferencesCommandsInput {
  dispatch: (action: ConversationAction) => void
  actions: ConversationActions
  stateRef: import('react').MutableRefObject<ConversationState>
  activeSideMode: SideMode
  activeSideCount: number
  activeSettingsBySide: Record<Side, SingleSideSettings>
  saveStagedSettings: (input: SaveStagedSettingsInput) => void
  modelCatalog: ModelCatalog
}

export function createPreferencesCommands(input: PreferencesCommandsInput) {
  const persistOverride = (snapshot: ConversationState, overrides: NonNullable<SaveStagedSettingsInput['overrides']>, patch: Partial<ConversationState>) => {
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

  const setFavoriteModelIds = (value: string[]) => {
    const nextFavoriteModelIds = Array.from(
      new Set(value.filter((modelId) => input.modelCatalog.models.some((model) => model.id === modelId))),
    )
    input.dispatch({ type: 'settings/setFavoriteModels', payload: nextFavoriteModelIds })

    const snapshot = input.stateRef.current
    persistOverride(snapshot, { favoriteModelIds: nextFavoriteModelIds }, { favoriteModelIds: nextFavoriteModelIds })
  }

  const setRunConcurrency = (value: number) => {
    const next = Math.max(1, Math.floor(value))
    input.dispatch({ type: 'settings/setRunConcurrency', payload: next })

    const snapshot = input.stateRef.current
    persistOverride(snapshot, { runConcurrency: next }, { runConcurrency: next })
  }

  const setRunConcurrencyUnlimited = (value: boolean) => {
    input.dispatch({ type: 'settings/setRunConcurrencyUnlimited', payload: value })

    const snapshot = input.stateRef.current
    persistOverride(snapshot, { runConcurrencyUnlimited: value }, { runConcurrencyUnlimited: value })
  }

  const setImageRuntimeSettings = (value: Partial<ImageRuntimeSettings>) => {
    const snapshot = input.stateRef.current
    const next = normalizeImageRuntimeSettings({
      ...snapshot.imageRuntimeSettings,
      ...value,
    })
    input.dispatch({ type: 'settings/setImageRuntimeSettings', payload: next })

    persistOverride(snapshot, { imageRuntimeSettings: next }, { imageRuntimeSettings: next })
  }

  const setLoggingSettings = (value: Partial<LoggingSettings>) => {
    const snapshot = input.stateRef.current
    const next = normalizeLoggingSettings({
      ...snapshot.loggingSettings,
      ...value,
      features: {
        ...snapshot.loggingSettings.features,
        ...(value.features ?? {}),
      },
    })
    input.dispatch({ type: 'settings/setLoggingSettings', payload: next })

    persistOverride(snapshot, { loggingSettings: next }, { loggingSettings: next })
  }

  const setDynamicPromptEnabled = (value: boolean) => {
    input.actions.setDynamicPromptEnabled(value)

    const snapshot = input.stateRef.current
    persistOverride(snapshot, { dynamicPromptEnabled: value }, { dynamicPromptEnabled: value })
  }

  const setAutoRenameConversationTitle = (value: boolean) => {
    input.actions.setAutoRenameConversationTitle(value)

    const snapshot = input.stateRef.current
    persistOverride(snapshot, { autoRenameConversationTitle: value }, { autoRenameConversationTitle: value })
  }

  const setAutoRenameConversationTitleModelId = (value: string | null) => {
    input.actions.setAutoRenameConversationTitleModelId(value)

    const snapshot = input.stateRef.current
    persistOverride(snapshot, { autoRenameConversationTitleModelId: value }, { autoRenameConversationTitleModelId: value })
  }

  const setPanelValueFormat = (value: PanelValueFormat) => {
    const snapshot = input.stateRef.current
    const normalized = reformatRowsForPanelFormat(snapshot.panelVariables, value)
    const nextPanelVariables = normalized.ok ? normalized.rows : snapshot.panelVariables

    input.actions.setPanelValueFormat(value)
    if (normalized.ok) {
      input.actions.setPanelVariables(nextPanelVariables)
    }

    persistOverride(snapshot, {
      panelValueFormat: value,
      panelVariables: nextPanelVariables,
    }, {
      panelValueFormat: value,
      panelVariables: nextPanelVariables,
    })
  }

  const setPanelVariables = (value: PanelVariableRow[]) => {
    input.actions.setPanelVariables(value)

    const snapshot = input.stateRef.current
    persistOverride(snapshot, { panelVariables: value }, { panelVariables: value })
  }

  return {
    setFavoriteModelIds,
    setRunConcurrency,
    setRunConcurrencyUnlimited,
    setImageRuntimeSettings,
    setLoggingSettings,
    setDynamicPromptEnabled,
    setAutoRenameConversationTitle,
    setAutoRenameConversationTitleModelId,
    setPanelValueFormat,
    setPanelVariables,
  }
}
