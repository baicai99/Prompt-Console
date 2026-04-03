import { useDeferredValue, useMemo } from 'react'
import type { Side } from '../../../../types/conversation'
import type { ConversationDraftSourceImage, ConversationReadModel } from '../../application/conversationControllerContract'
import { conversationModelCatalogPort } from '../../application/ports/modelCatalogPort'
import { createConversationReadModel } from '../../application/queries/conversationReadModel'
import { buildImageTasksByRunId } from '../../application/queries/imageTaskReadModel'
import { buildPanelVariableBatches } from '../../domain/panelVariableParsing'
import { getMultiSideIds } from '../../domain/settingsNormalization'
import {
  conversationSelectors,
  type ConversationState,
} from '../../state/conversationState'
import { useConversationDiagnostics } from './useConversationDiagnostics'

interface UseConversationReadModelInput {
  state: ConversationState
  draftSourceImages: ConversationDraftSourceImage[]
  historyVisibleLimit: number
  isLoadingOlderMessages: boolean
  sendScrollTrigger: number
  sendScrollTargetMessageId: string | null
  replayingRunIds: string[]
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

interface UseConversationReadModelResult {
  modelCatalog: ReturnType<typeof conversationModelCatalogPort.getModelCatalogFromChannels>
  activeConversation: ReturnType<typeof conversationSelectors.selectActiveConversation>
  activeSideMode: ConversationState['stagedSideMode']
  activeSideCount: number
  activeSides: Side[]
  activeSettingsBySide: ReturnType<typeof conversationSelectors.selectActiveSettings>['activeSettingsBySide']
  isSideConfigLocked: boolean
  queries: ConversationReadModel
}

export function useConversationReadModel(input: UseConversationReadModelInput): UseConversationReadModelResult {
  const contentState = conversationSelectors.selectContentState(input.state)
  const runtimeState = conversationSelectors.selectRuntimeState(input.state)
  const composerState = conversationSelectors.selectComposerState(input.state)
  const settingsState = conversationSelectors.selectSettingsState(input.state)
  const availableChannels = settingsState.channels
  const modelCatalog = useMemo(
    () => conversationModelCatalogPort.getModelCatalogFromChannels(availableChannels),
    [availableChannels],
  )
  const activeConversation = conversationSelectors.selectActiveConversation(input.state)
  const deferredDraft = useDeferredValue(composerState.draft)
  const deferredPanelVariables = useDeferredValue(composerState.panelVariables)
  const deferredPanelValueFormat = useDeferredValue(composerState.panelValueFormat)
  const { activeSideMode, activeSideCount, activeSettingsBySide } = conversationSelectors.selectActiveSettings(input.state)
  const { resolvedVariables, templatePreview, unusedVariableKeys } = conversationSelectors.selectTemplatePreview({
    ...input.state,
    draft: deferredDraft,
    panelVariables: deferredPanelVariables,
    panelValueFormat: deferredPanelValueFormat,
  })
  const panelBatchValidation = useMemo(
    () => buildPanelVariableBatches(deferredPanelVariables, deferredPanelValueFormat).validation,
    [deferredPanelValueFormat, deferredPanelVariables],
  )
  const isPanelBatchInvalid = composerState.dynamicPromptEnabled && !panelBatchValidation.ok
  const activeSides = activeSideMode === 'single' ? (['single'] as Side[]) : getMultiSideIds(activeSideCount)
  const imageTasksByRunId = useMemo(() => {
    const activeRuntimeTasks =
      (contentState.activeId ? runtimeState.runtimeTasksByConversationId[contentState.activeId] : undefined)
      ?? activeConversation?.tasksById
      ?? {}
    return buildImageTasksByRunId({
      runtimeTasks: activeRuntimeTasks,
      conversationTasks: activeConversation?.tasksById,
    })
  }, [activeConversation?.tasksById, contentState.activeId, runtimeState.runtimeTasksByConversationId])
  const isSideConfigLocked = Boolean(activeConversation && activeConversation.messages.length > 0)
  const workspaceDiagnostics = useConversationDiagnostics({
    summariesCount: input.state.summaries.length,
    loadedConversationCount: Object.keys(input.state.contents).length,
    activeConversation,
    activeConversationId: contentState.activeId,
    runtimeTasksByConversationId: runtimeState.runtimeTasksByConversationId,
    draft: composerState.draft,
    panelVariables: composerState.panelVariables,
    resolvedVariables,
    unusedVariableKeys,
    draftSourceImages: input.draftSourceImages,
    historyVisibleLimit: input.historyVisibleLimit,
    isLoadingOlderMessages: input.isLoadingOlderMessages,
    sendScrollTrigger: input.sendScrollTrigger,
    getRuntimeDebugStats: input.getRuntimeDebugStats,
  })

  const queries = createConversationReadModel({
    state: input.state,
    activeConversation,
    imageTasksByRunId,
    draftSourceImages: input.draftSourceImages,
    historyVisibleLimit: input.historyVisibleLimit,
    isLoadingOlderMessages: input.isLoadingOlderMessages,
    sendScrollTrigger: input.sendScrollTrigger,
    sendScrollTargetMessageId: input.sendScrollTargetMessageId,
    resolvedVariables,
    templatePreview,
    unusedVariableKeys,
    activeSideMode,
    activeSideCount,
    activeSides,
    isSideConfigLocked,
    activeSettingsBySide,
    modelCatalog,
    isPanelBatchInvalid,
    panelBatchValidation,
    replayingRunIds: input.replayingRunIds,
    workspaceDiagnostics,
  })

  return {
    modelCatalog,
    activeConversation,
    activeSideMode,
    activeSideCount,
    activeSides,
    activeSettingsBySide,
    isSideConfigLocked,
    queries,
  }
}
