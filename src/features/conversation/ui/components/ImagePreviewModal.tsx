import {
  DownloadOutlined,
  InfoCircleOutlined,
  OneToOneOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { Button, Modal, Popover, Segmented, Tag } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'
import type {
  DragOrigin,
  PreviewCompareMode,
  PreviewInteractionMode,
  PreviewPane,
  PreviewPair,
  PreviewPixelMode,
  PreviewPoint,
  PreviewSize,
  TransformState,
} from '../../../../hooks/useImagePreview'
import type { ImagePreviewSource, PreviewImage } from '../../../../types/image'
import type {
  ConversationSourceImagePrefetchHandle,
  ConversationSourceImagePreviewRequest,
} from '../../application/conversationSourceImagePreviewService'
import { ABPreviewStage, SinglePreviewStage } from './imagePreview/PreviewStageImage'
import { PreviewInfoPanel } from './imagePreview/PreviewInfoPanel'
import type { PreviewDetail, PreviewDetailEntry } from './imagePreview/previewTypes'
import { usePreviewHotkeys } from './imagePreview/usePreviewHotkeys'
import { useResolvedImagePreview } from './useResolvedImagePreview'
import type { ResolveImagePreviewSource } from './useResolvedImagePreview'

const SHORTCUT_HINT = (
  <div className="preview-shortcuts grid min-w-[260px] gap-1 leading-[1.4]">
    <div><code className="rounded bg-[#f5f5f5] px-1 py-px">Esc</code> 关闭</div>
    <div><code className="rounded bg-[#f5f5f5] px-1 py-px">←/→</code> 上一张/下一张</div>
    <div><code className="rounded bg-[#f5f5f5] px-1 py-px">Home/End</code> 首张/末张</div>
    <div><code className="rounded bg-[#f5f5f5] px-1 py-px">+/-</code> 缩放</div>
    <div><code className="rounded bg-[#f5f5f5] px-1 py-px">1</code> 100% 像素，<code className="rounded bg-[#f5f5f5] px-1 py-px">F/空格</code> 适配切换</div>
    <div><code className="rounded bg-[#f5f5f5] px-1 py-px">I</code> 信息面板</div>
    <div><code className="rounded bg-[#f5f5f5] px-1 py-px">Alt + 滚轮</code> 缩放，放大后可滚轮平移</div>
    <div>双击切换缩放档位；移动端支持滑动切图、下滑关闭、双指缩放</div>
  </div>
)

const FIT_ZOOM = 1
const DOUBLE_CLICK_STEP = 0.75
const TOUCH_NAV_THRESHOLD = 72
const TOUCH_CLOSE_THRESHOLD = 96
const TOUCH_PAN_DEADBAND = 4

export type PrefetchImagePreviewSource = (
  source: ImagePreviewSource,
  options?: ConversationSourceImagePreviewRequest,
) => Promise<ConversationSourceImagePrefetchHandle | null>

interface ImagePreviewModalProps {
  isPreviewOpen: boolean
  previewMode: 'single' | 'ab'
  closePreview: () => void
  goPrevPreview: () => void
  goNextPreview: () => void
  goFirstPreview: () => void
  goLastPreview: () => void
  goToPreview: (index: number) => void
  previewImages: PreviewImage[]
  previewPairs: PreviewPair[]
  currentPreviewImage: PreviewImage | undefined
  currentPreviewPair: PreviewPair | undefined
  interactionMode: PreviewInteractionMode
  compareMode: PreviewCompareMode
  isSyncLocked: boolean
  showInfoPanel: boolean
  pixelMode: PreviewPixelMode
  activePane: PreviewPane
  zoom: number
  offset: { x: number; y: number }
  transform: TransformState
  sharedTransform: TransformState
  leftTransform: TransformState
  rightTransform: TransformState
  detail?: PreviewDetail | null
  isDragging: boolean
  dragOriginRef: MutableRefObject<DragOrigin | null>
  setIsDragging: (value: boolean) => void
  zoomBy: (
    delta: number,
    options?: { anchor?: PreviewPoint; viewport?: PreviewSize; content?: PreviewSize; target?: PreviewPane },
  ) => void
  zoomTo: (
    value: number,
    options?: { anchor?: PreviewPoint; viewport?: PreviewSize; content?: PreviewSize; target?: PreviewPane },
  ) => void
  panBy: (dx: number, dy: number, options?: { viewport?: PreviewSize; content?: PreviewSize; target?: PreviewPane }) => void
  panTo: (
    offset: PreviewPoint,
    options?: { viewport?: PreviewSize; content?: PreviewSize; target?: PreviewPane },
  ) => void
  toggleFitMode: (
    actualZoom?: number,
    options?: { anchor?: PreviewPoint; viewport?: PreviewSize; content?: PreviewSize; target?: PreviewPane },
  ) => void
  setActualPixelMode: (
    actualZoom?: number,
    options?: { anchor?: PreviewPoint; viewport?: PreviewSize; content?: PreviewSize; target?: PreviewPane },
  ) => void
  setCompareMode: (value: PreviewCompareMode) => void
  setIsSyncLocked: (value: boolean) => void
  toggleInfoPanel: () => void
  setActivePane: (pane: PreviewPane) => void
  resolveImagePreviewSource?: ResolveImagePreviewSource
  prefetchImagePreviewSource?: PrefetchImagePreviewSource
  onDownloadSingleImage?: (runId: string, imageId: string) => void
  onCopyPrompt?: (entry: PreviewDetailEntry) => void
  onCopyParams?: (entry: PreviewDetailEntry) => void
  onReusePrompt?: (entry: PreviewDetailEntry) => void
  onReplayRun?: (entry: PreviewDetailEntry) => void
}

function normalizeWheelDelta(event: ReactWheelEvent<HTMLDivElement>): { x: number; y: number } {
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 48 : 1
  return {
    x: event.deltaX * scale,
    y: event.deltaY * scale,
  }
}

function getAnchorInViewport(rect: DOMRect, clientX: number, clientY: number): PreviewPoint {
  return {
    x: clientX - rect.left - rect.width / 2,
    y: clientY - rect.top - rect.height / 2,
  }
}

function detectPaneFromTarget(target: EventTarget | null): PreviewPane | undefined {
  if (!(target instanceof Element)) {
    return undefined
  }

  const pane = target.closest('[data-preview-pane]')
  if (!pane) {
    return undefined
  }

  return pane.getAttribute('data-preview-pane') === 'right' ? 'right' : 'left'
}

function isTouchEvent(event: ReactPointerEvent<HTMLDivElement>) {
  return event.pointerType === 'touch'
}

function distanceBetweenPoints(left: PreviewPoint, right: PreviewPoint): number {
  const dx = right.x - left.x
  const dy = right.y - left.y
  return Math.sqrt(dx * dx + dy * dy)
}

function midpointBetweenPoints(left: PreviewPoint, right: PreviewPoint): PreviewPoint {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  }
}

function roundZoomPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 100
  }

  return Math.max(1, Math.round(value))
}

function useStageThumbnailSrc(input: {
  image?: PreviewImage
  resolveImagePreviewSource?: ResolveImagePreviewSource
}) {
  return useResolvedImagePreview({
    source: input.image,
    resolveImagePreviewSource: input.resolveImagePreviewSource,
    request: { priority: 'visible' },
  })
}

function PreviewThumbnailButton(input: {
  image?: PreviewImage
  seq: number
  active: boolean
  label?: string
  badges?: string[]
  onClick: () => void
  resolveImagePreviewSource?: ResolveImagePreviewSource
}) {
  const { src } = useStageThumbnailSrc({
    image: input.image,
    resolveImagePreviewSource: input.resolveImagePreviewSource,
  })

  return (
    <button
      type="button"
      className={`preview-thumb flex min-w-[82px] cursor-pointer flex-col gap-2 rounded-[14px] border bg-[rgba(255,255,255,0.88)] p-2 transition-[transform,border-color,box-shadow] duration-150 ease-out sm:min-w-24 ${input.active ? 'is-active border-[#3578e5] shadow-[0_0_0_2px_rgba(53,120,229,0.12)]' : 'border-[rgba(125,140,163,0.24)] hover:-translate-y-px hover:border-[rgba(53,120,229,0.45)]'}`}
      onClick={input.onClick}
    >
      <div className="preview-thumb-media grid h-[66px] w-[66px] place-items-center overflow-hidden rounded-[10px] bg-[#eef3fa] text-sm text-[#5a6478] sm:h-20 sm:w-20">
        {src ? <img src={src} alt={`thumb-${input.seq}`} draggable={false} className="block h-full w-full object-cover" /> : <span>#{input.seq}</span>}
      </div>
      <div className="preview-thumb-meta flex flex-col items-start gap-0.5 text-xs text-[#4f5870]">
        <span>#{input.seq}</span>
        {input.label ? <span>{input.label}</span> : null}
      </div>
      {input.badges?.length ? (
        <div className="preview-thumb-badges flex flex-wrap gap-1">
          {input.badges.map((badge) => (
            <Tag key={badge}>{badge}</Tag>
          ))}
        </div>
      ) : null}
    </button>
  )
}

function PreviewThumbnailRail(input: {
  previewMode: 'single' | 'ab'
  previewImages: PreviewImage[]
  previewPairs: PreviewPair[]
  previewIndex: number
  goToPreview: (index: number) => void
  resolveImagePreviewSource?: ResolveImagePreviewSource
}) {
  if (input.previewMode === 'single') {
    return (
      <div className="preview-thumbnail-rail flex gap-2.5 overflow-x-auto pb-1">
        {input.previewImages.map((image, index) => (
          <PreviewThumbnailButton
            key={image.id}
            image={image}
            seq={image.seq}
            active={index === input.previewIndex}
            onClick={() => input.goToPreview(index)}
            resolveImagePreviewSource={input.resolveImagePreviewSource}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="preview-thumbnail-rail flex gap-2.5 overflow-x-auto pb-1">
      {input.previewPairs.map((pair, index) => {
        const representative = pair.left ?? pair.right
        const badges = [
          pair.left ? 'A' : 'A 缺图',
          pair.right ? 'B' : 'B 缺图',
        ]

        return (
          <PreviewThumbnailButton
            key={`${pair.seq}:${pair.left?.id ?? '-'}:${pair.right?.id ?? '-'}`}
            image={representative}
            seq={pair.seq}
            active={index === input.previewIndex}
            badges={badges}
            onClick={() => input.goToPreview(index)}
            resolveImagePreviewSource={input.resolveImagePreviewSource}
          />
        )
      })}
    </div>
  )
}

export function ImagePreviewModal(props: ImagePreviewModalProps) {
  const {
    isPreviewOpen,
    previewMode,
    closePreview,
    goPrevPreview,
    goNextPreview,
    goFirstPreview,
    goLastPreview,
    goToPreview,
    previewImages,
    previewPairs,
    currentPreviewImage,
    currentPreviewPair,
    interactionMode,
    compareMode,
    isSyncLocked,
    showInfoPanel,
    pixelMode,
    activePane,
    zoom,
    offset,
    transform,
    sharedTransform,
    leftTransform,
    rightTransform,
    detail,
    isDragging,
    dragOriginRef,
    setIsDragging,
    zoomBy,
    zoomTo,
    panBy,
    panTo,
    toggleFitMode,
    setActualPixelMode,
    setCompareMode,
    setIsSyncLocked,
    toggleInfoPanel,
    setActivePane,
    resolveImagePreviewSource,
    prefetchImagePreviewSource,
    onDownloadSingleImage,
    onCopyPrompt,
    onCopyParams,
    onReusePrompt,
    onReplayRun,
  } = props

  const stageRef = useRef<HTMLDivElement | null>(null)
  const touchPointsRef = useRef(new Map<number, PreviewPoint>())
  const pinchStateRef = useRef<null | {
    distance: number
    zoom: number
    target: PreviewPane | undefined
  }>(null)
  const swipeStateRef = useRef<null | {
    pointerId: number
    x: number
    y: number
    target: PreviewPane | undefined
  }>(null)
  const [singleFitScale, setSingleFitScale] = useState(1)
  const [singleNaturalSize, setSingleNaturalSize] = useState<PreviewSize>({
    width: 0,
    height: 0,
  })
  const [stageMetricsToken, setStageMetricsToken] = useState(0)
  const previewIdentity = useMemo(() => {
    if (previewMode === 'ab') {
      return `${currentPreviewPair?.seq ?? '-'}:${currentPreviewPair?.left?.id ?? '-'}:${currentPreviewPair?.right?.id ?? '-'}`
    }
    return currentPreviewImage?.id ?? '-'
  }, [currentPreviewImage?.id, currentPreviewPair?.left?.id, currentPreviewPair?.right?.id, currentPreviewPair?.seq, previewMode])

  const previewLength = previewMode === 'ab' ? previewPairs.length : previewImages.length
  const previewIndex = previewMode === 'ab'
    ? previewPairs.findIndex((pair) => pair.seq === currentPreviewPair?.seq)
    : previewImages.findIndex((item) => item.id === currentPreviewImage?.id)
  const downloadablePreviewImage = useMemo(() => {
    if (previewMode !== 'single' || !currentPreviewImage?.runId || !currentPreviewImage.id) {
      return null
    }

    return currentPreviewImage
  }, [currentPreviewImage, previewMode])
  const downloadableRunId = downloadablePreviewImage?.runId
  const singleImageStyle = useMemo<CSSProperties | undefined>(() => {
    if (previewMode !== 'single' || singleNaturalSize.width <= 0 || singleNaturalSize.height <= 0) {
      return undefined
    }

    return {
      width: `${singleNaturalSize.width * singleFitScale}px`,
      height: `${singleNaturalSize.height * singleFitScale}px`,
    }
  }, [previewMode, singleFitScale, singleNaturalSize.height, singleNaturalSize.width])

  const focusStage = useCallback(() => {
    stageRef.current?.focus({ preventScroll: true })
  }, [])
  const markStageMetricsDirty = useCallback(() => {
    setStageMetricsToken((prev) => prev + 1)
  }, [])

  const resolveTargetTransform = useCallback((target?: PreviewPane): TransformState => {
    if (previewMode !== 'ab' || compareMode !== 'split' || isSyncLocked) {
      return sharedTransform
    }

    return target === 'right' ? rightTransform : leftTransform
  }, [compareMode, isSyncLocked, leftTransform, previewMode, rightTransform, sharedTransform])

  const getStageMetrics = useCallback((target?: PreviewPane) => {
    const stageEl = stageRef.current
    if (!stageEl) {
      return null
    }

    if (previewMode === 'ab' && compareMode === 'split') {
      const targetPane = target ?? activePane
      const paneEl = stageEl.querySelector<HTMLElement>(`[data-preview-pane="${targetPane}"]`)
      const viewportEl = paneEl?.querySelector<HTMLElement>('.preview-ab-image-wrap') ?? paneEl
      const imageEl = paneEl?.querySelector<HTMLImageElement>('.preview-image')
      if (!viewportEl || !imageEl) {
        return null
      }

      const viewportRect = viewportEl.getBoundingClientRect()
      const imageRect = imageEl.getBoundingClientRect()
      const targetTransform = resolveTargetTransform(targetPane)
      const baseWidth = targetTransform.zoom > 0 ? imageRect.width / targetTransform.zoom : imageRect.width
      const baseHeight = targetTransform.zoom > 0 ? imageRect.height / targetTransform.zoom : imageRect.height

      return {
        viewport: {
          width: viewportRect.width,
          height: viewportRect.height,
        },
        content: {
          width: baseWidth,
          height: baseHeight,
        },
        rect: viewportRect,
      }
    }

    const viewportEl = stageEl.querySelector<HTMLElement>(
      previewMode === 'single' ? '.preview-image-wrap' : '.preview-compare-overlay-canvas',
    ) ?? stageEl
    const imageEl = stageEl.querySelector<HTMLImageElement>('.preview-image')
    if (!imageEl) {
      return null
    }

    const viewportRect = viewportEl.getBoundingClientRect()
    const imageRect = imageEl.getBoundingClientRect()
    const baseWidth = zoom > 0 ? imageRect.width / zoom : imageRect.width
    const baseHeight = zoom > 0 ? imageRect.height / zoom : imageRect.height

    return {
      viewport: {
        width: viewportRect.width,
        height: viewportRect.height,
      },
      content: {
        width: baseWidth,
        height: baseHeight,
      },
      rect: viewportRect,
    }
  }, [activePane, compareMode, previewMode, resolveTargetTransform, zoom])

  const recalcSingleFitScale = useCallback(() => {
    if (previewMode !== 'single') {
      return
    }

    const metrics = getStageMetrics()
    const stageEl = stageRef.current
    const imageEl = stageEl?.querySelector<HTMLImageElement>('.preview-image')
    if (!metrics || !imageEl || imageEl.naturalWidth <= 0 || imageEl.naturalHeight <= 0) {
      return
    }

    if (metrics.viewport.width <= 0 || metrics.viewport.height <= 0) {
      return
    }

    setSingleNaturalSize({
      width: imageEl.naturalWidth,
      height: imageEl.naturalHeight,
    })

    const fitScale = Math.min(metrics.viewport.width / imageEl.naturalWidth, metrics.viewport.height / imageEl.naturalHeight)
    if (!Number.isFinite(fitScale) || fitScale <= 0) {
      return
    }

    setSingleFitScale((prev) => (Math.abs(prev - fitScale) < 0.001 ? prev : fitScale))
  }, [getStageMetrics, previewMode])

  const getViewportAndContentSize = useCallback((target?: PreviewPane) => {
    const metrics = getStageMetrics(target)
    if (!metrics) {
      return null
    }

    return {
      viewport: metrics.viewport,
      content: metrics.content,
    }
  }, [getStageMetrics])

  const getActualZoom = useCallback((target?: PreviewPane): number => {
    const stageEl = stageRef.current
    if (!stageEl) {
      return 2
    }

    let imageEl: HTMLImageElement | null = null
    if (previewMode === 'ab' && compareMode === 'split') {
      const targetPane = target ?? activePane
      const paneEl = stageEl.querySelector<HTMLElement>(`[data-preview-pane="${targetPane}"]`)
      imageEl = paneEl?.querySelector<HTMLImageElement>('.preview-image') ?? null
    } else {
      imageEl = stageEl.querySelector<HTMLImageElement>('.preview-image')
    }

    if (!imageEl || !imageEl.naturalWidth || !imageEl.naturalHeight) {
      return 2
    }

    const targetTransform = resolveTargetTransform(target)
    const rect = imageEl.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return 2
    }

    const baseWidth = targetTransform.zoom > 0 ? rect.width / targetTransform.zoom : rect.width
    const baseHeight = targetTransform.zoom > 0 ? rect.height / targetTransform.zoom : rect.height
    const zoomX = imageEl.naturalWidth / baseWidth
    const zoomY = imageEl.naturalHeight / baseHeight
    return Math.max(1, Math.min(5, Math.min(zoomX, zoomY)))
  }, [activePane, compareMode, previewMode, resolveTargetTransform])

  const handleApplyFit = useCallback((target?: PreviewPane) => {
    const size = getViewportAndContentSize(target)
    if (!size) {
      return
    }

    zoomTo(FIT_ZOOM, {
      ...size,
      target,
    })
    panTo({ x: 0, y: 0 }, {
      ...size,
      target,
    })
    focusStage()
  }, [focusStage, getViewportAndContentSize, panTo, zoomTo])

  const handleApplyActual = useCallback((target?: PreviewPane) => {
    const size = getViewportAndContentSize(target)
    if (!size) {
      return
    }

    setActualPixelMode(getActualZoom(target), {
      ...size,
      target,
    })
    focusStage()
  }, [focusStage, getActualZoom, getViewportAndContentSize, setActualPixelMode])

  const handlePreviewHotkey = usePreviewHotkeys({
    closePreview,
    previewLength,
    goPrevPreview,
    goNextPreview,
    goFirstPreview,
    goLastPreview,
    getViewportAndContentSize,
    zoomBy,
    toggleFitMode,
    getActualZoom,
    setActualPixelMode,
    toggleInfoPanel,
    focusStage,
    activePane,
  })

  useEffect(() => {
    if (!isPreviewOpen) {
      return
    }

    const timer = window.setTimeout(() => {
      focusStage()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [focusStage, isPreviewOpen])

  useEffect(() => {
    if (!isPreviewOpen) {
      return
    }

    const stageEl = stageRef.current
    const resizeTarget = stageEl?.querySelector<HTMLElement>(
      previewMode === 'single'
        ? '.preview-image-wrap'
        : compareMode === 'split'
          ? '.preview-ab-grid'
          : '.preview-compare-overlay-canvas',
    ) ?? stageEl
    if (!resizeTarget) {
      return
    }

    const observer = new ResizeObserver(() => {
      markStageMetricsDirty()
      if (previewMode === 'single' && interactionMode === 'fit') {
        recalcSingleFitScale()
      }
    })

    observer.observe(resizeTarget)
    return () => {
      observer.disconnect()
    }
  }, [compareMode, interactionMode, isPreviewOpen, markStageMetricsDirty, previewMode, recalcSingleFitScale])

  useEffect(() => {
    if (!isPreviewOpen || previewMode !== 'single') {
      return
    }
    setSingleFitScale(1)
    setSingleNaturalSize({ width: 0, height: 0 })
  }, [isPreviewOpen, previewIdentity, previewMode])

  useEffect(() => {
    if (!isPreviewOpen || previewMode !== 'single' || interactionMode !== 'fit') {
      return
    }

    recalcSingleFitScale()
  }, [interactionMode, isPreviewOpen, previewIdentity, previewMode, recalcSingleFitScale])

  useEffect(() => {
    if (!isPreviewOpen || zoom <= 1 || isDragging) {
      return
    }

    const size = getViewportAndContentSize(activePane)
    if (!size) {
      return
    }

    panTo(offset, {
      ...size,
      target: activePane,
    })
  }, [activePane, getViewportAndContentSize, isDragging, isPreviewOpen, offset, panTo, zoom])

  useEffect(() => {
    if (!isPreviewOpen || !prefetchImagePreviewSource) {
      return
    }

    const sources: ImagePreviewSource[] = []
    if (previewMode === 'single') {
      for (const index of [previewIndex - 2, previewIndex - 1, previewIndex + 1, previewIndex + 2]) {
        const image = previewImages[index]
        if (image) {
          sources.push(image)
        }
      }
    } else {
      for (const index of [previewIndex - 2, previewIndex - 1, previewIndex + 1, previewIndex + 2]) {
        const pair = previewPairs[index]
        if (!pair) {
          continue
        }
        if (pair.left) {
          sources.push(pair.left)
        }
        if (pair.right) {
          sources.push(pair.right)
        }
      }
    }

    const identities = new Set<string>()
    const uniqueSources = sources.filter((item) => {
      const identity = `${item.refKind ?? ''}:${item.refKey ?? item.src ?? ''}`
      if (identities.has(identity)) {
        return false
      }
      identities.add(identity)
      return true
    })
    const cleanups: Array<() => void> = []
    let cancelled = false

    void Promise.all(
      uniqueSources.map(async (source) => {
        const handle = await prefetchImagePreviewSource(source, { priority: 'modal' })
        if (cancelled) {
          handle?.cleanup()
          return
        }
        if (handle) {
          cleanups.push(handle.cleanup)
        }
      }),
    )

    return () => {
      cancelled = true
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [isPreviewOpen, prefetchImagePreviewSource, previewImages, previewIndex, previewMode, previewPairs])

  const handleStageWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    const targetPane = detectPaneFromTarget(event.target) ?? activePane
    if (previewMode === 'ab' && compareMode === 'split') {
      setActivePane(targetPane)
    }

    const size = getViewportAndContentSize(targetPane)
    const metrics = getStageMetrics(targetPane)
    if (!size || !metrics) {
      return
    }

    if (event.ctrlKey || event.metaKey) {
      return
    }

    const isZoomIntent = event.altKey
    const normalized = normalizeWheelDelta(event)

    if (isZoomIntent) {
      event.preventDefault()
      const anchor = getAnchorInViewport(metrics.rect, event.clientX, event.clientY)
      const step = normalized.y < 0 ? 0.12 : -0.12
      zoomBy(step, {
        anchor,
        ...size,
        target: targetPane,
      })
      return
    }

    const targetZoom = resolveTargetTransform(targetPane).zoom
    if (targetZoom <= 1) {
      return
    }

    event.preventDefault()
    const panX = event.shiftKey ? normalized.y : normalized.x
    const panY = event.shiftKey ? 0 : normalized.y
    panBy(-panX, -panY, {
      ...size,
      target: targetPane,
    })
  }, [
    activePane,
    compareMode,
    getStageMetrics,
    getViewportAndContentSize,
    panBy,
    previewMode,
    resolveTargetTransform,
    setActivePane,
    zoomBy,
  ])

  const handleStageDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const targetPane = detectPaneFromTarget(event.target) ?? activePane
    if (previewMode === 'ab' && compareMode === 'split') {
      setActivePane(targetPane)
    }

    const size = getViewportAndContentSize(targetPane)
    const metrics = getStageMetrics(targetPane)
    if (!size || !metrics) {
      return
    }

    const anchor = getAnchorInViewport(metrics.rect, event.clientX, event.clientY)
    const targetZoom = resolveTargetTransform(targetPane).zoom
    if (interactionMode === 'fit') {
      setActualPixelMode(getActualZoom(targetPane), {
        anchor,
        ...size,
        target: targetPane,
      })
      return
    }

    if (targetZoom < 4.5) {
      zoomBy(DOUBLE_CLICK_STEP, {
        anchor,
        ...size,
        target: targetPane,
      })
      return
    }

    handleApplyFit(targetPane)
  }, [
    activePane,
    compareMode,
    getActualZoom,
    getStageMetrics,
    getViewportAndContentSize,
    handleApplyFit,
    interactionMode,
    previewMode,
    resolveTargetTransform,
    setActivePane,
    setActualPixelMode,
    zoomBy,
  ])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const targetPane = detectPaneFromTarget(event.target) ?? activePane
    if (previewMode === 'ab' && compareMode === 'split') {
      setActivePane(targetPane)
    }

    if (isTouchEvent(event)) {
      event.currentTarget.setPointerCapture(event.pointerId)
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touchPointsRef.current.size === 1) {
        swipeStateRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          target: targetPane,
        }
      } else if (touchPointsRef.current.size === 2) {
        const [first, second] = Array.from(touchPointsRef.current.values())
        pinchStateRef.current = {
          distance: distanceBetweenPoints(first, second),
          zoom: resolveTargetTransform(targetPane).zoom,
          target: targetPane,
        }
      }
      return
    }

    if (event.button !== 0 || resolveTargetTransform(targetPane).zoom <= 1) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOriginRef.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
    }
    setIsDragging(true)
  }, [
    activePane,
    compareMode,
    dragOriginRef,
    previewMode,
    resolveTargetTransform,
    setActivePane,
    setIsDragging,
  ])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const targetPane = detectPaneFromTarget(event.target) ?? swipeStateRef.current?.target ?? activePane
    if (isTouchEvent(event)) {
      const previous = touchPointsRef.current.get(event.pointerId)
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (touchPointsRef.current.size >= 2) {
        const [first, second] = Array.from(touchPointsRef.current.values())
        const pinchState = pinchStateRef.current
        const metrics = getStageMetrics(targetPane)
        if (!pinchState || !metrics) {
          return
        }

        const distance = distanceBetweenPoints(first, second)
        const midpoint = midpointBetweenPoints(first, second)
        const anchor = getAnchorInViewport(metrics.rect, midpoint.x, midpoint.y)
        zoomTo(pinchState.zoom * (distance / Math.max(pinchState.distance, 1)), {
          anchor,
          viewport: metrics.viewport,
          content: metrics.content,
          target: pinchState.target,
        })
        return
      }

      if (!previous) {
        return
      }

      const size = getViewportAndContentSize(targetPane)
      if (!size) {
        return
      }

      const currentTransform = resolveTargetTransform(targetPane)
      const deltaX = event.clientX - previous.x
      const deltaY = event.clientY - previous.y

      if (currentTransform.zoom > 1 && (Math.abs(deltaX) > TOUCH_PAN_DEADBAND || Math.abs(deltaY) > TOUCH_PAN_DEADBAND)) {
        panBy(deltaX, deltaY, {
          ...size,
          target: targetPane,
        })
      }
      return
    }

    if (!isDragging || !dragOriginRef.current || dragOriginRef.current.pointerId !== event.pointerId) {
      return
    }

    const size = getViewportAndContentSize(targetPane)
    if (!size) {
      return
    }

    const deltaX = event.clientX - dragOriginRef.current.pointerX
    const deltaY = event.clientY - dragOriginRef.current.pointerY
    dragOriginRef.current.pointerX = event.clientX
    dragOriginRef.current.pointerY = event.clientY
    panBy(deltaX, deltaY, {
      ...size,
      target: targetPane,
    })
  }, [
    activePane,
    dragOriginRef,
    getStageMetrics,
    getViewportAndContentSize,
    isDragging,
    panBy,
    resolveTargetTransform,
    zoomTo,
  ])

  const cleanupTouchState = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const swipeState = swipeStateRef.current
    const targetPane = swipeState?.target ?? detectPaneFromTarget(event.target) ?? activePane

    if (isTouchEvent(event)) {
      const currentTransform = resolveTargetTransform(targetPane)
      if (swipeState?.pointerId === event.pointerId && currentTransform.zoom <= 1) {
        const deltaX = event.clientX - swipeState.x
        const deltaY = event.clientY - swipeState.y
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > TOUCH_NAV_THRESHOLD && previewLength > 1) {
          if (deltaX > 0) {
            goPrevPreview()
          } else {
            goNextPreview()
          }
        } else if (deltaY > TOUCH_CLOSE_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
          closePreview()
        }
      }

      touchPointsRef.current.delete(event.pointerId)
      swipeStateRef.current = null
      if (touchPointsRef.current.size < 2) {
        pinchStateRef.current = null
      }
      event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }

    if (dragOriginRef.current?.pointerId !== event.pointerId) {
      return
    }

    setIsDragging(false)
    dragOriginRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [
    activePane,
    closePreview,
    dragOriginRef,
    goNextPreview,
    goPrevPreview,
    previewLength,
    resolveTargetTransform,
    setIsDragging,
  ])

  const currentMinimapMetrics = useMemo(() => {
    if (previewMode !== 'single' || zoom <= 1) {
      return null
    }

    const size = getViewportAndContentSize()
    if (!size) {
      return null
    }

    const displayWidth = size.content.width * zoom
    const displayHeight = size.content.height * zoom
    if (displayWidth <= 0 || displayHeight <= 0) {
      return null
    }

    const visibleWidth = Math.min(1, size.viewport.width / displayWidth)
    const visibleHeight = Math.min(1, size.viewport.height / displayHeight)
    const maxX = Math.max((displayWidth - size.viewport.width) / 2, 0)
    const maxY = Math.max((displayHeight - size.viewport.height) / 2, 0)
    const left = displayWidth > 0 ? (maxX - offset.x) / displayWidth : 0
    const top = displayHeight > 0 ? (maxY - offset.y) / displayHeight : 0

    return {
      left: Math.max(0, Math.min(1 - visibleWidth, left)),
      top: Math.max(0, Math.min(1 - visibleHeight, top)),
      width: visibleWidth,
      height: visibleHeight,
    }
  }, [getViewportAndContentSize, offset.x, offset.y, previewMode, zoom])
  const previewPageLabel = previewLength > 0
    ? `${(previewIndex >= 0 ? previewIndex : 0) + 1}/${previewLength}`
    : '0/0'
  const [footerZoomPercent, setFooterZoomPercent] = useState(100)

  const recomputeFooterZoomPercent = useCallback(() => {
    if (previewLength <= 0) {
      setFooterZoomPercent(100)
      return
    }

    if (previewMode === 'single') {
      const fitPercent = singleNaturalSize.width > 0 && singleFitScale > 0
        ? singleFitScale * transform.zoom * 100
        : (transform.zoom / getActualZoom()) * 100
      setFooterZoomPercent((current) => {
        const next = roundZoomPercent(fitPercent)
        return current === next ? current : next
      })
      return
    }

    const targetPane = compareMode === 'split' && !isSyncLocked ? activePane : undefined
    const actualZoom = getActualZoom(targetPane)
    const currentTransform = resolveTargetTransform(targetPane)
    setFooterZoomPercent((current) => {
      const next = roundZoomPercent((currentTransform.zoom / actualZoom) * 100)
      return current === next ? current : next
    })
  }, [
    activePane,
    compareMode,
    getActualZoom,
    isSyncLocked,
    previewLength,
    previewMode,
    resolveTargetTransform,
    singleFitScale,
    singleNaturalSize.width,
    transform.zoom,
  ])

  useEffect(() => {
    if (!isPreviewOpen) {
      setFooterZoomPercent(100)
      return
    }

    recomputeFooterZoomPercent()
  }, [isPreviewOpen, previewIdentity, recomputeFooterZoomPercent, stageMetricsToken])

  const compareOptions = [
    { label: '并排', value: 'split' },
    { label: '滑块', value: 'swipe' },
    { label: '叠加', value: 'overlay' },
    { label: '差异', value: 'difference' },
  ]
  const modalInlineGap = 'clamp(10px, 4vw, 72px)'
  const modalBlockGap = 'clamp(10px, 6vh, 88px)'
  const modalHeight = 'min(880px, calc(100dvh - clamp(20px, 12vh, 176px)))'

  return (
    <Modal
      open={isPreviewOpen}
      onCancel={closePreview}
      footer={
        <div className="preview-footer grid grid-cols-1 gap-2.5 pt-1 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="preview-footer-status flex min-w-0 flex-wrap items-center gap-2">
            <span className="preview-status-pill inline-flex h-[30px] items-center rounded-full border border-[#e4ebf5] bg-[#f4f7fb] px-3 text-[13px] leading-none text-[#576078]">{previewPageLabel}</span>
            <span className="preview-status-pill inline-flex h-[30px] items-center rounded-full border border-[#e4ebf5] bg-[#f4f7fb] px-3 text-[13px] leading-none text-[#576078]">{`${footerZoomPercent}%`}</span>
          </div>
          <div className="preview-footer-nav inline-flex items-center gap-2">
            <Button onClick={goPrevPreview} disabled={previewLength <= 1}>
              上一张
            </Button>
            <Button type="primary" onClick={goNextPreview} disabled={previewLength <= 1}>
              下一张
            </Button>
          </div>
          <div className="preview-footer-actions inline-flex flex-wrap items-center justify-start gap-2 md:justify-end">
            <Button
              type={showInfoPanel ? 'primary' : 'default'}
              icon={<InfoCircleOutlined />}
              onClick={toggleInfoPanel}
            >
              信息
            </Button>
            {downloadablePreviewImage && onDownloadSingleImage ? (
              <Button
                type="default"
                icon={<DownloadOutlined />}
                onClick={() => {
                  if (!downloadableRunId) {
                    return
                  }
                  onDownloadSingleImage(downloadableRunId, downloadablePreviewImage.id)
                }}
              >
                下载
              </Button>
            ) : null}
            <Popover content={SHORTCUT_HINT} trigger="click" placement="topRight">
              <Button type="default">快捷键</Button>
            </Popover>
          </div>
        </div>
      }
      width={previewMode === 'ab' ? 1320 : 1200}
      centered={false}
      destroyOnHidden
      keyboard={false}
      rootClassName="preview-modal-root"
      className="preview-modal"
      classNames={{
        wrapper: 'preview-modal-wrapper',
        container: 'preview-modal-container',
        body: 'preview-modal-body',
        footer: 'preview-modal-footer',
      }}
      styles={{
        wrapper: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${modalBlockGap} ${modalInlineGap}`,
          overflow: 'auto',
        },
        container: {
          height: modalHeight,
          maxHeight: modalHeight,
          maxWidth: `min(100%, calc(100vw - (${modalInlineGap} * 2)))`,
          margin: 0,
          paddingBottom: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        },
        body: {
          paddingTop: 10,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      modalRender={(node) => (
        <div
          onKeyDownCapture={(event) => {
            handlePreviewHotkey(event)
          }}
        >
          {node}
        </div>
      )}
      title={previewMode === 'ab' ? 'A/B 专业对比预览' : '专业预览'}
    >
      <div className={`preview-layout flex min-h-0 flex-1 flex-col gap-4 overflow-hidden ${showInfoPanel ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]' : ''}`}>
        <div className="preview-main-column flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="preview-toolbar flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="preview-toolbar-group inline-flex flex-wrap items-center gap-2 max-sm:w-full">
              <Button
                type={pixelMode === 'fit' ? 'primary' : 'default'}
                icon={<SwapOutlined />}
                className="max-sm:flex-1"
                onClick={() => handleApplyFit(activePane)}
              >
                适配
              </Button>
              <Button
                type={pixelMode === 'actual' ? 'primary' : 'default'}
                icon={<OneToOneOutlined />}
                className="max-sm:flex-1"
                onClick={() => handleApplyActual(activePane)}
              >
                100%
              </Button>
            </div>
            {previewMode === 'ab' ? (
              <div className="preview-toolbar-group inline-flex flex-wrap items-center gap-2 max-sm:w-full">
                <Segmented
                  className="max-sm:flex-1"
                  value={compareMode}
                  options={compareOptions}
                  onChange={(value) => setCompareMode(value as PreviewCompareMode)}
                />
                {compareMode === 'split' ? (
                  <Button
                    type={isSyncLocked ? 'default' : 'primary'}
                    className="max-sm:flex-1"
                    onClick={() => setIsSyncLocked(!isSyncLocked)}
                  >
                    {isSyncLocked ? '同步视图' : '独立视图'}
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className="preview-toolbar-group inline-flex flex-wrap items-center gap-2 max-sm:w-full">
              <Button
                type={showInfoPanel ? 'primary' : 'default'}
                icon={<InfoCircleOutlined />}
                className="max-sm:flex-1"
                onClick={toggleInfoPanel}
              >
                信息
              </Button>
            </div>
          </div>

          <div
            ref={stageRef}
            className={`preview-stage relative grid min-h-[220px] flex-1 place-items-center overflow-hidden rounded-2xl border border-[#dde6f2] bg-[linear-gradient(180deg,#f7f9fc_0%,#eef3fa_100%)] outline-none sm:min-h-[clamp(220px,34vh,420px)] ${isDragging ? 'is-dragging cursor-grabbing' : zoom > 1 ? 'is-pannable cursor-grab' : 'cursor-default'} touch-none select-none`}
            role="application"
            tabIndex={0}
            onDoubleClick={handleStageDoubleClick}
            onWheel={handleStageWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={cleanupTouchState}
            onPointerCancel={cleanupTouchState}
          >
            {previewMode === 'ab' ? (
              <ABPreviewStage
                key={previewIdentity}
                currentPreviewPair={currentPreviewPair}
                compareMode={compareMode}
                sharedTransform={sharedTransform}
                leftTransform={leftTransform}
                rightTransform={rightTransform}
                isSyncLocked={isSyncLocked}
                activePane={activePane}
                setActivePane={setActivePane}
                resolveImagePreviewSource={resolveImagePreviewSource}
                onStageImageLoad={markStageMetricsDirty}
              />
            ) : (
              <SinglePreviewStage
                key={previewIdentity}
                currentPreviewImage={currentPreviewImage}
                transform={transform}
                singleImageStyle={singleImageStyle}
                recalcSingleFitScale={recalcSingleFitScale}
                onStageImageLoad={markStageMetricsDirty}
                resolveImagePreviewSource={resolveImagePreviewSource}
              />
            )}

            {currentMinimapMetrics ? (
              <div className="preview-minimap absolute right-4 bottom-4 h-[76px] w-[104px] overflow-hidden rounded-xl border border-[rgba(125,140,163,0.35)] bg-[rgba(12,18,28,0.62)] backdrop-blur-md sm:h-24 sm:w-[136px]">
                <div className="absolute inset-[10px] rounded-lg border border-[rgba(255,255,255,0.16)]" />
                <div
                  className="preview-minimap-viewport absolute rounded-md border-2 border-[#78b0ff] bg-[rgba(120,176,255,0.16)]"
                  style={{
                    left: `${currentMinimapMetrics.left * 100}%`,
                    top: `${currentMinimapMetrics.top * 100}%`,
                    width: `${currentMinimapMetrics.width * 100}%`,
                    height: `${currentMinimapMetrics.height * 100}%`,
                  }}
                />
              </div>
            ) : null}
          </div>

          {previewLength > 1 ? (
            <PreviewThumbnailRail
              previewMode={previewMode}
              previewImages={previewImages}
              previewPairs={previewPairs}
              previewIndex={previewIndex >= 0 ? previewIndex : 0}
              goToPreview={goToPreview}
              resolveImagePreviewSource={resolveImagePreviewSource}
            />
          ) : null}
        </div>

        {showInfoPanel ? (
          <PreviewInfoPanel
            detail={detail}
            compareMode={compareMode}
            onCopyPrompt={onCopyPrompt}
            onCopyParams={onCopyParams}
            onReusePrompt={onReusePrompt}
            onReplayRun={onReplayRun}
          />
        ) : null}
      </div>
    </Modal>
  )
}
