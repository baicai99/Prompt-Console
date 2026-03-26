import { useEffect, useMemo } from 'react'
import { makeId } from '../../../../utils/chat'
import { createConversationOrchestrator } from '../../application/conversationOrchestrator'
import { createRunExecutor } from '../../application/runExecutor'
import { useConversationState } from '../../state/conversationState'
import { useDraftSourceImages } from './engine/useDraftSourceImages'
import { createAntdConversationNotifier } from '../antdConversationNotifier'
import { createConversationDownloadService } from '../../application/conversationDownloadService'
import { createConversationTaskResumeService } from '../../application/conversationTaskResumeService'
import { conversationLoggingPort } from '../../application/ports/loggingPort'
import { sortConversationSummariesByLastMessageTime } from '../../application/queries/conversationView'
import { useConversationBootstrap } from './useConversationBootstrap'
import { useConversationOperations } from './useConversationOperations'
import { useConversationRuntime } from './useConversationRuntime'
import { resolveRequestedRunConcurrency } from './engine/runConcurrency'
import { conversationProviderGatewayPort } from '../../application/ports/providerGatewayPort'
import { useConversationReadModel } from './useConversationReadModel'
import { createConversationCommandFactory } from './useConversationCommandFactory'
export {
  buildMessageArchivePrefix,
  collectBatchDownloadImagesByRunId,
} from './engine/helpers'
export { sortConversationSummariesByLastMessageTime }
export type { PanelVariableRow } from './engine/helpers'

export function useConversationsEngine() {
  const { repository, initialState } = useConversationBootstrap()

  const { state, dispatch, actions } = useConversationState(initialState)
  const {
    stateRef,
    replayingRunIds,
    setReplayingRunIds,
    replayingRunIdsRef,
    historyVisibleLimit,
    setHistoryVisibleLimit,
    historyVisibleLimitRef,
    isLoadingOlderMessages,
    setIsLoadingOlderMessages,
    sendScrollTrigger,
    setSendScrollTrigger,
    sendScrollTargetMessageId,
    setSendScrollTargetMessageId,
    pendingPersistConversationIdsRef,
    persistTimerRef,
    resumePollTimerRef,
    backgroundResumePollTimerRef,
    resumePollInFlightRef,
    backgroundResumePollInFlightRef,
    backgroundPollOwnerIdRef,
    conversationCacheOrderRef,
    runLocationByConversationRef,
    activeRunControllersRef,
    resumingImageIdsRef,
    runCompletionSignatureRef,
    resumePendingImagesForConversationRef,
    globalSubmitSemaphoreRef,
    globalSubmitRequestRunnerRef,
    getDebugStats: getRuntimeDebugStats,
  } = useConversationRuntime(state)

  const {
    draftSourceImages,
    draftSourceImagesRef,
    appendSourceImageFiles,
    removeDraftSourceImage,
    clearDraftSourceImages,
    persistDraftSourceImages,
    maxSourceImages,
  } = useDraftSourceImages({
    makeId,
  })
  const {
    modelCatalog,
    activeSideMode,
    activeSideCount,
    activeSides,
    activeSettingsBySide,
    isSideConfigLocked,
    queries,
  } = useConversationReadModel({
    state,
    draftSourceImages,
    historyVisibleLimit,
    isLoadingOlderMessages,
    sendScrollTrigger,
    sendScrollTargetMessageId,
    replayingRunIds,
    getRuntimeDebugStats,
  })

  const notifier = useMemo(() => createAntdConversationNotifier(), [])
  const downloadService = useMemo(() => createConversationDownloadService(notifier), [notifier])
  const taskResumeService = useMemo(() => createConversationTaskResumeService(), [])

  useEffect(() => {
    globalSubmitSemaphoreRef.current.setMax(
      resolveRequestedRunConcurrency({
        configured: state.runConcurrency,
        unlimited: state.runConcurrencyUnlimited,
      }),
    )
  }, [globalSubmitSemaphoreRef, state.runConcurrency, state.runConcurrencyUnlimited])

  useEffect(() => {
    conversationLoggingPort.setLoggingSettingsForRuntime(state.loggingSettings)
  }, [state.loggingSettings])

  const runExecutor = useMemo(() => createRunExecutor(), [])
  const orchestrator = useMemo(() => createConversationOrchestrator({ createRun: runExecutor.createRun }), [runExecutor])
  const {
    conversationSettings,
    conversationListCommands,
    sendFlow,
    downloadFlow,
    loadOlderMessages,
    flushPendingPersistence,
  } = useConversationOperations({
    state,
    stateRef,
    dispatch,
    actions,
    repository,
    runExecutor,
    orchestrator,
    streamText: conversationProviderGatewayPort.streamText,
    notifier,
    downloadService,
    taskResumeService,
    modelCatalog,
    activeSideMode,
    activeSideCount,
    activeSides,
    activeSettingsBySide,
    isSideConfigLocked,
    clearDraftSourceImages,
    draftSourceImagesRef,
    appendSourceImageFiles,
    persistDraftSourceImages,
    maxSourceImages,
    replayingRunIdsRef,
    setReplayingRunIds,
    setHistoryVisibleLimit,
    historyVisibleLimitRef,
    setIsLoadingOlderMessages,
    setSendScrollTrigger,
    setSendScrollTargetMessageId,
    runLocationByConversationRef,
    resumePendingImagesForConversationRef,
    pendingPersistConversationIdsRef,
    persistTimerRef,
    resumePollTimerRef,
    backgroundResumePollTimerRef,
    resumePollInFlightRef,
    backgroundResumePollInFlightRef,
    backgroundPollOwnerIdRef,
    conversationCacheOrderRef,
    activeRunControllersRef,
    resumingImageIdsRef,
    runCompletionSignatureRef,
    globalSubmitRequestRunnerRef,
  })

  const { commands, maintenance } = createConversationCommandFactory({
    actions,
    removeDraftSourceImage,
    clearDraftSourceImages,
    conversationSettings,
    conversationListCommands,
    sendFlow,
    downloadFlow: {
      downloadAllRunImages: downloadFlow.downloadAllRunImages,
      downloadSingleRunImage: downloadFlow.downloadSingleRunImage,
      downloadBatchRunImages: downloadFlow.downloadBatchRunImages,
      downloadMessageRunImages: downloadFlow.downloadMessageRunImages,
    },
    loadOlderMessages,
    flushPendingPersistence,
  })

  return {
    queries,
    commands,
    maintenance,
  }
}
