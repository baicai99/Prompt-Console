import type { MutableRefObject } from 'react'
import type { ConversationState } from '../../../../state/conversationState'
import { resolveResumePollIntervalMs } from '../../../../../../utils/imageRuntimeSettings'
import { toEpoch } from '../helpers'
import { buildFairResumableImageQueue } from './processing'

export const BACKGROUND_RESUME_LEASE_KEY = 'm3:background-resume-owner'
export const BACKGROUND_RESUME_LEASE_TTL_MS = 30_000

export function getVisibilityState(): DocumentVisibilityState {
  return typeof document !== 'undefined' ? document.visibilityState : 'visible'
}

export function resolvePendingElapsedMsForConversation(
  stateRef: MutableRefObject<ConversationState>,
  conversationId: string,
): number[] {
  const snapshot = stateRef.current
  const conversation = snapshot.contents[conversationId]
  if (!conversation) {
    return []
  }

  return buildFairResumableImageQueue(
    conversation,
    snapshot.runtimeTasksByConversationId?.[conversationId],
  ).map((entry) => {
    const pendingSinceEpoch = Math.max(
      toEpoch(entry.image.startedAt),
      toEpoch(entry.image.queuedAt),
      toEpoch(entry.image.pendingStartedAt),
      toEpoch(entry.task.startedAt),
      toEpoch(entry.task.queuedAt),
      toEpoch(entry.run.taskState?.generatingStartedAt),
      toEpoch(entry.run.createdAt),
    )
    return pendingSinceEpoch > 0 ? Math.max(0, Date.now() - pendingSinceEpoch) : 0
  })
}

export function resolveNextPollDelayMs(
  imageRuntimeSettings: ConversationState['imageRuntimeSettings'],
  elapsedMsList: number[],
): number {
  const visibilityState = getVisibilityState()
  if (elapsedMsList.length === 0) {
    return resolveResumePollIntervalMs(imageRuntimeSettings, 0, visibilityState)
  }
  return elapsedMsList.reduce((minDelay, elapsedMs) => {
    const delay = resolveResumePollIntervalMs(imageRuntimeSettings, elapsedMs, visibilityState)
    return Math.min(minDelay, delay)
  }, Number.POSITIVE_INFINITY)
}
