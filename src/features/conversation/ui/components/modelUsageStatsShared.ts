import dayjs from 'dayjs'
import type { LoadedModelUsageSnapshot } from '../../application/modelUsageStatsService'
import {
  type ModelUsagePresetRange,
  type ModelUsageRunStatus,
} from '../../domain/modelUsageStats'
import { formatElapsedDuration } from '../../domain/requestDuration'

export const STATUS_META: Record<ModelUsageRunStatus, { label: string; color: string }> = {
  completed: { label: '成功', color: 'success' },
  failed: { label: '失败', color: 'error' },
  cancelled: { label: '取消', color: 'default' },
  inProgress: { label: '进行中', color: 'processing' },
}

export const VISIBLE_RANGE_OPTIONS: Array<{ value: ModelUsagePresetRange; label: string }> = [
  { value: 'day', label: '天' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
]

export const ALL_SOURCES_VALUE = 'all'

export interface ModelUsageChartDatum {
  key: string
  label: string
  totalCount: number
  isLabelVisible: boolean
}

export function getTodayDateValue(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toPickerValue(dateValue: string) {
  return dayjs(dateValue, 'YYYY-MM-DD', true)
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

export function formatShare(value: number): string {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`
}

export function formatRatioText(count: number, total: number): string {
  if (total <= 0) {
    return '0%'
  }

  return formatShare(count / total)
}

export function formatCountText(value: number): string {
  return `${formatCount(value)} 次`
}

export function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '--'
  }

  return formatElapsedDuration(Math.round(value))
}

export function renderStatusSummary(statusCounts: Record<ModelUsageRunStatus, number>): string {
  return (Object.keys(STATUS_META) as ModelUsageRunStatus[])
    .filter((key) => statusCounts[key] > 0)
    .map((key) => `${STATUS_META[key].label} ${formatCount(statusCounts[key])}`)
    .join(' / ')
}

export function formatTimeZoneLabel(timeZone: string): string {
  return timeZone.replace(/_/g, ' ')
}

export function formatRangeSummary(range: { preset: ModelUsagePresetRange; label: string; anchorDateLabel: string }, timeZone: string): string {
  const timeZoneLabel = formatTimeZoneLabel(timeZone)
  if (range.preset === 'day') {
    return `所选自然日 · 按 ${range.anchorDateLabel} 0 点起统计 · ${timeZoneLabel}`
  }
  if (range.preset === 'week') {
    return `所选日期所在自然周 · 从本周起点累计至 ${range.anchorDateLabel} · ${timeZoneLabel}`
  }
  return `所选日期所在自然月 · 从本月起点累计至 ${range.anchorDateLabel} · ${timeZoneLabel}`
}

export function getRangeHint(range: { preset: ModelUsagePresetRange; anchorDateLabel: string }, granularity: string): string {
  if (range.preset === 'day') {
    return `按${granularity}聚合所选自然日数据，统计窗口为 ${range.anchorDateLabel} 0 点到次日 0 点。`
  }
  if (range.preset === 'week') {
    return `按${granularity}聚合所选日期所在自然周数据，统计窗口为本周起点到 ${range.anchorDateLabel} 次日 0 点。`
  }
  return `按${granularity}聚合所选日期所在自然月数据，统计窗口为本月起点到 ${range.anchorDateLabel} 次日 0 点。`
}

export function shouldRenderAxisLabel(index: number, total: number): boolean {
  if (total <= 8) {
    return true
  }

  const step = total <= 12 ? 2 : total <= 24 ? 3 : 4
  return index === 0 || index === total - 1 || index % step === 0
}

export function getVisibleRankingStatuses(statusCounts: Record<ModelUsageRunStatus, number>) {
  return (['completed', 'failed'] as const)
    .filter((status) => statusCounts[status] > 0)
    .map((status) => ({
      status,
      label: STATUS_META[status].label,
      count: statusCounts[status],
    }))
}

export function buildDetailSourceText(channelLabel: string | null, detailSourceLabel: string | null): string {
  return detailSourceLabel ?? channelLabel ?? '暂无来源信息'
}

export function getTopModelSummary(snapshot: LoadedModelUsageSnapshot | null) {
  const topModel = snapshot?.models[0] ?? null
  if (!topModel) {
    return null
  }

  return {
    name: topModel.modelName,
    count: formatCount(topModel.count),
    share: formatShare(topModel.share),
    statusSummary: renderStatusSummary(topModel.statusCounts) || '暂无状态数据',
  }
}
