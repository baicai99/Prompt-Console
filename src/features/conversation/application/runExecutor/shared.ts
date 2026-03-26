import type { ImageRefKind, RunSourceImageRef } from '../../../../types/image'
import type { ProviderSourceImage } from '../../../../types/provider'
import { classifyFailure } from '../../domain/failureClassifier'

export const LOCAL_IMAGE_POST_PROCESSING_CONCURRENCY = 2
export const TRACE_FILE = 'src/features/conversation/application/runExecutor.ts'
export const TRACE_MODULE = 'runExecutor'

export interface RunTraceMeta {
  traceId?: string
  seq?: number
}

export interface ProcessedSuccessImage {
  status: 'success'
  threadState: 'settled'
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  requestUrl?: string
  providerTaskStatus?: string
  fileRef?: string
  thumbRef?: string
  fullRef?: string
  refKind?: ImageRefKind
  refKey?: string
  bytes?: number
  serverTaskId?: string
  serverTaskMeta?: Record<string, string>
}

export interface ProcessedFailedImage {
  status: 'failed'
  threadState: 'settled'
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  requestUrl?: string
  providerTaskStatus?: string
  error: string
  errorCode: ReturnType<typeof classifyFailure>
  serverTaskId?: string
  serverTaskMeta?: Record<string, string>
}

export interface ProcessedPendingImage {
  status: 'pending'
  threadState: 'active'
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  requestUrl?: string
  providerTaskStatus?: string
  serverTaskId?: string
  serverTaskMeta?: Record<string, string>
}

export type ProcessedImage = ProcessedSuccessImage | ProcessedFailedImage | ProcessedPendingImage

export interface LoadedProviderSourceImages {
  providerSourceImages: ProviderSourceImage[]
  missingSourceImageNames: string[]
}

export interface SourceImageLookupInput {
  sourceImages: RunSourceImageRef[]
  getImageBlobFn: (assetKey: string) => Promise<Blob | null | undefined>
  traceId: string
  runId: string
  batchId: string
}
