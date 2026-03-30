import type {
  Conversation,
  Run,
  SettingPrimitive,
  Side,
  SideMode,
  SingleSideSettings,
} from '../../../types/conversation'
import type { ApiChannel } from '../../../types/channel'
import type { RunSourceImageRef } from '../../../types/image'
import type { ModelCatalog } from '../../../types/model'
import { buildJimengVirtualChannel, JIMENG_VIRTUAL_CHANNEL_ID } from '../../../services/jimengVirtualChannel'
import { makeId } from '../../../utils/chat'
import {
  getDefaultModel,
  getModelById,
} from './modelCatalogDomain'
import type { PanelValueFormat, PanelVariableRow } from './types'
import { createPlannedRuns } from './plannedRunFactory'
import { buildImageTasksForPlannedRuns } from './imageTaskPlanning'
import { expandPromptBatches } from './runPlanPromptExpansion'
import type { PlannedRun, SendDraftPlanResult } from './runPlanningTypes'
import { clampSideCount, getMultiSideIds, normalizeSettingsBySide } from './settingsNormalization'
import { normalizeSizeTier } from './sizeResolution'

const ASPECT_RATIO_DEFAULT = '1:1'

export type { PlannedRun, SendDraftPlan, SendDraftPlanResult } from './runPlanningTypes'

export interface RetryPlan {
  sourceRun: Run
  rootRunId: string
  nextRetryAttempt: number
  settings: SingleSideSettings
  modelId: string
  modelName: string
  paramsSnapshot: Record<string, SettingPrimitive>
  sourceImages: RunSourceImageRef[]
  channel: ApiChannel | undefined
}

export interface ReplayPlan {
  sourceRun: Run
  batchId: string
  settings: SingleSideSettings
  modelId: string
  modelName: string
  paramsSnapshot: Record<string, SettingPrimitive>
  sourceImages: RunSourceImageRef[]
  channel: ApiChannel | undefined
}

export function planRunBatch(input: {
  draft: string
  panelVariables: PanelVariableRow[]
  panelValueFormat?: PanelValueFormat
  dynamicPromptEnabled?: boolean
  mode: SideMode
  sideCount: number
  settingsBySide: Record<Side, SingleSideSettings>
  channels: ApiChannel[]
  modelCatalog: ModelCatalog
  sourceImages?: RunSourceImageRef[]
}): SendDraftPlanResult {
  const templatePrompt = input.draft.trim()
  if (!templatePrompt) {
    return { ok: false, error: 'Please enter a template prompt.' }
  }

  const sideCount = clampSideCount(input.sideCount)
  const mode = input.mode
  const settingsBySide = normalizeSettingsBySide(input.settingsBySide, input.channels, input.modelCatalog, sideCount)
  const batchId = makeId()
  const sourceImages = Array.isArray(input.sourceImages) ? input.sourceImages : []

  const expandedPrompts = expandPromptBatches({
    templatePrompt,
    panelVariables: input.panelVariables,
    panelValueFormat: input.panelValueFormat,
    dynamicPromptEnabled: input.dynamicPromptEnabled,
  })
  if (!expandedPrompts.ok) {
    return expandedPrompts
  }

  const runPlans: PlannedRun[] = createPlannedRuns({
    batchId,
    mode,
    sides: mode === 'single' ? ['single'] : getMultiSideIds(sideCount),
    settingsBySide,
    channels: input.channels,
    modelCatalog: input.modelCatalog,
    sourceImages,
    expandedPrompts: expandedPrompts.value,
    templatePrompt,
  })

  const firstRun = runPlans[0]?.pendingRun
  if (!firstRun) {
    return { ok: false, error: 'No runnable plans generated.' }
  }

  const imageTasks = buildImageTasksForPlannedRuns(runPlans)

  return {
    ok: true,
    value: {
      batchId,
      userPrompt: expandedPrompts.value.length > 1 ? `${templatePrompt} (${expandedPrompts.value.length} runs)` : firstRun.finalPrompt,
      templatePrompt,
      finalPrompt: firstRun.finalPrompt,
      variablesSnapshot: firstRun.variablesSnapshot,
      mode,
      sideCount,
      settingsBySide,
      runPlans,
      imageTasks,
      pendingRuns: runPlans.map((item) => item.pendingRun),
    },
  }
}

export function buildRetryPlan(input: {
  activeConversation: Conversation | null
  runId: string
  channels: ApiChannel[]
  modelCatalog: ModelCatalog
}): RetryPlan | null {
  const { activeConversation, runId, channels, modelCatalog } = input
  if (!activeConversation) {
    return null
  }

  const allRuns = activeConversation.messages.flatMap((message) => message.runs ?? [])
  const sourceRun = allRuns.find((item) => item.id === runId)
  if (!sourceRun) {
    return null
  }

  const rootRunId = sourceRun.retryOfRunId ?? sourceRun.id
  const maxRetryAttempt = allRuns.reduce((acc, current) => {
    if (current.id === rootRunId || current.retryOfRunId === rootRunId) {
      return Math.max(acc, current.retryAttempt ?? 0)
    }
    return acc
  }, 0)

  const settings: SingleSideSettings = {
    generationMode: 'image',
    resolution: normalizeSizeTier(sourceRun.settingsSnapshot?.resolution),
    aspectRatio: sourceRun.settingsSnapshot?.aspectRatio ?? ASPECT_RATIO_DEFAULT,
    imageCount: sourceRun.settingsSnapshot?.imageCount ?? sourceRun.imageCount,
    gridColumns: sourceRun.settingsSnapshot?.gridColumns ?? 4,
    sizeMode: sourceRun.settingsSnapshot?.sizeMode ?? 'preset',
    customWidth: sourceRun.settingsSnapshot?.customWidth ?? 1024,
    customHeight: sourceRun.settingsSnapshot?.customHeight ?? 1024,
    autoSave: Boolean(sourceRun.settingsSnapshot?.autoSave && sourceRun.settingsSnapshot?.saveDirectory),
    saveDirectory:
      typeof sourceRun.settingsSnapshot?.saveDirectory === 'string' &&
        sourceRun.settingsSnapshot.saveDirectory.trim().length > 0
        ? sourceRun.settingsSnapshot.saveDirectory.trim()
        : undefined,
    channelId: sourceRun.channelId,
    modelId: sourceRun.modelId,
    textModelId: sourceRun.modelId,
    videoModelId: sourceRun.modelId,
    paramValues: { ...sourceRun.paramsSnapshot },
  }

  const model = getModelById(modelCatalog, sourceRun.modelId) ?? getDefaultModel(modelCatalog)
  const channel = channels.find((item) => item.id === sourceRun.channelId)
    ?? (sourceRun.channelId === JIMENG_VIRTUAL_CHANNEL_ID ? buildJimengVirtualChannel() : null)
  const fallbackChannel = sourceRun.channelName
    ? { id: sourceRun.channelId ?? makeId(), name: sourceRun.channelName, baseUrl: '', apiKey: '' }
    : undefined

  return {
    sourceRun,
    rootRunId,
    nextRetryAttempt: maxRetryAttempt + 1,
    settings,
    modelId: model?.id ?? sourceRun.modelId,
    modelName: model?.name ?? sourceRun.modelName,
    paramsSnapshot: { ...sourceRun.paramsSnapshot },
    sourceImages: Array.isArray(sourceRun.sourceImages) ? sourceRun.sourceImages : [],
    channel: channel ?? fallbackChannel,
  }
}

export function buildReplayPlan(input: {
  activeConversation: Conversation | null
  runId: string
  channels: ApiChannel[]
  modelCatalog: ModelCatalog
}): ReplayPlan | null {
  const { activeConversation, runId, channels, modelCatalog } = input
  if (!activeConversation) {
    return null
  }

  const allRuns = activeConversation.messages.flatMap((message) => message.runs ?? [])
  const sourceRun = allRuns.find((item) => item.id === runId)
  if (!sourceRun) {
    return null
  }

  const settings: SingleSideSettings = {
    generationMode: 'image',
    resolution: normalizeSizeTier(sourceRun.settingsSnapshot?.resolution),
    aspectRatio: sourceRun.settingsSnapshot?.aspectRatio ?? ASPECT_RATIO_DEFAULT,
    imageCount: sourceRun.settingsSnapshot?.imageCount ?? sourceRun.imageCount,
    gridColumns: sourceRun.settingsSnapshot?.gridColumns ?? 4,
    sizeMode: sourceRun.settingsSnapshot?.sizeMode ?? 'preset',
    customWidth: sourceRun.settingsSnapshot?.customWidth ?? 1024,
    customHeight: sourceRun.settingsSnapshot?.customHeight ?? 1024,
    autoSave: Boolean(sourceRun.settingsSnapshot?.autoSave && sourceRun.settingsSnapshot?.saveDirectory),
    saveDirectory:
      typeof sourceRun.settingsSnapshot?.saveDirectory === 'string' &&
        sourceRun.settingsSnapshot.saveDirectory.trim().length > 0
        ? sourceRun.settingsSnapshot.saveDirectory.trim()
        : undefined,
    channelId: sourceRun.channelId,
    modelId: sourceRun.modelId,
    textModelId: sourceRun.modelId,
    videoModelId: sourceRun.modelId,
    paramValues: { ...sourceRun.paramsSnapshot },
  }

  const model = getModelById(modelCatalog, sourceRun.modelId) ?? getDefaultModel(modelCatalog)
  const channel = channels.find((item) => item.id === sourceRun.channelId)
    ?? (sourceRun.channelId === JIMENG_VIRTUAL_CHANNEL_ID ? buildJimengVirtualChannel() : null)
  const fallbackChannel = sourceRun.channelName
    ? { id: sourceRun.channelId ?? makeId(), name: sourceRun.channelName, baseUrl: '', apiKey: '' }
    : undefined

  return {
    sourceRun,
    batchId: makeId(),
    settings,
    modelId: model?.id ?? sourceRun.modelId,
    modelName: model?.name ?? sourceRun.modelName,
    paramsSnapshot: { ...sourceRun.paramsSnapshot },
    sourceImages: Array.isArray(sourceRun.sourceImages) ? sourceRun.sourceImages : [],
    channel: channel ?? fallbackChannel,
  }
}
