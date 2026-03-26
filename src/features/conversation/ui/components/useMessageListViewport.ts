import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebouncedCallback } from '../../../../hooks/useDebouncedCallback'
import { useMediaQueryState } from '../../../../hooks/useMediaQueryState'

const SCROLL_TO_BOTTOM_ANIMATION_MS = 800
const SCROLL_TO_BOTTOM_REDUCED_MOTION_MS = 120

interface UseMessageListViewportInput {
  conversationId: string | undefined
  onReachBottom?: () => void
  onReachTop?: () => void
}

export function useMessageListViewport(input: UseMessageListViewportInput) {
  const {
    conversationId,
    onReachBottom,
    onReachTop,
  } = input

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(null)
  const scrollToBottomAnimationFrameRef = useRef<number | null>(null)
  const scrollToBottomAnimationTokenRef = useRef(0)
  const nearBottomNotifiedRef = useRef(false)
  const nearTopNotifiedRef = useRef(false)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const prefersReducedMotion = useMediaQueryState('(prefers-reduced-motion: reduce)')
  const debouncedSetViewportHeight = useDebouncedCallback((nextHeight: number) => {
    setViewportHeight((prev) => (prev === nextHeight ? prev : nextHeight))
  }, 80)

  const setViewportNode = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node
    setViewportElement((prev) => (prev === node ? prev : node))
  }, [])

  const cancelScrollToBottomAnimation = useCallback(() => {
    scrollToBottomAnimationTokenRef.current += 1
    if (scrollToBottomAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollToBottomAnimationFrameRef.current)
      scrollToBottomAnimationFrameRef.current = null
    }
  }, [])

  const scrollViewportToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const node = viewportRef.current
    if (!node) {
      return
    }

    cancelScrollToBottomAnimation()

    const targetTop = Math.max(node.scrollHeight - node.clientHeight, 0)
    if (behavior !== 'smooth') {
      node.scrollTop = targetTop
      return
    }

    const startTop = node.scrollTop
    const animationDistance = Math.abs(targetTop - startTop)
    if (animationDistance < 1) {
      node.scrollTop = targetTop
      return
    }

    const durationMs = prefersReducedMotion ? SCROLL_TO_BOTTOM_REDUCED_MOTION_MS : SCROLL_TO_BOTTOM_ANIMATION_MS
    const animationToken = scrollToBottomAnimationTokenRef.current + 1
    scrollToBottomAnimationTokenRef.current = animationToken
    let startTime: number | null = null

    const easeOutCubic = (value: number) => 1 - (1 - value) ** 3
    const tick = (timestamp: number) => {
      if (scrollToBottomAnimationTokenRef.current !== animationToken) {
        return
      }

      if (startTime === null) {
        startTime = timestamp
      }

      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      const easedProgress = easeOutCubic(progress)
      const liveTargetTop = Math.max(node.scrollHeight - node.clientHeight, 0)
      node.scrollTop = startTop + (liveTargetTop - startTop) * easedProgress

      if (progress < 1) {
        scrollToBottomAnimationFrameRef.current = window.requestAnimationFrame(tick)
        return
      }

      node.scrollTop = liveTargetTop
      scrollToBottomAnimationFrameRef.current = null
    }

    scrollToBottomAnimationFrameRef.current = window.requestAnimationFrame(tick)
  }, [cancelScrollToBottomAnimation, prefersReducedMotion])

  const updateScrollStatus = useCallback(() => {
    const node = viewportRef.current
    if (!node) {
      setShowScrollToBottom(false)
      setScrollTop(0)
      setViewportHeight(0)
      return
    }

    const nextScrollTop = node.scrollTop
    const nextViewportHeight = node.clientHeight
    const nearBottom = node.scrollHeight - nextScrollTop - node.clientHeight < 24
    const nearTop = nextScrollTop < 24
    setViewportHeight((prev) => (prev === nextViewportHeight ? prev : nextViewportHeight))
    setScrollTop((prev) => (prev === nextScrollTop ? prev : nextScrollTop))
    setShowScrollToBottom((prev) => (prev === !nearBottom ? prev : !nearBottom))

    if (nearBottom && !nearBottomNotifiedRef.current) {
      nearBottomNotifiedRef.current = true
      onReachBottom?.()
    } else if (!nearBottom) {
      nearBottomNotifiedRef.current = false
    }

    if (nearTop && !nearTopNotifiedRef.current) {
      nearTopNotifiedRef.current = true
      onReachTop?.()
    } else if (!nearTop) {
      nearTopNotifiedRef.current = false
    }
  }, [onReachBottom, onReachTop])

  useEffect(() => {
    const node = viewportElement
    if (!node) {
      return undefined
    }

    setViewportHeight((prev) => (prev === node.clientHeight ? prev : node.clientHeight))
    updateScrollStatus()
    const resize = () => {
      debouncedSetViewportHeight(node.clientHeight)
      updateScrollStatus()
    }
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      debouncedSetViewportHeight.cancel()
    }
  }, [debouncedSetViewportHeight, updateScrollStatus, viewportElement])

  useEffect(() => {
    const node = viewportElement
    if (!node) {
      return undefined
    }

    updateScrollStatus()
    node.addEventListener('scroll', updateScrollStatus, { passive: true })
    window.addEventListener('resize', updateScrollStatus)
    return () => {
      node.removeEventListener('scroll', updateScrollStatus)
      window.removeEventListener('resize', updateScrollStatus)
      nearBottomNotifiedRef.current = false
      nearTopNotifiedRef.current = false
    }
  }, [conversationId, updateScrollStatus, viewportElement])

  useEffect(() => {
    return () => {
      cancelScrollToBottomAnimation()
    }
  }, [cancelScrollToBottomAnimation])

  const handleScrollToBottom = useCallback(() => {
    scrollViewportToBottom('smooth')
    setShowScrollToBottom(false)
  }, [scrollViewportToBottom])

  return {
    viewportRef: setViewportNode,
    viewportNodeRef: viewportRef,
    viewportElement,
    viewportHeight,
    scrollTop,
    showScrollToBottom,
    handleScrollToBottom,
    scrollViewportToBottom,
  }
}
