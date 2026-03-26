import type { Conversation, Run } from '../../../../../types/conversation'
import { createConversationTitleHelpers } from './sendFlowTitle'
import { createSendFlowRunActions } from './sendFlowRunActions'
import {
  createAppendDraftSourceImagesHandler,
  createSendDraftHandler,
  type SendFlowDeps,
} from './sendDraft'

export function createSendFlowModule(deps: SendFlowDeps) {
  const {
    stateRef,
    ensureConversationLoaded,
    persistConversation,
    modelCatalog,
    orchestrator,
    dispatch,
    actions,
    registerActiveRun,
    unregisterActiveRun,
    isRunStillActive,
    updateRunImageInConversation,
    replaceRunsInConversation,
    findRunInConversation,
    replayingRunIdsRef,
    setReplayingRunIds,
    submitRequestRunner,
  } = deps

  const getLoadedActiveConversation = async (): Promise<Conversation | null> => {
    const snapshot = stateRef.current
    if (!snapshot.activeId) {
      return null
    }

    const existing = snapshot.contents[snapshot.activeId] ?? null
    if (existing) {
      return existing
    }

    await ensureConversationLoaded(snapshot.activeId)
    const refreshed = stateRef.current
    if (!refreshed.activeId) {
      return null
    }
    return refreshed.contents[refreshed.activeId] ?? null
  }

  const {
    shouldGenerateConversationTitle,
    maybeGenerateConversationTitle,
    appendConversationEntry,
  } = createConversationTitleHelpers({
    stateRef,
    ensureConversationLoaded,
    persistConversation,
    streamTextFn: deps.streamText,
  })

  const appendDraftSourceImages = createAppendDraftSourceImagesHandler(deps)
  const sendDraft = createSendDraftHandler({
    ...deps,
    getLoadedActiveConversation,
    shouldGenerateConversationTitle,
    maybeGenerateConversationTitle,
    appendConversationEntry,
  })

  const {
    retryRun,
    editRunTemplate,
    replayRunAsNewMessage,
  } = createSendFlowRunActions({
    stateRef,
    modelCatalog,
    orchestrator,
    dispatch,
    actions,
    getLoadedActiveConversation,
    persistConversation,
    registerActiveRun,
    unregisterActiveRun,
    isRunStillActive,
    updateRunImageInConversation,
    replaceRunsInConversation,
    findRunInConversation: findRunInConversation as (conversation: Conversation, runId: string) => Run | null,
    replayingRunIdsRef,
    setReplayingRunIds,
    submitRequestRunner: submitRequestRunner ?? (async (runner) => runner()),
  })

  return {
    appendDraftSourceImages,
    sendDraft,
    retryRun,
    editRunTemplate,
    replayRunAsNewMessage,
  }
}
