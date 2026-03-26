import { createRunTaskState } from '../../../../domain/runTaskState'
import type { Conversation, Run } from '../../../../../../types/conversation'
import { normalizeRunAttempts } from '../../../../domain/runAttempts'

export function findRunInConversation(conversation: Conversation, runId: string): Run | null {
  for (const message of conversation.messages) {
    const target = (message.runs ?? []).find((item) => item.id === runId)
    if (target) {
      return target
    }
  }
  return null
}

function resolveTargetIndexes(sourceRun: Run, targetSeqs?: number[]): number[] {
  if (Array.isArray(targetSeqs) && targetSeqs.length > 0) {
    return targetSeqs
      .map((seq) => sourceRun.images.findIndex((item) => item.seq === seq))
      .filter((index) => index >= 0)
  }

  return sourceRun.images
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.status === 'failed')
    .map(({ index }) => index)
}

export function mergeRetryResultIntoRun(sourceRun: Run, retryRun: Run, options?: { targetSeqs?: number[] }): Run {
  const targetIndexes = resolveTargetIndexes(sourceRun, options?.targetSeqs)
  if (targetIndexes.length === 0) {
    return sourceRun
  }

  const nextImages = sourceRun.images.map((item) => ({ ...item }))
  targetIndexes.forEach((targetIndex, retryIndex) => {
    const retryImage = retryRun.images[retryIndex]
    if (!retryImage) {
      return
    }

    const current = nextImages[targetIndex]
    nextImages[targetIndex] = {
      ...current,
      status: retryImage.status,
      queuedAt: retryImage.queuedAt,
      startedAt: retryImage.startedAt,
      completedAt: retryImage.completedAt,
      pendingStartedAt: retryImage.pendingStartedAt,
      providerTaskStatus: retryImage.providerTaskStatus,
      threadState: retryImage.threadState,
      resumeTransport: retryImage.resumeTransport,
      fileRef: retryImage.fileRef,
      thumbRef: retryImage.thumbRef,
      fullRef: retryImage.fullRef,
      refKind: retryImage.refKind,
      refKey: retryImage.refKey,
      serverTaskId: retryImage.serverTaskId,
      serverTaskMeta: retryImage.serverTaskMeta,
      bytes: retryImage.bytes,
      error: retryImage.error,
      errorCode: retryImage.errorCode,
      detachedAt: retryImage.detachedAt,
      lastResumeAttemptAt: retryImage.lastResumeAttemptAt,
    }
  })

  return {
    ...sourceRun,
    channelId: retryRun.channelId,
    channelName: retryRun.channelName,
    modelId: retryRun.modelId,
    modelName: retryRun.modelName,
    paramsSnapshot: retryRun.paramsSnapshot,
    settingsSnapshot: retryRun.settingsSnapshot,
    retryAttempt: retryRun.retryAttempt,
    attempts: normalizeRunAttempts(sourceRun),
    taskState: retryRun.taskState,
    images: nextImages,
  }
}

export function markFailedImagesPending(run: Run, options?: { targetSeqs?: number[] }): Run {
  const targetSeqs = new Set(
    Array.isArray(options?.targetSeqs) && options.targetSeqs.length > 0
      ? options.targetSeqs
      : run.images.filter((item) => item.status === 'failed').map((item) => item.seq),
  )
  const nextImages = run.images.map((item) => {
    if (!targetSeqs.has(item.seq)) {
      return item
    }
    const queuedAt = new Date().toISOString()
    return {
      ...item,
      status: 'pending' as const,
      queuedAt,
      startedAt: undefined,
      completedAt: undefined,
      pendingStartedAt: queuedAt,
      providerTaskStatus: undefined,
      threadState: 'active' as const,
      resumeTransport: undefined,
      fileRef: undefined,
      thumbRef: undefined,
      fullRef: undefined,
      refKind: undefined,
      refKey: undefined,
      serverTaskId: undefined,
      serverTaskMeta: undefined,
      bytes: undefined,
      error: undefined,
      errorCode: undefined,
      detachedAt: undefined,
      lastResumeAttemptAt: undefined,
    }
  })

  return {
    ...run,
    taskState: createRunTaskState({
      status: 'waiting',
      previous: run.taskState,
    }),
    images: nextImages,
  }
}
