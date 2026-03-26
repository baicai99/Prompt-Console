import type { MutableRefObject } from 'react'
import { classifyFailure } from '../../../../domain/failureClassifier'
import { createRunTaskState } from '../../../../domain/runTaskState'
import type { ConversationState } from '../../../../state/conversationState'
import type { Conversation, ImageTask } from '../../../../../../types/conversation'

interface CancelRunMutationsInput {
  stateRef: MutableRefObject<ConversationState>
  replaceRuntimeTasksForConversation: (conversationId: string, tasksById: Record<string, ImageTask>) => void
  persistConversation: (
    conversation: Conversation,
    options?: { saveStorage?: boolean; saveIndex?: boolean; skipSummaryUpdate?: boolean },
  ) => void
  scheduleConversationPersistence: (conversationId: string) => void
}

export function createCancelRunMutations(input: CancelRunMutationsInput) {
  const cancelMessageRunsInConversation = (
    conversationId: string,
    messageId: string,
    runIds: string[],
    options?: { reason?: string },
  ) => {
    const snapshot = input.stateRef.current
    const currentConversation = snapshot.contents[conversationId]
    if (!currentConversation) {
      return
    }

    const messageIndex = currentConversation.messages.findIndex((message) => message.id === messageId)
    if (messageIndex < 0) {
      return
    }

    const targetMessage = currentConversation.messages[messageIndex]
    if (targetMessage.role !== 'assistant' || !targetMessage.runs?.length) {
      return
    }

    const targetRunIds = new Set(runIds)
    if (targetRunIds.size === 0) {
      return
    }

    const cancelledAt = new Date().toISOString()
    const cancelledRunIds = new Set<string>()
    let changed = false

    const nextRuns = targetMessage.runs.map((run) => {
      if (!targetRunIds.has(run.id)) {
        return run
      }
      let runChanged = false
      const nextImages = run.images.map((image) => {
        if (image.status !== 'pending') {
          return image
        }

        changed = true
        runChanged = true
        return {
          ...image,
          status: 'failed' as const,
          threadState: 'settled' as const,
          error: '图片生成已中断',
          errorCode: 'unknown' as const,
          detachedAt: cancelledAt,
        }
      })

      if (!runChanged) {
        return run
      }

      cancelledRunIds.add(run.id)
      return {
        ...run,
        taskState: createRunTaskState({
          status: 'cancelled',
          now: cancelledAt,
          previous: run.taskState,
          reason: options?.reason ?? 'message-aborted',
        }),
        images: nextImages,
      }
    })

    if (!changed) {
      return
    }

    const nextMessages = [...currentConversation.messages]
    nextMessages[messageIndex] = {
      ...targetMessage,
      runs: nextRuns,
    }

    const nextTasksById = Object.fromEntries(
      Object.entries(input.stateRef.current.runtimeTasksByConversationId[conversationId] ?? currentConversation.tasksById ?? {}).filter(([, task]) => !cancelledRunIds.has(task.runId)),
    )
    input.replaceRuntimeTasksForConversation(conversationId, nextTasksById)

    input.persistConversation({
      ...currentConversation,
      updatedAt: cancelledAt,
      tasksById: nextTasksById,
      messages: nextMessages,
    }, {
      saveStorage: false,
      saveIndex: false,
    })
    input.scheduleConversationPersistence(conversationId)
  }

  const classifyRunImageError = (message: string): ReturnType<typeof classifyFailure> => classifyFailure(message)

  return {
    cancelMessageRunsInConversation,
    classifyRunImageError,
  }
}
