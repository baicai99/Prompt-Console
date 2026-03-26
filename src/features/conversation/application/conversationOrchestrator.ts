import type {
  Conversation,
  ImageTask,
  Run,
  SettingPrimitive,
} from '../../../types/conversation'
import type { FailureCode, ImageRefKind, ImageResumeTransport, ImageThreadState, RunSourceImageRef } from '../../../types/image'
import type { ModelCatalog } from '../../../types/model'
import type { ProviderRequestRunner } from '../../../types/provider'
import type { CreateRunInput } from './runExecutor'
import { buildReplayPlan, buildRetryPlan, planRunBatch } from '../domain/runPlanning'
import { conversationSelectors, type ConversationState } from '../state/conversationState'
import { executeImageTaskPool } from './globalImageTaskExecutor'

export interface ConversationOrchestratorDeps {
  createRun: (input: CreateRunInput) => Promise<Run>
}

export interface RunImageProgress {
  runId: string
  seq: number
  status: 'pending' | 'success' | 'failed'
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  requestUrl?: string
  providerTaskStatus?: string
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

export interface TaskStateProgress {
  taskId: string
  runId: string
  seq: number
  state: 'queued' | 'running' | 'retry_waiting' | 'polling' | 'succeeded' | 'failed' | 'timeout' | 'cancelled'
  reason?: string
}

export function createConversationOrchestrator(deps: ConversationOrchestratorDeps) {
  return {
    planSendDraft(state: ConversationState, input: {
      mode: Conversation['sideMode']
      sideCount: number
      settingsBySide: Conversation['settingsBySide']
      modelCatalog: ModelCatalog
      sourceImages?: RunSourceImageRef[]
    }) {
      const composer = conversationSelectors.selectComposerState(state)
      const settings = conversationSelectors.selectSettingsState(state)
      return planRunBatch({
        draft: composer.draft,
        panelVariables: composer.panelVariables,
        panelValueFormat: composer.panelValueFormat,
        dynamicPromptEnabled: composer.dynamicPromptEnabled,
        mode: input.mode,
        sideCount: input.sideCount,
        settingsBySide: input.settingsBySide,
        channels: settings.channels,
        modelCatalog: input.modelCatalog,
        sourceImages: input.sourceImages,
      })
    },

    async executeRunPlans(runPlans: Array<{
      batchId: string
      sideMode: Conversation['sideMode']
      side: string
      settings: CreateRunInput['settings']
      templatePrompt: string
      finalPrompt: string
      variablesSnapshot: Record<string, string>
      modelId: string
      modelName: string
      paramsSnapshot: Record<string, SettingPrimitive>
      sourceImages?: RunSourceImageRef[]
      channel: CreateRunInput['channel']
      pendingRunId: string
      pendingCreatedAt: string
      pendingRun: Run
      runtimeSettings?: CreateRunInput['runtimeSettings']
      signal?: AbortSignal
    }>,
    imageTasks: ImageTask[],
    concurrency = runPlans.length,
    hooks?: {
      onTaskProgress?: (progress: RunImageProgress & { taskId: string; completedAt?: string }) => void
      onTaskStateChange?: (progress: TaskStateProgress) => void
      onRunSettled?: (run: Run) => void
    },
    submitRequestRunner?: ProviderRequestRunner): Promise<Run[]> {
      return executeImageTaskPool({
        createRun: deps.createRun,
        runPlans,
        imageTasks,
        requestedConcurrency: concurrency,
        hooks: {
          onTaskProgress: hooks?.onTaskProgress,
          onTaskStateChange: hooks?.onTaskStateChange,
          onRunSettled: hooks?.onRunSettled,
        },
        submitRequestRunner,
      })
    },

    planRetry(conversation: Conversation | null, runId: string, input: {
      channels: ConversationState['channels']
      modelCatalog: ModelCatalog
    }) {
      return buildRetryPlan({
        activeConversation: conversation,
        runId,
        channels: input.channels,
        modelCatalog: input.modelCatalog,
      })
    },

    planReplay(conversation: Conversation | null, runId: string, input: {
      channels: ConversationState['channels']
      modelCatalog: ModelCatalog
    }) {
      return buildReplayPlan({
        activeConversation: conversation,
        runId,
        channels: input.channels,
        modelCatalog: input.modelCatalog,
      })
    },

    executeRetry(options: {
      batchId: string
      sideMode: Conversation['sideMode']
      side: string
      settings: CreateRunInput['settings']
      templatePrompt: string
      finalPrompt: string
      variablesSnapshot: Record<string, string>
      modelId: string
      modelName: string
      paramsSnapshot: Record<string, SettingPrimitive>
      sourceImages?: RunSourceImageRef[]
      channel: CreateRunInput['channel']
      retryOfRunId: string
      retryAttempt: number
      runId?: string
      createdAt?: string
      runtimeSettings?: CreateRunInput['runtimeSettings']
      runWithRequestLimit?: ProviderRequestRunner
      signal?: AbortSignal
      onImageProgress?: (progress: RunImageProgress) => void
    }) {
      return deps.createRun({
        batchId: options.batchId,
        sideMode: options.sideMode,
        side: options.side,
        settings: options.settings,
        templatePrompt: options.templatePrompt,
        finalPrompt: options.finalPrompt,
        variablesSnapshot: options.variablesSnapshot,
        modelId: options.modelId,
        modelName: options.modelName,
        paramsSnapshot: options.paramsSnapshot,
        sourceImages: options.sourceImages ?? [],
        channel: options.channel,
        retryOfRunId: options.retryOfRunId,
        retryAttempt: options.retryAttempt,
        runId: options.runId,
        createdAt: options.createdAt,
        runtimeSettings: options.runtimeSettings,
        runWithRequestLimit: options.runWithRequestLimit,
        signal: options.signal,
        onImageProgress: options.onImageProgress,
      })
    },

    executeReplay(options: {
      batchId: string
      sideMode: Conversation['sideMode']
      side: string
      settings: CreateRunInput['settings']
      templatePrompt: string
      finalPrompt: string
      variablesSnapshot: Record<string, string>
      modelId: string
      modelName: string
      paramsSnapshot: Record<string, SettingPrimitive>
      sourceImages?: RunSourceImageRef[]
      channel: CreateRunInput['channel']
      runtimeSettings?: CreateRunInput['runtimeSettings']
      runWithRequestLimit?: ProviderRequestRunner
      signal?: AbortSignal
      onImageProgress?: (progress: RunImageProgress) => void
    }) {
      return deps.createRun({
        batchId: options.batchId,
        sideMode: options.sideMode,
        side: options.side,
        settings: options.settings,
        templatePrompt: options.templatePrompt,
        finalPrompt: options.finalPrompt,
        variablesSnapshot: options.variablesSnapshot,
        modelId: options.modelId,
        modelName: options.modelName,
        paramsSnapshot: options.paramsSnapshot,
        sourceImages: options.sourceImages ?? [],
        channel: options.channel,
        runtimeSettings: options.runtimeSettings,
        runWithRequestLimit: options.runWithRequestLimit,
        signal: options.signal,
        onImageProgress: options.onImageProgress,
      })
    },
  }
}
