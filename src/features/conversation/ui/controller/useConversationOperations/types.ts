import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ProviderRequestRunner } from '../../../../../types/provider'
import type { Run, Side } from '../../../../../types/conversation'
import type { ConversationAction, ConversationState } from '../../../state/conversationState'
import type { createConversationRepository } from '../../../infra/conversationRepository'
import type { createRunExecutor } from '../../../application/runExecutor'
import type { createConversationOrchestrator } from '../../../application/conversationOrchestrator'
import type { createAntdConversationNotifier } from '../../antdConversationNotifier'
import type { createConversationDownloadService } from '../../../application/conversationDownloadService'
import type { createConversationTaskResumeService } from '../../../application/conversationTaskResumeService'
import type { ConversationProviderGatewayPort } from '../../../application/ports/providerGatewayPort'
import type { DraftSourceImageItem } from '../engine/useDraftSourceImages'
import type { RunLocation } from '../../../application/queries/conversationIndexes'
import type { ActiveRunRegistration } from '../../../application/runtime/activeRunRegistry'

export interface ConversationOperationsDeps {
  state: ConversationState
  stateRef: MutableRefObject<ConversationState>
  dispatch: Dispatch<ConversationAction>
  actions: {
    setDraft: (value: string) => void
    setAdvancedVariables: (enabled: boolean) => void
    setDynamicPromptEnabled: (value: boolean) => void
    setAutoRenameConversationTitle: (value: boolean) => void
    setAutoRenameConversationTitleModelId: (value: string | null) => void
    setPanelValueFormat: (value: import('../../../domain/types').PanelValueFormat) => void
    setPanelVariables: (value: import('../../../domain/types').PanelVariableRow[]) => void
  }
  repository: ReturnType<typeof createConversationRepository>
  runExecutor: ReturnType<typeof createRunExecutor>
  orchestrator: ReturnType<typeof createConversationOrchestrator>
  streamText: ConversationProviderGatewayPort['streamText']
  notifier: ReturnType<typeof createAntdConversationNotifier>
  downloadService: ReturnType<typeof createConversationDownloadService>
  taskResumeService: ReturnType<typeof createConversationTaskResumeService>
  modelCatalog: ReturnType<typeof import('../../../application/ports/modelCatalogPort').conversationModelCatalogPort.getModelCatalogFromChannels>
  activeSideMode: ConversationState['stagedSideMode']
  activeSideCount: number
  activeSides: Side[]
  activeSettingsBySide: ReturnType<typeof import('../../../state/conversationState').conversationSelectors.selectActiveSettings>['activeSettingsBySide']
  isSideConfigLocked: boolean
  clearDraftSourceImages: () => void
  draftSourceImagesRef: MutableRefObject<DraftSourceImageItem[]>
  appendSourceImageFiles: (files: File[]) => { invalidNames: string[]; droppedValidCount: number }
  persistDraftSourceImages: (sourceImages: DraftSourceImageItem[]) => Promise<import('../../../../../types/image').RunSourceImageRef[]>
  maxSourceImages: number
  replayingRunIdsRef: MutableRefObject<Set<string>>
  setReplayingRunIds: Dispatch<SetStateAction<string[]>>
  setHistoryVisibleLimit: Dispatch<SetStateAction<number>>
  historyVisibleLimitRef: MutableRefObject<number>
  setIsLoadingOlderMessages: Dispatch<SetStateAction<boolean>>
  setSendScrollTrigger: Dispatch<SetStateAction<number>>
  setSendScrollTargetMessageId: Dispatch<SetStateAction<string | null>>
  runLocationByConversationRef: MutableRefObject<Record<string, Map<string, RunLocation>>>
  resumePendingImagesForConversationRef: MutableRefObject<(conversationId: string) => Promise<void> | void>
  pendingPersistConversationIdsRef: MutableRefObject<Set<string>>
  persistTimerRef: MutableRefObject<number | null>
  resumePollTimerRef: MutableRefObject<number | null>
  backgroundResumePollTimerRef: MutableRefObject<number | null>
  resumePollInFlightRef: MutableRefObject<boolean>
  backgroundResumePollInFlightRef: MutableRefObject<boolean>
  backgroundPollOwnerIdRef: MutableRefObject<string>
  conversationCacheOrderRef: MutableRefObject<string[]>
  activeRunControllersRef: MutableRefObject<Record<string, Map<string, ActiveRunRegistration>>>
  resumingImageIdsRef: MutableRefObject<Set<string>>
  runCompletionSignatureRef: MutableRefObject<Map<string, string>>
  globalSubmitRequestRunnerRef: MutableRefObject<ProviderRequestRunner>
}

export interface ConversationOperationsPersistence {
  registerActiveRun: (conversationId: string, messageId: string, runId: string, controller: AbortController) => void
  unregisterActiveRun: (conversationId: string, runId: string) => void
  isRunStillActive: (conversationId: string, runId: string) => boolean
  isRunOwnedByMessage: (conversationId: string, runId: string, messageId: string) => boolean
  abortRuns: (conversationId: string, runIds: string[]) => void
  abortConversationRuns: (conversationId: string) => void
  abortAllRuns: () => void
  resolveAdaptiveRunConcurrency: (requested: number) => number
  syncAndPersist: (conversation: import('../../../../../types/conversation').Conversation) => void
  persistConversation: (
    conversation: import('../../../../../types/conversation').Conversation,
    options?: { saveStorage?: boolean; saveIndex?: boolean; skipSummaryUpdate?: boolean },
  ) => void
  flushPendingPersistence: () => Promise<void>
  scheduleConversationPersistence: (conversationId: string) => void
  ensureConversationLoaded: (conversationId: string) => Promise<void>
  hydrateConversationHistory: (conversationId: string, nextLimit: number) => Promise<boolean>
  setActiveConversation: (conversationId: string) => void
  saveStagedSettings: (input: {
    mode: ConversationState['stagedSideMode']
    sideCount: number
    settingsBySide: ConversationState['stagedSettingsBySide']
    overrides?: Partial<{
      runConcurrency: number
      runConcurrencyUnlimited: boolean
      dynamicPromptEnabled: boolean
      autoRenameConversationTitle: boolean
      autoRenameConversationTitleModelId: string | null
      panelValueFormat: import('../../../domain/types').PanelValueFormat
      panelVariables: import('../../../domain/types').PanelVariableRow[]
      favoriteModelIds: string[]
      imageRuntimeSettings: ConversationState['imageRuntimeSettings']
    }>
  }) => void
  upsertRuntimeTask: (
    conversationId: string,
    task: import('../../../../../types/conversation').ImageTask,
  ) => void
  replaceRuntimeTasksForConversation: (
    conversationId: string,
    tasksById: Record<string, import('../../../../../types/conversation').ImageTask>,
  ) => void
}

export interface ConversationOperationsOutput {
  conversationSettings: ReturnType<typeof import('../engine/conversationSettings').createConversationSettingsModule>
  conversationListCommands: ReturnType<typeof import('../engine/conversationListCommands').createConversationListCommands>
  sendFlow: ReturnType<typeof import('../engine/sendFlow').createSendFlowModule> & {
    cancelMessageRuns: (conversationId: string, messageId: string, runIds: string[]) => Promise<void>
  }
  downloadFlow: ReturnType<typeof import('../engine/downloadFlow').createDownloadFlow>
  loadOlderMessages: () => Promise<void>
  flushPendingPersistence: () => Promise<void>
}

export interface RunCompletionNotificationInput {
  notifier: ReturnType<typeof createAntdConversationNotifier>
  runCompletionSignatureRef: MutableRefObject<Map<string, string>>
  setActiveConversation: (conversationId: string) => void
  stateRef: MutableRefObject<ConversationState>
}

export interface CancelMessageRunsHandlerInput {
  stateRef: MutableRefObject<ConversationState>
  abortRuns: (conversationId: string, runIds: string[]) => void
  cancelMessageRunsInConversation: (
    conversationId: string,
    messageId: string,
    runIds: string[],
    options?: { reason?: string },
  ) => void
}

export interface LoadOlderMessagesHandlerInput {
  stateRef: MutableRefObject<ConversationState>
  historyVisibleLimitRef: MutableRefObject<number>
  ensureConversationLoaded: (conversationId: string) => Promise<void>
  hydrateConversationHistory: (conversationId: string, nextLimit: number) => Promise<boolean>
  setHistoryVisibleLimit: Dispatch<SetStateAction<number>>
  setIsLoadingOlderMessages: Dispatch<SetStateAction<boolean>>
}

export interface RunCompletionNotifier {
  (conversationId: string, run: Run): void
}
