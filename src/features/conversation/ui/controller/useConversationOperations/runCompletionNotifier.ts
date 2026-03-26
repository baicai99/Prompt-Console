import { getRunCompletionStats } from '../../../application/queries/conversationView'
import { ensureRunTaskState } from '../../../domain/runTaskState'
import type {
  RunCompletionNotificationInput,
  RunCompletionNotifier,
} from './types'

export function createRunCompletionNotifier(input: RunCompletionNotificationInput): RunCompletionNotifier {
  return (conversationId, run) => {
    const stats = getRunCompletionStats(run)
    const signature = stats.pendingCount > 0
      ? `pending:${stats.pendingCount}`
      : `settled:${stats.successCount}:${stats.failedCount}`
    const runKey = `${conversationId}:${run.id}`
    const previousSignature = input.runCompletionSignatureRef.current.get(runKey)

    if (previousSignature === signature) {
      return
    }

    input.runCompletionSignatureRef.current.set(runKey, signature)
    if (stats.pendingCount > 0) {
      return
    }

    const snapshot = input.stateRef.current
    const taskState = ensureRunTaskState(run)
    const conversationTitle =
      snapshot.contents[conversationId]?.title ??
      snapshot.summaries.find((item) => item.id === conversationId)?.title ??
      '未命名对话'
    const isCurrentConversation = snapshot.activeId === conversationId
    const resultLabel =
      taskState.status === 'timeout'
        ? '任务已超时'
        : stats.failedCount === 0 ? '任务已完成' : stats.successCount === 0 ? '任务执行失败' : '任务已结束'
    const summaryParts = [
      stats.successCount > 0 ? `成功 ${stats.successCount} 张` : '',
      stats.failedCount > 0 ? `失败 ${stats.failedCount} 张` : '',
    ].filter((item) => item.length > 0)
    const description = isCurrentConversation
      ? `${conversationTitle}：${summaryParts.join('，') || '结果已更新'}。`
      : `${conversationTitle}：${summaryParts.join('，') || '结果已更新'}。点击跳转查看。`

    const notificationConfig = {
      title: resultLabel,
      description,
      duration: isCurrentConversation ? 3 : 5,
      onClick: isCurrentConversation ? undefined : () => { input.setActiveConversation(conversationId) },
    }

    if (stats.failedCount === 0) {
      input.notifier.notify({ ...notificationConfig, level: 'success' })
    } else if (stats.successCount === 0) {
      input.notifier.notify({ ...notificationConfig, level: 'error' })
    } else {
      input.notifier.notify({ ...notificationConfig, level: 'warning' })
    }
  }
}
