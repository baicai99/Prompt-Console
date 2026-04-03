import type { PanelValueFormat, PanelVariableRow } from '../../features/conversation/domain/types'
import type {
  ImageRuntimeSettings,
  LoggingSettings,
  Side,
  SideMode,
  SingleSideSettings,
} from '../../types/conversation'
import {
  clearRemovedProviderStorage,
  sanitizeAutoRenameModelId,
  sanitizeFavoriteModelIds,
  sanitizeSettingsBySide,
} from '../../utils/legacyRemovedProviderCompat'
import {
  normalizeImageRuntimeSettings,
} from '../../utils/imageRuntimeSettings'
import { normalizeLoggingSettings } from '../../utils/loggingSettings'
import { safeReadStorage, safeWriteStorage } from '../../utils/safeStorage'
import { STORAGE_STAGED_SETTINGS_KEY } from './constants'

export interface StagedSettingsState {
  sideMode: SideMode
  sideCount?: number
  settingsBySide?: Partial<Record<Side, SingleSideSettings>>
  runConcurrency?: number
  runConcurrencyUnlimited?: boolean
  dynamicPromptEnabled?: boolean
  autoRenameConversationTitle?: boolean
  autoRenameConversationTitleModelId?: string | null
  panelValueFormat?: PanelValueFormat
  panelVariables?: PanelVariableRow[]
  favoriteModelIds?: string[]
  imageRuntimeSettings?: Partial<ImageRuntimeSettings>
  loggingSettings?: Partial<LoggingSettings>
}

export function loadStagedSettingsFromStorage(): StagedSettingsState | null {
  clearRemovedProviderStorage()
  const raw = safeReadStorage(STORAGE_STAGED_SETTINGS_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as {
      sideMode?: string
      sideCount?: unknown
      settingsBySide?: unknown
      runConcurrency?: unknown
      runConcurrencyUnlimited?: unknown
      dynamicPromptEnabled?: unknown
      autoRenameConversationTitle?: unknown
      autoRenameConversationTitleModelId?: unknown
      panelValueFormat?: unknown
      panelVariables?: unknown
      favoriteModelIds?: unknown
      imageRuntimeSettings?: unknown
      loggingSettings?: unknown
    }
    const sideMode: SideMode = parsed?.sideMode === 'multi' || parsed?.sideMode === 'ab' ? 'multi' : 'single'
    const sideCount = typeof parsed?.sideCount === 'number' ? Math.max(2, Math.floor(parsed.sideCount)) : undefined
    const settingsBySide =
      parsed?.settingsBySide && typeof parsed.settingsBySide === 'object' ? parsed.settingsBySide : undefined
    const runConcurrency =
      typeof parsed?.runConcurrency === 'number' ? Math.max(1, Math.floor(parsed.runConcurrency)) : undefined
    const runConcurrencyUnlimited =
      typeof parsed?.runConcurrencyUnlimited === 'boolean' ? parsed.runConcurrencyUnlimited : undefined
    const dynamicPromptEnabled =
      typeof parsed?.dynamicPromptEnabled === 'boolean' ? parsed.dynamicPromptEnabled : undefined
    const autoRenameConversationTitle =
      typeof parsed?.autoRenameConversationTitle === 'boolean' ? parsed.autoRenameConversationTitle : undefined
    const autoRenameConversationTitleModelId =
      parsed?.autoRenameConversationTitleModelId === null
        ? null
        : typeof parsed?.autoRenameConversationTitleModelId === 'string'
          ? parsed.autoRenameConversationTitleModelId.trim() || null
          : undefined
    const panelValueFormatCandidates: PanelValueFormat[] = ['json', 'yaml', 'line', 'csv', 'auto']
    const panelValueFormat =
      typeof parsed?.panelValueFormat === 'string' &&
      panelValueFormatCandidates.includes(parsed.panelValueFormat as PanelValueFormat)
        ? (parsed.panelValueFormat as PanelValueFormat)
        : undefined
    const panelVariables = Array.isArray(parsed?.panelVariables)
      ? parsed.panelVariables
          .filter(
            (item): item is PanelVariableRow =>
              Boolean(item) &&
              typeof item === 'object' &&
              typeof (item as PanelVariableRow).id === 'string' &&
              typeof (item as PanelVariableRow).key === 'string' &&
              typeof (item as PanelVariableRow).valuesText === 'string' &&
              typeof (item as PanelVariableRow).selectedValue === 'string',
          )
          .map((item) => ({
            id: item.id,
            key: item.key,
            valuesText: item.valuesText,
            selectedValue: item.selectedValue,
          }))
      : undefined
    const favoriteModelIds = Array.isArray(parsed?.favoriteModelIds)
      ? parsed.favoriteModelIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : undefined
    const imageRuntimeSettings =
      parsed?.imageRuntimeSettings && typeof parsed.imageRuntimeSettings === 'object'
        ? normalizeImageRuntimeSettings(parsed.imageRuntimeSettings as Partial<ImageRuntimeSettings>)
        : undefined
    const loggingSettings =
      parsed?.loggingSettings && typeof parsed.loggingSettings === 'object'
        ? normalizeLoggingSettings(parsed.loggingSettings as Partial<LoggingSettings>)
        : undefined

    return {
      sideMode,
      sideCount,
      settingsBySide: sanitizeSettingsBySide(settingsBySide),
      runConcurrency,
      runConcurrencyUnlimited,
      dynamicPromptEnabled,
      autoRenameConversationTitle,
      autoRenameConversationTitleModelId: sanitizeAutoRenameModelId(autoRenameConversationTitleModelId),
      panelValueFormat,
      panelVariables,
      favoriteModelIds: sanitizeFavoriteModelIds(favoriteModelIds),
      imageRuntimeSettings,
      loggingSettings,
    }
  } catch {
    return null
  }
}

export function saveStagedSettingsToStorage(state: StagedSettingsState): void {
  clearRemovedProviderStorage()
  safeWriteStorage(STORAGE_STAGED_SETTINGS_KEY, JSON.stringify({
    ...state,
    settingsBySide: sanitizeSettingsBySide(state.settingsBySide),
    autoRenameConversationTitleModelId: sanitizeAutoRenameModelId(state.autoRenameConversationTitleModelId),
    favoriteModelIds: sanitizeFavoriteModelIds(state.favoriteModelIds),
  }))
}
