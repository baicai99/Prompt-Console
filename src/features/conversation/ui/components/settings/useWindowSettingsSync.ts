import { useCallback, useState } from 'react'
import type { Side, SideMode, SingleSideSettings } from '../../../../../types/conversation'

const GENERATION_BASE_SYNC_KEYS = new Set<keyof SingleSideSettings>(['imageCount', 'gridColumns'])

function resolveWindowSyncSectionLabel(patch: Partial<SingleSideSettings>): string | null {
  const patchKeys = Object.keys(patch) as Array<keyof SingleSideSettings>
  return patchKeys.some((key) => GENERATION_BASE_SYNC_KEYS.has(key)) ? '生成基础' : null
}

function hasSettingsPatchDiff(
  currentSettings: SingleSideSettings | undefined,
  patch: Partial<SingleSideSettings>,
): boolean {
  if (!currentSettings) {
    return false
  }

  return (Object.keys(patch) as Array<keyof SingleSideSettings>).some(
    (key) => !Object.is(currentSettings[key], patch[key]),
  )
}

export type PendingWindowSyncChoice = { side: Side; patch: Partial<SingleSideSettings>; sectionLabel: string }

interface UseWindowSettingsSyncInput {
  sideMode: SideMode
  sideIds: Side[]
  settingsBySide: Record<Side, SingleSideSettings>
  onSettingsChange: (side: Side, patch: Partial<SingleSideSettings>) => void
  onSettingsBatchChange: (sides: Side[], patch: Partial<SingleSideSettings>) => void
}

export function useWindowSettingsSync(input: UseWindowSettingsSyncInput) {
  const { sideMode, sideIds, settingsBySide, onSettingsChange, onSettingsBatchChange } = input
  const [pendingWindowSyncChoice, setPendingWindowSyncChoice] = useState<PendingWindowSyncChoice | null>(null)

  const handleSettingsChange = useCallback((side: Side, patch: Partial<SingleSideSettings>) => {
    const sectionLabel = resolveWindowSyncSectionLabel(patch)
    if (
      sideMode === 'multi'
      && sideIds.length > 1
      && sectionLabel
      && hasSettingsPatchDiff(settingsBySide[side], patch)
    ) {
      setPendingWindowSyncChoice({
        side,
        patch,
        sectionLabel,
      })
      return
    }

    onSettingsChange(side, patch)
  }, [onSettingsChange, settingsBySide, sideIds, sideMode])

  const applyPendingWindowSyncToCurrentSide = useCallback(() => {
    if (!pendingWindowSyncChoice) {
      return
    }

    onSettingsChange(pendingWindowSyncChoice.side, pendingWindowSyncChoice.patch)
    setPendingWindowSyncChoice(null)
  }, [onSettingsChange, pendingWindowSyncChoice])

  const applyPendingWindowSyncToAllSides = useCallback(() => {
    if (!pendingWindowSyncChoice) {
      return
    }

    onSettingsBatchChange(sideIds, pendingWindowSyncChoice.patch)
    setPendingWindowSyncChoice(null)
  }, [onSettingsBatchChange, pendingWindowSyncChoice, sideIds])

  return {
    pendingWindowSyncChoice,
    handleSettingsChange,
    applyPendingWindowSyncToCurrentSide,
    applyPendingWindowSyncToAllSides,
  }
}
