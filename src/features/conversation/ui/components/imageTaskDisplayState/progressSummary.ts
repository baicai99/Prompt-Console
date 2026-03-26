import type { ImageTask, Run } from '../../../../../types/conversation'
import type { ImageItem } from '../../../../../types/image'
import { ensureRunTaskState } from '../../../domain/runTaskState'
import { resolveImageLifecycleStatus } from './lifecycleStatusResolution'
import type { ImageLifecycleStatus } from './types'

function hasRenderableResult(image?: ImageItem | null, task?: ImageTask): boolean {
  const refs = [
    image?.thumbRef,
    image?.fileRef,
    image?.fullRef,
    image?.refKey,
    task?.thumbRef,
    task?.fileRef,
    task?.fullRef,
    task?.refKey,
  ]
  return refs.some((value) => typeof value === 'string' && value.trim().length > 0)
}

function summarizeLifecycleCounts(entries: Array<{ image: ImageItem; task?: ImageTask }>, run: Run): Record<ImageLifecycleStatus, number> {
  return entries.reduce<Record<ImageLifecycleStatus, number>>((acc, entry) => {
    const status = resolveImageLifecycleStatus({
      run,
      image: entry.image,
      task: entry.task,
    })
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {} as Record<ImageLifecycleStatus, number>)
}

function formatSummaryPart(count: number, label: string): string {
  return count > 0 ? `${count} 张${label}` : ''
}

export function getRunProgressSummary(run: Run, tasksById?: Record<string, ImageTask>): string | null {
  const taskState = ensureRunTaskState(run)
  const taskBySeq = new Map(
    Object.values(tasksById ?? {}).map((task) => [task.seq, task] as const),
  )
  const imageEntries = run.images.map((image) => ({ image, task: taskBySeq.get(image.seq) }))
  const counts = summarizeLifecycleCounts(imageEntries, run)
  const successCount = imageEntries.filter((entry) => entry.image.status === 'success' && hasRenderableResult(entry.image, entry.task)).length
  const pendingCount = imageEntries.filter((entry) => entry.image.status === 'pending').length
  const failedCount = imageEntries.filter((entry) => entry.image.status === 'failed').length

  if (pendingCount > 0 && successCount > 0) {
    const parts = [
      `已完成 ${successCount} 张`,
      formatSummaryPart(counts.waiting ?? 0, '等待中'),
      formatSummaryPart(counts.request_sending ?? 0, '处理中'),
      formatSummaryPart(counts.queued ?? 0, '排队中'),
      formatSummaryPart(counts.generating ?? 0, '生成中'),
      formatSummaryPart(counts.retry_waiting ?? 0, '等待重试'),
    ].filter(Boolean)
    return parts.join('，')
  }

  if (pendingCount > 0) {
    const parts = [
      formatSummaryPart(counts.waiting ?? 0, '等待中'),
      formatSummaryPart(counts.request_sending ?? 0, '处理中'),
      formatSummaryPart(counts.queued ?? 0, '排队中'),
      formatSummaryPart(counts.generating ?? 0, '生成中'),
      formatSummaryPart(counts.retry_waiting ?? 0, '等待重试'),
    ].filter(Boolean)
    if (parts.length > 0) {
      return parts.join('，')
    }
    if (taskState.status === 'waiting') {
      return `${pendingCount} 张图片等待中`
    }
    return `${pendingCount} 张图片处理中`
  }

  if (successCount === run.images.length && run.images.length > 0) {
    return '已完成'
  }
  if (taskState.status === 'timeout' || (counts.timeout ?? 0) > 0) {
    return '已超时'
  }
  if ((counts.cancelled ?? 0) > 0 && failedCount === run.images.length) {
    return '已取消'
  }
  if ((counts.insufficient_balance ?? 0) > 0) {
    return '余额不足'
  }
  if ((counts.auth_failed ?? 0) > 0) {
    return '认证失败'
  }
  if ((counts.invalid_params ?? 0) > 0) {
    return '参数错误'
  }
  if ((counts.sensitive_blocked ?? 0) > 0) {
    return '敏感词已拦截'
  }
  if ((counts.service_busy ?? 0) > 0) {
    return '服务繁忙'
  }
  if ((counts.result_invalid ?? 0) > 0) {
    return '结果异常'
  }
  if ((counts.queue_failed ?? 0) > 0) {
    return '排队失败'
  }
  if ((counts.request_failed ?? 0) > 0) {
    return '请求失败'
  }
  if (failedCount > 0) {
    return '生成失败'
  }
  return null
}
