import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  ImageTask,
  ImageRuntimeSettings,
  Side,
  SideMode,
  SingleSideSettings,
} from '../../../../../types/conversation'
import { trackMetrics } from '../../../../performance/runtimeMetrics'
import type { PanelValueFormat, PanelVariableRow } from '../../../domain/types'
import type { ConversationRepository } from '../../../infra/conversationRepository'
import type { ConversationAction, ConversationState } from '../../../state/conversationState'
import type { RunLocation } from '../../../application/queries/conversationIndexes'
import { getBrowserMemoryPressure, resolveAdaptiveRunConcurrencyByPressure } from '../../../application/runtime/conversationMemory'
import { persistStagedSettings } from './stagedSettingsPersistence'
import { createActiveRunRegistry, type ActiveRunRegistration } from '../../../application/runtime/activeRunRegistry'
import { createPersistenceCoordinator } from '../../../application/runtime/persistenceCoordinator'
import { filterActiveImageTasksRecord, isActiveImageTask } from '../../../domain/imageTaskMemory'

interface SaveStagedSettingsInput {
  mode: SideMode
  sideCount: number
  settingsBySide: Record<Side, SingleSideSettings>
  overrides?: Partial<{
    runConcurrency: number
    runConcurrencyUnlimited: boolean
    dynamicPromptEnabled: boolean
    autoRenameConversationTitle: boolean
    autoRenameConversationTitleModelId: string | null
    panelValueFormat: PanelValueFormat
    panelVariables: PanelVariableRow[]
    favoriteModelIds: string[]
    imageRuntimeSettings: ImageRuntimeSettings
  }>
}

interface UseConversationPersistenceInput {
  state: ConversationState
  stateRef: MutableRefObject<ConversationState>
  dispatch: Dispatch<ConversationAction>
  repository: ConversationRepository
  runExecutor: { releaseObjectUrls?: () => void }
  setHistoryVisibleLimit: Dispatch<SetStateAction<number>>
  getHistoryVisibleLimit: () => number
  resumePendingImagesForConversationRef: MutableRefObject<(conversationId: string) => Promise<void> | void>
  pendingPersistConversationIdsRef: MutableRefObject<Set<string>>
  persistTimerRef: MutableRefObject<number | null>
  resumePollTimerRef: MutableRefObject<number | null>
  backgroundResumePollTimerRef: MutableRefObject<number | null>
  conversationCacheOrderRef: MutableRefObject<string[]>
  runLocationByConversationRef: MutableRefObject<Record<string, Map<string, RunLocation>>>
  activeRunControllersRef: MutableRefObject<Record<string, Map<string, ActiveRunRegistration>>>
}

export function useConversationPersistence(input: UseConversationPersistenceInput) {
  const {
    state,
    stateRef,
    dispatch,
    repository,
    runExecutor,
    setHistoryVisibleLimit,
    getHistoryVisibleLimit,
    resumePendingImagesForConversationRef,
    pendingPersistConversationIdsRef,
    persistTimerRef,
    resumePollTimerRef,
    backgroundResumePollTimerRef,
    conversationCacheOrderRef,
    runLocationByConversationRef,
    activeRunControllersRef,
  } = input

  const activeRunRegistry = createActiveRunRegistry(activeRunControllersRef)
  const {
    registerActiveRun,
    unregisterActiveRun,
    isRunStillActive,
    isRunOwnedByMessage,
    abortRun,
    abortRuns,
    abortMessageRuns,
    abortConversationRuns,
    abortAllRuns,
  } = activeRunRegistry

  const getMemoryPressure = (): number => {
    if (typeof performance === 'undefined') {
      return 0
    }
    return getBrowserMemoryPressure(performance as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } })
  }

  const resolveAdaptiveRunConcurrency = (requested: number): number => {
    return resolveAdaptiveRunConcurrencyByPressure(requested, getMemoryPressure())
  }

  const upsertRuntimeTask = (conversationId: string, task: ImageTask) => {
    const currentTasks = stateRef.current.runtimeTasksByConversationId[conversationId] ?? {}
    const nextTasks = filterActiveImageTasksRecord({
      ...currentTasks,
      [task.taskId]: task,
    })
    stateRef.current = {
      ...stateRef.current,
      runtimeTasksByConversationId: {
        ...stateRef.current.runtimeTasksByConversationId,
        [conversationId]: nextTasks,
      },
    }
    if (isActiveImageTask(task)) {
      dispatch({
        type: 'conversation/runtime-task-upsert',
        payload: {
          conversationId,
          task,
        },
      })
      return
    }

    dispatch({
      type: 'conversation/runtime-tasks-replace',
      payload: {
        conversationId,
        tasksById: nextTasks,
      },
    })
  }

  const replaceRuntimeTasksForConversation = (conversationId: string, tasksById: Record<string, ImageTask>) => {
    const nextTasksById = filterActiveImageTasksRecord(tasksById)
    stateRef.current = {
      ...stateRef.current,
      runtimeTasksByConversationId: {
        ...stateRef.current.runtimeTasksByConversationId,
        [conversationId]: nextTasksById,
      },
    }
    dispatch({
      type: 'conversation/runtime-tasks-replace',
      payload: {
        conversationId,
        tasksById: nextTasksById,
      },
    })
  }

  const persistenceCoordinator = createPersistenceCoordinator({
    stateRef,
    dispatch,
    repository,
    runExecutor,
    setHistoryVisibleLimit,
    getHistoryVisibleLimit,
    resumePendingImagesForConversationRef,
    pendingPersistConversationIdsRef,
    persistTimerRef,
    conversationCacheOrderRef,
    runLocationByConversationRef,
  })
  const {
    syncAndPersist,
    persistConversation,
    flushPendingPersistence,
    scheduleConversationPersistence,
    ensureConversationLoaded,
    hydrateConversationHistory,
    setActiveConversation,
  } = persistenceCoordinator

  const saveStagedSettings = (input: SaveStagedSettingsInput) => {
    persistStagedSettings({
      repository,
      sideMode: input.mode,
      sideCount: input.sideCount,
      settingsBySide: input.settingsBySide,
      snapshot: stateRef.current,
      overrides: input.overrides,
    })

    stateRef.current = {
      ...stateRef.current,
      stagedSideMode: input.mode,
      stagedSideCount: input.sideCount,
      stagedSettingsBySide: input.settingsBySide,
    }

    dispatch({
      type: 'settings/updateSide',
      payload: {
        sideMode: input.mode,
        sideCount: input.sideCount,
        settingsBySide: input.settingsBySide,
      },
    })
  }

  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
      if (resumePollTimerRef.current !== null) {
        window.clearInterval(resumePollTimerRef.current)
        resumePollTimerRef.current = null
      }
      if (backgroundResumePollTimerRef.current !== null) {
        window.clearInterval(backgroundResumePollTimerRef.current)
        backgroundResumePollTimerRef.current = null
      }
      activeRunRegistry.abortAllRuns()
      activeRunControllersRef.current = {}
      void flushPendingPersistence()
      runExecutor.releaseObjectUrls?.()
    }
  }, [runExecutor]) // eslint-disable-line react-hooks/exhaustive-deps -- unmount cleanup must read latest ref-backed timers/controllers

  useEffect(() => {
    if (state.summaries.length === 0) {
      return
    }
    void repository.migrateLegacyContent(state.summaries.map((item) => item.id))
  }, [repository, state.summaries])

  useEffect(() => {
    if (!state.activeId) {
      return
    }
    void ensureConversationLoaded(state.activeId)
  }, [state.activeId]) // eslint-disable-line react-hooks/exhaustive-deps -- trigger only on active conversation changes; loader resolves latest state via refs

  useEffect(() => {
    trackMetrics('conversation.cacheState', {
      cachedConversationCount: Object.keys(state.contents).length,
      summaryCount: state.summaries.length,
      activeMessageCount: state.activeId ? (state.contents[state.activeId]?.messages.length ?? 0) : 0,
    })
  }, [state.activeId, state.contents, state.summaries.length])

  return {
    registerActiveRun,
    unregisterActiveRun,
    isRunStillActive,
    isRunOwnedByMessage,
    abortRun,
    abortRuns,
    abortMessageRuns,
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
  }
}
