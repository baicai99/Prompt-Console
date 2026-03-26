import { useMemo } from 'react'
import { createConversationSettingsModule } from './engine/conversationSettings'
import { createConversationListCommands } from './engine/conversationListCommands'
import { createRunMutationModule } from './engine/runMutation'
import { useResumeFlow } from './engine/useResumeFlow'
import { createSendFlowModule } from './engine/sendFlow'
import { createDownloadFlow } from './engine/downloadFlow'
import { useConversationPersistence } from './engine/useConversationPersistence'
import { conversationHasActiveImageThreads } from '../../application/queries/conversationView'
import { createCancelMessageRunsHandler } from './useConversationOperations/cancelMessageRuns'
import { createLoadOlderMessagesHandler } from './useConversationOperations/loadOlderMessages'
import { createRunCompletionNotifier } from './useConversationOperations/runCompletionNotifier'
import type { ConversationOperationsDeps } from './useConversationOperations/types'

export function useConversationOperations(deps: ConversationOperationsDeps) {
  const {
    state,
    stateRef,
    dispatch,
    actions,
    repository,
    runExecutor,
    orchestrator,
    streamText,
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
  } = deps

  const {
    registerActiveRun,
    unregisterActiveRun,
    isRunStillActive,
    isRunOwnedByMessage,
    abortRuns,
    abortConversationRuns,
    abortAllRuns,
    resolveAdaptiveRunConcurrency,
    syncAndPersist,
    persistConversation,
    flushPendingPersistence,
    scheduleConversationPersistence,
    ensureConversationLoaded,
    hydrateConversationHistory,
    setActiveConversation,
    saveStagedSettings,
    upsertRuntimeTask,
    replaceRuntimeTasksForConversation,
  } = useConversationPersistence({
    state,
    stateRef,
    dispatch,
    repository,
    runExecutor,
    setHistoryVisibleLimit,
    getHistoryVisibleLimit: () => historyVisibleLimitRef.current,
    resumePendingImagesForConversationRef,
    pendingPersistConversationIdsRef,
    persistTimerRef,
    resumePollTimerRef,
    backgroundResumePollTimerRef,
    conversationCacheOrderRef,
    runLocationByConversationRef,
    activeRunControllersRef,
  })

  const notifyRunCompleted = useMemo(() => createRunCompletionNotifier({
      notifier,
      runCompletionSignatureRef,
      setActiveConversation,
      stateRef,
    }),
    [notifier, runCompletionSignatureRef, setActiveConversation, stateRef],
  )

  const conversationSettings = useMemo(
    () =>
      createConversationSettingsModule({
        state,
        stateRef,
        dispatch,
        actions,
        repository,
        modelCatalog,
        activeSideMode,
        activeSideCount,
        activeSides,
        activeSettingsBySide,
        isSideConfigLocked,
        saveStagedSettings,
        persistConversation,
        setActiveConversation,
        clearDraftSourceImages,
      }),
    [
      actions,
      activeSettingsBySide,
      activeSideCount,
      activeSideMode,
      activeSides,
      clearDraftSourceImages,
      dispatch,
      isSideConfigLocked,
      modelCatalog,
      persistConversation,
      repository,
      saveStagedSettings,
      setActiveConversation,
      state,
      stateRef,
    ],
  )

  const conversationListCommands = useMemo(
    () =>
      createConversationListCommands({
        stateRef,
        dispatch,
        repository,
        flushPendingPersistence,
        syncAndPersist,
        setActiveConversation,
        conversationCacheOrderRef,
        runLocationByConversationRef,
        runCompletionSignatureRef,
        abortConversationRuns,
        abortAllRuns,
      }),
    [abortAllRuns, abortConversationRuns, conversationCacheOrderRef, dispatch, flushPendingPersistence, repository, runCompletionSignatureRef, runLocationByConversationRef, setActiveConversation, stateRef, syncAndPersist],
  )

  const runMutation = useMemo(
    () =>
      createRunMutationModule({
        stateRef,
        runLocationByConversationRef,
        persistConversation,
        upsertRuntimeTask,
        replaceRuntimeTasksForConversation,
        scheduleConversationPersistence,
        notifyRunCompleted,
      }),
    [notifyRunCompleted, persistConversation, runLocationByConversationRef, scheduleConversationPersistence, stateRef, upsertRuntimeTask, replaceRuntimeTasksForConversation],
  )

  const {
    updateAssistantMessageContent,
    replaceRunsInConversation,
    appendRunsToMessage,
    updateRunImageInConversation,
    updateRunTaskStateInConversation,
    updateImageTaskInConversation,
    findRunInConversation,
    cancelMessageRunsInConversation,
  } = runMutation

  const cancelMessageRuns = useMemo(() => createCancelMessageRunsHandler({
      stateRef,
      abortRuns,
      cancelMessageRunsInConversation,
    }),
    [abortRuns, cancelMessageRunsInConversation, stateRef],
  )

  const activeConversationHasResumableWork = useMemo(() => {
    const activeConversation = state.activeId ? state.contents[state.activeId] : null
    if (!activeConversation) {
      return false
    }

    if (conversationHasActiveImageThreads(activeConversation)) {
      return true
    }

    const runtimeTasksById = state.runtimeTasksByConversationId[activeConversation.id] ?? activeConversation.tasksById ?? {}
    return Object.values(runtimeTasksById).some((task) => task.status === 'running' || task.status === 'polling')
  }, [state.activeId, state.contents, state.runtimeTasksByConversationId])

  const { resumePendingImagesForConversation } = useResumeFlow({
    stateActiveId: state.activeId,
    activeConversationHasResumableWork,
    stateRef,
    imageRuntimeSettings: state.imageRuntimeSettings,
    resolveAdaptiveRunConcurrency,
    resumePollTimerRef,
    backgroundResumePollTimerRef,
    resumePollInFlightRef,
    backgroundResumePollInFlightRef,
    backgroundPollOwnerIdRef,
    resumingImageIdsRef,
    taskResumeService,
    registerActiveRun,
    unregisterActiveRun,
    isRunStillActive,
    isRunOwnedByMessage,
    ensureConversationLoaded,
    updateImageTaskInConversation,
    updateRunImageInConversation,
    updateRunTaskStateInConversation,
    replaceRuntimeTasksForConversation,
    persistConversation: (conversation) => {
      persistConversation(conversation)
    },
    flushPendingPersistence,
  })
  resumePendingImagesForConversationRef.current = resumePendingImagesForConversation

  const sendFlow = useMemo(
    () =>
      createSendFlowModule({
        stateRef,
        modelCatalog,
        orchestrator,
        streamText,
        dispatch,
        actions,
        notifier,
        ensureConversationLoaded,
        persistConversation: (conversation) => {
          persistConversation(conversation)
        },
        setActiveConversation,
        setSendScrollTrigger,
        setSendScrollTargetMessageId,
        clearDraftSourceImages,
        draftSourceImagesRef,
        appendSourceImageFiles,
        persistDraftSourceImages,
        maxSourceImages,
        submitRequestRunner: globalSubmitRequestRunnerRef.current,
        applyModelShortcut: conversationSettings.applyModelShortcut,
        resolveAdaptiveRunConcurrency,
        registerActiveRun,
        unregisterActiveRun,
        isRunStillActive,
        updateImageTaskInConversation,
        updateRunImageInConversation,
        updateRunTaskStateInConversation,
        replaceRunsInConversation,
        appendRunsToMessage,
        findRunInConversation,
        replayingRunIdsRef,
        setReplayingRunIds,
        updateAssistantMessageContent,
      }),
    [
      actions,
      appendRunsToMessage,
      appendSourceImageFiles,
      clearDraftSourceImages,
      conversationSettings.applyModelShortcut,
      dispatch,
      draftSourceImagesRef,
      ensureConversationLoaded,
      findRunInConversation,
      isRunStillActive,
      maxSourceImages,
      modelCatalog,
      notifier,
      orchestrator,
      persistDraftSourceImages,
      persistConversation,
      registerActiveRun,
      replaceRunsInConversation,
      replayingRunIdsRef,
      resolveAdaptiveRunConcurrency,
      setActiveConversation,
      setReplayingRunIds,
      setSendScrollTrigger,
      setSendScrollTargetMessageId,
      stateRef,
      streamText,
      unregisterActiveRun,
      updateImageTaskInConversation,
      updateAssistantMessageContent,
      updateRunImageInConversation,
      updateRunTaskStateInConversation,
      globalSubmitRequestRunnerRef,
    ],
  )

  const downloadFlow = useMemo(
    () =>
      createDownloadFlow({
        getActiveConversation: () => {
          const snapshot = stateRef.current
          return snapshot.activeId ? snapshot.contents[snapshot.activeId] ?? null : null
        },
        findRunInConversation,
        downloadService,
      }),
    [downloadService, findRunInConversation, stateRef],
  )

  const loadOlderMessages = useMemo(() => createLoadOlderMessagesHandler({
      stateRef,
      historyVisibleLimitRef,
      ensureConversationLoaded,
      hydrateConversationHistory,
      setHistoryVisibleLimit,
      setIsLoadingOlderMessages,
    }),
    [ensureConversationLoaded, historyVisibleLimitRef, hydrateConversationHistory, setHistoryVisibleLimit, setIsLoadingOlderMessages, stateRef],
  )

  return {
    conversationSettings,
    conversationListCommands,
    sendFlow: {
      ...sendFlow,
      cancelMessageRuns,
    },
    downloadFlow,
    loadOlderMessages,
    flushPendingPersistence,
  }
}
