import type { MutableRefObject } from 'react'
import type { ConversationState } from '../../../../state/conversationState'
import type { Conversation, ImageTask } from '../../../../../../types/conversation'

interface DetachConversationImageThreadsInput {
  stateRef: MutableRefObject<ConversationState>
  replaceRuntimeTasksForConversation: (conversationId: string, tasksById: Record<string, ImageTask>) => void
  persistConversation: (conversation: Conversation) => void
}

export function createDetachConversationImageThreads(input: DetachConversationImageThreadsInput) {
  return (conversationId: string) => {
    const snapshot = input.stateRef.current
    const currentConversation = snapshot.contents[conversationId]
    if (!currentConversation) {
      return
    }

    const detachedAt = new Date().toISOString()
    let changed = false
    const nextMessages = currentConversation.messages.map((message) => {
      const nextRuns = (message.runs ?? []).map((run) => {
        let runChanged = false
        const nextImages = run.images.map((image) => {
          if (image.status !== 'pending' || image.threadState !== 'active') {
            return image
          }
          runChanged = true
          changed = true
          const canResume = Boolean(image.serverTaskId || image.serverTaskMeta)
          if (!canResume) {
            return {
              ...image,
              status: 'failed' as const,
              threadState: 'settled' as const,
              error: '图片生成已中断，请重试',
              errorCode: 'unknown' as const,
              detachedAt,
            }
          }
          return {
            ...image,
            threadState: 'detached' as const,
            detachedAt,
          }
        })
        return runChanged ? { ...run, images: nextImages } : run
      })
      return message.runs ? { ...message, runs: nextRuns } : message
    })

    if (!changed) {
      return
    }

    const nextTasksById = { ...(input.stateRef.current.runtimeTasksByConversationId[conversationId] ?? currentConversation.tasksById ?? {}) }
    Object.values(nextTasksById).forEach((task) => {
      if (task.status !== 'running' && task.status !== 'polling') {
        return
      }
      nextTasksById[task.taskId] = {
        ...task,
        status: 'polling',
        threadState: 'detached',
      }
    })
    input.replaceRuntimeTasksForConversation(conversationId, nextTasksById)

    input.persistConversation({
      ...currentConversation,
      updatedAt: detachedAt,
      messages: nextMessages,
    })
  }
}
