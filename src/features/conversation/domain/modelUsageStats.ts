import type { Run, RunAttempt, RunTaskStatus } from '../../../types/conversation'
import type { ModelCatalog } from '../../../types/model'
import { parseScopedModelId } from '../../../utils/modelIdentity'
import { getRunElapsedMs } from './requestDuration'
import { getRunAttemptElapsedMs, normalizeRunAttempts } from './runAttempts'

export type ModelUsageGranularity = 'hour' | 'day' | 'week' | 'month'
export type ModelUsagePresetRange = 'day' | 'week' | 'month'
export type ModelUsageRunStatus = 'completed' | 'failed' | 'cancelled' | 'inProgress'

export interface ModelUsageBucketModelEntry {
  modelId: string
  modelName: string
  count: number
  totalElapsedMs: number
  averageElapsedMs: number | null
}

export interface ModelUsageBucket {
  key: string
  label: string
  bucketStart: string
  bucketEnd: string
  totalCount: number
  totalElapsedMs: number
  averageElapsedMs: number | null
  statusCounts: Record<ModelUsageRunStatus, number>
  topModels: ModelUsageBucketModelEntry[]
}

export interface ModelUsageModelEntry {
  modelId: string
  modelName: string
  count: number
  share: number
  totalElapsedMs: number
  averageElapsedMs: number | null
  statusCounts: Record<ModelUsageRunStatus, number>
  channelLabel: string | null
  detailSourceLabel: string | null
}

export interface ModelUsageSnapshot {
  range: {
    preset: ModelUsagePresetRange
    label: string
    start: string
    end: string
    anchorDate: string
    anchorDateLabel: string
  }
  granularity: ModelUsageGranularity
  timeZone: string
  totalCount: number
  totalElapsedMs: number
  averageElapsedMs: number | null
  activeModelCount: number
  statusCounts: Record<ModelUsageRunStatus, number>
  sources: string[]
  buckets: ModelUsageBucket[]
  models: ModelUsageModelEntry[]
}

interface AggregateModelUsageStatsInput {
  runs: Run[]
  modelCatalog: ModelCatalog
  range: ModelUsagePresetRange
  granularity: ModelUsageGranularity
  timeZone: string
  sourceFilter?: string | null
  anchorDate?: string
  now?: Date
}

interface ZonedDateParts {
  year: number
  month: number
  day: number
  hour: number
}

const MODEL_USAGE_STATUS_KEYS: ModelUsageRunStatus[] = ['completed', 'failed', 'cancelled', 'inProgress']

export const MODEL_USAGE_PRESET_LABELS: Record<ModelUsagePresetRange, string> = {
  day: '天',
  week: '周',
  month: '月',
}

export const MODEL_USAGE_PRESET_GRANULARITIES: Record<ModelUsagePresetRange, ModelUsageGranularity[]> = {
  day: ['hour', 'day'],
  week: ['day', 'week'],
  month: ['day', 'week', 'month'],
}

export const MODEL_USAGE_GRANULARITY_LABELS: Record<ModelUsageGranularity, string> = {
  hour: '小时',
  day: '天',
  week: '周',
  month: '月',
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function createEmptyStatusCounts(): Record<ModelUsageRunStatus, number> {
  return {
    completed: 0,
    failed: 0,
    cancelled: 0,
    inProgress: 0,
  }
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cacheKey = timeZone
  const existing = formatterCache.get(cacheKey)
  if (existing) {
    return existing
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })
  formatterCache.set(cacheKey, formatter)
  return formatter
}

function getZonedParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = getFormatter(timeZone).formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
  }
}

function compareZonedParts(left: ZonedDateParts, right: ZonedDateParts): number {
  if (left.year !== right.year) {
    return left.year - right.year
  }
  if (left.month !== right.month) {
    return left.month - right.month
  }
  if (left.day !== right.day) {
    return left.day - right.day
  }
  return left.hour - right.hour
}

function toUtcDate(parts: ZonedDateParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, 0, 0, 0))
}

function fromUtcDate(date: Date): ZonedDateParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
  }
}

function addHours(parts: ZonedDateParts, hours: number): ZonedDateParts {
  return fromUtcDate(new Date(toUtcDate(parts).getTime() + hours * 60 * 60 * 1000))
}

function addDays(parts: ZonedDateParts, days: number): ZonedDateParts {
  return fromUtcDate(new Date(toUtcDate({ ...parts, hour: 0 }).getTime() + days * 24 * 60 * 60 * 1000))
}

function addMonths(parts: ZonedDateParts, months: number): ZonedDateParts {
  return fromUtcDate(new Date(Date.UTC(parts.year, parts.month - 1 + months, 1, 0, 0, 0, 0)))
}

function getIsoWeekday(parts: ZonedDateParts): number {
  const weekday = toUtcDate({ ...parts, hour: 0 }).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

function startOfHour(parts: ZonedDateParts): ZonedDateParts {
  return parts
}

function startOfDay(parts: ZonedDateParts): ZonedDateParts {
  return { ...parts, hour: 0 }
}

function startOfWeek(parts: ZonedDateParts): ZonedDateParts {
  return addDays(startOfDay(parts), 1 - getIsoWeekday(parts))
}

function startOfMonth(parts: ZonedDateParts): ZonedDateParts {
  return { year: parts.year, month: parts.month, day: 1, hour: 0 }
}

function floorToGranularity(parts: ZonedDateParts, granularity: ModelUsageGranularity): ZonedDateParts {
  if (granularity === 'hour') {
    return startOfHour(parts)
  }
  if (granularity === 'day') {
    return startOfDay(parts)
  }
  if (granularity === 'week') {
    return startOfWeek(parts)
  }
  return startOfMonth(parts)
}

function nextBucketStart(parts: ZonedDateParts, granularity: ModelUsageGranularity): ZonedDateParts {
  if (granularity === 'hour') {
    return addHours(parts, 1)
  }
  if (granularity === 'day') {
    return addDays(parts, 1)
  }
  if (granularity === 'week') {
    return addDays(parts, 7)
  }
  return addMonths(parts, 1)
}

function formatIsoLike(parts: ZonedDateParts): string {
  const year = String(parts.year)
  const month = String(parts.month).padStart(2, '0')
  const day = String(parts.day).padStart(2, '0')
  const hour = String(parts.hour).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:00:00`
}

function formatAnchorDate(parts: ZonedDateParts): string {
  const year = String(parts.year)
  const month = String(parts.month).padStart(2, '0')
  const day = String(parts.day).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatAnchorDateLabel(parts: ZonedDateParts): string {
  return `${parts.year}年${String(parts.month).padStart(2, '0')}月${String(parts.day).padStart(2, '0')}日`
}

function formatBucketKey(parts: ZonedDateParts, granularity: ModelUsageGranularity): string {
  if (granularity === 'hour') {
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')} ${String(parts.hour).padStart(2, '0')}:00`
  }
  if (granularity === 'day') {
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
  }
  if (granularity === 'week') {
    return `${parts.year}-W${String(getIsoWeekNumber(parts)).padStart(2, '0')}`
  }
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`
}

function formatBucketLabel(parts: ZonedDateParts, granularity: ModelUsageGranularity): string {
  if (granularity === 'hour') {
    return `${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')} ${String(parts.hour).padStart(2, '0')}:00`
  }
  if (granularity === 'day') {
    return `${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}`
  }
  if (granularity === 'week') {
    const isoWeek = getIsoWeekNumber(parts)
    return `${parts.year} W${String(isoWeek).padStart(2, '0')}`
  }
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`
}

function getIsoWeekNumber(parts: ZonedDateParts): number {
  const current = toUtcDate(startOfDay(parts))
  const dayNumber = getIsoWeekday(parts)
  current.setUTCDate(current.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1))
  return Math.ceil((((current.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function resolveRangeStart(nowParts: ZonedDateParts, range: ModelUsagePresetRange): ZonedDateParts {
  if (range === 'day') {
    return startOfDay(nowParts)
  }
  if (range === 'week') {
    return startOfWeek(nowParts)
  }
  return startOfMonth(nowParts)
}

function resolveRangeEndExclusive(nowParts: ZonedDateParts, range: ModelUsagePresetRange): ZonedDateParts {
  if (range === 'day') {
    return addDays(startOfDay(nowParts), 1)
  }
  return addDays(startOfDay(nowParts), 1)
}

function parseAnchorDate(value: string): ZonedDateParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }

  const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day, hour: 0 }
}

function resolveRunStatus(status: RunTaskStatus | undefined): ModelUsageRunStatus {
  if (status === 'completed') {
    return 'completed'
  }
  if (status === 'failed' || status === 'timeout') {
    return 'failed'
  }
  if (status === 'cancelled') {
    return 'cancelled'
  }
  return 'inProgress'
}

function resolveAttemptStatus(status: RunAttempt['status']): ModelUsageRunStatus {
  return resolveRunStatus(status)
}

function stripModelSourceSuffix(value: string): string {
  const normalized = value.trim()
  const match = normalized.match(/^(.*?)[（(]([^()（）]+)[)）]\s*$/)
  const primary = match?.[1]?.trim() ?? normalized
  return primary || normalized
}

function extractTrailingSource(value: string): string | null {
  const normalized = value.trim()
  const match = normalized.match(/[（(]([^()（）]+)[)）]\s*$/)
  const source = match?.[1]?.trim() ?? ''
  return source || null
}

function extractHostnameCandidate(value: string): string | null {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const directCandidate = normalized.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(directCandidate)) {
    return directCandidate.toLowerCase()
  }

  try {
    const parsed = new URL(normalized)
    return parsed.hostname || null
  } catch {
    return null
  }
}

function normalizeSourceLabel(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  if (!normalized) {
    return null
  }

  return extractHostnameCandidate(normalized) ?? normalized
}

function resolveAttemptModelName(attempt: RunAttempt, modelCatalog: ModelCatalog): string {
  const currentModel = modelCatalog.models.find((item) => item.id === attempt.modelId)
  if (currentModel?.rawId?.trim()) {
    return currentModel.rawId.trim()
  }
  if (currentModel?.name?.trim()) {
    return stripModelSourceSuffix(currentModel.name)
  }
  if (attempt.modelName?.trim()) {
    return stripModelSourceSuffix(attempt.modelName)
  }
  return parseScopedModelId(attempt.modelId)?.modelId ?? attempt.modelId
}

function resolveAttemptSourceLabel(attempt: RunAttempt, modelCatalog: ModelCatalog): { channelLabel: string | null; detailSourceLabel: string | null } {
  const currentModel = modelCatalog.models.find((item) => item.id === attempt.modelId)
  const detailedSource = normalizeSourceLabel(
    attempt.channelName
    ?? currentModel?.sourceName
    ?? extractTrailingSource(currentModel?.name ?? '')
    ?? extractTrailingSource(attempt.modelName ?? ''),
  )

  return {
    channelLabel: detailedSource,
    detailSourceLabel: detailedSource,
  }
}

function isImageRun(run: Run): boolean {
  return run.imageCount > 0 || run.images.length > 0
}

function getTrackedAttempts(run: Run): RunAttempt[] {
  return normalizeRunAttempts(run)
}

export function aggregateModelUsageStats(input: AggregateModelUsageStatsInput): ModelUsageSnapshot {
  const now = input.now ?? new Date()
  const nowParts = input.anchorDate ? parseAnchorDate(input.anchorDate) ?? getZonedParts(now, input.timeZone) : getZonedParts(now, input.timeZone)
  const rangeStart = resolveRangeStart(nowParts, input.range)
  const rangeEndExclusive = resolveRangeEndExclusive(nowParts, input.range)

  const bucketEntries: Array<ModelUsageBucket & { modelCounts: Map<string, number>; modelNames: Map<string, string> }> = []
  for (let cursor = floorToGranularity(rangeStart, input.granularity); compareZonedParts(cursor, rangeEndExclusive) < 0;) {
    const bucketStart = floorToGranularity(cursor, input.granularity)
    const bucketEnd = nextBucketStart(bucketStart, input.granularity)
    bucketEntries.push({
      key: formatBucketKey(bucketStart, input.granularity),
      label: formatBucketLabel(bucketStart, input.granularity),
      bucketStart: formatIsoLike(bucketStart),
      bucketEnd: formatIsoLike(bucketEnd),
      totalCount: 0,
      totalElapsedMs: 0,
      averageElapsedMs: null,
      statusCounts: createEmptyStatusCounts(),
      topModels: [],
      modelCounts: new Map<string, number>(),
      modelNames: new Map<string, string>(),
    })
    cursor = bucketEnd
  }

  const bucketIndexByKey = new Map(bucketEntries.map((bucket, index) => [bucket.key, index]))
  const modelTotals = new Map<string, ModelUsageModelEntry>()
  const statusCounts = createEmptyStatusCounts()
  const sourceLabels = new Set<string>()
  let totalElapsedMs = 0
  const normalizedSourceFilter = normalizeSourceLabel(input.sourceFilter)

  for (const run of input.runs) {
    if (!isImageRun(run)) {
      continue
    }
    const attempts = getTrackedAttempts(run)

    for (const attempt of attempts) {
      const attemptCreatedAt = new Date(attempt.createdAt)
      if (Number.isNaN(attemptCreatedAt.getTime())) {
        continue
      }

      const createdAtParts = getZonedParts(attemptCreatedAt, input.timeZone)
      if (compareZonedParts(createdAtParts, rangeStart) < 0 || compareZonedParts(createdAtParts, rangeEndExclusive) >= 0) {
        continue
      }

      const status = resolveAttemptStatus(attempt.status)
      const modelName = resolveAttemptModelName(attempt, input.modelCatalog)
      const sourceLabel = resolveAttemptSourceLabel(attempt, input.modelCatalog)
      const elapsedMs = getRunAttemptElapsedMs(attempt) ?? (attempts.length === 1 ? getRunElapsedMs(run) : null)
      if (sourceLabel.channelLabel) {
        sourceLabels.add(sourceLabel.channelLabel)
      }
      if (normalizedSourceFilter && sourceLabel.channelLabel !== normalizedSourceFilter) {
        continue
      }
      const bucketStart = floorToGranularity(createdAtParts, input.granularity)
      const bucketKey = formatBucketKey(bucketStart, input.granularity)
      const bucketIndex = bucketIndexByKey.get(bucketKey)
      if (bucketIndex === undefined) {
        continue
      }

      statusCounts[status] += 1
      const bucket = bucketEntries[bucketIndex]
      bucket.totalCount += 1
      bucket.totalElapsedMs += elapsedMs ?? 0
      bucket.statusCounts[status] += 1
      bucket.modelCounts.set(attempt.modelId, (bucket.modelCounts.get(attempt.modelId) ?? 0) + 1)
      bucket.modelNames.set(attempt.modelId, modelName)
      totalElapsedMs += elapsedMs ?? 0

      const currentModel = modelTotals.get(attempt.modelId)
      if (currentModel) {
        currentModel.count += 1
        currentModel.totalElapsedMs += elapsedMs ?? 0
        currentModel.statusCounts[status] += 1
        if (!currentModel.modelName && modelName) {
          currentModel.modelName = modelName
        }
        if (!currentModel.channelLabel && sourceLabel.channelLabel) {
          currentModel.channelLabel = sourceLabel.channelLabel
        }
        if (!currentModel.detailSourceLabel && sourceLabel.detailSourceLabel) {
          currentModel.detailSourceLabel = sourceLabel.detailSourceLabel
        }
        continue
      }

      modelTotals.set(attempt.modelId, {
        modelId: attempt.modelId,
        modelName,
        count: 1,
        share: 0,
        totalElapsedMs: elapsedMs ?? 0,
        averageElapsedMs: null,
        channelLabel: sourceLabel.channelLabel,
        detailSourceLabel: sourceLabel.detailSourceLabel,
        statusCounts: {
          completed: status === 'completed' ? 1 : 0,
          failed: status === 'failed' ? 1 : 0,
          cancelled: status === 'cancelled' ? 1 : 0,
          inProgress: status === 'inProgress' ? 1 : 0,
        },
      })
    }
  }

  const totalCount = MODEL_USAGE_STATUS_KEYS.reduce((sum, key) => sum + statusCounts[key], 0)
  const models = Array.from(modelTotals.values())
    .filter((entry) => entry.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }
      return left.modelName.localeCompare(right.modelName, 'zh-CN')
    })
    .map((entry) => ({
      ...entry,
      share: totalCount > 0 ? entry.count / totalCount : 0,
      averageElapsedMs: entry.count > 0 ? entry.totalElapsedMs / entry.count : null,
    }))

  const buckets = bucketEntries.map((bucket) => {
    const topModels = Array.from(bucket.modelCounts.entries())
      .map(([modelId, count]) => ({
        modelId,
        modelName: bucket.modelNames.get(modelId) ?? modelId,
        count,
        totalElapsedMs: models.find((entry) => entry.modelId === modelId)?.totalElapsedMs ?? 0,
        averageElapsedMs: count > 0
          ? (models.find((entry) => entry.modelId === modelId)?.totalElapsedMs ?? 0) / count
          : null,
      }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count
        }
        return left.modelName.localeCompare(right.modelName, 'zh-CN')
      })
      .slice(0, 3)

    return {
      key: bucket.key,
      label: bucket.label,
      bucketStart: bucket.bucketStart,
      bucketEnd: bucket.bucketEnd,
      totalCount: bucket.totalCount,
      totalElapsedMs: bucket.totalElapsedMs,
      averageElapsedMs: bucket.totalCount > 0 ? bucket.totalElapsedMs / bucket.totalCount : null,
      statusCounts: bucket.statusCounts,
      topModels,
    }
  })

  return {
    range: {
      preset: input.range,
      label: MODEL_USAGE_PRESET_LABELS[input.range],
      start: formatIsoLike(rangeStart),
      end: formatIsoLike(rangeEndExclusive),
      anchorDate: formatAnchorDate(nowParts),
      anchorDateLabel: formatAnchorDateLabel(nowParts),
    },
    granularity: input.granularity,
    timeZone: input.timeZone,
    totalCount,
    totalElapsedMs,
    averageElapsedMs: totalCount > 0 ? totalElapsedMs / totalCount : null,
    activeModelCount: models.length,
    statusCounts,
    sources: Array.from(sourceLabels).sort((left, right) => left.localeCompare(right, 'zh-CN')),
    buckets,
    models,
  }
}
