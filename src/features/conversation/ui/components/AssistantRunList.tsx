import { memo } from 'react'
import type { ImageRuntimeSettings, ImageTask, Run } from '../../../../types/conversation'
import { sortImagesBySeq } from '../../../../utils/chat'
import { renderRunCard } from './messageListRenderers'
import type { AssistantActionTrigger } from './messageListShared'
import type { ResolveImagePreviewSource } from './useResolvedImagePreview'

interface AssistantRunListProps {
  runs: Run[]
  tasksByRunId?: Record<string, Record<number, ImageTask>>
  isCompact?: boolean
  visibleImageLimitByRunId: Record<string, number>
  expandedPromptRunIds: Record<string, boolean>
  normalizedMultiImageInitialLimit: number
  onOpenPreview: (run: Run, imageId: string, linkedRun?: Run) => void
  onRetryRun: (runId: string) => void | Promise<void>
  onDownloadSingleImage?: (runId: string, imageId: string) => void
  onDownloadBatchRun?: (runId: string) => void
  onLoadMoreImages: (runId: string) => void
  onToggleRunPrompt: (runId: string) => void
  triggerAssistantAction: AssistantActionTrigger
  resolveImagePreviewSource?: ResolveImagePreviewSource
  imageRuntimeSettings?: ImageRuntimeSettings
  elapsedNow?: number
}

function AssistantRunListComponent({
  runs,
  tasksByRunId,
  isCompact = false,
  visibleImageLimitByRunId,
  expandedPromptRunIds,
  normalizedMultiImageInitialLimit,
  onOpenPreview,
  onRetryRun,
  onDownloadSingleImage,
  onDownloadBatchRun,
  onLoadMoreImages,
  onToggleRunPrompt,
  triggerAssistantAction,
  resolveImagePreviewSource,
  imageRuntimeSettings,
  elapsedNow,
}: AssistantRunListProps) {
  const showRunNumber = runs.length > 1
  const batchLoopCountByKey = new Map<string, number>()

  for (const run of runs) {
    const key = `${run.batchId}::${run.side}`
    batchLoopCountByKey.set(key, (batchLoopCountByKey.get(key) ?? 0) + 1)
  }

  return (
    <div className="assistant-run-list flex w-full min-w-0 flex-col gap-[18px]">
      {runs.map((run, index) => {
        const batchKey = `${run.batchId}::${run.side}`
        const batchLoopCount = batchLoopCountByKey.get(batchKey) ?? 0
        const isDynamicBatch = Object.keys(run.variablesSnapshot ?? {}).length > 0 && batchLoopCount > 1
        const orderedImages = run.images.length > 1 ? sortImagesBySeq(run.images) : run.images
        const allRows = orderedImages.map((item) => ({ seq: item.seq, item }))
        const visibleImageLimit = isCompact
          ? (visibleImageLimitByRunId[run.id] ?? normalizedMultiImageInitialLimit)
          : allRows.length
        const visibleRows = isCompact ? allRows.slice(0, visibleImageLimit) : allRows
        const hasMoreImages = isCompact && allRows.length > visibleRows.length
        const imagePagination = hasMoreImages
          ? {
              label: '加载更多图片',
              current: visibleRows.length,
              total: allRows.length,
              onLoadMore: () => onLoadMoreImages(run.id),
            }
          : undefined

        return renderRunCard(
          run,
          index + 1,
          showRunNumber,
          visibleRows,
          tasksByRunId?.[run.id],
          undefined,
          onOpenPreview,
          onRetryRun,
          onDownloadSingleImage,
          isDynamicBatch,
          onDownloadBatchRun,
          expandedPromptRunIds[run.id] ?? false,
          () => onToggleRunPrompt(run.id),
          imagePagination,
          triggerAssistantAction,
          isCompact,
          resolveImagePreviewSource,
          imageRuntimeSettings?.showRequestMethodBadge ?? false,
          imageRuntimeSettings?.offscreenPreviewReleaseDelayMs,
          elapsedNow,
        )
      })}
    </div>
  )
}

export const AssistantRunList = memo(AssistantRunListComponent)
