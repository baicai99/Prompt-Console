import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  COMPOSER_OVERSHOOT_BASE_DURATION_MS,
  COMPOSER_OVERSHOOT_MAX_DELTA_PX,
  COMPOSER_OVERSHOOT_MAX_DURATION_MS,
  COMPOSER_OVERSHOOT_MIN_DELTA_PX,
} from './composerLayoutTokens'
import { useMediaQueryState } from '../../../../hooks/useMediaQueryState'

type ComposerLayoutSize = {
  width: number
  height: number
}

export type ComposerAnimationReason = 'idle' | 'input' | 'paste-expand'

export interface ComposerAnimationMeta {
  active: boolean
  reason: ComposerAnimationReason
  intensity: number
  scaleX: number
  scaleY: number
  durationMs: number
}

interface UseComposerOvershootAnimationInput {
  composerCardRef: RefObject<HTMLDivElement | null>
  draft: string
  selectedQuickActionsCount: number
  showAdvancedVariables: boolean
  sourceImagesCount: number
  useSheet: boolean
}

export function useComposerOvershootAnimation(input: UseComposerOvershootAnimationInput) {
  const { composerCardRef, draft, selectedQuickActionsCount, showAdvancedVariables, sourceImagesCount, useSheet } = input
  const previousLayoutSizeRef = useRef<ComposerLayoutSize | null>(null)
  const pendingAnimationReasonRef = useRef<ComposerAnimationReason>('idle')
  const overshootTimerRef = useRef<number | null>(null)
  const prefersReducedMotion = useMediaQueryState('(prefers-reduced-motion: reduce)')
  const [animationMeta, setAnimationMeta] = useState<ComposerAnimationMeta>({
    active: false,
    reason: 'idle',
    intensity: 0,
    scaleX: 1,
    scaleY: 1,
    durationMs: COMPOSER_OVERSHOOT_BASE_DURATION_MS,
  })

  useEffect(() => {
    return () => {
      if (overshootTimerRef.current !== null) {
        window.clearTimeout(overshootTimerRef.current)
      }
    }
  }, [])

  useLayoutEffect(() => {
    const card = composerCardRef.current
    if (!card) {
      return
    }

    const nextSize = {
      width: Math.ceil(card.getBoundingClientRect().width),
      height: Math.ceil(card.getBoundingClientRect().height),
    }
    const previousSize = previousLayoutSizeRef.current
    const reason = pendingAnimationReasonRef.current

    if (previousSize && !prefersReducedMotion && reason === 'paste-expand') {
      const deltaWidth = Math.max(nextSize.width - previousSize.width, 0)
      const deltaHeight = Math.max(nextSize.height - previousSize.height, 0)
      const totalDelta = deltaWidth + deltaHeight

      if (totalDelta >= COMPOSER_OVERSHOOT_MIN_DELTA_PX) {
        const intensity = Math.min(
          1,
          (totalDelta - COMPOSER_OVERSHOOT_MIN_DELTA_PX) /
            (COMPOSER_OVERSHOOT_MAX_DELTA_PX - COMPOSER_OVERSHOOT_MIN_DELTA_PX),
        )
        const totalDeltaSafe = Math.max(totalDelta, 1)
        const widthRatio = deltaWidth / totalDeltaSafe
        const heightRatio = deltaHeight / totalDeltaSafe
        const nextMeta: ComposerAnimationMeta = {
          active: true,
          reason,
          intensity,
          scaleX: 1 + 0.02 + intensity * (0.018 + widthRatio * 0.028),
          scaleY: 1 + 0.024 + intensity * (0.024 + heightRatio * 0.034),
          durationMs:
            COMPOSER_OVERSHOOT_BASE_DURATION_MS +
            Math.round((COMPOSER_OVERSHOOT_MAX_DURATION_MS - COMPOSER_OVERSHOOT_BASE_DURATION_MS) * intensity),
        }

        if (overshootTimerRef.current !== null) {
          window.clearTimeout(overshootTimerRef.current)
        }

        setAnimationMeta(nextMeta)
        overshootTimerRef.current = window.setTimeout(() => {
          setAnimationMeta((current) => ({ ...current, active: false, reason: 'idle', intensity: 0 }))
          overshootTimerRef.current = null
        }, nextMeta.durationMs)
      }
    }

    previousLayoutSizeRef.current = nextSize
    pendingAnimationReasonRef.current = 'idle'
  }, [composerCardRef, draft, prefersReducedMotion, selectedQuickActionsCount, showAdvancedVariables, sourceImagesCount, useSheet])

  return {
    animationMeta,
    markAnimationReason: (reason: ComposerAnimationReason) => {
      pendingAnimationReasonRef.current = reason
    },
  }
}
