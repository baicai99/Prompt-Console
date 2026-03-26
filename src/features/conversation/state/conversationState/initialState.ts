import type { ApiChannel } from '../../../../types/channel'
import type {
  Conversation,
  ConversationSummary,
  ImageRuntimeSettings,
  LoggingSettings,
  Side,
  SideMode,
  SingleSideSettings,
} from '../../../../types/conversation'
import type { ModelCatalog } from '../../../../types/model'
import { makeId } from '../../../../utils/chat'
import { normalizeImageRuntimeSettings } from '../../../../utils/imageRuntimeSettings'
import { normalizeLoggingSettings } from '../../../../utils/loggingSettings'
import { resolveConversationTitleModelId } from '../../domain/conversationTitleDomain'
import { filterActiveImageTasksRecord } from '../../domain/imageTaskMemory'
import { clampSideCount, normalizeConversation, normalizeSettingsBySide } from '../../domain/settingsNormalization'
import type { PanelValueFormat, PanelVariableRow } from '../../domain/types'
import type {
  ConversationComposerState,
  ConversationContentState,
  ConversationRuntimeState,
  ConversationSettingsState,
  ConversationState,
} from './types'

function defaultPanelRows(): PanelVariableRow[] {
  return [{ id: makeId(), key: '', valuesText: '', selectedValue: '' }]
}

function buildInitialContentState(input: {
  initialLoad: {
    summaries: ConversationSummary[]
    contents: Record<string, Conversation>
    activeId: string | null
  }
  channels: ApiChannel[]
  modelCatalog: ModelCatalog
}): ConversationContentState & ConversationRuntimeState {
  const normalizedContents: Record<string, Conversation> = {}
  const runtimeTasksByConversationId: Record<string, Record<string, import('../../../../types/conversation').ImageTask>> = {}
  for (const [id, conversation] of Object.entries(input.initialLoad.contents)) {
    normalizedContents[id] = normalizeConversation(conversation, input.channels, input.modelCatalog)
    runtimeTasksByConversationId[id] = filterActiveImageTasksRecord(normalizedContents[id].tasksById)
  }

  return {
    summaries: input.initialLoad.summaries,
    contents: normalizedContents,
    activeId: input.initialLoad.activeId,
    runtimeTasksByConversationId,
  }
}

function buildInitialComposerState(input: {
  initialStaged: {
    dynamicPromptEnabled?: boolean
    autoRenameConversationTitle?: boolean
    autoRenameConversationTitleModelId?: string | null
    panelValueFormat?: PanelValueFormat
    panelVariables?: PanelVariableRow[]
  } | null
  modelCatalog: ModelCatalog
}): ConversationComposerState {
  return {
    draft: '',
    sendError: '',
    isSending: false,
    showAdvancedVariables: false,
    dynamicPromptEnabled: input.initialStaged?.dynamicPromptEnabled ?? true,
    autoRenameConversationTitle: input.initialStaged?.autoRenameConversationTitle ?? true,
    autoRenameConversationTitleModelId: resolveConversationTitleModelId({
      current: input.initialStaged?.autoRenameConversationTitleModelId,
      models: input.modelCatalog.models,
    }),
    panelValueFormat: input.initialStaged?.panelValueFormat ?? 'json',
    panelVariables:
      Array.isArray(input.initialStaged?.panelVariables) && input.initialStaged.panelVariables.length > 0
        ? input.initialStaged.panelVariables
        : defaultPanelRows(),
  }
}

function buildInitialSettingsState(input: {
  initialStaged: {
    sideMode: SideMode
    sideCount?: number
    settingsBySide?: Partial<Record<Side, SingleSideSettings>>
    runConcurrency?: number
    runConcurrencyUnlimited?: boolean
    favoriteModelIds?: string[]
    imageRuntimeSettings?: Partial<ImageRuntimeSettings>
    loggingSettings?: Partial<LoggingSettings>
  } | null
  channels: ApiChannel[]
  modelCatalog: ModelCatalog
}): ConversationSettingsState {
  const stagedSideCount = clampSideCount(input.initialStaged?.sideCount ?? 2)
  return {
    favoriteModelIds: Array.isArray(input.initialStaged?.favoriteModelIds) ? input.initialStaged.favoriteModelIds : [],
    runConcurrency: Math.max(1, Math.floor(input.initialStaged?.runConcurrency ?? 4)),
    runConcurrencyUnlimited: Boolean(input.initialStaged?.runConcurrencyUnlimited),
    imageRuntimeSettings: normalizeImageRuntimeSettings(input.initialStaged?.imageRuntimeSettings),
    loggingSettings: normalizeLoggingSettings(input.initialStaged?.loggingSettings),
    stagedSideMode: input.initialStaged?.sideMode ?? 'single',
    stagedSideCount,
    stagedSettingsBySide: normalizeSettingsBySide(
      input.initialStaged?.settingsBySide,
      input.channels,
      input.modelCatalog,
      stagedSideCount,
    ),
    channels: input.channels,
  }
}

export function createInitialConversationState(input: {
  channels: ApiChannel[]
  modelCatalog: ModelCatalog
  initialLoad: {
    summaries: ConversationSummary[]
    contents: Record<string, Conversation>
    activeId: string | null
  }
  initialStaged: {
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
  } | null
}): ConversationState {
  const { channels, modelCatalog, initialLoad, initialStaged } = input
  return {
    ...buildInitialContentState({ initialLoad, channels, modelCatalog }),
    ...buildInitialComposerState({ initialStaged, modelCatalog }),
    ...buildInitialSettingsState({ initialStaged, channels, modelCatalog }),
  }
}
