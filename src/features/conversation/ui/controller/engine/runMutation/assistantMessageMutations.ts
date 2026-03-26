import type { MutableRefObject } from 'react'
import { buildRunLocationIndex, type RunLocation } from '../../../../application/queries/conversationIndexes'
import type { ConversationState } from '../../../../state/conversationState'
import type { Conversation, Run } from '../../../../../../types/conversation'

interface AssistantMessageMutationsInput {
  stateRef: MutableRefObject<ConversationState>
  runLocationByConversationRef: MutableRefObject<Record<string, Map<string, RunLocation>>>
  persistConversation: (
    conversation: Conversation,
    options?: { saveStorage?: boolean; saveIndex?: boolean; skipSummaryUpdate?: boolean },
  ) => void
  scheduleConversationPersistence: (conversationId: string) => void
  notifyRunCompleted: (conversationId: string, run: Run) => void
}

function areRunImagesEquivalent(left: Run['images'][number], right: Run['images'][number]): boolean {
  return (
    left.id === right.id
    && left.seq === right.seq
    && left.status === right.status
    && left.queuedAt === right.queuedAt
    && left.startedAt === right.startedAt
    && left.completedAt === right.completedAt
    && left.pendingStartedAt === right.pendingStartedAt
    && left.providerTaskStatus === right.providerTaskStatus
    && left.requestUrl === right.requestUrl
    && left.threadState === right.threadState
    && left.resumeTransport === right.resumeTransport
    && left.fileRef === right.fileRef
    && left.thumbRef === right.thumbRef
    && left.fullRef === right.fullRef
    && left.refKind === right.refKind
    && left.refKey === right.refKey
    && left.serverTaskId === right.serverTaskId
    && JSON.stringify(left.serverTaskMeta ?? null) === JSON.stringify(right.serverTaskMeta ?? null)
    && left.width === right.width
    && left.height === right.height
    && left.bytes === right.bytes
    && left.error === right.error
    && left.errorCode === right.errorCode
    && left.detachedAt === right.detachedAt
    && left.lastResumeAttemptAt === right.lastResumeAttemptAt
  )
}

function mergeRunImage(currentImage: Run['images'][number], replacementImage: Run['images'][number]): Run['images'][number] {
  const nextStartedAt =
    typeof replacementImage.startedAt !== 'undefined'
      ? replacementImage.startedAt
      : replacementImage.status === 'pending' && currentImage.status !== 'pending'
        ? undefined
        : currentImage.startedAt
  const nextCompletedAt =
    typeof replacementImage.completedAt !== 'undefined'
      ? replacementImage.completedAt
      : replacementImage.status === 'pending'
        ? undefined
        : currentImage.completedAt

  const mergedImage: Run['images'][number] = {
    ...replacementImage,
    queuedAt: replacementImage.queuedAt ?? currentImage.queuedAt,
    startedAt: nextStartedAt,
    completedAt: nextCompletedAt,
    pendingStartedAt: replacementImage.pendingStartedAt ?? currentImage.pendingStartedAt,
    requestUrl: replacementImage.requestUrl ?? currentImage.requestUrl,
    providerTaskStatus: replacementImage.providerTaskStatus ?? currentImage.providerTaskStatus,
    threadState: replacementImage.threadState ?? currentImage.threadState,
    resumeTransport: replacementImage.resumeTransport ?? currentImage.resumeTransport,
    fileRef: replacementImage.fileRef ?? currentImage.fileRef,
    thumbRef: replacementImage.thumbRef ?? currentImage.thumbRef,
    fullRef: replacementImage.fullRef ?? currentImage.fullRef,
    refKind: replacementImage.refKind ?? currentImage.refKind,
    refKey: replacementImage.refKey ?? currentImage.refKey,
    serverTaskId: replacementImage.serverTaskId ?? currentImage.serverTaskId,
    serverTaskMeta: replacementImage.serverTaskMeta ?? currentImage.serverTaskMeta,
    width: replacementImage.width ?? currentImage.width,
    height: replacementImage.height ?? currentImage.height,
    bytes: replacementImage.bytes ?? currentImage.bytes,
    error:
      typeof replacementImage.error === 'undefined' && replacementImage.status === currentImage.status
        ? currentImage.error
        : replacementImage.error,
    errorCode:
      typeof replacementImage.errorCode === 'undefined' && replacementImage.status === currentImage.status
        ? currentImage.errorCode
        : replacementImage.errorCode,
    detachedAt: replacementImage.detachedAt ?? currentImage.detachedAt,
    lastResumeAttemptAt: replacementImage.lastResumeAttemptAt ?? currentImage.lastResumeAttemptAt,
  }

  return areRunImagesEquivalent(currentImage, mergedImage) ? currentImage : mergedImage
}

function mergeRunReplacement(currentRun: Run, replacementRun: Run): Run {
  const currentImagesBySeq = new Map(currentRun.images.map((image) => [image.seq, image] as const))
  const nextImages = replacementRun.images.map((image) => {
    const currentImage = currentImagesBySeq.get(image.seq)
    return currentImage ? mergeRunImage(currentImage, image) : image
  })

  return {
    ...replacementRun,
    images: nextImages,
  }
}

export function createAssistantMessageMutations(input: AssistantMessageMutationsInput) {
  const updateAssistantMessageContent = (
    conversationId: string,
    messageId: string,
    content: string,
    options?: { immediateStorage?: boolean },
  ) => {
    const snapshot = input.stateRef.current
    const currentConversation = snapshot.contents[conversationId]
    if (!currentConversation) {
      return
    }

    const messageIndex = currentConversation.messages.findIndex((item) => item.id === messageId)
    if (messageIndex < 0) {
      return
    }

    const target = currentConversation.messages[messageIndex]
    if (target.role !== 'assistant' || target.content === content) {
      return
    }

    const nextMessages = [...currentConversation.messages]
    nextMessages[messageIndex] = {
      ...target,
      content,
    }

    input.persistConversation({
      ...currentConversation,
      updatedAt: new Date().toISOString(),
      messages: nextMessages,
    }, {
      saveStorage: options?.immediateStorage ?? false,
      saveIndex: options?.immediateStorage ?? false,
      skipSummaryUpdate: !(options?.immediateStorage ?? false),
    })

    if (!(options?.immediateStorage ?? false)) {
      input.scheduleConversationPersistence(conversationId)
    }
  }

  const replaceRunsInConversation = (conversationId: string, nextRunsById: Map<string, Run>) => {
    const snapshot = input.stateRef.current
    const currentConversation = snapshot.contents[conversationId]
    if (!currentConversation) {
      return
    }

    const locationMap =
      input.runLocationByConversationRef.current[conversationId] ??
      (() => {
        const rebuilt = buildRunLocationIndex(currentConversation)
        input.runLocationByConversationRef.current[conversationId] = rebuilt
        return rebuilt
      })()

    let changed = false
    const nextMessages = [...currentConversation.messages]
    nextRunsById.forEach((replacement, runId) => {
      const loc = locationMap.get(runId)
      if (!loc) {
        return
      }
      const message = nextMessages[loc.messageIndex]
      const runs = message.runs ?? []
      if (!runs[loc.runIndex] || runs[loc.runIndex].id !== runId) {
        return
      }
      const nextRuns = [...runs]
      nextRuns[loc.runIndex] = mergeRunReplacement(runs[loc.runIndex], replacement)
      nextMessages[loc.messageIndex] = {
        ...message,
        runs: nextRuns,
      }
      changed = true
    })

    if (!changed) {
      return
    }

    const updatedConversation: Conversation = {
      ...currentConversation,
      updatedAt: new Date().toISOString(),
      messages: nextMessages,
    }

    input.persistConversation(updatedConversation)
    nextRunsById.forEach((run) => {
      input.notifyRunCompleted(conversationId, run)
    })
  }

  const appendRunsToMessage = (conversationId: string, messageId: string, runsToAppend: Run[]) => {
    if (runsToAppend.length === 0) {
      return
    }

    const snapshot = input.stateRef.current
    const currentConversation = snapshot.contents[conversationId]
    if (!currentConversation) {
      return
    }

    const messageIndex = currentConversation.messages.findIndex((item) => item.id === messageId)
    if (messageIndex < 0) {
      return
    }

    const message = currentConversation.messages[messageIndex]
    if (message.role !== 'assistant') {
      return
    }

    const nextMessages = [...currentConversation.messages]
    nextMessages[messageIndex] = {
      ...message,
      runs: [...(message.runs ?? []), ...runsToAppend],
    }

    const updatedConversation: Conversation = {
      ...currentConversation,
      updatedAt: new Date().toISOString(),
      messages: nextMessages,
    }

    input.persistConversation(updatedConversation)
    runsToAppend.forEach((run) => {
      input.notifyRunCompleted(conversationId, run)
    })
  }

  return {
    updateAssistantMessageContent,
    replaceRunsInConversation,
    appendRunsToMessage,
  }
}
