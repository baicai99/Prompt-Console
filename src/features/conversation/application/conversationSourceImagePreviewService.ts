import type { ImageItem, ImagePreviewSource } from '../../../types/image'
import { conversationAssetStorePort } from './ports/assetStorePort'
import {
  emitImageChainTrace,
  summarizeBlob,
  summarizeImagePayload,
  summarizeImagePreviewSource,
  summarizeString,
} from '../../../services/imageChainTrace'
import { toImagePreviewSource } from '../../../services/imageRef'

export interface ConversationSourceImagePreviewRequest {
  priority?: 'visible' | 'modal'
}

export interface ConversationSourceImagePreviewHandle {
  src: string
  kind: 'direct' | 'idb-blob'
  release: () => void
  cleanup: () => void
}

export interface ConversationSourceImagePreview {
  src: string
  cleanup?: () => void
}

export interface ConversationSourceImagePrefetchHandle {
  cleanup: () => void
}

export interface ConversationSourceImagePreviewDebugStats {
  cacheSize: number
  cacheCount: number
  totalRefs: number
  inflightCount: number
  createdObjectUrls: number
  revokedObjectUrls: number
  activeObjectUrls: number
  activeCount: number
  blockedByBudgetCount: number
  maxActivePreviews: number
}

export interface ConversationSourceImagePreviewService {
  acquirePreview: (
    source: ImagePreviewSource,
    options?: ConversationSourceImagePreviewRequest,
  ) => Promise<ConversationSourceImagePreviewHandle | null>
  prefetchPreview: (
    source: ImagePreviewSource,
    options?: ConversationSourceImagePreviewRequest,
  ) => Promise<ConversationSourceImagePrefetchHandle | null>
  acquireSourceImagePreview: (
    assetKey: string,
    options?: ConversationSourceImagePreviewRequest,
  ) => Promise<ConversationSourceImagePreviewHandle | null>
  acquireGeneratedImagePreview: (
    image: ImageItem,
    options?: ConversationSourceImagePreviewRequest,
  ) => Promise<ConversationSourceImagePreviewHandle | null>
  resolveSourceImagePreview: (
    assetKey: string,
    options?: ConversationSourceImagePreviewRequest,
  ) => Promise<ConversationSourceImagePreview | null>
  resolveImagePreviewSource: (
    source: ImagePreviewSource,
    options?: ConversationSourceImagePreviewRequest,
  ) => Promise<ConversationSourceImagePreview | null>
  resolveGeneratedImagePreview: (
    image: ImageItem,
    options?: ConversationSourceImagePreviewRequest,
  ) => Promise<ConversationSourceImagePreview | null>
  peekPreviewStats: () => ConversationSourceImagePreviewDebugStats
  getDebugStats: () => ConversationSourceImagePreviewDebugStats
}

interface PreviewCacheEntry {
  src: string
  refs: number
  lastAccessedAt: number
}

interface ConversationSourceImagePreviewServiceInput {
  getImageBlobFn?: typeof conversationAssetStorePort.getImageBlob
  maxActivePreviews?: number
}

const TRACE_FILE = 'src/features/conversation/application/conversationSourceImagePreviewService.ts'
const TRACE_MODULE = 'conversationSourceImagePreviewService'
const DEFAULT_MAX_ACTIVE_PREVIEWS = 24

export function createConversationSourceImagePreviewService(
  input?: ConversationSourceImagePreviewServiceInput,
): ConversationSourceImagePreviewService {
  const getImageBlobFn = input?.getImageBlobFn ?? conversationAssetStorePort.getImageBlob
  const maxActivePreviews = Math.max(1, Math.floor(input?.maxActivePreviews ?? DEFAULT_MAX_ACTIVE_PREVIEWS))
  const cache = new Map<string, PreviewCacheEntry>()
  const inflight = new Map<string, Promise<ConversationSourceImagePreviewHandle | null>>()
  let createdObjectUrls = 0
  let revokedObjectUrls = 0
  let blockedByBudgetCount = 0

  const asPreview = (handle: ConversationSourceImagePreviewHandle | null): ConversationSourceImagePreview | null => {
    if (!handle) {
      return null
    }
    return {
      src: handle.src,
      cleanup: handle.release,
    }
  }

  const getStats = (): ConversationSourceImagePreviewDebugStats => {
    let totalRefs = 0
    cache.forEach((entry) => {
      totalRefs += entry.refs
    })

    return {
      cacheSize: cache.size,
      cacheCount: cache.size,
      totalRefs,
      inflightCount: inflight.size,
      createdObjectUrls,
      revokedObjectUrls,
      activeObjectUrls: createdObjectUrls - revokedObjectUrls,
      activeCount: cache.size,
      blockedByBudgetCount,
      maxActivePreviews,
    }
  }

  const releasePreview = (assetKey: string) => {
    const cached = cache.get(assetKey)
    if (!cached) {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'releasePreview',
        stage: 'object_url_release_skipped_missing_cache',
        level: 'warn',
        traceId: assetKey,
        detail: {
          assetKey: summarizeString(assetKey),
          cacheSize: cache.size,
        },
      })
      return
    }

    cached.refs = Math.max(0, cached.refs - 1)
    cached.lastAccessedAt = Date.now()
    if (cached.refs > 0) {
      return
    }

    revokedObjectUrls += 1
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'releasePreview',
      stage: 'object_url_revoked',
      traceId: assetKey,
      detail: {
        assetKey: summarizeString(assetKey),
        objectUrl: summarizeImagePayload(cached.src),
      },
    })
    URL.revokeObjectURL(cached.src)
    cache.delete(assetKey)
  }

  const toHandle = (assetKey: string, src: string, kind: 'direct' | 'idb-blob'): ConversationSourceImagePreviewHandle => ({
    src,
    kind,
    release: () => releasePreview(assetKey),
    cleanup: () => releasePreview(assetKey),
  })

  const acquireCachedPreview = (assetKey: string): ConversationSourceImagePreviewHandle | null => {
    const current = cache.get(assetKey)
    if (!current) {
      return null
    }

    current.refs += 1
    current.lastAccessedAt = Date.now()
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'acquireCachedPreview',
      stage: 'preview_cache_hit',
      traceId: assetKey,
      detail: {
        assetKey: summarizeString(assetKey),
        refs: current.refs,
        objectUrl: summarizeImagePayload(current.src),
        cacheSize: cache.size,
      },
    })
    return toHandle(assetKey, current.src, 'idb-blob')
  }

  const tryReserveBudget = (assetKey: string, priority: 'visible' | 'modal') => {
    if (priority === 'modal' || cache.has(assetKey) || cache.size < maxActivePreviews) {
      return true
    }

    blockedByBudgetCount += 1
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'tryReserveBudget',
      stage: 'preview_budget_blocked',
      level: 'warn',
      traceId: assetKey,
      detail: {
        assetKey: summarizeString(assetKey),
        cacheSize: cache.size,
        maxActivePreviews,
      },
    })
    return false
  }

  const insertPreview = (assetKey: string, src: string): ConversationSourceImagePreviewHandle => {
    cache.set(assetKey, {
      src,
      refs: 1,
      lastAccessedAt: Date.now(),
    })
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'insertPreview',
      stage: 'preview_cache_inserted',
      traceId: assetKey,
      detail: {
        assetKey: summarizeString(assetKey),
        refs: 1,
        objectUrl: summarizeImagePayload(src),
        cacheSize: cache.size,
      },
    })
    return toHandle(assetKey, src, 'idb-blob')
  }

  const acquireSourceImagePreview = async (
    assetKey: string,
    options?: ConversationSourceImagePreviewRequest,
  ): Promise<ConversationSourceImagePreviewHandle | null> => {
    const normalizedAssetKey = assetKey.trim()
    const priority = options?.priority ?? 'visible'
    if (!normalizedAssetKey) {
      return null
    }

    const cachedHandle = acquireCachedPreview(normalizedAssetKey)
    if (cachedHandle) {
      return cachedHandle
    }

    if (!tryReserveBudget(normalizedAssetKey, priority)) {
      return null
    }

    const existing = inflight.get(normalizedAssetKey)
    if (existing) {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'acquireSourceImagePreview',
        stage: 'preview_resolve_inflight_reused',
        traceId: normalizedAssetKey,
        detail: {
          assetKey: summarizeString(normalizedAssetKey),
          inflightSize: inflight.size,
        },
      })
      const preview = await existing
      return preview ? acquireCachedPreview(normalizedAssetKey) ?? preview : null
    }

    const task = (async () => {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'acquireSourceImagePreview',
        stage: 'preview_resolve_idb_fetch_started',
        traceId: normalizedAssetKey,
        detail: {
          assetKey: summarizeString(normalizedAssetKey),
          priority,
        },
      })
      const blob = await getImageBlobFn(normalizedAssetKey)
      if (!blob) {
        emitImageChainTrace({
          file: TRACE_FILE,
          module: TRACE_MODULE,
          fn: 'acquireSourceImagePreview',
          stage: 'preview_resolve_idb_fetch_miss',
          level: 'warn',
          traceId: normalizedAssetKey,
          detail: {
            assetKey: summarizeString(normalizedAssetKey),
          },
        })
        return null
      }

      const src = URL.createObjectURL(blob)
      createdObjectUrls += 1
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'acquireSourceImagePreview',
        stage: 'object_url_created',
        traceId: normalizedAssetKey,
        detail: {
          assetKey: summarizeString(normalizedAssetKey),
          blob: summarizeBlob(blob),
          objectUrl: summarizeImagePayload(src),
          priority,
        },
      })
      return insertPreview(normalizedAssetKey, src)
    })()

    inflight.set(normalizedAssetKey, task)
    try {
      return await task
    } finally {
      inflight.delete(normalizedAssetKey)
    }
  }

  const acquirePreview = async (
    source: ImagePreviewSource,
    options?: ConversationSourceImagePreviewRequest,
  ): Promise<ConversationSourceImagePreviewHandle | null> => {
    const directSrc = source.src?.trim()
      || (source.refKind === 'url' ? source.refKey?.trim() : '')
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'acquirePreview',
      stage: 'preview_source_received',
      traceId: source.refKey ?? directSrc ?? undefined,
      detail: {
        source: summarizeImagePreviewSource(source),
        priority: options?.priority ?? 'visible',
      },
    })

    if (directSrc) {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'acquirePreview',
        stage: 'preview_source_direct',
        traceId: source.refKey ?? directSrc,
        detail: {
          src: summarizeImagePayload(directSrc),
        },
      })
      return {
        src: directSrc,
        kind: 'direct',
        release: () => {},
        cleanup: () => {},
      }
    }

    if (source.refKind === 'idb-blob' && source.refKey?.trim()) {
      return acquireSourceImagePreview(source.refKey, options)
    }

    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'acquirePreview',
      stage: 'preview_source_unresolvable',
      level: 'warn',
      traceId: source.refKey ?? undefined,
      detail: {
        source: summarizeImagePreviewSource(source),
      },
    })
    return null
  }

  return {
    acquirePreview,
    async prefetchPreview(source: ImagePreviewSource, options?: ConversationSourceImagePreviewRequest) {
      const preview = await acquirePreview(source, options)
      if (!preview) {
        return null
      }

      return {
        cleanup: preview.release,
      }
    },
    acquireSourceImagePreview,
    acquireGeneratedImagePreview(image: ImageItem, options?: ConversationSourceImagePreviewRequest) {
      return acquirePreview(toImagePreviewSource(image), options)
    },
    async resolveSourceImagePreview(assetKey: string, options?: ConversationSourceImagePreviewRequest) {
      return asPreview(await acquireSourceImagePreview(assetKey, options))
    },
    async resolveImagePreviewSource(source: ImagePreviewSource, options?: ConversationSourceImagePreviewRequest) {
      return asPreview(await acquirePreview(source, options))
    },
    async resolveGeneratedImagePreview(image: ImageItem, options?: ConversationSourceImagePreviewRequest) {
      return asPreview(await acquirePreview(toImagePreviewSource(image), options))
    },
    peekPreviewStats: getStats,
    getDebugStats: getStats,
  }
}
