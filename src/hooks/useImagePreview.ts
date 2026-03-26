import { useCallback, useRef, useState } from 'react'
import type { Run } from '../types/conversation'
import type { PreviewImage } from '../types/image'
import { toImagePreviewSource } from '../services/imageRef'
import { clamp, sortImagesBySeq } from '../utils/chat'

export interface DragOrigin {
  pointerId: number
  pointerX: number
  pointerY: number
}

export interface PreviewPair {
  seq: number
  left?: PreviewImage
  right?: PreviewImage
}

export type PreviewInteractionMode = 'fit' | 'actual'
export type PreviewCompareMode = 'split' | 'swipe' | 'overlay' | 'difference'
export type PreviewPixelMode = 'fit' | 'actual'
export type PreviewPane = 'left' | 'right'

export interface PreviewPoint {
  x: number
  y: number
}

export interface PreviewSize {
  width: number
  height: number
}

export interface TransformState {
  zoom: number
  offset: PreviewPoint
  mode: PreviewInteractionMode
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 5
const FIT_ZOOM = 1
const DEFAULT_ACTUAL_ZOOM = 2

function createDefaultTransform(): TransformState {
  return {
    zoom: FIT_ZOOM,
    offset: { x: 0, y: 0 },
    mode: 'fit',
  }
}

export function clampOffsetToBounds(offset: PreviewPoint, zoom: number, viewport: PreviewSize, content: PreviewSize): PreviewPoint {
  if (zoom <= FIT_ZOOM || viewport.width <= 0 || viewport.height <= 0 || content.width <= 0 || content.height <= 0) {
    return { x: 0, y: 0 }
  }

  const maxX = Math.max((content.width * zoom - viewport.width) / 2, 0)
  const maxY = Math.max((content.height * zoom - viewport.height) / 2, 0)

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  }
}

export function computeAnchoredOffset(prev: PreviewPoint, prevZoom: number, nextZoom: number, anchor: PreviewPoint): PreviewPoint {
  if (prevZoom <= 0 || prevZoom === nextZoom) {
    return prev
  }

  const ratio = nextZoom / prevZoom
  return {
    x: anchor.x - (anchor.x - prev.x) * ratio,
    y: anchor.y - (anchor.y - prev.y) * ratio,
  }
}

function toSuccessPreviewImages(run: Run): PreviewImage[] {
  return sortImagesBySeq(run.images)
    .filter((item) => item.status === 'success' && Boolean(item.fullRef ?? item.fileRef ?? item.thumbRef ?? item.refKey))
    .map((item) => ({
      runId: run.id,
      id: item.id,
      seq: item.seq,
      ...toImagePreviewSource(item),
    }))
}

export function useImagePreview() {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState<'single' | 'ab'>('single')
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([])
  const [previewPairs, setPreviewPairs] = useState<PreviewPair[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [transform, setTransform] = useState<TransformState>(() => createDefaultTransform())
  const [paneTransforms, setPaneTransforms] = useState<Record<PreviewPane, TransformState>>({
    left: createDefaultTransform(),
    right: createDefaultTransform(),
  })
  const [compareMode, setCompareMode] = useState<PreviewCompareMode>('split')
  const [isSyncLocked, setIsSyncLocked] = useState(true)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [activePane, setActivePane] = useState<PreviewPane>('left')
  const [isDragging, setIsDragging] = useState(false)
  const dragOriginRef = useRef<DragOrigin | null>(null)

  const currentPreviewImage = previewImages[previewIndex]
  const currentPreviewPair = previewPairs[previewIndex]

  const previewLength = previewMode === 'ab' ? previewPairs.length : previewImages.length
  const isSplitUnlocked = previewMode === 'ab' && compareMode === 'split' && !isSyncLocked
  const activeTransform = isSplitUnlocked ? paneTransforms[activePane] : transform
  const interactionMode = activeTransform.mode
  const pixelMode: PreviewPixelMode = interactionMode === 'fit' ? 'fit' : 'actual'

  const resetPaneTransforms = useCallback(() => {
    setPaneTransforms({
      left: createDefaultTransform(),
      right: createDefaultTransform(),
    })
  }, [])

  const resetTransform = useCallback(() => {
    setTransform(createDefaultTransform())
    resetPaneTransforms()
    setIsDragging(false)
    dragOriginRef.current = null
  }, [resetPaneTransforms])

  const updateTargetTransform = useCallback(
    (
      updater: (previous: TransformState) => TransformState,
      target?: PreviewPane,
    ) => {
      if (isSplitUnlocked) {
        const targetPane = target ?? activePane
        setPaneTransforms((prev) => ({
          ...prev,
          [targetPane]: updater(prev[targetPane]),
        }))
        return
      }

      setTransform((prev) => updater(prev))
    },
    [activePane, isSplitUnlocked],
  )

  const zoomTo = useCallback(
    (
      value: number,
      options?: { anchor?: PreviewPoint; viewport?: PreviewSize; content?: PreviewSize; target?: PreviewPane },
    ) => {
      updateTargetTransform((prev) => {
        const nextZoom = clamp(value, MIN_ZOOM, MAX_ZOOM)
        const anchor = options?.anchor
        const nextOffset = anchor
          ? computeAnchoredOffset(prev.offset, prev.zoom, nextZoom, anchor)
          : { ...prev.offset }

        const clampedOffset = options?.viewport && options?.content
          ? clampOffsetToBounds(nextOffset, nextZoom, options.viewport, options.content)
          : nextOffset

        return {
          zoom: nextZoom,
          offset: clampedOffset,
          mode: nextZoom === FIT_ZOOM ? 'fit' : 'actual',
        }
      }, options?.target)
    },
    [updateTargetTransform],
  )

  const zoomBy = useCallback(
    (
      delta: number,
      options?: { anchor?: PreviewPoint; viewport?: PreviewSize; content?: PreviewSize; target?: PreviewPane },
    ) => {
      updateTargetTransform((prev) => {
        const nextZoom = clamp(prev.zoom + delta, MIN_ZOOM, MAX_ZOOM)
        const anchor = options?.anchor
        const nextOffset = anchor
          ? computeAnchoredOffset(prev.offset, prev.zoom, nextZoom, anchor)
          : { ...prev.offset }

        const clampedOffset = options?.viewport && options?.content
          ? clampOffsetToBounds(nextOffset, nextZoom, options.viewport, options.content)
          : nextOffset

        return {
          zoom: nextZoom,
          offset: clampedOffset,
          mode: nextZoom === FIT_ZOOM ? 'fit' : 'actual',
        }
      }, options?.target)
    },
    [updateTargetTransform],
  )

  const panBy = useCallback((
    dx: number,
    dy: number,
    options?: { viewport?: PreviewSize; content?: PreviewSize; target?: PreviewPane },
  ) => {
    updateTargetTransform((prev) => {
      const nextOffset = {
        x: prev.offset.x + dx,
        y: prev.offset.y + dy,
      }

      const clampedOffset = options?.viewport && options?.content
        ? clampOffsetToBounds(nextOffset, prev.zoom, options.viewport, options.content)
        : nextOffset

      return {
        ...prev,
        offset: clampedOffset,
      }
    }, options?.target)
  }, [updateTargetTransform])

  const panTo = useCallback((
    offset: PreviewPoint,
    options?: { viewport?: PreviewSize; content?: PreviewSize; target?: PreviewPane },
  ) => {
    updateTargetTransform((prev) => {
      const clampedOffset = options?.viewport && options?.content
        ? clampOffsetToBounds(offset, prev.zoom, options.viewport, options.content)
        : offset

      return {
        ...prev,
        offset: clampedOffset,
      }
    }, options?.target)
  }, [updateTargetTransform])

  const toggleFitMode = useCallback(
    (
      actualZoom = DEFAULT_ACTUAL_ZOOM,
      options?: { anchor?: PreviewPoint; viewport?: PreviewSize; content?: PreviewSize; target?: PreviewPane },
    ) => {
      updateTargetTransform((prev) => {
        const nextZoom = prev.mode === 'fit' ? clamp(actualZoom, MIN_ZOOM, MAX_ZOOM) : FIT_ZOOM
        const anchor = options?.anchor
        const nextOffset = nextZoom === FIT_ZOOM
          ? { x: 0, y: 0 }
          : anchor
            ? computeAnchoredOffset(prev.offset, prev.zoom, nextZoom, anchor)
            : { ...prev.offset }

        const clampedOffset = options?.viewport && options?.content
          ? clampOffsetToBounds(nextOffset, nextZoom, options.viewport, options.content)
          : nextOffset

        return {
          zoom: nextZoom,
          offset: clampedOffset,
          mode: nextZoom === FIT_ZOOM ? 'fit' : 'actual',
        }
      }, options?.target)
    },
    [updateTargetTransform],
  )

  const setActualPixelMode = useCallback(
    (
      actualZoom = DEFAULT_ACTUAL_ZOOM,
      options?: { anchor?: PreviewPoint; viewport?: PreviewSize; content?: PreviewSize; target?: PreviewPane },
    ) => {
      zoomTo(actualZoom, {
        ...options,
        target: options?.target,
      })
    },
    [zoomTo],
  )

  const setCompareModeWithSync = useCallback((value: PreviewCompareMode) => {
    setCompareMode(value)
    if (value !== 'split') {
      setTransform(paneTransforms[activePane])
      setIsSyncLocked(true)
    }
  }, [activePane, paneTransforms])

  const setSyncLockedWithState = useCallback((value: boolean) => {
    if (compareMode !== 'split') {
      setIsSyncLocked(true)
      return
    }

    if (value) {
      setTransform(paneTransforms[activePane])
      setIsSyncLocked(true)
      return
    }

    setPaneTransforms({
      left: { ...transform },
      right: { ...transform },
    })
    setIsSyncLocked(false)
  }, [activePane, compareMode, paneTransforms, transform])

  const toggleInfoPanel = useCallback(() => {
    setShowInfoPanel((prev) => !prev)
  }, [])

  const goToPreview = useCallback((index: number) => {
    setPreviewIndex(clamp(index, 0, Math.max(previewLength - 1, 0)))
    resetTransform()
  }, [previewLength, resetTransform])

  const openPreview = useCallback(
    (run: Run, imageId: string, linkedRun?: Run) => {
      if (!linkedRun || run.sideMode !== 'multi') {
        const images = toSuccessPreviewImages(run)
        if (images.length === 0) {
          return
        }

        const selectedIndex = images.findIndex((item) => item.id === imageId)
        setPreviewMode('single')
        setPreviewPairs([])
        setPreviewImages(images)
        setActivePane('left')
        setPreviewIndex(selectedIndex >= 0 ? selectedIndex : 0)
        resetTransform()
        setIsPreviewOpen(true)
        return
      }

      const selected = run.images.find((item) => item.id === imageId)
      const selectedSeq = selected?.seq
      if (!selectedSeq) {
        return
      }

      const imagesA = toSuccessPreviewImages(run)
      const imagesB = toSuccessPreviewImages(linkedRun)
      const mapA = new Map(imagesA.map((item) => [item.seq, item]))
      const mapB = new Map(imagesB.map((item) => [item.seq, item]))
      const seqSet = new Set<number>([...mapA.keys(), ...mapB.keys()])

      const pairs = Array.from(seqSet)
        .sort((a, b) => a - b)
        .map((seq) => ({
          seq,
          left: mapA.get(seq),
          right: mapB.get(seq),
        }))

      if (pairs.length === 0) {
        return
      }

      const selectedIndex = pairs.findIndex((pair) => pair.seq === selectedSeq)
      setPreviewMode('ab')
      setPreviewImages([])
      setPreviewPairs(pairs)
      setActivePane('left')
      setPreviewIndex(selectedIndex >= 0 ? selectedIndex : 0)
      resetTransform()
      setIsPreviewOpen(true)
    },
    [resetTransform],
  )

  const closePreview = useCallback(() => {
    setIsPreviewOpen(false)
    setPreviewMode('single')
    setPreviewImages([])
    setPreviewPairs([])
    setPreviewIndex(0)
    resetTransform()
  }, [resetTransform])

  const goPrevPreview = useCallback(() => {
    setPreviewIndex((prev) => (prev === 0 ? previewLength - 1 : prev - 1))
    resetTransform()
  }, [previewLength, resetTransform])

  const goNextPreview = useCallback(() => {
    setPreviewIndex((prev) => (prev === previewLength - 1 ? 0 : prev + 1))
    resetTransform()
  }, [previewLength, resetTransform])

  const goFirstPreview = useCallback(() => {
    setPreviewIndex(0)
    resetTransform()
  }, [resetTransform])

  const goLastPreview = useCallback(() => {
    setPreviewIndex(Math.max(0, previewLength - 1))
    resetTransform()
  }, [previewLength, resetTransform])

  return {
    isPreviewOpen,
    previewMode,
    previewImages,
    previewPairs,
    previewIndex,
    transform: activeTransform,
    sharedTransform: transform,
    leftTransform: paneTransforms.left,
    rightTransform: paneTransforms.right,
    zoom: activeTransform.zoom,
    offset: activeTransform.offset,
    interactionMode,
    compareMode,
    isSyncLocked,
    showInfoPanel,
    pixelMode,
    activePane,
    isDragging,
    dragOriginRef,
    currentPreviewImage,
    currentPreviewPair,
    openPreview,
    closePreview,
    goPrevPreview,
    goNextPreview,
    goFirstPreview,
    goLastPreview,
    goToPreview,
    zoomBy,
    zoomTo,
    panBy,
    panTo,
    toggleFitMode,
    setActualPixelMode,
    setIsDragging,
    setCompareMode: setCompareModeWithSync,
    setIsSyncLocked: setSyncLockedWithState,
    toggleInfoPanel,
    setActivePane,
  }
}
