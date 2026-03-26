import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { emitUiRenderDebug } from '../../../../services/imageTaskDebug'

interface RunImageStatusPlaceholderProps {
  variant:
    | 'pending-waiting'
    | 'pending-generating'
    | 'pending-slow'
    | 'pending-slow-wait'
    | 'pending-long-wait'
    | 'pending-detached'
    | 'pending-detached-slow'
    | 'pending-detached-slow-wait'
    | 'pending-detached-long-wait'
    | 'retry-waiting'
    | 'failed'
    | 'timeout'
    | 'cancelled'
    | 'missing'
  label: string
  aspectRatioStyle?: CSSProperties
  compact?: boolean
  debugMeta?: {
    runId?: string
    batchId?: string
    taskId?: string
    imageId?: string
    seq?: number
    provider?: string
    model?: string
    channelId?: string | null
    channelName?: string | null
    state?: string
    detail?: Record<string, unknown>
  }
}

export function RunImageStatusPlaceholder({
  variant,
  label,
  aspectRatioStyle,
  compact = false,
  debugMeta,
}: RunImageStatusPlaceholderProps) {
  const isProcessVariant = variant.startsWith('pending-') || variant === 'retry-waiting'
  const legacyClassName = isProcessVariant ? 'run-image-skeleton' : 'run-image-fallback'
  const labelClassName = isProcessVariant ? 'run-image-skeleton-label' : 'run-image-placeholder-label'

  useEffect(() => {
    if (!debugMeta) {
      return
    }
    emitUiRenderDebug({
      cacheKey: `${debugMeta.runId ?? 'unknown'}:${debugMeta.imageId ?? debugMeta.seq ?? 'unknown'}:${variant}`,
      stage: 'ui_placeholder_rendered',
      label,
      ...debugMeta,
      detail: {
        variant,
        compact,
        ...debugMeta.detail,
      },
    })
  }, [compact, debugMeta, label, variant])

  return (
    <div
      className={[
        legacyClassName,
        'run-image-placeholder',
        `is-${variant}`,
        compact ? 'run-image-placeholder-compact' : '',
        'grid',
        'w-full',
        'place-items-center',
        'rounded-[var(--assistant-image-frame-radius)]',
        isProcessVariant
          ? 'run-image-skeleton border border-[#f0f0f0] bg-[linear-gradient(90deg,#f5f5f5_25%,#ececec_37%,#f5f5f5_63%)] [background-size:400%_100%] [animation:run-skeleton-shimmer_1.2s_ease-in-out_infinite]'
          : 'run-image-fallback border border-dashed border-[#d9d9d9] bg-[#fafafa] text-[#8c8c8c]',
        ['failed', 'timeout', 'missing'].includes(variant) ? 'border border-dashed border-[#d9d9d9] bg-[#fafafa]' : '',
        variant === 'retry-waiting' ? 'border-[#ffe58f] bg-[linear-gradient(90deg,#fffbe6_25%,#fff7d6_37%,#fffbe6_63%)] [background-size:400%_100%] [animation:run-skeleton-shimmer_1.2s_ease-in-out_infinite]' : '',
      ].filter(Boolean).join(' ')}
      style={aspectRatioStyle}
    >
      <span
        className={[
          labelClassName,
          isProcessVariant
            ? 'run-image-skeleton-label rounded-full border border-[rgba(0,0,0,0.06)] bg-[rgba(255,255,255,0.82)] px-[10px] py-1 text-xs font-semibold tracking-[0.02em] text-[#595959]'
            : 'run-image-placeholder-label rounded-full border border-[rgba(0,0,0,0.06)] bg-[rgba(255,255,255,0.92)] px-3 py-1.5 text-center text-xs font-semibold leading-[1.2] text-[#8c8c8c]',
          variant === 'timeout' ? 'border-[rgba(250,173,20,0.28)] bg-[rgba(255,251,230,0.92)] text-[#ad6800]' : '',
          variant === 'cancelled' ? 'border-[rgba(0,0,0,0.1)] bg-[rgba(245,245,245,0.95)] text-[#595959]' : '',
          variant === 'missing' ? 'text-[#595959]' : '',
          variant === 'retry-waiting' ? 'border-[rgba(250,173,20,0.28)] bg-[rgba(255,251,230,0.92)] text-[#ad6800]' : '',
        ].join(' ')}
      >
        {label}
      </span>
    </div>
  )
}
