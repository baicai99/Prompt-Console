import { useCallback } from 'react'

export function isFitToggleHotkey(event: { key: string; code?: string }) {
  if (event.key === ' ') {
    return true
  }

  if (event.code === 'KeyF') {
    return true
  }

  return event.key.toLowerCase() === 'f'
}

interface UsePreviewHotkeysInput {
  closePreview: () => void
  previewLength: number
  goPrevPreview: () => void
  goNextPreview: () => void
  goFirstPreview: () => void
  goLastPreview: () => void
  getViewportAndContentSize: (
    target?: 'left' | 'right',
  ) => { viewport: { width: number; height: number }; content: { width: number; height: number } } | null
  zoomBy: (
    delta: number,
    options?: {
      anchor?: { x: number; y: number }
      viewport?: { width: number; height: number }
      content?: { width: number; height: number }
      target?: 'left' | 'right'
    },
  ) => void
  toggleFitMode: (
    actualZoom?: number,
    options?: {
      anchor?: { x: number; y: number }
      viewport?: { width: number; height: number }
      content?: { width: number; height: number }
      target?: 'left' | 'right'
    },
  ) => void
  getActualZoom: (target?: 'left' | 'right') => number
  setActualPixelMode: (
    actualZoom?: number,
    options?: {
      anchor?: { x: number; y: number }
      viewport?: { width: number; height: number }
      content?: { width: number; height: number }
      target?: 'left' | 'right'
    },
  ) => void
  toggleInfoPanel: () => void
  focusStage: () => void
  activePane: 'left' | 'right'
}

export function usePreviewHotkeys(input: UsePreviewHotkeysInput) {
  return useCallback(
    (event: { key: string; preventDefault: () => void; code?: string }) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        input.closePreview()
        return
      }

      if (event.key === 'ArrowLeft' && input.previewLength > 1) {
        event.preventDefault()
        input.goPrevPreview()
        input.focusStage()
        return
      }

      if (event.key === 'ArrowRight' && input.previewLength > 1) {
        event.preventDefault()
        input.goNextPreview()
        input.focusStage()
        return
      }

      if (event.key === 'Home' && input.previewLength > 1) {
        event.preventDefault()
        input.goFirstPreview()
        input.focusStage()
        return
      }

      if (event.key === 'End' && input.previewLength > 1) {
        event.preventDefault()
        input.goLastPreview()
        input.focusStage()
        return
      }

      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        const size = input.getViewportAndContentSize(input.activePane)
        if (!size) {
          return
        }

        input.zoomBy(0.15, {
          ...size,
          target: input.activePane,
        })
        input.focusStage()
        return
      }

      if (event.key === '-') {
        event.preventDefault()
        const size = input.getViewportAndContentSize(input.activePane)
        if (!size) {
          return
        }

        input.zoomBy(-0.15, {
          ...size,
          target: input.activePane,
        })
        input.focusStage()
        return
      }

      if (event.key === '1') {
        event.preventDefault()
        const size = input.getViewportAndContentSize(input.activePane)
        if (!size) {
          return
        }

        input.setActualPixelMode(input.getActualZoom(input.activePane), {
          ...size,
          target: input.activePane,
        })
        input.focusStage()
        return
      }

      if (event.key.toLowerCase() === 'i') {
        event.preventDefault()
        input.toggleInfoPanel()
        input.focusStage()
        return
      }

      if (isFitToggleHotkey(event)) {
        event.preventDefault()
        const size = input.getViewportAndContentSize(input.activePane)
        if (!size) {
          return
        }

        input.toggleFitMode(input.getActualZoom(input.activePane), {
          ...size,
          target: input.activePane,
        })
        input.focusStage()
      }
    },
    [input],
  )
}
