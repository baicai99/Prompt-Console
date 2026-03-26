import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ConversationAction, ConversationState } from '../../../../state/conversationState'
import type { DraftSourceImageItem } from '../useDraftSourceImages'
import type {
  Conversation,
  ImageTask,
  MessageAction,
  Run,
  Side,
  SingleSideSettings,
} from '../../../../../../types/conversation'
import type { RunSourceImageRef } from '../../../../../../types/image'
import type { ModelCatalog } from '../../../../../../types/model'
import type { createConversationOrchestrator } from '../../../../application/conversationOrchestrator'
import type { ConversationProviderGatewayPort } from '../../../../application/ports/providerGatewayPort'

export interface SendFlowActions {
  setDraft: (value: string) => void
}

export interface SendFlowNotifier {
  info: (content: string) => void
  warning: (content: string) => void
  success: (content: string) => void
}

export interface AppendSourceImageResult {
  invalidNames: string[]
  droppedValidCount: number
}

export interface AppliedModelCommand {
  scope: 'temporary' | 'permanent'
  model: {
    id: string
    name: string
  }
  cleanedPrompt?: string
}

export interface ActiveConversationState {
  activeSideMode: Conversation['sideMode']
  activeSideCount: number
  activeSettingsBySide: Record<Side, SingleSideSettings>
}

export interface QueuedTaskProgress {
  taskId: string
  runId: string
  seq: number
  status: 'pending' | 'success' | 'failed'
  queuedAt?: string
  startedAt?: string
  requestUrl?: string
  providerTaskStatus?: Run['images'][number]['providerTaskStatus']
  threadState?: Run['images'][number]['threadState']
  fileRef?: string
  thumbRef?: string
  fullRef?: string
  refKind?: Run['images'][number]['refKind']
  refKey?: Run['images'][number]['refKey']
  serverTaskId?: Run['images'][number]['serverTaskId']
  serverTaskMeta?: Run['images'][number]['serverTaskMeta']
  bytes?: number
  error?: string
  errorCode?: Run['images'][number]['errorCode']
  completedAt?: string
}

export interface QueuedTaskState {
  taskId: string
  runId: string
  seq: number
  state: 'queued' | 'running' | 'retry_waiting' | 'polling' | 'succeeded' | 'failed' | 'timeout' | 'cancelled'
  reason?: string
}

export interface SendFlowDeps {
  stateRef: MutableRefObject<ConversationState>
  modelCatalog: ModelCatalog
  orchestrator: ReturnType<typeof createConversationOrchestrator>
  streamText: ConversationProviderGatewayPort['streamText']
  dispatch: Dispatch<ConversationAction>
  actions: SendFlowActions
  notifier: SendFlowNotifier
  ensureConversationLoaded: (conversationId: string) => Promise<void>
  persistConversation: (conversation: Conversation) => void
  setActiveConversation: (conversationId: string | null) => void
  setSendScrollTrigger: Dispatch<SetStateAction<number>>
  setSendScrollTargetMessageId: Dispatch<SetStateAction<string | null>>
  clearDraftSourceImages: () => void
  draftSourceImagesRef: MutableRefObject<DraftSourceImageItem[]>
  appendSourceImageFiles: (files: File[]) => AppendSourceImageResult
  persistDraftSourceImages: (sourceImages: DraftSourceImageItem[]) => Promise<RunSourceImageRef[]>
  maxSourceImages: number
  submitRequestRunner?: <T>(runner: () => Promise<T>) => Promise<T>
  applyModelShortcut: (modelId: string) => Record<Side, SingleSideSettings>
  resolveAdaptiveRunConcurrency: (requested: number) => number
  registerActiveRun: (conversationId: string, messageId: string, runId: string, controller: AbortController) => void
  unregisterActiveRun: (conversationId: string, runId: string) => void
  isRunStillActive: (conversationId: string, runId: string) => boolean
  updateRunImageInConversation: (
    conversationId: string,
    input: {
      runId: string
      seq: number
      status?: 'pending' | 'success' | 'failed'
      queuedAt?: string
      startedAt?: string
      completedAt?: string
      requestUrl?: string
      providerTaskStatus?: Run['images'][number]['providerTaskStatus']
      threadState?: Run['images'][number]['threadState']
      resumeTransport?: Run['images'][number]['resumeTransport']
      fileRef?: string
      thumbRef?: string
      fullRef?: string
      refKind?: Run['images'][number]['refKind']
      refKey?: Run['images'][number]['refKey']
      serverTaskId?: Run['images'][number]['serverTaskId']
      serverTaskMeta?: Run['images'][number]['serverTaskMeta']
      bytes?: number
      error?: string
      errorCode?: Run['images'][number]['errorCode']
      detachedAt?: string
      lastResumeAttemptAt?: string
    },
  ) => void
  updateImageTaskInConversation: (
    conversationId: string,
    input: {
      taskId: string
      runId: string
      seq: number
      status?: ImageTask['status']
      requestUrl?: string
      providerTaskStatus?: ImageTask['providerTaskStatus']
      threadState?: ImageTask['threadState']
      resumeTransport?: ImageTask['resumeTransport']
      fileRef?: ImageTask['fileRef']
      thumbRef?: ImageTask['thumbRef']
      fullRef?: ImageTask['fullRef']
      refKind?: ImageTask['refKind']
      refKey?: ImageTask['refKey']
      serverTaskId?: ImageTask['serverTaskId']
      serverTaskMeta?: ImageTask['serverTaskMeta']
      bytes?: ImageTask['bytes']
      error?: ImageTask['error']
      errorCode?: ImageTask['errorCode']
      startedAt?: string
      completedAt?: string
    },
  ) => void
  updateRunTaskStateInConversation: (
    conversationId: string,
    input: {
      runId: string
      status: NonNullable<Run['taskState']>['status']
      reason?: string
    },
  ) => void
  replaceRunsInConversation: (conversationId: string, nextRunsById: Map<string, Run>) => void
  appendRunsToMessage: (conversationId: string, messageId: string, runs: Run[]) => void
  updateAssistantMessageContent: (
    conversationId: string,
    messageId: string,
    content: string,
    options?: { immediateStorage?: boolean },
  ) => void
  findRunInConversation: (conversation: Conversation, runId: string) => Run | null
  replayingRunIdsRef: MutableRefObject<Set<string>>
  setReplayingRunIds: Dispatch<SetStateAction<string[]>>
}

export interface SendDraftHelpers {
  getLoadedActiveConversation: () => Promise<Conversation | null>
  shouldGenerateConversationTitle: (conversation: Conversation, titleEligible: boolean) => boolean
  maybeGenerateConversationTitle: (input: {
    conversationId: string
    titleSource: string
    shouldGenerateTitle: boolean
    preferredChannelId?: string | null
  }) => void
  appendConversationEntry: (
    conversation: Conversation,
    userContent: string,
    assistantContent: string,
    runs?: Run[],
    titleSource?: string,
    userSourceImages?: RunSourceImageRef[],
    assistantActions?: MessageAction[],
    options?: { titleEligible?: boolean; taskEntries?: ImageTask[] },
  ) => Conversation
}

export interface SendBlockedReason {
  kind: 'missing-model' | 'missing-api'
  assistantContent: string
  actions: MessageAction[]
}
