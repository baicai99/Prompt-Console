import { createConversation } from '../../../../../utils/chat'
import type { Side } from '../../../../../types/conversation'
import { conversationLoggingPort } from '../../../application/ports/loggingPort'
import { getMultiSideIds } from '../../../domain/settingsNormalization'
import { resolveSendGenerationMode } from './sendFlowUtils'
import {
  applyOneShotSizeOverridesToSettings,
  parseModelCommandDraft,
  parseOneShotSizeCommands,
} from './helpers'
import { handleImageModeSend } from './sendDraft/imageMode'
import { createAppendDraftSourceImagesHandler, hydrateSettingsChannels, resolveSendBlockedReason } from './sendDraft/preflight'
import { handleTextModeSend } from './sendDraft/textMode'
import type { ActiveConversationState, AppliedModelCommand, SendDraftHelpers, SendFlowDeps } from './sendDraft/types'

export { createAppendDraftSourceImagesHandler }
export type {
  AppendSourceImageResult,
  SendFlowActions,
  SendFlowDeps,
  SendFlowNotifier,
} from './sendDraft/types'

function resolveActiveConversationState(
  snapshot: SendFlowDeps['stateRef']['current'],
  currentActive: Awaited<ReturnType<SendDraftHelpers['getLoadedActiveConversation']>>,
): ActiveConversationState {
  return {
    activeSideMode: currentActive?.sideMode ?? snapshot.stagedSideMode,
    activeSideCount: currentActive?.sideCount ?? snapshot.stagedSideCount,
    activeSettingsBySide: currentActive?.settingsBySide ?? snapshot.stagedSettingsBySide,
  }
}

function resolveTargetSides(activeState: ActiveConversationState): Side[] {
  return activeState.activeSideMode === 'single' ? ['single'] : getMultiSideIds(activeState.activeSideCount)
}

function applyTemporaryModelShortcut(
  activeSettingsBySide: ActiveConversationState['activeSettingsBySide'],
  targetSides: readonly Side[],
  modelCommand: AppliedModelCommand | null,
) {
  if (modelCommand?.scope !== 'temporary') {
    return activeSettingsBySide
  }

  const nextSettings = { ...activeSettingsBySide }
  for (const side of targetSides) {
    const current = nextSettings[side]
    if (!current) {
      continue
    }
    nextSettings[side] = {
      ...current,
      modelId: modelCommand.model.id,
      textModelId: modelCommand.model.id,
      paramValues: {},
    }
  }
  return nextSettings
}

export function createSendDraftHandler(deps: SendFlowDeps & SendDraftHelpers) {
  return async () => {
    const snapshot = deps.stateRef.current
    conversationLoggingPort.emitImageTaskDebug({
      stage: 'user_submit_request',
      conversationId: snapshot.activeId ?? undefined,
      detail: {
        draft: snapshot.draft,
        sourceImageCount: deps.draftSourceImagesRef.current.length,
        runConcurrency: snapshot.runConcurrency,
        runConcurrencyUnlimited: snapshot.runConcurrencyUnlimited,
      },
    })

    const currentActive = await deps.getLoadedActiveConversation()
    const activeState = resolveActiveConversationState(snapshot, currentActive)
    const targetSides = resolveTargetSides(activeState)
    const modelCommand = (parseModelCommandDraft(snapshot.draft, deps.modelCatalog.models) ?? null) as AppliedModelCommand | null

    if (modelCommand?.scope === 'permanent') {
      const mergedSettingsBySide = deps.applyModelShortcut(modelCommand.model.id)
      const baseConversation =
        currentActive ??
        createConversation(mergedSettingsBySide, activeState.activeSideMode, activeState.activeSideCount)
      const conversationWithLatestSettings = {
        ...baseConversation,
        sideMode: activeState.activeSideMode,
        sideCount: activeState.activeSideCount,
        settingsBySide: mergedSettingsBySide,
      }
      const shouldGenerateTitle = deps.shouldGenerateConversationTitle(conversationWithLatestSettings, false)
      const updatedConversation = deps.appendConversationEntry(
        conversationWithLatestSettings,
        snapshot.draft,
        `模型已切换为 ${modelCommand.model.name}，后续请求将默认使用该模型。`,
        [],
        undefined,
        [],
        undefined,
        { titleEligible: false },
      )
      deps.persistConversation(updatedConversation)
      deps.maybeGenerateConversationTitle({
        conversationId: updatedConversation.id,
        titleSource: snapshot.draft,
        shouldGenerateTitle,
        preferredChannelId: mergedSettingsBySide.single?.channelId ?? null,
      })
      deps.setActiveConversation(updatedConversation.id)
      deps.setSendScrollTargetMessageId(updatedConversation.messages.at(-1)?.id ?? null)
      deps.setSendScrollTrigger((prev) => prev + 1)
      deps.actions.setDraft('')
      deps.clearDraftSourceImages()
      deps.notifier.success(`已切换到 ${modelCommand.model.name}`)
      return
    }

    const draftAfterModelCommand = modelCommand?.cleanedPrompt?.length ? modelCommand.cleanedPrompt : snapshot.draft
    const oneShotParseResult = parseOneShotSizeCommands(draftAfterModelCommand)
    if (oneShotParseResult.error) {
      deps.dispatch({ type: 'send/fail', payload: oneShotParseResult.error })
      return
    }

    const effectiveDraft = oneShotParseResult.cleanedPrompt
    const titleEligible = effectiveDraft.trim().length > 0
    const modelAdjustedSettingsBySide = applyTemporaryModelShortcut(
      activeState.activeSettingsBySide,
      targetSides,
      modelCommand,
    )
    const sizeAdjustedSettingsBySide = applyOneShotSizeOverridesToSettings(
      modelAdjustedSettingsBySide,
      [...targetSides],
      oneShotParseResult.overrides,
    )
    const effectiveSettingsBySide = hydrateSettingsChannels(
      snapshot.channels,
      sizeAdjustedSettingsBySide,
      [...targetSides],
    )

    const blockedReason = resolveSendBlockedReason(snapshot, deps.modelCatalog, {
      ...activeState,
      activeSettingsBySide: effectiveSettingsBySide,
    })
    if (blockedReason) {
      const baseConversation =
        currentActive ??
        createConversation(activeState.activeSettingsBySide, activeState.activeSideMode, activeState.activeSideCount)
      const shouldGenerateTitle = deps.shouldGenerateConversationTitle(baseConversation, titleEligible)
      const updatedConversation = deps.appendConversationEntry(
        baseConversation,
        snapshot.draft,
        blockedReason.assistantContent,
        [],
        effectiveDraft,
        [],
        blockedReason.actions,
        { titleEligible },
      )
      deps.persistConversation(updatedConversation)
      deps.maybeGenerateConversationTitle({
        conversationId: updatedConversation.id,
        titleSource: effectiveDraft,
        shouldGenerateTitle,
        preferredChannelId: effectiveSettingsBySide[targetSides[0] ?? 'single']?.channelId ?? null,
      })
      deps.setActiveConversation(updatedConversation.id)
      deps.setSendScrollTargetMessageId(updatedConversation.messages.at(-1)?.id ?? null)
      deps.setSendScrollTrigger((prev) => prev + 1)
      deps.actions.setDraft('')
      deps.clearDraftSourceImages()
      deps.dispatch({ type: 'send/clearError' })
      return
    }

    const sendModeResolution = resolveSendGenerationMode({
      sideMode: activeState.activeSideMode,
      sideCount: activeState.activeSideCount,
      settingsBySide: effectiveSettingsBySide,
    })
    if ('error' in sendModeResolution) {
      deps.dispatch({ type: 'send/fail', payload: sendModeResolution.error })
      return
    }

    deps.dispatch({ type: 'send/start' })

    if (sendModeResolution.mode === 'text') {
      await handleTextModeSend({
        snapshot,
        currentActive,
        activeState,
        effectiveDraft,
        titleEligible,
        modelCommand,
        effectiveSettingsBySide,
        targetSides: [...targetSides],
        deps,
      })
      return
    }

    await handleImageModeSend({
      snapshot,
      currentActive,
      activeState,
      effectiveDraft,
      titleEligible,
      modelCommand,
      effectiveSettingsBySide,
      deps,
    })
  }
}
