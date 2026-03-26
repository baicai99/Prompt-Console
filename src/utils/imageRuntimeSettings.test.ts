import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IMAGE_RUNTIME_SETTINGS,
  RESUME_POLL_PRESET_SCHEDULES,
  getResumePollSchedule,
  normalizeImageRuntimeSettings,
  resolveResumePollIntervalMs,
  toImageRuntimeMilliseconds,
} from './imageRuntimeSettings'

describe('imageRuntimeSettings', () => {
  it('uses the balanced preset schedule and 10 minute timeout by default', () => {
    expect(DEFAULT_IMAGE_RUNTIME_SETTINGS.resumePollStrategyMode).toBe('preset')
    expect(DEFAULT_IMAGE_RUNTIME_SETTINGS.resumePollPreset).toBe('balanced')
    expect(DEFAULT_IMAGE_RUNTIME_SETTINGS.resumePollSchedule).toEqual([
      { elapsedSeconds: 0, intervalSeconds: 0.5 },
      { elapsedSeconds: 30, intervalSeconds: 1.5 },
      { elapsedSeconds: 60, intervalSeconds: 3 },
    ])
    expect(DEFAULT_IMAGE_RUNTIME_SETTINGS.generationTimeoutMinutes).toBe(10)
    expect(normalizeImageRuntimeSettings(undefined).resumePollPreset).toBe('balanced')
    expect(getResumePollSchedule(DEFAULT_IMAGE_RUNTIME_SETTINGS)).toEqual(RESUME_POLL_PRESET_SCHEDULES.balanced)
  })

  it('maps legacy fixed polling seconds into a custom first segment for compatibility', () => {
    const normalized = normalizeImageRuntimeSettings({ resumePollIntervalSeconds: 2 })

    expect(normalized.resumePollStrategyMode).toBe('preset')
    expect(normalized.resumePollPreset).toBe('balanced')
    expect(normalized.resumePollSchedule).toEqual([{ elapsedSeconds: 0, intervalSeconds: 2 }])
  })

  it('normalizes custom schedules by sorting, clamping, truncating, and forcing the first step to 0 seconds', () => {
    const normalized = normalizeImageRuntimeSettings({
      resumePollStrategyMode: 'custom',
      resumePollSchedule: [
        { elapsedSeconds: 90, intervalSeconds: 4.6 },
        { elapsedSeconds: 0.2, intervalSeconds: 0.02 },
        { elapsedSeconds: 30, intervalSeconds: 1.49 },
        { elapsedSeconds: 30, intervalSeconds: 2.1 },
        { elapsedSeconds: 200, intervalSeconds: 999 },
        { elapsedSeconds: 240, intervalSeconds: 5 },
      ],
    })

    expect(normalized.resumePollSchedule).toEqual([
      { elapsedSeconds: 0, intervalSeconds: 0.1 },
      { elapsedSeconds: 30, intervalSeconds: 1.5 },
      { elapsedSeconds: 90, intervalSeconds: 4.6 },
      { elapsedSeconds: 200, intervalSeconds: 300 },
    ])
  })

  it('resolves polling interval by elapsed time and doubles it when hidden', () => {
    expect(resolveResumePollIntervalMs(DEFAULT_IMAGE_RUNTIME_SETTINGS, 5_000, 'visible')).toBe(500)
    expect(resolveResumePollIntervalMs(DEFAULT_IMAGE_RUNTIME_SETTINGS, 45_000, 'visible')).toBe(1500)
    expect(resolveResumePollIntervalMs(DEFAULT_IMAGE_RUNTIME_SETTINGS, 61_000, 'visible')).toBe(3000)
    expect(resolveResumePollIntervalMs(DEFAULT_IMAGE_RUNTIME_SETTINGS, 61_000, 'hidden')).toBe(6000)
  })

  it('converts timeout minutes to milliseconds', () => {
    expect(toImageRuntimeMilliseconds({
      ...DEFAULT_IMAGE_RUNTIME_SETTINGS,
      generationTimeoutMinutes: 2.5,
    })).toEqual({
      generationTimeoutMs: 150000,
    })
  })
})
