import { memo, useEffect, useMemo, useRef, type CSSProperties, type ComponentProps, type MouseEvent } from 'react'
import { DownloadOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import type { ImageTask, Run } from '../../../../types/conversation'
import type { ImageItem } from '../../../../types/image'
import { RunImageStatusPlaceholder } from './RunImageStatusPlaceholder'
import { emitUiRenderDebug } from '../../../../services/imageTaskDebug'
import {
  emitImageChainTrace,
  summarizeImagePayload,
  summarizeImagePreviewSource,
  summarizeImageRefs,
} from '../../../../services/imageChainTrace'
import { useResolvedImagePreview, type ResolveImagePreviewSource } from './useResolvedImagePreview'
import { toImagePreviewSource } from '../../../../services/imageRef'
import { getResolvedImageElapsedLabel } from '../../domain/requestDuration'
import { useNearViewport } from './useNearViewport'

interface ResolvedSuccessRunImageProps {
  run: Run
  image: ImageItem
  seq: number
  linkedRun: Run | undefined
  matchedTask?: ImageTask
  aspectRatioValue?: string
  placeholder: { variant: ComponentProps<typeof RunImageStatusPlaceholder>['variant']; label: string }
  compact: boolean
  isHovering: boolean
  onOpenPreview: (run: Run, imageId: string, linkedRun?: Run) => void
  onDownloadSingleImage?: (runId: string, imageId: string) => void
  resolveImagePreviewSource?: ResolveImagePreviewSource
  offscreenPreviewReleaseDelayMs?: number
  elapsedNow?: number
}

function toAspectRatioStyle(value: string | undefined): CSSProperties | undefined {
  return value ? { aspectRatio: value } : undefined
}

function areResolvedSuccessRunImagePropsEqual(prev: ResolvedSuccessRunImageProps, next: ResolvedSuccessRunImageProps): boolean {
  return (
    prev.run.id === next.run.id
    && prev.run.batchId === next.run.batchId
    && prev.run.modelId === next.run.modelId
    && prev.run.channelId === next.run.channelId
    && prev.run.channelName === next.run.channelName
    && prev.image === next.image
    && prev.seq === next.seq
    && (prev.linkedRun?.id ?? null) === (next.linkedRun?.id ?? null)
    && prev.matchedTask === next.matchedTask
    && prev.aspectRatioValue === next.aspectRatioValue
    && prev.placeholder.variant === next.placeholder.variant
    && prev.placeholder.label === next.placeholder.label
    && prev.compact === next.compact
    && prev.isHovering === next.isHovering
    && prev.onOpenPreview === next.onOpenPreview
    && prev.onDownloadSingleImage === next.onDownloadSingleImage
    && prev.resolveImagePreviewSource === next.resolveImagePreviewSource
    && prev.offscreenPreviewReleaseDelayMs === next.offscreenPreviewReleaseDelayMs
    && prev.elapsedNow === next.elapsedNow
  )
}

export const ResolvedSuccessRunImage = memo(function ResolvedSuccessRunImage({
  run,
  image,
  seq,
  linkedRun,
  matchedTask,
  aspectRatioValue,
  placeholder,
  compact,
  isHovering,
  onOpenPreview,
  onDownloadSingleImage,
  resolveImagePreviewSource,
  offscreenPreviewReleaseDelayMs = 0,
  elapsedNow,
}: ResolvedSuccessRunImageProps) {
  const renderCountRef = useRef(0)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const previewSource = useMemo(() => toImagePreviewSource(image), [image])
  const isNearViewport = useNearViewport({
    targetRef: contentRef,
    rootMarginPx: 240,
    offscreenReleaseDelayMs: offscreenPreviewReleaseDelayMs,
  })
  const { src, isLoading } = useResolvedImagePreview({
    source: previewSource,
    resolveImagePreviewSource,
    enabled: isNearViewport,
    request: { priority: 'visible' },
  })
  const hoverLabel = getResolvedImageElapsedLabel(image, matchedTask, elapsedNow)
  const showHoverOverlay = isHovering && (Boolean(onDownloadSingleImage) || Boolean(hoverLabel))
  const aspectRatioStyle = toAspectRatioStyle(aspectRatioValue)

  useEffect(() => {
    renderCountRef.current += 1
    emitImageChainTrace({
      file: 'src/features/conversation/ui/components/ResolvedSuccessRunImage.tsx',
      module: 'ResolvedSuccessRunImage',
      fn: 'commit',
      stage: 'image_component_render_committed',
      traceId: run.id,
      runId: run.id,
      batchId: run.batchId,
      taskId: matchedTask?.taskId,
      imageId: image.id,
      seq,
      detail: {
        renderCount: renderCountRef.current,
        image: summarizeImageRefs(image),
        previewSource: summarizeImagePreviewSource(previewSource),
        resolvedSrc: summarizeImagePayload(src),
        isLoading,
        compact,
        isNearViewport,
      },
    })
  }, [compact, image, isLoading, isNearViewport, matchedTask?.taskId, previewSource, run.batchId, run.id, seq, src])

  useEffect(() => {
    if (!src) {
      return
    }
    emitImageChainTrace({
      file: 'src/features/conversation/ui/components/ResolvedSuccessRunImage.tsx',
      module: 'ResolvedSuccessRunImage',
      fn: 'srcEffect',
      stage: 'image_component_src_assigned',
      traceId: run.id,
      runId: run.id,
      batchId: run.batchId,
      taskId: matchedTask?.taskId,
      imageId: image.id,
      seq,
      detail: {
        src: summarizeImagePayload(src),
        previewSource: summarizeImagePreviewSource(previewSource),
      },
    })
  }, [image.id, matchedTask?.taskId, previewSource, run.batchId, run.id, seq, src])

  if (!src) {
    emitImageChainTrace({
      file: 'src/features/conversation/ui/components/ResolvedSuccessRunImage.tsx',
      module: 'ResolvedSuccessRunImage',
      fn: 'render',
      stage: 'image_component_rendering_placeholder',
      level: isLoading ? 'log' : 'warn',
      traceId: run.id,
      runId: run.id,
      batchId: run.batchId,
      taskId: matchedTask?.taskId,
      imageId: image.id,
      seq,
      detail: {
        isLoading,
        isNearViewport,
        placeholderVariant: isLoading || !isNearViewport ? 'pending-generating' : placeholder.variant,
        placeholderLabel: isLoading ? '加载预览中' : !isNearViewport ? '滚动到此处加载预览' : placeholder.label,
        image: summarizeImageRefs(image),
      },
    })
    return (
      <div ref={contentRef} className="run-image-success-content relative w-full min-w-0">
        <RunImageStatusPlaceholder
          variant={isLoading || !isNearViewport ? 'pending-generating' : placeholder.variant}
          label={isLoading ? '加载预览中' : !isNearViewport ? '滚动到此处加载预览' : placeholder.label}
          aspectRatioStyle={aspectRatioStyle}
          compact={compact}
          debugMeta={{
            runId: run.id,
            batchId: run.batchId,
            taskId: matchedTask?.taskId,
            imageId: image.id,
            seq,
            model: run.modelId,
            channelId: run.channelId,
            channelName: run.channelName,
            state: image.status,
            detail: {
              loadingPreview: isLoading,
              isNearViewport,
            },
          }}
        />
      </div>
    )
  }

  const handleOpenPreview = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur()
    onOpenPreview(run, image.id, linkedRun)
  }

  return (
    <div ref={contentRef} className="run-image-success-content relative w-full min-w-0">
      <button
        className="image-button run-image-button block w-full cursor-pointer overflow-hidden rounded-[var(--assistant-image-radius)] border-0 bg-transparent leading-none transition-none"
        type="button"
        onClick={handleOpenPreview}
      >
        <img
          className={`run-image block h-auto w-full rounded-[var(--assistant-image-radius)] bg-[#f8efe3] object-cover ${compact ? 'run-image-compact [transform:translateZ(0)]' : ''}`}
          style={aspectRatioStyle}
          src={src}
          alt={`image-${seq}`}
          loading="lazy"
          decoding="async"
          onLoad={(event) => {
            emitUiRenderDebug({
              cacheKey: `${run.id}:${image.id}:image-loaded`,
              stage: 'ui_image_rendered',
              label: '已完成',
              runId: run.id,
              batchId: run.batchId,
              taskId: matchedTask?.taskId,
              imageId: image.id,
              seq,
              model: run.modelId,
              channelId: run.channelId,
              channelName: run.channelName,
              state: image.status,
              detail: {
                src,
              },
            })
            emitImageChainTrace({
              file: 'src/features/conversation/ui/components/ResolvedSuccessRunImage.tsx',
              module: 'ResolvedSuccessRunImage',
              fn: 'img.onLoad',
              stage: 'image_element_onload',
              traceId: run.id,
              runId: run.id,
              batchId: run.batchId,
              taskId: matchedTask?.taskId,
              imageId: image.id,
              seq,
              detail: {
                src: summarizeImagePayload(src),
                naturalWidth: event.currentTarget.naturalWidth,
                naturalHeight: event.currentTarget.naturalHeight,
                currentSrc: summarizeImagePayload(event.currentTarget.currentSrc),
              },
            })
          }}
          onError={(event) => {
            emitImageChainTrace({
              file: 'src/features/conversation/ui/components/ResolvedSuccessRunImage.tsx',
              module: 'ResolvedSuccessRunImage',
              fn: 'img.onError',
              stage: 'image_element_onerror',
              level: 'error',
              traceId: run.id,
              runId: run.id,
              batchId: run.batchId,
              taskId: matchedTask?.taskId,
              imageId: image.id,
              seq,
              detail: {
                src: summarizeImagePayload(src),
                currentSrc: summarizeImagePayload(event.currentTarget.currentSrc),
                naturalWidth: event.currentTarget.naturalWidth,
                naturalHeight: event.currentTarget.naturalHeight,
                complete: event.currentTarget.complete,
              },
            })
          }}
        />
      </button>
      {showHoverOverlay ? (
        <div className="run-image-hover-overlay pointer-events-none absolute inset-0 z-[3] bg-[linear-gradient(180deg,rgba(28,18,8,0.08)_0%,rgba(28,18,8,0)_34%,rgba(28,18,8,0.52)_100%)]">
          {onDownloadSingleImage ? (
            <Button
              size="small"
              type="primary"
              icon={<DownloadOutlined />}
              className="run-image-download-btn assistant-action-btn !absolute !top-[14px] !right-[14px] !pointer-events-auto !rounded-[8px] !border-[rgba(255,255,255,0.18)] !bg-[rgba(43,30,18,0.76)] !text-[#fff7ee] !shadow-[0_10px_22px_rgba(22,15,8,0.3)] backdrop-blur-[10px]"
              onClick={(event) => {
                event.stopPropagation()
                onDownloadSingleImage?.(run.id, image.id)
              }}
            >
              下载
            </Button>
          ) : null}
          {hoverLabel ? <div className="run-image-elapsed-badge pointer-events-none absolute bottom-[14px] left-[14px] max-w-[calc(100%-28px)] rounded-full bg-[rgba(43,30,18,0.72)] px-[10px] py-1.5 text-xs leading-none font-semibold tracking-[0.02em] text-[#fff7ee] shadow-[0_10px_22px_rgba(22,15,8,0.24)] backdrop-blur-[10px]">{`耗时 ${hoverLabel}`}</div> : null}
        </div>
      ) : null}
    </div>
  )
}, areResolvedSuccessRunImagePropsEqual)
