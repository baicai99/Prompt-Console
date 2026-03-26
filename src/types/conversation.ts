import type { SettingPrimitive } from './primitives'
import type {
  FailureCode,
  ImageItem,
  ImageRefKind,
  ImageResumeTransport,
  ImageThreadState,
  RunSourceImageRef,
} from './image'

export type { SettingPrimitive } from './primitives'

export type SideMode = 'single' | 'multi'
export type Side = string
export type ConversationTitleMode = 'default' | 'auto' | 'manual'
export type MessageRole = 'user' | 'assistant'
export type MessageActionType = 'select-model' | 'add-api'
export type LogDetailLevel = 'brief' | 'standard' | 'verbose'
export type LoggingFeatureKey =
  | 'imageGeneration'
  | 'textConversation'
  | 'multiWindow'
  | 'dynamicPrompt'
  | 'concurrencyPool'
  | 'polling'
  | 'stateTransition'
  | 'uiRender'
export type RunTaskStatus = 'waiting' | 'generating' | 'timeout' | 'completed' | 'failed' | 'cancelled'
export type RunAttemptSource = 'initial' | 'retry'
export type ImageTaskStatus =
  | 'queued'
  | 'submitting'
  | 'running'
  | 'retry_waiting'
  | 'polling'
  | 'succeeded'
  | 'failed'
  | 'timeout'
  | 'cancelled'

export interface MessageAction {
  id: string
  type: MessageActionType
  label: string
}

export interface SingleSideSettings {
  generationMode?: 'image' | 'text'
  resolution: string
  aspectRatio: string
  imageCount: number
  gridColumns: number
  sizeMode: 'preset' | 'custom'
  customWidth: number
  customHeight: number
  autoSave: boolean
  saveDirectory?: string
  channelId: string | null
  modelId: string
  textModelId?: string
  videoModelId?: string
  paramValues: Record<string, SettingPrimitive>
}

export interface ImageRuntimeSettings {
  resumePollStrategyMode: 'preset' | 'custom'
  resumePollPreset: 'fast' | 'balanced' | 'low_request'
  resumePollSchedule: Array<{
    elapsedSeconds: number
    intervalSeconds: number
  }>
  generationTimeoutMinutes: number
  showRequestMethodBadge: boolean
  maxActivePreviewHandles: number
  offscreenPreviewReleaseDelayMs: number
  recentMessageRetentionCount: number
  highPressureMessageRetentionCount: number
}

export interface LoggingSettings {
  enabled: boolean
  detailLevel: LogDetailLevel
  features: Record<LoggingFeatureKey, boolean>
}

export interface RunSettingsSnapshot {
  resolution: string
  aspectRatio: string
  imageCount: number
  gridColumns: number
  sizeMode: 'preset' | 'custom'
  customWidth: number
  customHeight: number
  autoSave: boolean
  saveDirectory?: string
}

export interface RunTaskState {
  status: RunTaskStatus
  updatedAt: string
  waitingStartedAt?: string
  generatingStartedAt?: string
  timedOutAt?: string
  completedAt?: string
  reason?: string
}

export interface RunAttempt {
  attemptId: string
  source: RunAttemptSource
  createdAt: string
  updatedAt: string
  status: RunTaskStatus
  startedAt?: string
  waitingStartedAt?: string
  generatingStartedAt?: string
  completedAt?: string
  timedOutAt?: string
  modelId: string
  modelName: string
  channelId: string | null
  channelName: string | null
}

export interface ImageTask {
  taskId: string
  runId: string
  batchId: string
  side: Side
  seq: number
  finalPrompt: string
  status: ImageTaskStatus
  createdAt: string
  queuedAt: string
  startedAt?: string
  completedAt?: string
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
  bytes?: number
  error?: string
  errorCode?: FailureCode
}

export interface LiveFeedItem {
  id: string
  taskId: string
  runId: string
  batchId: string
  side: Side
  seq: number
  finalPrompt: string
  status: Exclude<ImageTaskStatus, 'queued' | 'submitting' | 'running' | 'polling'>
  completedAt: string
  image: ImageItem
}

export interface Run {
  id: string
  batchId: string
  createdAt: string
  sideMode: SideMode
  side: Side
  prompt: string
  imageCount: number
  channelId: string | null
  channelName: string | null
  modelId: string
  modelName: string
  templatePrompt: string
  finalPrompt: string
  variablesSnapshot: Record<string, string>
  paramsSnapshot: Record<string, SettingPrimitive>
  settingsSnapshot: RunSettingsSnapshot
  sourceImages?: RunSourceImageRef[]
  retryOfRunId?: string
  retryAttempt: number
  attempts?: RunAttempt[]
  taskIds?: string[]
  taskState?: RunTaskState
  images: ImageItem[]
}

export interface Message {
  id: string
  createdAt: string
  displayCreatedAt?: string
  role: MessageRole
  content: string
  titleEligible?: boolean
  sourceImages?: RunSourceImageRef[]
  runs?: Run[]
  taskIds?: string[]
  liveFeed?: LiveFeedItem[]
  actions?: MessageAction[]
}

export interface ConversationMemoryState {
  isCompacted: boolean
  hydratedMessageCount: number
  totalMessageCount: number
}

export interface Conversation {
  id: string
  title: string
  titleMode: ConversationTitleMode
  pinnedAt?: string | null
  createdAt: string
  updatedAt: string
  sideMode: SideMode
  sideCount: number
  settingsBySide: Record<Side, SingleSideSettings>
  messages: Message[]
  tasksById?: Record<string, ImageTask>
  memoryState?: ConversationMemoryState
}

export interface ConversationSummary {
  id: string
  title: string
  pinnedAt?: string | null
  createdAt: string
  updatedAt: string
  lastMessagePreview: string
}
