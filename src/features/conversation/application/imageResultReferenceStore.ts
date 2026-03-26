import type { ImageRefKind } from '../../../types/image'
import { conversationAssetStorePort } from './ports/assetStorePort'
import {
  emitImageChainTrace,
  summarizeBlob,
  summarizeImagePayload,
  summarizeString,
} from '../../../services/imageChainTrace'

export interface PersistedImageReference {
  fileRef?: string
  thumbRef?: string
  fullRef?: string
  refKind?: ImageRefKind
  refKey?: string
  bytes?: number
}

export interface ImageResultPersistenceMeta {
  traceId?: string
  seq?: number
}

interface ImageResultReferenceStoreInput {
  fetchFn?: typeof fetch
  putImageBlobFn?: typeof conversationAssetStorePort.putImageBlob
}

const TRACE_FILE = 'src/features/conversation/application/imageResultReferenceStore.ts'
const TRACE_MODULE = 'imageResultReferenceStore'

function estimateBase64Bytes(value: string): number {
  const base64 = value.replace(/^data:[^,]+,/, '')
  return Math.floor((base64.length * 3) / 4)
}

function makeAssetKey(): string {
  return `asset:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
}

function normalizeBase64Payload(payload: string, meta?: ImageResultPersistenceMeta): string | null {
  const trimmed = payload.trim()
  if (!trimmed) {
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'normalizeBase64Payload',
      stage: 'base64_payload_empty',
      level: 'warn',
      traceId: meta?.traceId,
      seq: meta?.seq,
      detail: {
        payload: summarizeString(payload),
      },
    })
    return null
  }

  const maybeDecoded = trimmed.includes('%')
    ? (() => {
        try {
          return decodeURIComponent(trimmed)
        } catch (error) {
          emitImageChainTrace({
            file: TRACE_FILE,
            module: TRACE_MODULE,
            fn: 'normalizeBase64Payload',
            stage: 'base64_decode_uri_failed',
            level: 'warn',
            traceId: meta?.traceId,
            seq: meta?.seq,
            error,
            detail: {
              payload: summarizeString(trimmed),
            },
          })
          return trimmed
        }
      })()
    : trimmed

  const compacted = maybeDecoded.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compacted)) {
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'normalizeBase64Payload',
      stage: 'base64_payload_invalid_charset',
      level: 'warn',
      traceId: meta?.traceId,
      seq: meta?.seq,
      detail: {
        payload: summarizeString(compacted),
      },
    })
    return null
  }

  const missingPadding = compacted.length % 4
  if (missingPadding === 1) {
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'normalizeBase64Payload',
      stage: 'base64_payload_invalid_padding',
      level: 'warn',
      traceId: meta?.traceId,
      seq: meta?.seq,
      detail: {
        payloadLength: compacted.length,
      },
    })
    return null
  }

  if (missingPadding > 1) {
    return `${compacted}${'='.repeat(4 - missingPadding)}`
  }

  return compacted
}

function dataUrlToBlob(value: string, meta?: ImageResultPersistenceMeta): Blob | null {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/i)
  if (!match) {
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'dataUrlToBlob',
      stage: 'data_url_parse_failed',
      level: 'warn',
      traceId: meta?.traceId,
      seq: meta?.seq,
      detail: {
        src: summarizeImagePayload(value),
      },
    })
    return null
  }

  const mime = match[1] || 'application/octet-stream'
  const isBase64 = Boolean(match[2])
  const payload = match[3] ?? ''
  if (isBase64) {
    const normalizedPayload = normalizeBase64Payload(payload, meta)
    if (!normalizedPayload) {
      return null
    }

    try {
      const binary = atob(normalizedPayload)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }
      const blob = new Blob([bytes], { type: mime })
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'dataUrlToBlob',
        stage: 'data_url_blob_created',
        traceId: meta?.traceId,
        seq: meta?.seq,
        detail: {
          mime,
          src: summarizeImagePayload(value),
          blob: summarizeBlob(blob),
        },
      })
      return blob
    } catch (error) {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'dataUrlToBlob',
        stage: 'data_url_blob_create_failed',
        level: 'error',
        traceId: meta?.traceId,
        seq: meta?.seq,
        error,
        detail: {
          mime,
          src: summarizeImagePayload(value),
        },
      })
      return null
    }
  }

  try {
    const blob = new Blob([decodeURIComponent(payload)], { type: mime })
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'dataUrlToBlob',
      stage: 'data_url_blob_created',
      traceId: meta?.traceId,
      seq: meta?.seq,
      detail: {
        mime,
        src: summarizeImagePayload(value),
        blob: summarizeBlob(blob),
      },
    })
    return blob
  } catch (error) {
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'dataUrlToBlob',
      stage: 'data_url_decode_failed',
      level: 'error',
      traceId: meta?.traceId,
      seq: meta?.seq,
      error,
      detail: {
        mime,
        src: summarizeImagePayload(value),
      },
    })
    return null
  }
}

export function isInlineImagePayload(value: string | undefined | null): boolean {
  return typeof value === 'string' && /^data:image\//i.test(value.trim())
}

export function createImageResultReferenceStore(input: ImageResultReferenceStoreInput = {}) {
  const fetchFn = input.fetchFn ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined)
  const putImageBlobFn = input.putImageBlobFn ?? conversationAssetStorePort.putImageBlob

  const persistBlob = async (
    src: string,
    blob: Blob,
    meta?: ImageResultPersistenceMeta,
  ): Promise<PersistedImageReference> => {
    const assetKey = makeAssetKey()
    await putImageBlobFn(assetKey, blob)
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'persistBlob',
      stage: 'image_blob_persisted_to_idb',
      traceId: meta?.traceId,
      seq: meta?.seq,
      detail: {
        src: summarizeImagePayload(src),
        blob: summarizeBlob(blob),
        assetKey: summarizeString(assetKey),
      },
    })

    return {
      refKind: 'idb-blob',
      refKey: assetKey,
      bytes: blob.size,
    }
  }

  const persistRemoteImage = async (
    src: string,
    meta?: ImageResultPersistenceMeta,
  ): Promise<PersistedImageReference> => {
    if (!fetchFn || !/^https?:\/\//i.test(src)) {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'persistRemoteImage',
        stage: 'remote_image_persist_skipped',
        level: 'warn',
        traceId: meta?.traceId,
        seq: meta?.seq,
        branch: !fetchFn ? 'missing_fetch' : 'non_http_src',
        detail: {
          src: summarizeImagePayload(src),
        },
      })
      return {
        thumbRef: src,
        fileRef: src,
        refKind: 'url',
        refKey: src,
      }
    }

    try {
      const response = await fetchFn(src)
      if (!response.ok) {
        emitImageChainTrace({
          file: TRACE_FILE,
          module: TRACE_MODULE,
          fn: 'persistRemoteImage',
          stage: 'remote_image_fetch_failed',
          level: 'warn',
          traceId: meta?.traceId,
          seq: meta?.seq,
          detail: {
            src: summarizeImagePayload(src),
            httpStatus: response.status,
          },
        })
        return {
          thumbRef: src,
          fileRef: src,
          refKind: 'url',
          refKey: src,
        }
      }

      const blob = await response.blob()
      if (blob.size === 0) {
        emitImageChainTrace({
          file: TRACE_FILE,
          module: TRACE_MODULE,
          fn: 'persistRemoteImage',
          stage: 'remote_image_blob_empty',
          level: 'warn',
          traceId: meta?.traceId,
          seq: meta?.seq,
          detail: {
            src: summarizeImagePayload(src),
            blob: summarizeBlob(blob),
          },
        })
        return {
          thumbRef: src,
          fileRef: src,
          refKind: 'url',
          refKey: src,
        }
      }

      return persistBlob(src, blob, meta)
    } catch (error) {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'persistRemoteImage',
        stage: 'remote_image_fetch_exception',
        level: 'error',
        traceId: meta?.traceId,
        seq: meta?.seq,
        error,
        detail: {
          src: summarizeImagePayload(src),
        },
      })
      return {
        thumbRef: src,
        fileRef: src,
        refKind: 'url',
        refKey: src,
      }
    }
  }

  const persistImageResultSource = async (
    src: string,
    meta?: ImageResultPersistenceMeta,
  ): Promise<PersistedImageReference> => {
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'persistImageResultSource',
      stage: 'image_src_received_for_persistence',
      traceId: meta?.traceId,
      seq: meta?.seq,
      detail: {
        src: summarizeImagePayload(src),
      },
    })

    if (!isInlineImagePayload(src)) {
      return persistRemoteImage(src, meta)
    }

    const blob = dataUrlToBlob(src, meta)
    if (!blob) {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'persistImageResultSource',
        stage: 'inline_image_fallback_used',
        level: 'warn',
        traceId: meta?.traceId,
        seq: meta?.seq,
        detail: {
          src: summarizeImagePayload(src),
          estimatedBytes: estimateBase64Bytes(src),
        },
      })
      return {
        thumbRef: src,
        fileRef: src,
        refKind: 'inline',
        bytes: estimateBase64Bytes(src),
      }
    }

    return persistBlob(src, blob, meta)
  }

  return {
    persistImageResultSource,
  }
}
