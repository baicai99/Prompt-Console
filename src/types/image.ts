export type ImageStatus = 'pending' | 'success' | 'failed'
export type ImageThreadState = 'active' | 'detached' | 'settled'
export type ImageRefKind = 'url' | 'idb-blob' | 'inline'
export type ImageResumeTransport = 'stream' | 'polling'
export type FailureCode =
  | 'timeout'
  | 'auth'
  | 'insufficient_balance'
  | 'rate_limit'
  | 'unsupported_param'
  | 'rejected'
  | 'request_failed'
  | 'queue_failed'
  | 'result_invalid'
  | 'cancelled'
  | 'generation_failed'
  | 'unknown'

export interface RunSourceImageRef {
  id: string
  assetKey: string
  fileName: string
  mimeType: string
  size: number
}

export interface ImageItem {
  id: string
  seq: number
  status: ImageStatus
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  pendingStartedAt?: string
  providerTaskStatus?: string
  requestUrl?: string
  threadState?: ImageThreadState
  resumeTransport?: ImageResumeTransport
  fileRef?: string
  thumbRef?: string
  fullRef?: string
  refKind?: ImageRefKind
  refKey?: string
  serverTaskId?: string
  serverTaskMeta?: Record<string, string>
  width?: number
  height?: number
  bytes?: number
  error?: string
  errorCode?: FailureCode
  detachedAt?: string
  lastResumeAttemptAt?: string
}

export interface ImagePreviewSource {
  src?: string
  refKind?: ImageRefKind
  refKey?: string
}

export interface PreviewImage extends ImagePreviewSource {
  runId?: string
  id: string
  seq: number
}
