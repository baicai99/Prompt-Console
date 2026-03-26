import { useEffect, useState } from 'react'
import type { Side, SideMode } from '../../../../../types/conversation'
import { safeReadStorage, safeWriteStorage } from '../../../../../utils/safeStorage'
import { normalizeCollapseKeys } from './settingsPanelHelpers'

interface UseSettingsPanelCollapseStateInput {
  storageKey: string
  defaultKeys: string[]
  sideMode: SideMode
  sideIds: Side[]
}

type SettingsPanelCollapseState = { sideById?: unknown }

export function useSettingsPanelCollapseState(input: UseSettingsPanelCollapseStateInput) {
  const { storageKey, defaultKeys, sideMode, sideIds } = input

  const [sideCollapseKeysById, setSideCollapseKeysById] = useState<Record<Side, string[]>>(() => {
    try {
      const raw = safeReadStorage(storageKey)
      if (!raw) {
        return { single: defaultKeys }
      }
      const parsed = JSON.parse(raw) as SettingsPanelCollapseState
      if (!parsed?.sideById || typeof parsed.sideById !== 'object') {
        return { single: defaultKeys }
      }
      const result: Record<Side, string[]> = { single: defaultKeys }
      for (const [key, value] of Object.entries(parsed.sideById as Record<string, unknown>)) {
        result[key as Side] = normalizeCollapseKeys(value, defaultKeys)
      }
      return result
    } catch {
      return { single: defaultKeys }
    }
  })

  useEffect(() => {
    safeWriteStorage(
      storageKey,
      JSON.stringify({
        sideById: sideCollapseKeysById,
      }),
    )
  }, [sideCollapseKeysById, storageKey])

  useEffect(() => {
    const expectedSides: Side[] = sideMode === 'multi' ? sideIds : ['single']
    setSideCollapseKeysById((prev) => {
      let changed = false
      const next = { ...prev }
      for (const side of expectedSides) {
        if (!next[side]) {
          next[side] = defaultKeys
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [defaultKeys, sideIds, sideMode])

  return {
    sideCollapseKeysById,
    setSideCollapseKeysById,
  }
}
