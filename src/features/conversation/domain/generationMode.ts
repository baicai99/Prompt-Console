import type { Side, SideMode, SingleSideSettings } from '../../../types/conversation'
import { getMultiSideIds } from './settingsNormalization'

export function resolveGenerationMode(settings: Pick<SingleSideSettings, 'generationMode'> | null | undefined): 'image' | 'text' {
  return settings?.generationMode === 'image' ? 'image' : 'text'
}

export function resolveSharedGenerationMode(input: {
  sideMode: SideMode
  sideCount: number
  settingsBySide: Record<Side, SingleSideSettings>
}): 'image' | 'text' {
  const targetSides = input.sideMode === 'single' ? (['single'] as Side[]) : getMultiSideIds(input.sideCount)
  const firstConfiguredSide = targetSides.find((side) => input.settingsBySide[side])
  return resolveGenerationMode(firstConfiguredSide ? input.settingsBySide[firstConfiguredSide] : null)
}

export function resolveCurrentModeModelId(
  settings: Pick<SingleSideSettings, 'generationMode' | 'modelId' | 'textModelId'>,
): string {
  if (resolveGenerationMode(settings) === 'text') {
    return settings.textModelId ?? settings.modelId
  }
  return settings.modelId
}
