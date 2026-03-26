import type { ImageRuntimeSettings } from '../types/conversation'

export type ResumePollPreset = ImageRuntimeSettings['resumePollPreset']
export type ResumePollStrategyMode = ImageRuntimeSettings['resumePollStrategyMode']
export type ResumePollScheduleItem = ImageRuntimeSettings['resumePollSchedule'][number]

interface LegacyImageRuntimeSettingsInput extends Partial<ImageRuntimeSettings> {
  resumePollIntervalSeconds?: number
}

const MIN_POLL_INTERVAL_SECONDS = 0.1
const MAX_POLL_INTERVAL_SECONDS = 300
const MAX_POLL_SCHEDULE_STEPS = 5
const HIDDEN_POLL_MULTIPLIER = 2

export const RESUME_POLL_PRESET_SCHEDULES: Record<ResumePollPreset, ResumePollScheduleItem[]> = {
  fast: [
    { elapsedSeconds: 0, intervalSeconds: 0.3 },
    { elapsedSeconds: 15, intervalSeconds: 0.8 },
    { elapsedSeconds: 45, intervalSeconds: 2 },
  ],
  balanced: [
    { elapsedSeconds: 0, intervalSeconds: 0.5 },
    { elapsedSeconds: 30, intervalSeconds: 1.5 },
    { elapsedSeconds: 60, intervalSeconds: 3 },
  ],
  low_request: [
    { elapsedSeconds: 0, intervalSeconds: 1 },
    { elapsedSeconds: 20, intervalSeconds: 2.5 },
    { elapsedSeconds: 45, intervalSeconds: 5 },
  ],
}

export const DEFAULT_IMAGE_RUNTIME_SETTINGS: ImageRuntimeSettings = {
  resumePollStrategyMode: 'preset',
  resumePollPreset: 'balanced',
  resumePollSchedule: RESUME_POLL_PRESET_SCHEDULES.balanced,
  generationTimeoutMinutes: 10,
  showRequestMethodBadge: false,
  maxActivePreviewHandles: 24,
  offscreenPreviewReleaseDelayMs: 120,
  recentMessageRetentionCount: 24,
  highPressureMessageRetentionCount: 8,
}

function clampNumber(value: unknown, min: number, max: number, fallback: number, precision = 1): number {
  const normalized = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(normalized)) {
    return fallback
  }
  const clamped = Math.min(max, Math.max(min, normalized))
  const factor = 10 ** precision
  return Math.round((clamped + Number.EPSILON) * factor) / factor
}

function normalizeResumePollPreset(value: unknown): ResumePollPreset {
  return value === 'fast' || value === 'balanced' || value === 'low_request'
    ? value
    : DEFAULT_IMAGE_RUNTIME_SETTINGS.resumePollPreset
}

function normalizeResumePollStrategyMode(value: unknown): ResumePollStrategyMode {
  return value === 'custom' ? 'custom' : 'preset'
}

function normalizeResumePollSchedule(
  schedule: unknown,
  fallback: ResumePollScheduleItem[],
): ResumePollScheduleItem[] {
  const input = Array.isArray(schedule)
    ? schedule
        .filter(
          (item): item is Partial<ResumePollScheduleItem> =>
            Boolean(item) && typeof item === 'object',
        )
        .slice(0, MAX_POLL_SCHEDULE_STEPS)
    : []

  const normalized = input
    .map((item, index) => ({
      elapsedSeconds: clampNumber(
        item.elapsedSeconds,
        0,
        24 * 60 * 60,
        index === 0 ? 0 : fallback[Math.min(index, fallback.length - 1)]?.elapsedSeconds ?? 0,
        0,
      ),
      intervalSeconds: clampNumber(
        item.intervalSeconds,
        MIN_POLL_INTERVAL_SECONDS,
        MAX_POLL_INTERVAL_SECONDS,
        fallback[Math.min(index, fallback.length - 1)]?.intervalSeconds ?? DEFAULT_IMAGE_RUNTIME_SETTINGS.resumePollSchedule[0].intervalSeconds,
      ),
    }))
    .sort((left, right) => left.elapsedSeconds - right.elapsedSeconds)
    .filter((item, index, items) => index === 0 || item.elapsedSeconds > items[index - 1]!.elapsedSeconds)

  if (normalized.length === 0) {
    return fallback
  }

  const [first, ...rest] = normalized
  return [
    {
      elapsedSeconds: 0,
      intervalSeconds: first.intervalSeconds,
    },
    ...rest,
  ]
}

export function getResumePollSchedule(settings: ImageRuntimeSettings): ResumePollScheduleItem[] {
  return settings.resumePollStrategyMode === 'custom'
    ? settings.resumePollSchedule
    : RESUME_POLL_PRESET_SCHEDULES[settings.resumePollPreset]
}

export function normalizeImageRuntimeSettings(
  value: LegacyImageRuntimeSettingsInput | null | undefined,
): ImageRuntimeSettings {
  const resumePollPreset = normalizeResumePollPreset(value?.resumePollPreset)
  const resumePollStrategyMode = normalizeResumePollStrategyMode(value?.resumePollStrategyMode)
  const legacyInterval = clampNumber(
    value?.resumePollIntervalSeconds,
    MIN_POLL_INTERVAL_SECONDS,
    MAX_POLL_INTERVAL_SECONDS,
    RESUME_POLL_PRESET_SCHEDULES.balanced[0].intervalSeconds,
  )
  const presetSchedule = RESUME_POLL_PRESET_SCHEDULES[resumePollPreset]
  const fallbackCustomSchedule =
    typeof value?.resumePollIntervalSeconds === 'number'
      ? [{ elapsedSeconds: 0, intervalSeconds: legacyInterval }]
      : presetSchedule
  const resumePollSchedule = normalizeResumePollSchedule(value?.resumePollSchedule, fallbackCustomSchedule)

  return {
    resumePollStrategyMode,
    resumePollPreset,
    resumePollSchedule,
    generationTimeoutMinutes: clampNumber(
      value?.generationTimeoutMinutes,
      0.1,
      24 * 60,
      DEFAULT_IMAGE_RUNTIME_SETTINGS.generationTimeoutMinutes,
      1,
    ),
    showRequestMethodBadge: value?.showRequestMethodBadge ?? DEFAULT_IMAGE_RUNTIME_SETTINGS.showRequestMethodBadge,
    maxActivePreviewHandles: clampNumber(
      value?.maxActivePreviewHandles,
      4,
      120,
      DEFAULT_IMAGE_RUNTIME_SETTINGS.maxActivePreviewHandles,
      0,
    ),
    offscreenPreviewReleaseDelayMs: clampNumber(
      value?.offscreenPreviewReleaseDelayMs,
      0,
      5000,
      DEFAULT_IMAGE_RUNTIME_SETTINGS.offscreenPreviewReleaseDelayMs,
      0,
    ),
    recentMessageRetentionCount: clampNumber(
      value?.recentMessageRetentionCount,
      4,
      200,
      DEFAULT_IMAGE_RUNTIME_SETTINGS.recentMessageRetentionCount,
      0,
    ),
    highPressureMessageRetentionCount: clampNumber(
      value?.highPressureMessageRetentionCount,
      2,
      100,
      DEFAULT_IMAGE_RUNTIME_SETTINGS.highPressureMessageRetentionCount,
      0,
    ),
  }
}

export function resolveResumePollIntervalMs(
  settings: ImageRuntimeSettings,
  elapsedMs: number,
  visibilityState?: DocumentVisibilityState,
): number {
  const schedule = getResumePollSchedule(settings)
  const elapsedSeconds = Math.max(0, elapsedMs) / 1000
  const matched = schedule.reduce<ResumePollScheduleItem>(
    (current, item) => (elapsedSeconds >= item.elapsedSeconds ? item : current),
    schedule[0] ?? DEFAULT_IMAGE_RUNTIME_SETTINGS.resumePollSchedule[0],
  )
  const intervalMs = Math.round(matched.intervalSeconds * 1000)
  return visibilityState === 'hidden'
    ? Math.round(intervalMs * HIDDEN_POLL_MULTIPLIER)
    : intervalMs
}

export function toImageRuntimeMilliseconds(settings: ImageRuntimeSettings): {
  generationTimeoutMs: number
} {
  return {
    generationTimeoutMs: settings.generationTimeoutMinutes * 60 * 1000,
  }
}
