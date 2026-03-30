import type { Run, SettingPrimitive, Side, SideMode, SingleSideSettings } from '../../../types/conversation'
import type { ApiChannel } from '../../../types/channel'
import type { RunSourceImageRef } from '../../../types/image'
import type { ModelCatalog } from '../../../types/model'
import { buildJimengVirtualChannel, JIMENG_VIRTUAL_CHANNEL_ID } from '../../../services/jimengVirtualChannel'
import { makeId, toSettingsSnapshot } from '../../../utils/chat'
import { createRunTaskState } from './runTaskState'
import { getDefaultModel, getModelById, normalizeParamValues } from './modelCatalogDomain'
import { getEffectiveSize } from './settingsNormalization'
import type { ExpandedPromptBatch } from './runPlanPromptExpansion'
import type { PlannedRun } from './runPlanningTypes'

export function createPlannedRuns(input: {
  batchId: string
  mode: SideMode
  sides: Side[]
  settingsBySide: Record<Side, SingleSideSettings>
  channels: ApiChannel[]
  modelCatalog: ModelCatalog
  sourceImages: RunSourceImageRef[]
  expandedPrompts: ExpandedPromptBatch[]
  templatePrompt: string
}): PlannedRun[] {
  const runPlans: PlannedRun[] = []

  for (const expandedPrompt of input.expandedPrompts) {
    for (const side of input.sides) {
      const settings = input.settingsBySide[side]
      const model = getModelById(input.modelCatalog, settings.modelId) ?? getDefaultModel(input.modelCatalog)
      const paramsSnapshot: Record<string, SettingPrimitive> = {
        ...normalizeParamValues(model, settings.paramValues),
        size: getEffectiveSize(settings),
      }
      const channel = input.channels.find((item) => item.id === settings.channelId)
        ?? (settings.channelId === JIMENG_VIRTUAL_CHANNEL_ID ? buildJimengVirtualChannel() ?? undefined : undefined)
      const imageCount = Math.max(1, Math.floor(settings.imageCount))
      const createdAt = new Date().toISOString()

      const pendingRun: Run = {
        id: makeId(),
        batchId: input.batchId,
        createdAt,
        sideMode: input.mode,
        side,
        prompt: expandedPrompt.finalPrompt,
        imageCount,
        channelId: channel?.id ?? null,
        channelName: channel?.name ?? null,
        modelId: model?.id ?? settings.modelId,
        modelName: model?.name ?? settings.modelId,
        templatePrompt: input.templatePrompt,
        finalPrompt: expandedPrompt.finalPrompt,
        variablesSnapshot: expandedPrompt.variablesSnapshot,
        paramsSnapshot,
        sourceImages: input.sourceImages,
        settingsSnapshot: toSettingsSnapshot(settings),
        retryAttempt: 0,
        taskIds: [],
        taskState: createRunTaskState({
          status: 'waiting',
          now: createdAt,
        }),
        images: Array.from({ length: imageCount }, (_, index) => ({
          id: makeId(),
          seq: index + 1,
          status: 'pending' as const,
          queuedAt: createdAt,
          threadState: 'active' as const,
        })),
      }

      runPlans.push({
        side,
        settings,
        modelId: model?.id ?? settings.modelId,
        modelName: model?.name ?? settings.modelId,
        paramsSnapshot,
        sourceImages: input.sourceImages,
        channel,
        pendingRun,
      })
    }
  }

  return runPlans
}
