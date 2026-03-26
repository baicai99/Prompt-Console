import type { Message, Run, Side } from '../../../../types/conversation'
import type { FailureCode } from '../../../../types/image'
import { isBatchDownloadBlockedForRuns } from '../../domain/batchDownload'
import { getRunsForSide } from '../../application/queries/conversationQueries'
import { classifyFailure } from '../../domain/failureClassifier'
import { globalAntdFeedback } from '../antdFeedback'
import { isInsufficientBalanceMessage } from '../../../../utils/insufficientBalance'

const FAILURE_LABEL: Record<FailureCode, string> = {
  timeout: '超时',
  auth: '认证失败',
  insufficient_balance: '余额不足',
  rate_limit: '服务繁忙',
  unsupported_param: '参数错误',
  rejected: '敏感词拦截',
  request_failed: '请求失败',
  queue_failed: '排队失败',
  result_invalid: '结果异常',
  cancelled: '已取消',
  generation_failed: '生成失败',
  unknown: '未知',
}
const SERVICE_BUSY_DETAIL = '当前生成请求较多，服务暂时繁忙。请稍后再试。'
const SERVICE_BUSY_PATTERNS = [
  /当前分组上游负载已饱和/i,
  /上游负载已饱和/i,
  /服务暂时繁忙/i,
  /server\s*busy/i,
  /temporar(?:y|ily)\s+unavailable/i,
  /overloaded/i,
]

function normalizePromptForReuse(prompt: string): string {
  return prompt.replace(/\s*\(\d+\s+runs\)\s*$/i, '').trim()
}

function formatParamSnapshot(params: Run['paramsSnapshot'] | undefined): string {
  const entries = Object.entries(params ?? {})
  if (entries.length === 0) {
    return '无'
  }

  return entries.map(([key, value]) => `${key}=${String(value)}`).join(', ')
}

function getRunRequestAddress(run: Run): string {
  const values = new Set<string>()
  for (const image of run.images) {
    const direct = typeof image.requestUrl === 'string' ? image.requestUrl.trim() : ''
    if (direct) {
      values.add(direct)
    }
    const metaValue = typeof image.serverTaskMeta?.requestUrl === 'string' ? image.serverTaskMeta.requestUrl.trim() : ''
    if (metaValue) {
      values.add(metaValue)
    }
  }

  const list = Array.from(values)
  if (list.length === 0) {
    return '未记录'
  }
  return list.join(' , ')
}

function getSingleRuns(message: Message): Run[] {
  return getRunsForSide(message, 'single')
}

function getSideRuns(message: Message, sideView: Side): Run[] {
  return getRunsForSide(message, sideView)
}

function isMessageBatchDownloadBlocked(runs: Run[]): boolean {
  return isBatchDownloadBlockedForRuns(runs)
}

function shouldRenderAssistantMessage(message: Message, sideView: Side): boolean {
  const runs = message.runs ?? []
  if (runs.length === 0) {
    return true
  }

  if (sideView === 'single') {
    return getSingleRuns(message).length > 0
  }

  return getSideRuns(message, sideView).length > 0
}

function getFailureSummary(run: Run): string | null {
  const failed = run.images.filter((item) => item.status === 'failed')
  if (failed.length === 0) {
    return null
  }

  const counts = new Map<FailureCode, number>()
  for (const item of failed) {
    const code = item.errorCode && item.errorCode !== 'unknown'
      ? item.errorCode
      : classifyFailure(item.error ?? '')
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([code, count]) => `${FAILURE_LABEL[code]} ${count}`)
    .join(' | ')
}


function humanizeFailureDetail(detail: string): string {
  const normalized = detail.trim()
  if (!normalized) {
    return normalized
  }
  if (isInsufficientBalanceMessage(normalized)) {
    return '余额不足'
  }
  if (SERVICE_BUSY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return SERVICE_BUSY_DETAIL
  }
  return normalized
}

function getFailureDetails(run: Run): string[] {
  const details = run.images
    .filter((item) => item.status === 'failed')
    .map((item) => item.error?.trim())
    .map((detail) => (detail ? humanizeFailureDetail(detail) : detail))
    .filter((detail): detail is string => Boolean(detail))

  return Array.from(new Set(details))
}

function formatJsonSnapshot(snapshot: Record<string, unknown> | undefined): string {
  if (!snapshot || Object.keys(snapshot).length === 0) {
    return '{}'
  }
  return JSON.stringify(snapshot, null, 2)
}

function buildRunFailureCopyText(run: Run, runNumber: number): string {
  const failedLines = run.images
    .filter((item) => item.status === 'failed')
    .sort((left, right) => left.seq - right.seq)
    .map((item) => {
      const code = item.errorCode && item.errorCode !== 'unknown'
        ? item.errorCode
        : classifyFailure(item.error ?? '')
      const reason = item.error?.trim() ? humanizeFailureDetail(item.error) : '未记录'
      return `#${item.seq} | ${code} | ${reason}`
    })

  const sections = [
    '失败 Run 复现信息',
    `Run #: ${runNumber}`,
    `Run ID: ${run.id || '未记录'}`,
    `Batch ID: ${run.batchId || '未记录'}`,
    `创建时间: ${run.createdAt || '未记录'}`,
    `模型: ${run.modelName || '未记录'}`,
    `模型 ID: ${run.modelId || '未记录'}`,
    `渠道: ${run.channelName ?? run.channelId ?? '未记录'}`,
    `模板 prompt: ${run.templatePrompt || '未记录'}`,
    `最终 prompt: ${run.finalPrompt || '未记录'}`,
    '失败信息:',
    failedLines.length > 0 ? failedLines.join('\n') : '无失败信息',
    '生成参数(JSON):',
    formatJsonSnapshot(run.paramsSnapshot as unknown as Record<string, unknown>),
    '生成设置(JSON):',
    formatJsonSnapshot(run.settingsSnapshot as unknown as Record<string, unknown>),
  ]

  return sections.join('\n')
}

async function copyRunFailureReport(run: Run, runNumber: number): Promise<void> {
  const text = buildRunFailureCopyText(run, runNumber)
  await globalAntdFeedback.copyText({
    text,
    successMessage: '已复制报错与生成参数',
    failureMessage: '复制失败，请手动复制',
  })
}

async function copyUserMessageContent(content: string): Promise<void> {
  await globalAntdFeedback.copyText({
    text: content,
    successMessage: '已复制内容',
    failureMessage: '复制失败，请手动复制',
  })
}

async function copyRunPromptContent(prompt: string): Promise<void> {
  await globalAntdFeedback.copyText({
    text: prompt,
    successMessage: '已复制 Prompt',
    failureMessage: '复制失败，请手动复制',
  })
}

export {
  normalizePromptForReuse,
  formatParamSnapshot,
  getRunRequestAddress,
  getSingleRuns,
  getSideRuns,
  isMessageBatchDownloadBlocked,
  shouldRenderAssistantMessage,
  getFailureSummary,
  getFailureDetails,
  copyRunFailureReport,
  copyRunPromptContent,
  copyUserMessageContent,
}
