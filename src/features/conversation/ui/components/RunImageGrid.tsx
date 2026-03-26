import { Button } from 'antd'
import { memo, useState, type CSSProperties } from 'react'
import type { ImageTask, Run } from '../../../../types/conversation'
import type { ImageItem } from '../../../../types/image'
import { gridColumnCount } from '../../../../utils/chat'
import { getPendingImageElapsedLabel } from '../../domain/requestDuration'
import {
  getResumeTransportLabel,
  getPendingStatusLabel,
  resolveImageDisplayState,
} from './imageTaskDisplayState'
import { RunImageStatusPlaceholder } from './RunImageStatusPlaceholder'
import type { AssistantActionTrigger, DisplayImage, PaginationControl } from './messageListRendererTypes'
import { ResolvedSuccessRunImage } from './ResolvedSuccessRunImage'
import type { ResolveImagePreviewSource } from './useResolvedImagePreview'

function toAspectRatioValue(width: number, height: number): string | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined
  }

  return `${width} / ${height}`
}

function parseAspectRatioText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const matched = value.trim().match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/)
  if (!matched) {
    return undefined
  }

  return toAspectRatioValue(Number(matched[1]), Number(matched[2]))
}

function resolveSubmittedAspectRatioValue(run: Run | undefined, item: ImageItem | null | undefined): string | undefined {
  const actualAspectRatio = toAspectRatioValue(item?.width ?? Number.NaN, item?.height ?? Number.NaN)
  if (actualAspectRatio) {
    return actualAspectRatio
  }

  if (!run) {
    return undefined
  }

  if (run.settingsSnapshot.sizeMode === 'custom') {
    const customAspectRatio = toAspectRatioValue(run.settingsSnapshot.customWidth, run.settingsSnapshot.customHeight)
    if (customAspectRatio) {
      return customAspectRatio
    }
  }

  return parseAspectRatioText(run.settingsSnapshot.aspectRatio)
}

function toAspectRatioStyle(value: string | undefined): CSSProperties | undefined {
  return value ? { aspectRatio: value } : undefined
}

function getRunImageContextSignature(run: Run | undefined): string {
  if (!run) {
    return 'none'
  }

  return [
    run.id,
    run.batchId,
    run.modelId,
    run.channelId ?? '',
    run.channelName ?? '',
    run.settingsSnapshot.sizeMode,
    run.settingsSnapshot.aspectRatio,
    run.settingsSnapshot.customWidth,
    run.settingsSnapshot.customHeight,
  ].join('::')
}

interface RunImageGridItemProps {
  seq: number
  image: ImageItem | null
  missingReason?: string
  run: Run | undefined
  linkedRun: Run | undefined
  matchedTask: ImageTask | undefined
  onOpenPreview: (run: Run, imageId: string, linkedRun?: Run) => void
  onDownloadSingleImage?: (runId: string, imageId: string) => void
  compact: boolean
  resolveImagePreviewSource?: ResolveImagePreviewSource
  showRequestMethodBadge: boolean
  offscreenPreviewReleaseDelayMs?: number
  elapsedNow?: number
}

function RunImageGridItemComponent(props: RunImageGridItemProps) {
  const {
    seq,
    image,
    missingReason,
    run,
    linkedRun,
    matchedTask,
    onOpenPreview,
    onDownloadSingleImage,
    compact,
    resolveImagePreviewSource,
    showRequestMethodBadge,
    offscreenPreviewReleaseDelayMs,
    elapsedNow,
  } = props
  const [isHovering, setIsHovering] = useState(false)
  const pendingLabel = image && run ? getPendingStatusLabel(run, image, matchedTask) : '生成中'
  const pendingElapsedLabel = image?.status === 'pending'
    ? getPendingImageElapsedLabel(image, matchedTask, elapsedNow)
    : null
  const transportLabel = getResumeTransportLabel(matchedTask, image)
  const aspectRatioValue = resolveSubmittedAspectRatioValue(run, image)
  const aspectRatioStyle = toAspectRatioStyle(aspectRatioValue)
  const placeholder = resolveImageDisplayState({
    run,
    image,
    task: matchedTask,
    missingReason,
  })

  const formatPendingDisplayLabel = (statusLabel: string, elapsedLabel: string | null) => {
    if (!elapsedLabel) {
      return statusLabel
    }
    if (statusLabel === '请求发送中') {
      return `耗时 ${elapsedLabel}`
    }
    return `${statusLabel} · 耗时 ${elapsedLabel}`
  }

  return (
    <div className={`run-grid-item relative flex min-w-0 flex-col gap-2.5 ${compact ? 'run-grid-item-compact gap-0' : ''}`}>
      {!compact ? <div className="run-image-seq-overlay pointer-events-none absolute top-2 left-2 z-[2] inline-flex h-[22px] min-w-[30px] items-center justify-center rounded-full bg-[rgba(0,0,0,0.55)] px-2 text-xs leading-none text-white">#{seq}</div> : null}
      {showRequestMethodBadge && transportLabel ? <div className="run-image-transport-overlay pointer-events-none absolute top-2 right-2 z-[2] inline-flex h-[22px] min-w-11 items-center justify-center rounded-full border border-[rgba(0,0,0,0.08)] bg-[rgba(255,255,255,0.94)] px-2 text-xs leading-none font-semibold text-[#595959]">{transportLabel}</div> : null}
      <div
        className={`run-image-frame relative box-border w-full min-w-0 overflow-hidden rounded-[var(--assistant-image-frame-radius)] bg-[linear-gradient(180deg,#fbf1e5_0%,#fdf8f2_100%)] shadow-[inset_0_0_0_1px_rgba(136,101,61,0.08),0_14px_30px_rgba(102,74,40,0.12)] transition-[transform,box-shadow,filter] duration-200 ease-out hover:translate-y-[-3px] hover:scale-[1.01] hover:saturate-[1.02] hover:shadow-[inset_0_0_0_1px_rgba(154,90,31,0.14),0_20px_34px_rgba(102,74,40,0.16)] focus-within:translate-y-[-3px] focus-within:scale-[1.01] focus-within:saturate-[1.02] focus-within:shadow-[inset_0_0_0_1px_rgba(154,90,31,0.18),0_20px_34px_rgba(102,74,40,0.16),0_0_0_2px_rgba(154,90,31,0.12)] ${compact ? 'compact' : ''}`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onFocusCapture={() => setIsHovering(true)}
        onBlurCapture={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return
          }
          setIsHovering(false)
        }}
      >
        {image?.status === 'pending' ? (
          <RunImageStatusPlaceholder
            variant={placeholder.variant}
            label={formatPendingDisplayLabel(pendingLabel || placeholder.label, pendingElapsedLabel)}
            aspectRatioStyle={aspectRatioStyle}
            compact={compact}
            debugMeta={{
              runId: run?.id,
              batchId: run?.batchId,
              taskId: matchedTask?.taskId,
              imageId: image?.id,
              seq,
              provider: undefined,
              model: run?.modelId,
              channelId: run?.channelId,
              channelName: run?.channelName,
              state: image?.status,
              detail: {
                providerTaskStatus: matchedTask?.providerTaskStatus ?? image?.providerTaskStatus,
                lifecycleLabel: pendingLabel || placeholder.label,
                elapsedLabel: pendingElapsedLabel,
              },
            }}
          />
        ) : image?.status === 'failed' ? (
          <RunImageStatusPlaceholder
            variant={placeholder.variant}
            label={placeholder.label}
            aspectRatioStyle={aspectRatioStyle}
            compact={compact}
            debugMeta={{
              runId: run?.id,
              batchId: run?.batchId,
              taskId: matchedTask?.taskId,
              imageId: image?.id,
              seq,
              model: run?.modelId,
              channelId: run?.channelId,
              channelName: run?.channelName,
              state: image?.status,
              detail: {
                errorCode: image?.errorCode,
                error: image?.error,
              },
            }}
          />
        ) : image?.status === 'success' && run ? (
          <ResolvedSuccessRunImage
            run={run}
            image={image}
            seq={seq}
            linkedRun={linkedRun}
            matchedTask={matchedTask}
            aspectRatioValue={aspectRatioValue}
            placeholder={placeholder}
            compact={compact}
            isHovering={isHovering}
            onOpenPreview={onOpenPreview}
            onDownloadSingleImage={onDownloadSingleImage}
            resolveImagePreviewSource={resolveImagePreviewSource}
            offscreenPreviewReleaseDelayMs={offscreenPreviewReleaseDelayMs}
            elapsedNow={elapsedNow}
          />
        ) : (
          <RunImageStatusPlaceholder
            variant={placeholder.variant}
            label={placeholder.label}
            aspectRatioStyle={aspectRatioStyle}
            compact={compact}
            debugMeta={{
              runId: run?.id,
              batchId: run?.batchId,
              taskId: matchedTask?.taskId,
              imageId: image?.id,
              seq,
              model: run?.modelId,
              channelId: run?.channelId,
              channelName: run?.channelName,
              state: image?.status,
              detail: {
                missingReason,
              },
            }}
          />
        )}
      </div>
    </div>
  )
}

const RunImageGridItem = memo(RunImageGridItemComponent, (prev, next) => {
  return (
    prev.seq === next.seq
    && prev.image === next.image
    && prev.missingReason === next.missingReason
    && prev.matchedTask === next.matchedTask
    && getRunImageContextSignature(prev.run) === getRunImageContextSignature(next.run)
    && (prev.linkedRun?.id ?? null) === (next.linkedRun?.id ?? null)
    && prev.onOpenPreview === next.onOpenPreview
    && prev.onDownloadSingleImage === next.onDownloadSingleImage
    && prev.compact === next.compact
    && prev.resolveImagePreviewSource === next.resolveImagePreviewSource
    && prev.showRequestMethodBadge === next.showRequestMethodBadge
    && prev.offscreenPreviewReleaseDelayMs === next.offscreenPreviewReleaseDelayMs
    && prev.elapsedNow === next.elapsedNow
  )
})

interface RunImageGridProps {
  rows: DisplayImage[]
  run: Run | undefined
  tasksById: Record<string, ImageTask> | undefined
  linkedRun: Run | undefined
  onOpenPreview: (run: Run, imageId: string, linkedRun?: Run) => void
  onDownloadSingleImage?: (runId: string, imageId: string) => void
  pagination?: PaginationControl
  onAssistantActionTrigger?: AssistantActionTrigger
  compact?: boolean
  resolveImagePreviewSource?: ResolveImagePreviewSource
  showRequestMethodBadge?: boolean
  offscreenPreviewReleaseDelayMs?: number
  elapsedNow?: number
}

export function RunImageGrid(props: RunImageGridProps) {
  const {
    rows,
    run,
    tasksById,
    linkedRun,
    onOpenPreview,
    onDownloadSingleImage,
    pagination,
    onAssistantActionTrigger,
    compact = false,
    resolveImagePreviewSource,
    showRequestMethodBadge = false,
    offscreenPreviewReleaseDelayMs,
    elapsedNow,
  } = props
  const preferredColumns = run?.settingsSnapshot?.gridColumns

  return (
    <>
      <div
        className={`run-grid grid ${compact ? 'run-grid-compact gap-[14px]' : 'gap-[14px]'}`}
        style={{
          gridTemplateColumns: `repeat(${gridColumnCount(Math.max(rows.length, 1), preferredColumns)}, minmax(0, 1fr))`,
        }}
      >
        {rows.map((row) => (
          <RunImageGridItem
            key={`${run?.id ?? 'none'}-${row.seq}`}
            seq={row.seq}
            image={row.item}
            missingReason={row.missingReason}
            run={run}
            linkedRun={linkedRun}
            matchedTask={row.item && run ? tasksById?.[row.seq] : undefined}
            onOpenPreview={onOpenPreview}
            onDownloadSingleImage={onDownloadSingleImage}
            compact={compact}
            resolveImagePreviewSource={resolveImagePreviewSource}
            showRequestMethodBadge={showRequestMethodBadge}
            offscreenPreviewReleaseDelayMs={offscreenPreviewReleaseDelayMs}
            elapsedNow={elapsedNow}
          />
        ))}
      </div>
      {pagination ? (
        <div className="message-history-more">
          <Button
            size="small"
            className="assistant-action-btn"
            onClick={(event) => {
              onAssistantActionTrigger?.(
                `run-${run?.id ?? 'unknown'}-load-more-images-${pagination.current}`,
                event,
                pagination.onLoadMore,
              )
            }}
          >
            {`${pagination.label} (${pagination.current}/${pagination.total})`}
          </Button>
        </div>
      ) : null}
    </>
  )
}
