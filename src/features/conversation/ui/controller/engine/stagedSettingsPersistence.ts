import type { PanelValueFormat, PanelVariableRow } from '../../../domain/types'
import type { ConversationRepository } from '../../../infra/conversationRepository'
import type { ConversationState } from '../../../state/conversationState'
import type { ImageRuntimeSettings, LoggingSettings, Side, SideMode, SingleSideSettings } from '../../../../../types/conversation'

type StagedSettingsSnapshot = Pick<
  ConversationState,
  | 'runConcurrency'
  | 'runConcurrencyUnlimited'
  | 'dynamicPromptEnabled'
  | 'autoRenameConversationTitle'
  | 'autoRenameConversationTitleModelId'
  | 'panelValueFormat'
  | 'panelVariables'
  | 'favoriteModelIds'
  | 'imageRuntimeSettings'
  | 'loggingSettings'
>

interface PersistStagedSettingsInput {
  repository: ConversationRepository
  sideMode: SideMode
  sideCount: number
  settingsBySide: Record<Side, SingleSideSettings>
  snapshot: StagedSettingsSnapshot
  overrides?: Partial<{
    runConcurrency: number
    runConcurrencyUnlimited: boolean
    dynamicPromptEnabled: boolean
    autoRenameConversationTitle: boolean
    autoRenameConversationTitleModelId: string | null
    panelValueFormat: PanelValueFormat
    panelVariables: PanelVariableRow[]
    favoriteModelIds: string[]
    imageRuntimeSettings: ImageRuntimeSettings
    loggingSettings: LoggingSettings
  }>
}

export function persistStagedSettings(input: PersistStagedSettingsInput): void {
  const { repository, sideMode, sideCount, settingsBySide, snapshot, overrides } = input
  repository.saveStagedSettings({
    sideMode,
    sideCount,
    settingsBySide,
    runConcurrency: overrides?.runConcurrency ?? snapshot.runConcurrency,
    runConcurrencyUnlimited: overrides?.runConcurrencyUnlimited ?? snapshot.runConcurrencyUnlimited,
    dynamicPromptEnabled: overrides?.dynamicPromptEnabled ?? snapshot.dynamicPromptEnabled,
    autoRenameConversationTitle: overrides?.autoRenameConversationTitle ?? snapshot.autoRenameConversationTitle,
    autoRenameConversationTitleModelId:
      overrides?.autoRenameConversationTitleModelId ?? snapshot.autoRenameConversationTitleModelId,
    panelValueFormat: overrides?.panelValueFormat ?? snapshot.panelValueFormat,
    panelVariables: overrides?.panelVariables ?? snapshot.panelVariables,
    favoriteModelIds: overrides?.favoriteModelIds ?? snapshot.favoriteModelIds,
    imageRuntimeSettings: overrides?.imageRuntimeSettings ?? snapshot.imageRuntimeSettings,
    loggingSettings: overrides?.loggingSettings ?? snapshot.loggingSettings,
  })
}
