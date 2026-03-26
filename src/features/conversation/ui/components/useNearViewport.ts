import { useEffect, useState, type RefObject } from 'react'

interface UseNearViewportInput {
  targetRef: RefObject<Element | null>
  rootSelector?: string
  rootMarginPx?: number
  offscreenReleaseDelayMs?: number
}

function resolveViewportBounds(root: Element | null) {
  if (root instanceof HTMLElement) {
    return root.getBoundingClientRect()
  }

  return {
    top: 0,
    left: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  }
}

export function useNearViewport(input: UseNearViewportInput) {
  const {
    targetRef,
    rootSelector = '.message-list-viewport',
    rootMarginPx = 0,
    offscreenReleaseDelayMs = 0,
  } = input
  const [isNearViewport, setIsNearViewport] = useState(() => typeof window === 'undefined' || typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const node = targetRef.current
    if (!node || typeof window === 'undefined') {
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true)
      return
    }

    const rootCandidate = node.closest(rootSelector)
    const root = rootCandidate instanceof Element ? rootCandidate : null
    let releaseTimer: number | null = null
    let frameId: number | null = null

    const clearReleaseTimer = () => {
      if (releaseTimer !== null) {
        window.clearTimeout(releaseTimer)
        releaseTimer = null
      }
    }

    const commitVisibility = (nextVisible: boolean) => {
      if (nextVisible) {
        clearReleaseTimer()
        setIsNearViewport(true)
        return
      }

      if (offscreenReleaseDelayMs <= 0) {
        setIsNearViewport(false)
        return
      }

      clearReleaseTimer()
      releaseTimer = window.setTimeout(() => {
        releaseTimer = null
        setIsNearViewport(false)
      }, offscreenReleaseDelayMs)
    }

    const checkViewportIntersection = () => {
      if (!node.isConnected) {
        return
      }

      const targetRect = node.getBoundingClientRect()
      const viewportBounds = resolveViewportBounds(root)
      const topBoundary = viewportBounds.top - rootMarginPx
      const bottomBoundary = viewportBounds.bottom + rootMarginPx
      const leftBoundary = viewportBounds.left
      const rightBoundary = viewportBounds.right
      const isVisible =
        targetRect.bottom > topBoundary
        && targetRect.top < bottomBoundary
        && targetRect.right > leftBoundary
        && targetRect.left < rightBoundary

      commitVisibility(isVisible)
    }

    const scheduleViewportCheck = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null
        checkViewportIntersection()
      })
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) {
          return
        }
        commitVisibility(entry.isIntersecting || entry.intersectionRatio > 0)
      },
      {
        root: root instanceof Element ? root : null,
        rootMargin: `${rootMarginPx}px 0px`,
        threshold: 0.01,
      },
    )

    observer.observe(node)
    scheduleViewportCheck()

    const scrollTarget: EventTarget = root ?? window
    scrollTarget.addEventListener('scroll', scheduleViewportCheck, { passive: true })
    window.addEventListener('resize', scheduleViewportCheck)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleViewportCheck()
      })
      resizeObserver.observe(node)
      if (root && root !== node) {
        resizeObserver.observe(root)
      }
    }

    return () => {
      observer.disconnect()
      scrollTarget.removeEventListener('scroll', scheduleViewportCheck)
      window.removeEventListener('resize', scheduleViewportCheck)
      resizeObserver?.disconnect()
      clearReleaseTimer()
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [offscreenReleaseDelayMs, rootMarginPx, rootSelector, targetRef])

  return isNearViewport
}
