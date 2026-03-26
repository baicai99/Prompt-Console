import { useSyncExternalStore } from 'react'
import type {
  Conversation,
  ImageTask,
} from '../../../../types/conversation'
import type { ConversationDraftSourceImage, ConversationWorkspaceReadModel } from '../../application/conversationControllerContract'
import { isSettledImageTaskStatus } from '../../domain/imageTaskMemory'
import { isInlineImagePayload } from '../../application/imageResultReferenceStore'
import { conversationLoggingPort } from '../../application/ports/loggingPort'
import {
  isChatMemoryDiagnosticsEnabled,
  subscribeChatMemoryDiagnostics,
} from '../../../performance/chatMemoryDiagnostics'

type WorkspaceDiagnostics = ConversationWorkspaceReadModel['workspaceDiagnostics']

export const EMPTY_WORKSPACE_DIAGNOSTICS: WorkspaceDiagnostics = {
  summariesCount: 0,
  loadedConversationCount: 0,
  runtimeTaskConversationCount: 0,
  runtimeTaskTotalCount: 0,
  activeConversationMessageCount: 0,
  activeConversationRunCount: 0,
  activeConversationImageCount: 0,
  activeConversationTaskCount: 0,
  activeConversationLiveFeedCount: 0,
  inlineImageCount: 0,
  inlineImageBytes: 0,
  idbBackedImageCount: 0,
  directUrlImageCount: 0,
  activeTaskCount: 0,
  settledTaskCount: 0,
  draftCharacterCount: 0,
  panelVariableRowCount: 0,
  resolvedVariableCount: 0,
  unusedVariableCount: 0,
  draftSourceImageCount: 0,
  draftSourcePreviewUrlCount: 0,
  totalDraftSourceBytes: 0,
  replayingRunIdsCount: 0,
  historyVisibleLimit: 0,
  isLoadingOlderMessages: false,
  sendScrollTrigger: 0,
  pendingPersistConversationCount: 0,
  persistTimerActive: false,
  resumePollTimerActive: false,
  backgroundResumePollTimerActive: false,
  resumePollInFlight: false,
  backgroundResumePollInFlight: false,
  conversationCacheOrderCount: 0,
  runLocationConversationCount: 0,
  runLocationEntryCount: 0,
  activeRunControllerConversationCount: 0,
  activeRunControllerCount: 0,
  resumingImageCount: 0,
  runCompletionSignatureCount: 0,
  backgroundPollOwnerId: '',
  globalSubmitMax: 0,
  globalSubmitActive: 0,
  globalSubmitQueued: 0,
  logEntryCount: 0,
  logBufferLimit: 0,
  uiRenderCacheSize: 0,
  logSubscriberCount: 0,
  loggingEnabled: false,
  loggingDetailLevel: 'standard',
}

interface UseConversationDiagnosticsInput {
  summariesCount: number
  loadedConversationCount: number
  activeConversation: Conversation | null
  activeConversationId: string | null
  runtimeTasksByConversationId: Record<string, Record<string, ImageTask>>
  draft: string
  panelVariables: Array<{ id: string }>
  resolvedVariables: Record<string, string>
  unusedVariableKeys: string[]
  draftSourceImages: ConversationDraftSourceImage[]
  historyVisibleLimit: number
  isLoadingOlderMessages: boolean
  sendScrollTrigger: number
  getRuntimeDebugStats: () => {
    replayingRunIdsCount: number
    historyVisibleLimit: number
    isLoadingOlderMessages: boolean
    sendScrollTrigger: number
    pendingPersistConversationCount: number
    persistTimerActive: boolean
    resumePollTimerActive: boolean
    backgroundResumePollTimerActive: boolean
    resumePollInFlight: boolean
    backgroundResumePollInFlight: boolean
    conversationCacheOrderCount: number
    runLocationConversationCount: number
    runLocationEntryCount: number
    activeRunControllerConversationCount: number
    activeRunControllerCount: number
    resumingImageCount: number
    runCompletionSignatureCount: number
    backgroundPollOwnerId: string
    globalSubmit: {
      max: number
      active: number
      queued: number
    }
  }
}

export function useConversationDiagnostics(input: UseConversationDiagnosticsInput): WorkspaceDiagnostics {
  const { getLoggingDebugStats } = conversationLoggingPort
  const diagnosticsEnabled = useSyncExternalStore(
    subscribeChatMemoryDiagnostics,
    isChatMemoryDiagnosticsEnabled,
    isChatMemoryDiagnosticsEnabled,
  )

  if (!diagnosticsEnabled) {
    return {
      ...EMPTY_WORKSPACE_DIAGNOSTICS,
      summariesCount: input.summariesCount,
      activeConversationMessageCount: input.activeConversation?.messages.length ?? 0,
      draftCharacterCount: input.draft.length,
      panelVariableRowCount: input.panelVariables.length,
    }
  }

  const runtimeDebug = input.getRuntimeDebugStats()
  const loggingDebug = getLoggingDebugStats()
  const activeConversationRunCount = input.activeConversation?.messages
    .reduce((sum, message) => sum + (message.runs?.length ?? 0), 0) ?? 0
  const activeConversationImageCount = input.activeConversation?.messages
    .reduce((sum, message) => sum + (message.runs?.reduce((runSum, run) => runSum + run.images.length, 0) ?? 0), 0) ?? 0
  const activeConversationLiveFeedCount = input.activeConversation?.messages
    .reduce((sum, message) => sum + (message.liveFeed?.length ?? 0), 0) ?? 0
  const activeConversationImages = input.activeConversation?.messages.flatMap((message) =>
    (message.runs ?? []).flatMap((run) => run.images),
  ) ?? []
  const inlineImageCount = activeConversationImages.filter((image) =>
    isInlineImagePayload(image.fullRef)
    || isInlineImagePayload(image.fileRef)
    || isInlineImagePayload(image.thumbRef)
    || (image.refKind === 'inline' && isInlineImagePayload(image.refKey))
  ).length
  const inlineImageBytes = activeConversationImages.reduce((sum, image) => {
    if (
      isInlineImagePayload(image.fullRef)
      || isInlineImagePayload(image.fileRef)
      || isInlineImagePayload(image.thumbRef)
      || (image.refKind === 'inline' && isInlineImagePayload(image.refKey))
    ) {
      return sum + (image.bytes ?? 0)
    }
    return sum
  }, 0)
  const idbBackedImageCount = activeConversationImages.filter((image) => image.refKind === 'idb-blob').length
  const directUrlImageCount = activeConversationImages.filter((image) => image.refKind === 'url').length
  const activeConversationTasks = Object.values(
    (input.activeConversationId ? input.runtimeTasksByConversationId[input.activeConversationId] : undefined)
    ?? input.activeConversation?.tasksById
    ?? {},
  )
  const activeTaskCount = activeConversationTasks.filter((task) => !isSettledImageTaskStatus(task.status)).length
  const settledTaskCount = activeConversationTasks.filter((task) => isSettledImageTaskStatus(task.status)).length
  const runtimeTaskTotalCount = Object.values(input.runtimeTasksByConversationId)
    .reduce((sum, tasksById) => sum + Object.keys(tasksById).length, 0)
  const draftSourcePreviewUrlCount = input.draftSourceImages.filter((item) => Boolean(item.previewUrl)).length
  const totalDraftSourceBytes = input.draftSourceImages.reduce((sum, item) => sum + item.file.size, 0)

  return {
    summariesCount: input.summariesCount,
    loadedConversationCount: input.loadedConversationCount,
    runtimeTaskConversationCount: Object.keys(input.runtimeTasksByConversationId).length,
    runtimeTaskTotalCount,
    activeConversationMessageCount: input.activeConversation?.messages.length ?? 0,
    activeConversationRunCount,
    activeConversationImageCount,
    activeConversationTaskCount: Object.keys(input.activeConversation?.tasksById ?? {}).length,
    activeConversationLiveFeedCount,
    inlineImageCount,
    inlineImageBytes,
    idbBackedImageCount,
    directUrlImageCount,
    activeTaskCount,
    settledTaskCount,
    draftCharacterCount: input.draft.length,
    panelVariableRowCount: input.panelVariables.length,
    resolvedVariableCount: Object.keys(input.resolvedVariables).length,
    unusedVariableCount: input.unusedVariableKeys.length,
    draftSourceImageCount: input.draftSourceImages.length,
    draftSourcePreviewUrlCount,
    totalDraftSourceBytes,
    replayingRunIdsCount: runtimeDebug.replayingRunIdsCount,
    historyVisibleLimit: runtimeDebug.historyVisibleLimit,
    isLoadingOlderMessages: runtimeDebug.isLoadingOlderMessages,
    sendScrollTrigger: runtimeDebug.sendScrollTrigger,
    pendingPersistConversationCount: runtimeDebug.pendingPersistConversationCount,
    persistTimerActive: runtimeDebug.persistTimerActive,
    resumePollTimerActive: runtimeDebug.resumePollTimerActive,
    backgroundResumePollTimerActive: runtimeDebug.backgroundResumePollTimerActive,
    resumePollInFlight: runtimeDebug.resumePollInFlight,
    backgroundResumePollInFlight: runtimeDebug.backgroundResumePollInFlight,
    conversationCacheOrderCount: runtimeDebug.conversationCacheOrderCount,
    runLocationConversationCount: runtimeDebug.runLocationConversationCount,
    runLocationEntryCount: runtimeDebug.runLocationEntryCount,
    activeRunControllerConversationCount: runtimeDebug.activeRunControllerConversationCount,
    activeRunControllerCount: runtimeDebug.activeRunControllerCount,
    resumingImageCount: runtimeDebug.resumingImageCount,
    runCompletionSignatureCount: runtimeDebug.runCompletionSignatureCount,
    backgroundPollOwnerId: runtimeDebug.backgroundPollOwnerId,
    globalSubmitMax: runtimeDebug.globalSubmit.max,
    globalSubmitActive: runtimeDebug.globalSubmit.active,
    globalSubmitQueued: runtimeDebug.globalSubmit.queued,
    logEntryCount: loggingDebug.entryCount,
    logBufferLimit: loggingDebug.bufferLimit,
    uiRenderCacheSize: loggingDebug.uiRenderCacheSize,
    logSubscriberCount: loggingDebug.subscriberCount,
    loggingEnabled: loggingDebug.loggingEnabled,
    loggingDetailLevel: loggingDebug.detailLevel,
  }
}
