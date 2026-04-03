import { CopyOutlined, RetweetOutlined } from '@ant-design/icons'
import { Button, Collapse, Space, Typography } from 'antd'
import type { ImageTask, Run } from '../../../../types/conversation'
import { isRemovedProviderRun } from '../../../../utils/legacyRemovedProviderCompat'
import {
  copyRunFailureReport,
  copyRunPromptContent,
  formatParamSnapshot,
  getFailureDetails,
  getFailureSummary,
} from './messageListUtils'
import { getResumeTransportLabel, getRunProgressSummary } from './imageTaskDisplayState'
import { ensureRunTaskState } from '../../domain/runTaskState'
import { emitUiRenderDebug } from '../../../../services/imageTaskDebug'
import { RunImageGrid } from './RunImageGrid'
import { RunMetaTitle } from './RunMetaTitle'
import { summarizeRunPrompt } from './runPromptSummary'
import type { AssistantActionTrigger, DisplayImage, PaginationControl } from './messageListRendererTypes'
import type { ResolveImagePreviewSource } from './useResolvedImagePreview'
import { URL_RESPONSE_FORMAT_BATCH_DOWNLOAD_HINT, isBatchDownloadBlockedForRun } from '../../domain/batchDownload'

const { Text } = Typography

function getRunTransportSummary(run: Run, tasksById?: Record<string, ImageTask>): string | null {
  const transportBySeq = new Map<number, string>()
  for (const [seq, task] of Object.entries(tasksById ?? {})) {
    const label = getResumeTransportLabel(task)
    if (label) {
      transportBySeq.set(Number(seq), label)
    }
  }
  for (const image of run.images) {
    if (transportBySeq.has(image.seq)) {
      continue
    }
    const label = getResumeTransportLabel(undefined, image)
    if (label) {
      transportBySeq.set(image.seq, label)
    }
  }
  if (transportBySeq.size === 0) {
    return null
  }
  const counts = new Map<string, number>()
  for (const label of transportBySeq.values()) {
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  if (counts.size === 1) {
    return Array.from(counts.keys())[0] ?? null
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
    .map(([label, count]) => `${count} 张${label}`)
    .join(' / ')
}

export function renderRunCard(
  run: Run,
  runNumber: number,
  showRunNumber: boolean,
  rows: DisplayImage[],
  tasksById: Record<string, ImageTask> | undefined,
  linkedRun: Run | undefined,
  onOpenPreview: (run: Run, imageId: string, linkedRun?: Run) => void,
  onRetryRun: (runId: string) => void,
  onDownloadSingleImage: ((runId: string, imageId: string) => void) | undefined,
  showBatchDownload: boolean,
  onDownloadBatchRun?: (runId: string) => void,
  isPromptExpanded = false,
  onTogglePrompt?: () => void,
  imagePagination?: PaginationControl,
  onAssistantActionTrigger?: AssistantActionTrigger,
  compact = false,
  resolveImagePreviewSource?: ResolveImagePreviewSource,
  showRequestMethodBadge = false,
  offscreenPreviewReleaseDelayMs?: number,
  elapsedNow?: number,
) {
  const failureSummary = getFailureSummary(run)
  const progressSummary = getRunProgressSummary(run, tasksById)
  const failureDetails = getFailureDetails(run)
  const hasFailed = run.images.some((item) => item.status === 'failed')
  const canRetryRun = hasFailed && !isRemovedProviderRun(run)
  const promptText = run.finalPrompt.trim()
  const promptSummary = summarizeRunPrompt(promptText)
  const taskState = ensureRunTaskState(run)
  const transportSummary = getRunTransportSummary(run, tasksById)
  const shouldShowProgressSummary = Boolean(progressSummary) && (hasFailed || progressSummary !== '已完成')
  const isBatchDownloadDisabled = isBatchDownloadBlockedForRun(run)
  emitUiRenderDebug({
    cacheKey: `${run.id}:run-summary`,
    stage: 'ui_run_summary_rendered',
    label: progressSummary ?? failureSummary ?? taskState.status,
    runId: run.id,
    batchId: run.batchId,
    model: run.modelId,
    channelId: run.channelId,
    channelName: run.channelName,
    state: taskState.status,
    detail: {
      progressSummary,
      failureSummary,
      transportSummary,
      runNumber,
    },
  })

  return (
    <div key={run.id} className={`run-card-stack flex w-full min-w-0 flex-col ${compact ? 'run-card-stack-compact gap-2.5' : 'gap-3'}`}>
      <div className={`run-record min-w-0 rounded-[var(--message-bubble-inner-radius)] border-0 bg-transparent p-0 shadow-none ${compact ? 'run-record-compact' : ''}`}>
        <Space orientation="vertical" size={8} className="w-full">
          {compact ? (
            <div className="run-meta-compact flex min-w-0 flex-col gap-1.5 rounded-[var(--assistant-nested-surface-radius)] border border-[rgba(136,101,61,0.12)] bg-[rgba(255,251,246,0.9)] px-3 py-2.5 shadow-[0_10px_24px_rgba(102,74,40,0.06)]">
              <div className="run-meta-compact-main flex min-w-0 items-center gap-2.5">
                {showRunNumber ? <Text strong className="run-meta-title-fixed">{runNumber}</Text> : null}
                <Text className="run-meta-title-prompt">{promptSummary}</Text>
              </div>
              {showBatchDownload || promptText ? (
                <Space size={8} wrap className="run-meta-inline-actions flex flex-wrap items-center gap-1">
                  {showBatchDownload ? (
                    <Button
                      type="link"
                      size="small"
                      className="run-meta-title-toggle assistant-action-btn"
                      disabled={isBatchDownloadDisabled}
                      title={isBatchDownloadDisabled ? URL_RESPONSE_FORMAT_BATCH_DOWNLOAD_HINT : undefined}
                      onClick={(event) => {
                        onAssistantActionTrigger?.(
                          `run-${run.id}-download-batch-compact`,
                          event,
                          () => onDownloadBatchRun?.(run.id),
                        )
                      }}
                    >
                      下载这一批次
                    </Button>
                  ) : null}
                  {promptText ? (
                    <Button
                      type="link"
                      size="small"
                      className="run-meta-title-toggle assistant-action-btn"
                      onClick={(event) => {
                        onAssistantActionTrigger?.(
                          `run-${run.id}-${isPromptExpanded ? 'collapse' : 'expand'}-prompt`,
                          event,
                          () => onTogglePrompt?.(),
                        )
                      }}
                    >
                      {isPromptExpanded ? '收起提示词' : '查看完整提示词'}
                    </Button>
                  ) : null}
                  {promptText ? (
                    <Button
                      type="link"
                      size="small"
                      className="run-meta-title-toggle assistant-action-btn"
                      onClick={(event) => {
                        onAssistantActionTrigger?.(
                          `run-${run.id}-copy-prompt`,
                          event,
                          () => copyRunPromptContent(promptText),
                        )
                      }}
                    >
                      复制提示词
                    </Button>
                  ) : null}
                </Space>
              ) : null}
              {promptText && isPromptExpanded ? (
                <div className="run-prompt-expanded max-h-[220px] overflow-auto rounded-[var(--message-bubble-inner-radius)] border border-[rgba(136,101,61,0.14)] bg-[rgba(255,255,255,0.7)] px-3 py-2.5">
                  <Text className="run-prompt-expanded-text break-words whitespace-pre-wrap leading-[1.6] text-[#5e4630]">{promptText}</Text>
                </div>
              ) : null}
            </div>
          ) : (
            <Collapse
              className="run-meta-collapse"
              ghost
              items={[
                {
                  key: 'meta',
                  label: (
                    <RunMetaTitle
                      run={run}
                      runNumber={runNumber}
                      showRunNumber={showRunNumber}
                      showBatchDownload={showBatchDownload}
                      batchDownloadDisabled={isBatchDownloadDisabled}
                      onDownloadBatchRun={onDownloadBatchRun}
                      onAssistantActionTrigger={onAssistantActionTrigger}
                    />
                  ),
                  children: (
                    <Space orientation="vertical" size={8} className="w-full">
                      <Text type="secondary">side={run.side} | images={run.imageCount} | mode={run.sideMode} | batch={run.batchId}</Text>
                      <Text type="secondary">task={taskState.status}</Text>
                      <Text type="secondary">retry={run.retryAttempt ?? 0}{run.retryOfRunId ? ` | source=${run.retryOfRunId}` : ''}</Text>
                      <Text type="secondary">渠道: {run.channelName ?? '未选择'}</Text>
                      <Text type="secondary">模型: {run.modelName ?? run.modelId ?? '未记录'}</Text>
                      <Text type="secondary">参数: {formatParamSnapshot(run.paramsSnapshot)}</Text>
                      <Text type="secondary">模板: {run.templatePrompt}</Text>
                      <Text type="secondary">变量: {formatParamSnapshot(run.variablesSnapshot)}</Text>
                      <Text type="secondary">最终 prompt: {run.finalPrompt}</Text>
                    </Space>
                  ),
                },
              ]}
            />
          )}
          {shouldShowProgressSummary ? <Text type={hasFailed ? 'warning' : 'secondary'}>{progressSummary}</Text> : null}
          {failureSummary && !progressSummary ? <Text type="warning">失败摘要: {failureSummary}</Text> : null}
          {!compact && failureDetails.length > 0 ? (
            <Space orientation="vertical" size={2} className="w-full">
              {failureDetails.map((detail, index) => (
                <Text key={`${run.id}-failure-${index}`} type="secondary">
                  {detail}
                </Text>
              ))}
            </Space>
          ) : null}
          {hasFailed ? (
            <Space size={8} wrap>
              {canRetryRun ? (
                <Button
                  size="small"
                  type="dashed"
                  icon={<RetweetOutlined />}
                  className="assistant-action-btn"
                  onClick={(event) => {
                    onAssistantActionTrigger?.(`run-${run.id}-retry-failed`, event, () => onRetryRun(run.id))
                  }}
                >
                  重试失败项
                </Button>
              ) : null}
              <Button
                size="small"
                type="default"
                icon={<CopyOutlined />}
                className="assistant-action-btn"
                onClick={(event) => {
                  onAssistantActionTrigger?.(`run-${run.id}-copy-failure-report`, event, () => copyRunFailureReport(run, runNumber))
                }}
              >
                复制报错与参数
              </Button>
            </Space>
          ) : null}
        </Space>
      </div>
      <RunImageGrid
        rows={rows}
        run={run}
        tasksById={tasksById}
        linkedRun={linkedRun}
        onOpenPreview={onOpenPreview}
        onDownloadSingleImage={onDownloadSingleImage}
        pagination={imagePagination}
        onAssistantActionTrigger={onAssistantActionTrigger}
        compact={compact}
        resolveImagePreviewSource={resolveImagePreviewSource}
        showRequestMethodBadge={showRequestMethodBadge}
        offscreenPreviewReleaseDelayMs={offscreenPreviewReleaseDelayMs}
        elapsedNow={elapsedNow}
      />
    </div>
  )
}
