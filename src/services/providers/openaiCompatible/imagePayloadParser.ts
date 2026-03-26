import {
  summarizeImagePayload,
} from '../../imageChainTrace'

export interface RawImageItem {
  url?: unknown
  image_url?: unknown
  imageUrl?: unknown
  b64_json?: unknown
  data?: unknown
  base64?: unknown
  output?: unknown
  output_url?: unknown
  outputUrl?: unknown
  id?: unknown
  task_id?: unknown
  taskId?: unknown
  job_id?: unknown
  jobId?: unknown
  request_id?: unknown
  requestId?: unknown
  status_url?: unknown
  statusUrl?: unknown
  poll_url?: unknown
  pollUrl?: unknown
  result_url?: unknown
  resultUrl?: unknown
}

export function summarizeRawImageCandidates(item: RawImageItem | Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!item || typeof item !== 'object') {
    return {
      present: false,
    }
  }

  const record = item as Record<string, unknown>
  const nestedOutput = record.output && typeof record.output === 'object'
    ? (record.output as Record<string, unknown>)
    : null

  return {
    present: true,
    url: summarizeImagePayload(record.url),
    image_url: summarizeImagePayload(record.image_url),
    imageUrl: summarizeImagePayload(record.imageUrl),
    output_url: summarizeImagePayload(record.output_url),
    outputUrl: summarizeImagePayload(record.outputUrl),
    b64_json: summarizeImagePayload(record.b64_json),
    data: summarizeImagePayload(record.data),
    base64: summarizeImagePayload(record.base64),
    output: nestedOutput
      ? {
          url: summarizeImagePayload(nestedOutput.url),
          image_url: summarizeImagePayload(nestedOutput.image_url),
          imageUrl: summarizeImagePayload(nestedOutput.imageUrl),
          b64_json: summarizeImagePayload(nestedOutput.b64_json),
          base64: summarizeImagePayload(nestedOutput.base64),
        }
      : null,
  }
}

export function toImageSrc(item: RawImageItem): string | null {
  function normalizeBase64Payload(value: string): string | null {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const compacted = trimmed.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compacted)) {
      return null
    }

    const remainder = compacted.length % 4
    if (remainder === 1) {
      return null
    }
    if (remainder > 1) {
      return `${compacted}${'='.repeat(4 - remainder)}`
    }
    return compacted
  }

  function toSource(candidate: unknown): string | null {
    if (typeof candidate !== 'string' || !candidate.trim()) {
      return null
    }
    const raw = candidate.trim()
    if (/^data:image\//i.test(raw)) {
      return raw
    }
    if (/^(https?:\/\/|blob:)/i.test(raw)) {
      return raw
    }
    const normalized = normalizeBase64Payload(raw)
    if (normalized) {
      return `data:image/png;base64,${normalized}`
    }
    return null
  }

  const nestedOutput = item.output && typeof item.output === 'object'
    ? (
        toSource((item.output as Record<string, unknown>).url)
        ?? toSource((item.output as Record<string, unknown>).image_url)
        ?? toSource((item.output as Record<string, unknown>).imageUrl)
        ?? toSource((item.output as Record<string, unknown>).b64_json)
        ?? toSource((item.output as Record<string, unknown>).base64)
      )
    : null

  return (
    toSource(item.url)
    ?? toSource(item.image_url)
    ?? toSource(item.imageUrl)
    ?? toSource(item.output_url)
    ?? toSource(item.outputUrl)
    ?? toSource(item.b64_json)
    ?? toSource(item.data)
    ?? toSource(item.base64)
    ?? nestedOutput
  )
}
