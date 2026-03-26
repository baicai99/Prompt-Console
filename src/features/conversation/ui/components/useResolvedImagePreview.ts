import { useEffect, useRef, useState } from 'react'
import type {
  ConversationSourceImagePreviewHandle,
  ConversationSourceImagePreviewRequest,
} from '../../application/conversationSourceImagePreviewService'
import type { ImagePreviewSource } from '../../../../types/image'
import {
  emitImageChainTrace,
  summarizeError,
  summarizeImagePayload,
  summarizeImagePreviewSource,
  summarizeString,
} from '../../../../services/imageChainTrace'

export type ResolveImagePreviewSource = (
  source: ImagePreviewSource,
  options?: ConversationSourceImagePreviewRequest,
) => Promise<ConversationSourceImagePreviewHandle | null>

export type ResolvedImagePreviewStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

function getPreviewSourceIdentity(source?: ImagePreviewSource | null): string {
  if (!source) {
    return 'empty'
  }

  return `${source.refKind ?? ''}:${source.refKey ?? source.src ?? ''}`
}

function getDirectImagePreviewSrc(source?: ImagePreviewSource | null): string | null {
  if (!source) {
    return null
  }
  if (source.src?.trim()) {
    return source.src
  }
  if (source.refKind === 'url' && source.refKey?.trim()) {
    return source.refKey
  }
  return null
}

export function useResolvedImagePreview(input: {
  source?: ImagePreviewSource | null
  resolveImagePreviewSource?: ResolveImagePreviewSource
  enabled?: boolean
  request?: ConversationSourceImagePreviewRequest
}) {
  const { source, resolveImagePreviewSource, enabled = true, request } = input
  const priority = request?.priority ?? 'visible'
  const directSrc = getDirectImagePreviewSrc(source)
  const sourceIdentity = getPreviewSourceIdentity(source)
  const [src, setSrc] = useState<string | null>(enabled ? directSrc : null)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const previousSourceIdentityRef = useRef(sourceIdentity)
  const previousEnabledRef = useRef(enabled)
  const currentSrcRef = useRef<string | null>(src)
  const currentErrorRef = useRef<string | null>(error)

  useEffect(() => {
    currentSrcRef.current = src
    currentErrorRef.current = error
  }, [error, src])

  useEffect(() => {
    const sourceChanged = previousSourceIdentityRef.current !== sourceIdentity
    const enabledChanged = previousEnabledRef.current !== enabled
    previousSourceIdentityRef.current = sourceIdentity
    previousEnabledRef.current = enabled
    emitImageChainTrace({
      file: 'src/features/conversation/ui/components/useResolvedImagePreview.ts',
      module: 'useResolvedImagePreview',
      fn: 'effect',
      stage: 'preview_hook_effect_entered',
      traceId: source?.refKey ?? source?.src ?? undefined,
      detail: {
        source: summarizeImagePreviewSource(source),
        directSrc: summarizeImagePayload(directSrc),
        hasResolver: Boolean(resolveImagePreviewSource),
        enabled,
        priority,
      },
    })
    if (!enabled) {
      setSrc(null)
      setError(null)
      return
    }

    if (directSrc) {
      emitImageChainTrace({
        file: 'src/features/conversation/ui/components/useResolvedImagePreview.ts',
        module: 'useResolvedImagePreview',
        fn: 'effect',
        stage: 'preview_hook_using_direct_src',
        traceId: source?.refKey ?? directSrc,
        detail: {
          directSrc: summarizeImagePayload(directSrc),
        },
      })
      setSrc(directSrc)
      setError(null)
      return
    }

    if (!sourceChanged && !enabledChanged && currentSrcRef.current && !currentErrorRef.current) {
      return
    }

    const pendingSource = source
    const assetKey = pendingSource?.refKind === 'idb-blob' ? pendingSource.refKey?.trim() : ''
    if (!assetKey || !pendingSource || !resolveImagePreviewSource) {
      emitImageChainTrace({
        file: 'src/features/conversation/ui/components/useResolvedImagePreview.ts',
        module: 'useResolvedImagePreview',
        fn: 'effect',
        stage: 'preview_hook_cleared_src',
        level: 'warn',
        traceId: pendingSource?.refKey ?? undefined,
        branch: !pendingSource ? 'missing_source' : !assetKey ? 'missing_asset_key' : 'missing_resolver',
        detail: {
          source: summarizeImagePreviewSource(pendingSource),
          hasResolver: Boolean(resolveImagePreviewSource),
        },
      })
      setSrc(null)
      setError(null)
      return
    }

    let cancelled = false
    let cleanup: (() => void) | undefined
    let retryTimer: number | null = null
    if (sourceChanged || enabledChanged) {
      setSrc(null)
      setError(null)
    }
    emitImageChainTrace({
      file: 'src/features/conversation/ui/components/useResolvedImagePreview.ts',
      module: 'useResolvedImagePreview',
      fn: 'effect',
      stage: 'preview_hook_async_resolve_started',
      traceId: assetKey,
      detail: {
        assetKey: summarizeString(assetKey),
        source: summarizeImagePreviewSource(pendingSource),
      },
    })

    void resolveImagePreviewSource(pendingSource, priority === 'visible' ? undefined : { priority })
      .then((preview) => {
        if (cancelled) {
          emitImageChainTrace({
            file: 'src/features/conversation/ui/components/useResolvedImagePreview.ts',
            module: 'useResolvedImagePreview',
            fn: 'effect.then',
            stage: 'preview_hook_result_after_cancel',
            level: 'warn',
            traceId: assetKey,
            detail: {
              assetKey: summarizeString(assetKey),
              previewSrc: summarizeImagePayload(preview?.src),
            },
          })
          preview?.cleanup?.()
          return
        }
        if (!preview) {
          retryTimer = window.setTimeout(() => {
            setRetryToken((prev) => prev + 1)
          }, 180)
          return
        }
        cleanup = preview?.cleanup
        emitImageChainTrace({
          file: 'src/features/conversation/ui/components/useResolvedImagePreview.ts',
          module: 'useResolvedImagePreview',
          fn: 'effect.then',
          stage: 'preview_hook_async_resolve_completed',
          traceId: assetKey,
          detail: {
            assetKey: summarizeString(assetKey),
            previewSrc: summarizeImagePayload(preview?.src),
            hasCleanup: Boolean(preview?.cleanup),
          },
        })
        setSrc(preview?.src ?? null)
        setError(null)
      })
      .catch((error) => {
        emitImageChainTrace({
          file: 'src/features/conversation/ui/components/useResolvedImagePreview.ts',
          module: 'useResolvedImagePreview',
          fn: 'effect.catch',
          stage: 'preview_hook_async_resolve_failed',
          level: 'error',
          traceId: assetKey,
          error,
          detail: {
            assetKey: summarizeString(assetKey),
            errorSummary: summarizeError(error),
          },
        })
        if (!cancelled) {
          setSrc(null)
          setError(JSON.stringify(summarizeError(error)))
        }
      })

    return () => {
      cancelled = true
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer)
      }
      emitImageChainTrace({
        file: 'src/features/conversation/ui/components/useResolvedImagePreview.ts',
        module: 'useResolvedImagePreview',
        fn: 'effect.cleanup',
        stage: 'preview_hook_cleanup',
        traceId: assetKey,
        detail: {
          assetKey: summarizeString(assetKey),
          source: summarizeImagePreviewSource(pendingSource),
        },
      })
      cleanup?.()
    }
  }, [directSrc, enabled, priority, resolveImagePreviewSource, retryToken, source, sourceIdentity])

  const isLoading = enabled && !directSrc && source?.refKind === 'idb-blob' && Boolean(source.refKey?.trim()) && !src && !error
  const hasSource = Boolean(source?.src?.trim() || source?.refKey?.trim())
  const status: ResolvedImagePreviewStatus = !enabled
    ? 'idle'
    : src
      ? 'ready'
      : error
        ? 'error'
        : isLoading
          ? 'loading'
          : hasSource
            ? 'missing'
            : 'idle'

  return {
    src,
    isLoading,
    error,
    status,
    retry() {
      setRetryToken((prev) => prev + 1)
    },
  }
}
