import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  Conversation,
  ConversationSummary,
} from '../../../../types/conversation'
import { startMetric, trackDuration, trackMetrics } from '../../../performance/runtimeMetrics'
import { conversationImageTaskPort } from '../ports/imageTaskPort'
import { conversationModelCatalogPort } from '../ports/modelCatalogPort'
import type { ConversationRepository } from '../../infra/conversationRepository'
import type { ConversationAction, ConversationState } from '../../state/conversationState'
import { normalizeConversation } from '../../domain/settingsNormalization'
import { buildRunLocationIndex, collectPendingImageTasks, type RunLocation } from '../queries/conversationIndexes'
import {
  MAX_IN_MEMORY_CONVERSATIONS,
  MESSAGE_HISTORY_INITIAL_LIMIT,
  PROGRESS_PERSIST_DEBOUNCE_MS,
  sortConversationSummariesByLastMessageTime,
  upsertConversationState,
} from '../queries/conversationView'
import {
  compactConversationForWindow,
  getBrowserMemoryPressure,
  prepareConversationForPersistence,
  touchConversationCache,
} from './conversationMemory'
import { migrateConversationInlineImages } from './conversationInlineImageMigration'
import { filterActiveImageTasksRecord } from '../../domain/imageTaskMemory'

interface PersistenceCoordinatorDeps {
  stateRef: MutableRefObject<ConversationState>
  dispatch: Dispatch<ConversationAction>
  repository: ConversationRepository
  runExecutor: { releaseObjectUrls?: () => void }
  setHistoryVisibleLimit: Dispatch<SetStateAction<number>>
  getHistoryVisibleLimit: () => number
  resumePendingImagesForConversationRef: MutableRefObject<(conversationId: string) => Promise<void> | void>
  pendingPersistConversationIdsRef: MutableRefObject<Set<string>>
  persistTimerRef: MutableRefObject<number | null>
  conversationCacheOrderRef: MutableRefObject<string[]>
  runLocationByConversationRef: MutableRefObject<Record<string, Map<string, RunLocation>>>
}

export function createPersistenceCoordinator(deps: PersistenceCoordinatorDeps) {
  const {
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
  } = deps

  const rebuildRunLocationIndex = (conversation: Conversation) => {
    runLocationByConversationRef.current[conversation.id] = buildRunLocationIndex(conversation)
  }

  const syncTaskRegistryForConversation = (conversation: Conversation) => {
    conversationImageTaskPort.replaceConversation(conversation.id, collectPendingImageTasks(conversation))
  }

  const mergeRuntimeTasksIntoConversation = (conversation: Conversation): Conversation => ({
    ...conversation,
    tasksById: (() => {
      const activeTasks = filterActiveImageTasksRecord(
        stateRef.current.runtimeTasksByConversationId[conversation.id] ?? conversation.tasksById,
      )
      return Object.keys(activeTasks).length > 0 ? activeTasks : undefined
    })(),
  })

  const getMemoryPressure = (): number => {
    if (typeof performance === 'undefined') {
      return 0
    }
    return getBrowserMemoryPressure(performance as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } })
  }

  const applyMemoryProfile = (conversation: Conversation, options?: {
    isActive?: boolean
    hydratedMessageCount?: number
    pressure?: number
  }) => {
    const isActive = options?.isActive ?? conversation.id === stateRef.current.activeId
    const pressure = options?.pressure ?? getMemoryPressure()
    const hydrated = options?.hydratedMessageCount ?? getHistoryVisibleLimit()
    if (!isActive) {
      return compactConversationForWindow({
        conversation,
        hydratedMessageCount: Math.min(conversation.messages.length, getHistoryVisibleLimit()),
        pressure,
        runtimeSettings: stateRef.current.imageRuntimeSettings,
      })
    }
    return compactConversationForWindow({
      conversation,
      hydratedMessageCount: hydrated,
      pressure,
      runtimeSettings: stateRef.current.imageRuntimeSettings,
    })
  }

  const touchCache = (conversationId: string) => {
    conversationCacheOrderRef.current = touchConversationCache(
      conversationCacheOrderRef.current,
      conversationId,
      MAX_IN_MEMORY_CONVERSATIONS,
    )
  }

  const syncConversationContentOnly = (conversation: Conversation) => {
    const normalizedConversation = mergeRuntimeTasksIntoConversation(conversation)
    const nextContents = {
      ...stateRef.current.contents,
      [normalizedConversation.id]: normalizedConversation,
    }
    stateRef.current = {
      ...stateRef.current,
      contents: nextContents,
    }
    dispatch({ type: 'conversation/content-upsert', payload: normalizedConversation })
  }

  const syncContent = (conversation: Conversation, options?: { saveIndex?: boolean; skipSummaryUpdate?: boolean }) => {
    const snapshot = stateRef.current
    const next = upsertConversationState(
      snapshot.summaries,
      snapshot.contents,
      conversation,
      snapshot.activeId,
      conversationCacheOrderRef.current,
    )
    syncAndPersist(
      {
        summaries: next.nextSummaries,
        contents: next.nextContents,
      },
      options,
    )
  }

  const syncAndPersist = (
    next: { summaries: ConversationSummary[]; contents: Record<string, Conversation> },
    options?: { saveIndex?: boolean },
  ) => {
    const nextContents = Object.fromEntries(
      Object.entries(next.contents).map(([conversationId, conversation]) => [
        conversationId,
        mergeRuntimeTasksIntoConversation(conversation),
      ]),
    )
    const sortedSummaries = sortConversationSummariesByLastMessageTime(next.summaries, nextContents)
    const nextRuntimeTasksByConversationId = Object.fromEntries(
      Object.entries(nextContents).map(([conversationId, conversation]) => [
        conversationId,
        filterActiveImageTasksRecord({
          ...filterActiveImageTasksRecord(conversation.tasksById),
          ...filterActiveImageTasksRecord(stateRef.current.runtimeTasksByConversationId[conversationId]),
        }),
      ]),
    )
    stateRef.current = {
      ...stateRef.current,
      summaries: sortedSummaries,
      contents: nextContents,
      runtimeTasksByConversationId: nextRuntimeTasksByConversationId,
    }
    dispatch({ type: 'conversation/sync', payload: { summaries: sortedSummaries, contents: nextContents } })
    if (options?.saveIndex ?? true) {
      repository.saveIndex(sortedSummaries)
    }
  }

  const persistConversation = async (
    conversation: Conversation,
    options?: { saveStorage?: boolean; saveIndex?: boolean; skipSummaryUpdate?: boolean },
  ) => {
    syncTaskRegistryForConversation(conversation)
    rebuildRunLocationIndex(conversation)
    touchCache(conversation.id)
    const memoryManaged = applyMemoryProfile(conversation)
    if (options?.skipSummaryUpdate) {
      syncConversationContentOnly(memoryManaged)
    } else {
      syncContent(memoryManaged, { saveIndex: options?.saveIndex })
    }
    if (options?.saveStorage ?? true) {
      await repository.saveConversation(mergeRuntimeTasksIntoConversation(conversation))
    }
  }

  const flushPendingPersistence = async (): Promise<void> => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }

    const snapshot = stateRef.current
    if (pendingPersistConversationIdsRef.current.size === 0) {
      return
    }

    const start = startMetric()
    const pressure = getMemoryPressure()
    const pending: Conversation[] = []
    for (const conversationId of pendingPersistConversationIdsRef.current) {
      const conversation = snapshot.contents[conversationId]
      if (conversation) {
        const isActive = conversationId === snapshot.activeId
        pending.push(prepareConversationForPersistence({
          conversation: mergeRuntimeTasksIntoConversation(conversation),
          isActive,
          pressure,
          runtimeSettings: snapshot.imageRuntimeSettings,
        }))
      }
    }
    await Promise.all(pending.map((conversation) => repository.saveConversation(conversation)))
    pendingPersistConversationIdsRef.current.clear()
    repository.saveIndex(snapshot.summaries)
    trackDuration('persistence.flushBatch', start)
  }

  const scheduleConversationPersistence = (conversationId: string) => {
    pendingPersistConversationIdsRef.current.add(conversationId)
    if (persistTimerRef.current !== null) {
      return
    }

    persistTimerRef.current = window.setTimeout(() => {
      void flushPendingPersistence()
    }, PROGRESS_PERSIST_DEBOUNCE_MS)
  }

  const ensureConversationLoaded = async (conversationId: string): Promise<void> => {
    const snapshot = stateRef.current
    const existing = snapshot.contents[conversationId]
    if (existing) {
      touchCache(conversationId)
      void resumePendingImagesForConversationRef.current(conversationId)
      return
    }

    const fallbackTitle = snapshot.summaries.find((item) => item.id === conversationId)?.title ?? '未命名'
    const loaded = await repository.loadConversation(conversationId, fallbackTitle)
    if (!loaded) {
      return
    }

    const normalized = normalizeConversation(
      loaded,
      snapshot.channels,
      conversationModelCatalogPort.getModelCatalogFromChannels(snapshot.channels),
    )
    const migrated = await migrateConversationInlineImages(normalized)
    if (migrated.changed) {
      void repository.saveConversation(mergeRuntimeTasksIntoConversation(migrated.conversation))
    }
    const memoryManaged = applyMemoryProfile(migrated.conversation, {
      isActive: conversationId === snapshot.activeId,
    })
    syncTaskRegistryForConversation(migrated.conversation)
    rebuildRunLocationIndex(migrated.conversation)
    touchCache(conversationId)
    syncContent(memoryManaged, { saveIndex: false })
    await resumePendingImagesForConversationRef.current(conversationId)
  }

  const hydrateConversationHistory = async (
    conversationId: string,
    hydratedMessageCount: number,
  ): Promise<boolean> => {
    const snapshot = stateRef.current
    const fallbackTitle = snapshot.summaries.find((item) => item.id === conversationId)?.title ?? '未命名'
    const loaded = await repository.loadConversation(conversationId, fallbackTitle)
    if (!loaded) {
      return false
    }

    const normalized = normalizeConversation(
      loaded,
      snapshot.channels,
      conversationModelCatalogPort.getModelCatalogFromChannels(snapshot.channels),
    )
    const migrated = await migrateConversationInlineImages(normalized)
    if (migrated.changed) {
      void repository.saveConversation(mergeRuntimeTasksIntoConversation(migrated.conversation))
    }
    const memoryManaged = applyMemoryProfile(migrated.conversation, {
      isActive: conversationId === snapshot.activeId,
      hydratedMessageCount,
    })
    syncTaskRegistryForConversation(migrated.conversation)
    rebuildRunLocationIndex(migrated.conversation)
    touchCache(conversationId)
    syncContent(memoryManaged, { saveIndex: false })
    trackMetrics('conversation.historyHydration', {
      conversationId,
      totalMessages: migrated.conversation.messages.length,
      hydratedMessageCount: memoryManaged.memoryState?.hydratedMessageCount ?? migrated.conversation.messages.length,
      cachedConversationCount: Object.keys(snapshot.contents).length,
    })
    return true
  }

  const setActiveConversation = (conversationId: string | null) => {
    void flushPendingPersistence()
    runExecutor.releaseObjectUrls?.()
    setHistoryVisibleLimit(MESSAGE_HISTORY_INITIAL_LIMIT)
    stateRef.current = {
      ...stateRef.current,
      activeId: conversationId,
    }
    dispatch({ type: 'conversation/switch', payload: conversationId })
    repository.saveActiveId(conversationId)
    if (conversationId) {
      void ensureConversationLoaded(conversationId)
    }
  }

  return {
    syncAndPersist,
    persistConversation,
    flushPendingPersistence,
    scheduleConversationPersistence,
    ensureConversationLoaded,
    hydrateConversationHistory,
    setActiveConversation,
  }
}
