import { useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { ConversationState } from '../../../state/conversationState'
import type { Conversation, ImageTask, Run } from '../../../../../types/conversation'
import { runNonReentrant } from '../../../../../utils/runNonReentrant'
import { conversationImageTaskRegistryPort } from '../../../application/ports/imageTaskRegistryPort'
import { conversationWindowLeasePort } from '../../../application/ports/windowLeasePort'
import { resolveRequestedRunConcurrency } from './runConcurrency'
import { createDetachConversationImageThreads } from './useResumeFlow/detachConversationImageThreads'
import { createResumePollingScheduler } from './useResumeFlow/scheduler'
import {
  BACKGROUND_RESUME_LEASE_KEY,
  BACKGROUND_RESUME_LEASE_TTL_MS,
} from './useResumeFlow/shared'
import {
  processBackgroundPendingTaskConversations,
  processPendingImageResumes,
  type ResumeTaskService,
  type UpdateRunImageInput,
} from './useResumeFlow/processing'

export {
  buildFairResumableImageQueue,
  processBackgroundPendingTaskConversations,
  processPendingImageResumes,
} from './useResumeFlow/processing'

const { loadImageTasks } = conversationImageTaskRegistryPort
const { acquireWindowLease, isWindowLeaseOwner, releaseWindowLease } = conversationWindowLeasePort

interface ResumeFlowDeps {
  stateActiveId: string | null
  activeConversationHasResumableWork: boolean
  stateRef: MutableRefObject<ConversationState>
  imageRuntimeSettings: ConversationState['imageRuntimeSettings']
  resolveAdaptiveRunConcurrency: (requested: number) => number
  resumePollTimerRef: MutableRefObject<number | null>
  backgroundResumePollTimerRef: MutableRefObject<number | null>
  resumePollInFlightRef: MutableRefObject<boolean>
  backgroundResumePollInFlightRef: MutableRefObject<boolean>
  backgroundPollOwnerIdRef: MutableRefObject<string>
  resumingImageIdsRef: MutableRefObject<Set<string>>
  taskResumeService: ResumeTaskService
  registerActiveRun: (conversationId: string, messageId: string, runId: string, controller: AbortController) => void
  unregisterActiveRun: (conversationId: string, runId: string) => void
  isRunStillActive: (conversationId: string, runId: string) => boolean
  isRunOwnedByMessage: (conversationId: string, runId: string, messageId: string) => boolean
  ensureConversationLoaded: (conversationId: string) => Promise<void>
  updateImageTaskInConversation: (conversationId: string, input: {
    taskId: string
    runId: string
    seq: number
    status?: ImageTask['status']
    requestUrl?: string
    threadState?: ImageTask['threadState']
    resumeTransport?: ImageTask['resumeTransport']
    fileRef?: string
    thumbRef?: string
    fullRef?: string
    refKind?: ImageTask['refKind']
    refKey?: ImageTask['refKey']
    serverTaskId?: ImageTask['serverTaskId']
    serverTaskMeta?: ImageTask['serverTaskMeta']
    bytes?: ImageTask['bytes']
    error?: ImageTask['error']
    errorCode?: ImageTask['errorCode']
    startedAt?: string
    completedAt?: string
  }) => void
  updateRunImageInConversation: (conversationId: string, input: UpdateRunImageInput) => void
  updateRunTaskStateInConversation: (
    conversationId: string,
    input: {
      runId: string
      status: NonNullable<Run['taskState']>['status']
      reason?: string
    },
  ) => void
  replaceRuntimeTasksForConversation: (conversationId: string, tasksById: Record<string, ImageTask>) => void
  persistConversation: (conversation: Conversation) => void
  flushPendingPersistence: () => Promise<void>
}

export function useResumeFlow(deps: ResumeFlowDeps) {
  const {
    stateActiveId,
    activeConversationHasResumableWork,
    stateRef,
    imageRuntimeSettings,
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
    persistConversation,
    flushPendingPersistence,
  } = deps

  const detachConversationImageThreads = createDetachConversationImageThreads({
    stateRef,
    replaceRuntimeTasksForConversation,
    persistConversation,
  })

  const resumePendingImagesForConversation = async (conversationId: string) => {
    const snapshot = stateRef.current
    await processPendingImageResumes({
      conversationId,
      snapshot,
      requestedConcurrency: snapshot.runConcurrencyUnlimited
        ? resolveRequestedRunConcurrency({
            configured: snapshot.runConcurrency,
            unlimited: true,
          })
        : resolveAdaptiveRunConcurrency(snapshot.runConcurrency),
      resumeOwnerId: backgroundPollOwnerIdRef.current,
      resumingImageIdsRef,
      taskResumeService,
      registerActiveRun,
      unregisterActiveRun,
      isRunStillActive,
      isRunOwnedByMessage,
      updateImageTaskInConversation,
      updateRunImageInConversation,
      updateRunTaskStateInConversation,
    })
  }

  const pollBackgroundPendingTasks = async () => {
    await runNonReentrant(backgroundResumePollInFlightRef, async () => {
      const ownerId = backgroundPollOwnerIdRef.current
      const acquired = acquireWindowLease({
        leaseKey: BACKGROUND_RESUME_LEASE_KEY,
        ownerId,
        ttlMs: BACKGROUND_RESUME_LEASE_TTL_MS,
      })
      if (!acquired && !isWindowLeaseOwner({ leaseKey: BACKGROUND_RESUME_LEASE_KEY, ownerId })) {
        return
      }

      const registeredTasks = loadImageTasks()
      if (registeredTasks.length === 0) {
        stopBackgroundPolling()
        return
      }

      await processBackgroundPendingTaskConversations({
        conversationIds: registeredTasks.map((item: { conversationId: string }) => item.conversationId),
        ensureConversationLoaded,
        resumePendingImagesForConversation,
      })
    })
  }

  const pollActiveConversation = async (conversationId: string) => {
    await runNonReentrant(resumePollInFlightRef, async () => {
      await resumePendingImagesForConversation(conversationId)
    })
  }

  const {
    stopActivePolling,
    stopBackgroundPolling,
    scheduleNextActivePoll,
    scheduleNextBackgroundPoll,
  } = createResumePollingScheduler({
    stateRef,
    imageRuntimeSettings,
    activeConversationHasResumableWork,
    resumePollTimerRef,
    backgroundResumePollTimerRef,
    pollActiveConversation,
    pollBackgroundPendingTasks,
  })

  useEffect(() => {
    if (!stateActiveId || !activeConversationHasResumableWork) {
      stopActivePolling()
      return
    }

    void pollActiveConversation(stateActiveId)
      .finally(() => {
        scheduleNextActivePoll()
      })

    const handleVisible = () => {
      const activeId = stateRef.current.activeId
      if (!activeId) {
        return
      }
      void pollActiveConversation(activeId).finally(() => {
        scheduleNextActivePoll()
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleVisible()
        return
      }
      scheduleNextActivePoll()
    }

    const handlePageHide = () => {
      const activeId = stateRef.current.activeId
      if (!activeId) {
        return
      }
      detachConversationImageThreads(activeId)
      void flushPendingPersistence()
    }

    window.addEventListener('pageshow', handleVisible)
    window.addEventListener('focus', handleVisible)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopActivePolling()
      window.removeEventListener('pageshow', handleVisible)
      window.removeEventListener('focus', handleVisible)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [activeConversationHasResumableWork, imageRuntimeSettings, stateActiveId]) // eslint-disable-line react-hooks/exhaustive-deps -- event handlers intentionally read live refs/current state

  useEffect(() => {
    const ownerId = backgroundPollOwnerIdRef.current

    const handleVisibilityChange = () => {
      const scheduled = scheduleNextBackgroundPoll()
      if (document.visibilityState === 'visible' && scheduled) {
        void pollBackgroundPendingTasks().finally(() => {
          scheduleNextBackgroundPoll()
        })
      }
    }

    const handleVisible = () => {
      void pollBackgroundPendingTasks().finally(() => {
        scheduleNextBackgroundPoll()
      })
    }

    const handlePageHide = () => {
      stopBackgroundPolling()
      releaseWindowLease({
        leaseKey: BACKGROUND_RESUME_LEASE_KEY,
        ownerId,
      })
    }

    const scheduled = scheduleNextBackgroundPoll()
    if (scheduled) {
      void pollBackgroundPendingTasks().finally(() => {
        scheduleNextBackgroundPoll()
      })
    }
    window.addEventListener('pageshow', handleVisible)
    window.addEventListener('focus', handleVisible)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopBackgroundPolling()
      window.removeEventListener('pageshow', handleVisible)
      window.removeEventListener('focus', handleVisible)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      releaseWindowLease({
        leaseKey: BACKGROUND_RESUME_LEASE_KEY,
        ownerId,
      })
    }
  }, [imageRuntimeSettings]) // eslint-disable-line react-hooks/exhaustive-deps -- background lease/timer handlers intentionally resolve latest refs when invoked

  return {
    resumePendingImagesForConversation,
    detachConversationImageThreads,
  }
}
