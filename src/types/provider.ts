import type { SettingPrimitive } from './primitives'

export type ProviderId = 'openai-compatible' | 'midjourney-proxy' | 'custom' | (string & {})

export type ProviderErrorCode =
  | 'auth'
  | 'browser_unsupported'
  | 'insufficient_balance'
  | 'rate_limit'
  | 'timeout'
  | 'unsupported_param'
  | 'rejected'
  | 'provider_unavailable'
  | 'unknown'

export interface ProviderCapabilities {
  endpointStyle: 'openai-compatible' | 'task-based'
  auth: 'bearer' | 'api-key'
  browserInvocation: 'supported' | 'requires-proxy'
  supportsModelDiscovery: boolean
  supportsTaskResume: boolean
  modelTag: string
  defaultImageParamSchema: Array<{
    key: string
    label: string
    type: 'number' | 'enum' | 'boolean'
    surface?: 'model' | 'shared-settings'
    default: SettingPrimitive
    min?: number
    max?: number
    options?: string[]
  }>
}

export interface ProviderError extends Error {
  code: ProviderErrorCode
  status?: number
  providerId: string
  retriable: boolean
  detail?: string
}

export interface ProviderChannel {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  providerId?: ProviderId
  models?: string[]
}

export interface ImageRequestTiming {
  traceId?: string
  requestedAt?: string
}

export interface NormalizedImageRequest {
  modelId: string
  prompt: string
  imageCount: number
  paramValues: Record<string, SettingPrimitive>
  sourceImages?: ProviderSourceImage[]
  signal?: AbortSignal
  timing?: ImageRequestTiming
}

export interface NormalizedTextMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface NormalizedTextRequest {
  modelId: string
  messages: NormalizedTextMessage[]
  temperature?: number
  topP?: number
  maxTokens?: number
  allowNonStreamFallback?: boolean
  signal?: AbortSignal
}

export interface ProviderSourceImage {
  blob: Blob
  fileName: string
  mimeType: string
}

export interface ProviderModelEntry {
  id: string
  metadata: Record<string, unknown> | null
}

export interface NormalizedImageTaskRegistration {
  seq: number
  requestUrl?: string
  providerTaskStatus?: string
  serverTaskId?: string
  serverTaskMeta?: Record<string, string>
}

export interface NormalizedImageItem {
  seq: number
  requestUrl?: string
  src?: string
  error?: string
  providerTaskStatus?: string
  serverTaskId?: string
  serverTaskMeta?: Record<string, string>
}

export interface NormalizedImageResult {
  items: NormalizedImageItem[]
}

export interface NormalizedResumeItem {
  state: 'pending' | 'success' | 'failed'
  src?: string
  error?: string
  providerTaskStatus?: string
  serverTaskId?: string
  serverTaskMeta?: Record<string, string>
}

export type ProviderRequestRunner = <T>(fn: () => Promise<T>) => Promise<T>

export type NormalizedResumeResult =
  | { state: 'success'; src: string; serverTaskId?: string; serverTaskMeta?: Record<string, string>; items?: NormalizedResumeItem[] }
  | { state: 'pending'; providerTaskStatus?: string; serverTaskId?: string; serverTaskMeta?: Record<string, string>; items?: NormalizedResumeItem[] }
  | { state: 'failed'; error?: string; providerTaskStatus?: string; serverTaskId?: string; serverTaskMeta?: Record<string, string>; items?: NormalizedResumeItem[] }

export type ImageTaskStreamEvent =
  | { state: 'pending'; providerTaskStatus?: string; serverTaskId?: string; serverTaskMeta?: Record<string, string> }
  | { state: 'success'; src: string; serverTaskId?: string; serverTaskMeta?: Record<string, string> }
  | { state: 'failed'; error?: string; providerTaskStatus?: string; serverTaskId?: string; serverTaskMeta?: Record<string, string> }

export interface StreamImageTaskResult {
  state: 'unsupported' | 'aborted' | 'completed'
}

export interface ProviderAdapter {
  id: ProviderId
  displayName: string
  capabilities: ProviderCapabilities
  discoverModels: (channel: Pick<ProviderChannel, 'baseUrl' | 'apiKey'>) => Promise<string[]>
  discoverModelEntries?: (channel: Pick<ProviderChannel, 'baseUrl' | 'apiKey'>) => Promise<ProviderModelEntry[]>
  generateImages: (input: {
    channel: ProviderChannel
    request: NormalizedImageRequest
    onTaskRegistered?: (item: NormalizedImageTaskRegistration) => void
    onImageCompleted?: (item: NormalizedImageItem) => void
    runWithRequestLimit?: ProviderRequestRunner
  }) => Promise<NormalizedImageResult>
  resumeImageTask: (input: {
    channel: ProviderChannel
    taskId?: string
    taskMeta?: Record<string, string>
    signal?: AbortSignal
    runWithRequestLimit?: ProviderRequestRunner
  }) => Promise<NormalizedResumeResult>
  streamImageTask?: (input: {
    channel: ProviderChannel
    taskId?: string
    taskMeta?: Record<string, string>
    signal?: AbortSignal
    onEvent: (event: ImageTaskStreamEvent) => void
  }) => Promise<StreamImageTaskResult>
  streamText: (input: {
    channel: ProviderChannel
    request: NormalizedTextRequest
    onDelta: (chunk: string) => void
    onDone?: () => void
    onError?: (error: ProviderError) => void
  }) => Promise<void>
  normalizeError: (error: unknown) => ProviderError
}
