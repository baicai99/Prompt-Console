import type { Conversation, Message, Side, SingleSideSettings } from '../../../../../../types/conversation'
import { createConversation, makeId } from '../../../../../../utils/chat'
import { parseScopedModelId } from '../../../../../../utils/modelIdentity'
import { buildTextRequestMessages } from '../sendFlowUtils'
import { isAbortLikeError } from '../helpers'
import type { ActiveConversationState, AppliedModelCommand, SendDraftHelpers, SendFlowDeps } from './types'

interface HandleTextModeSendInput {
  snapshot: SendFlowDeps['stateRef']['current']
  currentActive: Conversation | null
  activeState: ActiveConversationState
  effectiveDraft: string
  titleEligible: boolean
  modelCommand: AppliedModelCommand | null
  effectiveSettingsBySide: Record<Side, SingleSideSettings>
  targetSides: Side[]
  deps: SendFlowDeps & SendDraftHelpers
}

export async function handleTextModeSend(input: HandleTextModeSendInput): Promise<void> {
  const {
    snapshot,
    currentActive,
    activeState,
    effectiveDraft,
    titleEligible,
    modelCommand,
    effectiveSettingsBySide,
    targetSides,
    deps,
  } = input
  const primarySide = targetSides[0] ?? 'single'
  const textSettings = effectiveSettingsBySide[primarySide]
  const textChannel = snapshot.channels.find((item) => item.id === textSettings?.channelId)
  if (!textSettings || !textChannel) {
    deps.dispatch({ type: 'send/fail', payload: '当前文本模式未找到可用渠道配置。' })
    return
  }

  if (deps.draftSourceImagesRef.current.length > 0) {
    deps.notifier.info('文本模式下不会携带参考图，已自动忽略。')
  }

  const textMessages = buildTextRequestMessages(currentActive, effectiveDraft)
  const baseConversation =
    currentActive ??
    createConversation(activeState.activeSettingsBySide, activeState.activeSideMode, activeState.activeSideCount)
  const conversationWithLatestSettings = {
    ...baseConversation,
    sideMode: activeState.activeSideMode,
    sideCount: activeState.activeSideCount,
    settingsBySide: activeState.activeSettingsBySide,
  }
  const assistantInitialContent = modelCommand?.scope === 'temporary'
    ? `已临时切换到 ${modelCommand.model.name} 执行本次文本请求。\n\n`
    : ''
  const shouldGenerateTitle = deps.shouldGenerateConversationTitle(conversationWithLatestSettings, titleEligible)
  const conversationWithEntry = deps.appendConversationEntry(
    conversationWithLatestSettings,
    snapshot.draft,
    modelCommand?.scope === 'temporary' ? assistantInitialContent.trim() : '',
    [],
    effectiveDraft,
    [],
    undefined,
    { titleEligible },
  )
  const streamingAssistantMessage: Message = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    role: 'assistant',
    content: '',
  }
  const updatedConversation = modelCommand?.scope === 'temporary'
    ? {
        ...conversationWithEntry,
        updatedAt: streamingAssistantMessage.createdAt,
        messages: [...conversationWithEntry.messages, streamingAssistantMessage],
      }
    : conversationWithEntry
  deps.persistConversation(updatedConversation)
  deps.maybeGenerateConversationTitle({
    conversationId: updatedConversation.id,
    titleSource: effectiveDraft,
    shouldGenerateTitle,
    preferredChannelId: textChannel.id,
  })
  if (!currentActive) {
    deps.setActiveConversation(updatedConversation.id)
  }
  const assistantScrollTargetMessageId = modelCommand?.scope === 'temporary'
    ? conversationWithEntry.messages.at(-1)?.id ?? null
    : updatedConversation.messages.at(-1)?.id ?? null
  deps.setSendScrollTargetMessageId(assistantScrollTargetMessageId)
  deps.setSendScrollTrigger((prev) => prev + 1)

  const assistantMessageId = modelCommand?.scope === 'temporary'
    ? streamingAssistantMessage.id
    : updatedConversation.messages[updatedConversation.messages.length - 1]?.id
  const targetConversationId = updatedConversation.id

  deps.actions.setDraft('')
  deps.clearDraftSourceImages()
  if (modelCommand?.scope === 'temporary') {
    deps.notifier.success(`本次已临时切换到 ${modelCommand.model.name}`)
  }

  if (!assistantMessageId) {
    deps.dispatch({ type: 'send/fail', payload: '助手消息初始化失败。' })
    return
  }

  let streamedText = ''
  try {
    await deps.streamText({
      channel: textChannel,
      request: {
        modelId: parseScopedModelId(textSettings.textModelId ?? textSettings.modelId)?.modelId
          ?? (textSettings.textModelId ?? textSettings.modelId),
        messages: textMessages,
      },
      onDelta: (chunk) => {
        streamedText += chunk
        deps.updateAssistantMessageContent(targetConversationId, assistantMessageId, streamedText)
      },
    })

    const finalText = streamedText.trim().length > 0 ? streamedText : '（未返回文本内容）'
    deps.updateAssistantMessageContent(targetConversationId, assistantMessageId, finalText, {
      immediateStorage: true,
    })
    deps.dispatch({ type: 'send/succeed' })
  } catch (error) {
    const reason = error instanceof Error ? error.message : '文本生成失败'
    const fallbackText = streamedText.trim().length > 0 ? streamedText : `文本生成失败：${reason}`
    deps.updateAssistantMessageContent(targetConversationId, assistantMessageId, fallbackText, {
      immediateStorage: true,
    })
    if (isAbortLikeError(error)) {
      deps.dispatch({ type: 'send/succeed' })
      return
    }
    deps.dispatch({ type: 'send/fail', payload: reason })
  }
}
