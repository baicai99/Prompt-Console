import type { MutableRefObject } from 'react'

export interface ActiveRunRegistration {
  controller: AbortController
  messageId: string
}

export interface ActiveRunRegistry {
  registerActiveRun: (conversationId: string, messageId: string, runId: string, controller: AbortController) => void
  unregisterActiveRun: (conversationId: string, runId: string) => void
  isRunStillActive: (conversationId: string, runId: string) => boolean
  isRunOwnedByMessage: (conversationId: string, runId: string, messageId: string) => boolean
  abortRun: (conversationId: string, runId: string) => void
  abortRuns: (conversationId: string, runIds: string[]) => void
  abortMessageRuns: (conversationId: string, messageId: string) => void
  abortConversationRuns: (conversationId: string) => void
  abortAllRuns: () => void
}

export function createActiveRunRegistry(ref: MutableRefObject<Record<string, Map<string, ActiveRunRegistration>>>): ActiveRunRegistry {
  const registerActiveRun = (conversationId: string, messageId: string, runId: string, controller: AbortController) => {
    const existing = ref.current[conversationId] ?? new Map<string, ActiveRunRegistration>()
    existing.set(runId, { controller, messageId })
    ref.current[conversationId] = existing
  }

  const unregisterActiveRun = (conversationId: string, runId: string) => {
    const existing = ref.current[conversationId]
    if (!existing) {
      return
    }
    existing.delete(runId)
    if (existing.size === 0) {
      delete ref.current[conversationId]
    }
  }

  const isRunStillActive = (conversationId: string, runId: string): boolean => {
    return ref.current[conversationId]?.has(runId) ?? false
  }

  const isRunOwnedByMessage = (conversationId: string, runId: string, messageId: string): boolean => {
    return ref.current[conversationId]?.get(runId)?.messageId === messageId
  }

  const abortRun = (conversationId: string, runId: string) => {
    const registration = ref.current[conversationId]?.get(runId)
    if (!registration) {
      return
    }
    registration.controller.abort()
    unregisterActiveRun(conversationId, runId)
  }

  const abortRuns = (conversationId: string, runIds: string[]) => {
    const uniqueRunIds = new Set(runIds)
    uniqueRunIds.forEach((runId) => {
      abortRun(conversationId, runId)
    })
  }

  const abortMessageRuns = (conversationId: string, messageId: string) => {
    const controllers = ref.current[conversationId]
    if (!controllers) {
      return
    }
    Array.from(controllers.entries())
      .filter(([, registration]) => registration.messageId === messageId)
      .forEach(([runId]) => {
        abortRun(conversationId, runId)
      })
  }

  const abortConversationRuns = (conversationId: string) => {
    const controllers = ref.current[conversationId]
    if (!controllers) {
      return
    }
    Array.from(controllers.keys()).forEach((runId) => {
      abortRun(conversationId, runId)
    })
  }

  const abortAllRuns = () => {
    Object.keys(ref.current).forEach((conversationId) => {
      abortConversationRuns(conversationId)
    })
  }

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
  }
}
