import type { MutableRefObject } from 'react'
import { conversationImageTaskRegistryPort } from '../../../../application/ports/imageTaskRegistryPort'
import type { ConversationState } from '../../../../state/conversationState'
import {
  getVisibilityState,
  resolveNextPollDelayMs,
  resolvePendingElapsedMsForConversation,
} from './shared'

const { loadImageTasks } = conversationImageTaskRegistryPort

interface CreateResumePollingSchedulerInput {
  stateRef: MutableRefObject<ConversationState>
  imageRuntimeSettings: ConversationState['imageRuntimeSettings']
  activeConversationHasResumableWork: boolean
  resumePollTimerRef: MutableRefObject<number | null>
  backgroundResumePollTimerRef: MutableRefObject<number | null>
  pollActiveConversation: (conversationId: string) => Promise<void>
  pollBackgroundPendingTasks: () => Promise<void>
}

export function createResumePollingScheduler(input: CreateResumePollingSchedulerInput) {
  const stopActivePolling = () => {
    if (input.resumePollTimerRef.current !== null) {
      window.clearTimeout(input.resumePollTimerRef.current)
      input.resumePollTimerRef.current = null
    }
  }

  const stopBackgroundPolling = () => {
    if (input.backgroundResumePollTimerRef.current !== null) {
      window.clearTimeout(input.backgroundResumePollTimerRef.current)
      input.backgroundResumePollTimerRef.current = null
    }
  }

  const scheduleNextActivePoll = () => {
    stopActivePolling()
    const activeId = input.stateRef.current.activeId
    if (!activeId || !input.activeConversationHasResumableWork) {
      return
    }
    const intervalMs = resolveNextPollDelayMs(
      input.imageRuntimeSettings,
      resolvePendingElapsedMsForConversation(input.stateRef, activeId),
    )
    input.resumePollTimerRef.current = window.setTimeout(() => {
      const latestActiveId = input.stateRef.current.activeId
      if (!latestActiveId) {
        stopActivePolling()
        return
      }
      if (getVisibilityState() === 'hidden') {
        scheduleNextActivePoll()
        return
      }
      void input.pollActiveConversation(latestActiveId).finally(() => {
        scheduleNextActivePoll()
      })
    }, intervalMs)
  }

  const scheduleNextBackgroundPoll = () => {
    const registeredTasks = loadImageTasks()
    if (registeredTasks.length === 0) {
      stopBackgroundPolling()
      return false
    }

    stopBackgroundPolling()
    const intervalMs = resolveNextPollDelayMs(
      input.imageRuntimeSettings,
      registeredTasks.flatMap((item: { conversationId: string }) =>
        resolvePendingElapsedMsForConversation(input.stateRef, item.conversationId)
      ),
    )
    input.backgroundResumePollTimerRef.current = window.setTimeout(() => {
      void input.pollBackgroundPendingTasks().finally(() => {
        scheduleNextBackgroundPoll()
      })
    }, intervalMs)
    return true
  }

  return {
    stopActivePolling,
    stopBackgroundPolling,
    scheduleNextActivePoll,
    scheduleNextBackgroundPoll,
  }
}
