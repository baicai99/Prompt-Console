import { getModelById } from '../../../../domain/modelCatalogDomain'
import { resolveGenerationMode } from '../../../../domain/generationMode'
import { normalizeSettingsBySide } from '../../../../domain/settingsNormalization'
import { resolveSendGenerationMode } from '../sendFlowUtils'
import type { ModelCatalog } from '../../../../../../types/model'
import type { Side, SideMode, SingleSideSettings } from '../../../../../../types/conversation'

interface ModelSelectionCommandsInput {
  stateChannels: import('../../../../state/conversationState').ConversationState['channels']
  modelCatalog: ModelCatalog
  activeSideMode: SideMode
  activeSideCount: number
  activeSides: Side[]
  activeSettingsBySide: Record<Side, SingleSideSettings>
  clearDraftSourceImages: () => void
  updateConversationState: (mode: SideMode, sideCount: number, settingsBySide: Record<Side, SingleSideSettings>) => void
}

export function createModelSelectionCommands(input: ModelSelectionCommandsInput) {
  const resolveSharedUpdateSides = (sides: Side[]): Side[] => {
    const uniqueSides = Array.from(new Set(sides))
    if (input.activeSideMode !== 'multi') {
      return uniqueSides
    }

    const includesAllActiveSides = input.activeSides.every((side) => uniqueSides.includes(side))
    if (!includesAllActiveSides) {
      return uniqueSides
    }

    return Array.from(new Set<Side>(['single', ...uniqueSides]))
  }

  const applySettingsPatchToSides = (sides: Side[], patch: Partial<SingleSideSettings>) => {
    const uniqueSides = resolveSharedUpdateSides(sides)
    let changed = false
    const nextSettings = { ...input.activeSettingsBySide }

    for (const side of uniqueSides) {
      const current = input.activeSettingsBySide[side]
      if (!current) {
        continue
      }
      nextSettings[side] = {
        ...current,
        ...patch,
      }
      changed = true
    }

    if (!changed) {
      return null
    }

    return normalizeSettingsBySide(nextSettings, input.stateChannels, input.modelCatalog, input.activeSideCount)
  }

  const finalizeSideSettingsUpdate = (
    patch: Partial<SingleSideSettings>,
    merged: Record<Side, SingleSideSettings>,
  ) => {
    input.updateConversationState(input.activeSideMode, input.activeSideCount, merged)
    if (patch.generationMode === 'text') {
      const modeResolution = resolveSendGenerationMode({
        sideMode: input.activeSideMode,
        sideCount: input.activeSideCount,
        settingsBySide: merged,
      })
      if (!('error' in modeResolution) && modeResolution.mode === 'text') {
        input.clearDraftSourceImages()
      }
    }
  }

  const updateSideSettings = (side: Side, patch: Partial<SingleSideSettings>) => {
    const merged = applySettingsPatchToSides([side], patch)
    if (!merged) {
      return
    }
    finalizeSideSettingsUpdate(patch, merged)
  }

  const updateSidesSettings = (sides: Side[], patch: Partial<SingleSideSettings>) => {
    const merged = applySettingsPatchToSides(sides, patch)
    if (!merged) {
      return
    }
    finalizeSideSettingsUpdate(patch, merged)
  }

  const setSideModel = (side: Side, modelId: string) => {
    const current = input.activeSettingsBySide[side]
    const selectedModel = getModelById(input.modelCatalog, modelId)
    const merged = normalizeSettingsBySide(
      {
        ...input.activeSettingsBySide,
        [side]: {
          ...current,
          modelId,
          channelId: selectedModel?.channelId ?? current?.channelId ?? null,
          paramValues: {},
        },
      },
      input.stateChannels,
      input.modelCatalog,
      input.activeSideCount,
    )

    input.updateConversationState(input.activeSideMode, input.activeSideCount, merged)
  }

  const setSideModelForCurrentMode = (side: Side, modelId: string) => {
    const current = input.activeSettingsBySide[side]
    if (!current) {
      return
    }
    const selectedModel = getModelById(input.modelCatalog, modelId)

    const nextSideSettings =
      resolveGenerationMode(current) === 'text'
        ? {
            ...current,
            textModelId: modelId,
            channelId: selectedModel?.channelId ?? current.channelId,
          }
        : {
            ...current,
            modelId,
            channelId: selectedModel?.channelId ?? current.channelId,
            paramValues: {},
          }

    const merged = normalizeSettingsBySide(
      {
        ...input.activeSettingsBySide,
        [side]: nextSideSettings,
      },
      input.stateChannels,
      input.modelCatalog,
      input.activeSideCount,
    )

    input.updateConversationState(input.activeSideMode, input.activeSideCount, merged)
  }

  const setGenerationMode = (mode: 'image' | 'text') => {
    const targetSides = input.activeSideMode === 'single'
      ? (['single'] as Side[])
      : Array.from(new Set<Side>(['single', ...input.activeSides]))
    const nextSettings = { ...input.activeSettingsBySide }
    for (const side of targetSides) {
      const current = nextSettings[side]
      if (!current) {
        continue
      }
      nextSettings[side] = {
        ...current,
        generationMode: mode,
      }
    }
    const merged = normalizeSettingsBySide(nextSettings, input.stateChannels, input.modelCatalog, input.activeSideCount)
    input.updateConversationState(input.activeSideMode, input.activeSideCount, merged)
    if (mode === 'text') {
      input.clearDraftSourceImages()
    }
  }

  const applyModelShortcut = (modelId: string): Record<Side, SingleSideSettings> => {
    const targetSides = input.activeSideMode === 'single'
      ? (['single'] as Side[])
      : Array.from(new Set<Side>(['single', ...input.activeSides]))
    const nextSettings = { ...input.activeSettingsBySide }
    const selectedModel = getModelById(input.modelCatalog, modelId)

    for (const side of targetSides) {
      const current = nextSettings[side]
      if (!current) {
        continue
      }
      nextSettings[side] = {
        ...current,
        modelId,
        textModelId: modelId,
        channelId: selectedModel?.channelId ?? current.channelId,
        paramValues: {},
      }
    }

    const merged = normalizeSettingsBySide(nextSettings, input.stateChannels, input.modelCatalog, input.activeSideCount)
    input.updateConversationState(input.activeSideMode, input.activeSideCount, merged)
    return merged
  }

  const setSideModelParam = (side: Side, paramKey: string, value: string | number | boolean) => {
    const current = input.activeSettingsBySide[side]
    const merged = normalizeSettingsBySide(
      {
        ...input.activeSettingsBySide,
        [side]: {
          ...current,
          paramValues: {
            ...current.paramValues,
            [paramKey]: value,
          },
        },
      },
      input.stateChannels,
      input.modelCatalog,
      input.activeSideCount,
    )

    input.updateConversationState(input.activeSideMode, input.activeSideCount, merged)
  }

  return {
    updateSideSettings,
    updateSidesSettings,
    setSideModel,
    setSideModelForCurrentMode,
    setGenerationMode,
    applyModelShortcut,
    setSideModelParam,
  }
}
