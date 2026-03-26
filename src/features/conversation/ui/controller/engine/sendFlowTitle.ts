import type { MutableRefObject } from 'react'
import type { ConversationState } from '../../../state/conversationState'
import type {
  Conversation,
  ImageTask,
  Message,
  MessageAction,
  Run,
} from '../../../../../types/conversation'
import type { RunSourceImageRef } from '../../../../../types/image'
import {
  DEFAULT_CONVERSATION_TITLE,
  hasEligibleConversationTitleMessage,
  makeId,
  normalizeConversationTitleMode,
  summarizePromptAsTitle,
} from '../../../../../utils/chat'
import type { ConversationProviderGatewayPort } from '../../../application/ports/providerGatewayPort'
import {
  buildConversationTitleGenerationMessages,
  cleanGeneratedConversationTitle,
  finalizeConversationTitleDisplay,
  resolveConversationTitleChannel,
} from '../../../domain/conversationTitleDomain'
import { parseScopedModelId } from '../../../../../utils/modelIdentity'

interface ConversationTitleDeps {
  stateRef: MutableRefObject<ConversationState>
  ensureConversationLoaded: (conversationId: string) => Promise<void>
  persistConversation: (conversation: Conversation) => void
  streamTextFn: ConversationProviderGatewayPort['streamText']
}

interface MaybeGenerateConversationTitleInput {
  conversationId: string
  titleSource: string
  shouldGenerateTitle: boolean
  preferredChannelId?: string | null
}

export function createConversationTitleHelpers(deps: ConversationTitleDeps) {
  const {
    stateRef,
    ensureConversationLoaded,
    persistConversation,
    streamTextFn,
  } = deps

  const resolveConversationTitleState = (conversation: Conversation) => {
    const summaryTitle = stateRef.current.summaries.find((item) => item.id === conversation.id)?.title?.trim() ?? ''
    const resolvedConversationTitle =
      summaryTitle.length > 0 && summaryTitle !== conversation.title && conversation.titleMode === 'default'
        ? summaryTitle
        : conversation.title
    const resolvedConversationTitleMode =
      resolvedConversationTitle === conversation.title
        ? conversation.titleMode
        : normalizeConversationTitleMode(undefined, resolvedConversationTitle)

    return {
      title: resolvedConversationTitle,
      titleMode: resolvedConversationTitleMode,
    }
  }

  const shouldGenerateConversationTitle = (conversation: Conversation, titleEligible: boolean): boolean => {
    const autoRenameConversationTitle = stateRef.current.autoRenameConversationTitle
    const hadEligibleUserMessage = hasEligibleConversationTitleMessage(conversation.messages)
    const resolvedTitleState = resolveConversationTitleState(conversation)

    return titleEligible && autoRenameConversationTitle && !hadEligibleUserMessage && resolvedTitleState.titleMode === 'default'
  }

  const maybeGenerateConversationTitle = (input: MaybeGenerateConversationTitleInput) => {
    const normalizedTitleSource = input.titleSource.trim()
    const snapshot = stateRef.current
    const titleModelId = snapshot.autoRenameConversationTitleModelId
    const titleChannel = resolveConversationTitleChannel(snapshot.channels, titleModelId, input.preferredChannelId)
    const fallbackTitle = summarizePromptAsTitle(normalizedTitleSource)

    if (
      !input.shouldGenerateTitle
      || !snapshot.autoRenameConversationTitle
      || normalizedTitleSource.length === 0
    ) {
      return
    }

    const persistResolvedTitle = async (nextTitle: string) => {
      if (!nextTitle || nextTitle === DEFAULT_CONVERSATION_TITLE) {
        return
      }

      let latestConversation = stateRef.current.contents[input.conversationId] ?? null
      if (!latestConversation) {
        await ensureConversationLoaded(input.conversationId)
        latestConversation = stateRef.current.contents[input.conversationId] ?? null
      }

      const latestSnapshot = stateRef.current
      if (
        !latestSnapshot.autoRenameConversationTitle
        || !latestConversation
        || latestConversation.titleMode !== 'default'
      ) {
        return
      }

      persistConversation({
        ...latestConversation,
        title: nextTitle,
        titleMode: 'auto',
        updatedAt: new Date().toISOString(),
      })
    }

    if (!titleModelId || !titleChannel) {
      void persistResolvedTitle(fallbackTitle)
      return
    }

    const resolvedTitleModelId = titleModelId
    const resolvedTitleChannel = titleChannel

    void (async () => {
      let generatedTitle = ''
      try {
        await streamTextFn({
          channel: resolvedTitleChannel,
          request: {
            modelId: parseScopedModelId(resolvedTitleModelId)?.modelId ?? resolvedTitleModelId,
            messages: buildConversationTitleGenerationMessages(normalizedTitleSource),
            temperature: 0.2,
            maxTokens: 48,
            allowNonStreamFallback: true,
          },
          onDelta: (chunk) => {
            generatedTitle += chunk
          },
        })
      } catch {
        await persistResolvedTitle(fallbackTitle)
        return
      }

      const cleanedTitle = cleanGeneratedConversationTitle(generatedTitle)
      const nextTitle =
        cleanedTitle
          ? finalizeConversationTitleDisplay(cleanedTitle)
          : fallbackTitle

      await persistResolvedTitle(nextTitle)
    })()
  }

  const appendConversationEntry = (
    conversation: Conversation,
    userContent: string,
    assistantContent: string,
    runs: Run[] = [],
    _titleSource?: string,
    userSourceImages: RunSourceImageRef[] = [],
    assistantActions?: MessageAction[],
    options?: { titleEligible?: boolean; taskEntries?: ImageTask[] },
  ): Conversation => {
    const now = new Date().toISOString()
    const titleEligible = options?.titleEligible ?? true
    const resolvedTitleState = resolveConversationTitleState(conversation)
    const userMessage: Message = {
      id: makeId(),
      createdAt: now,
      role: 'user',
      content: userContent,
      titleEligible,
      sourceImages: userSourceImages,
    }
    const assistantMessage: Message = {
      id: makeId(),
      createdAt: now,
      role: 'assistant',
      content: assistantContent,
      runs,
      taskIds: options?.taskEntries?.map((task) => task.taskId) ?? [],
      actions: assistantActions,
    }

    return {
      ...conversation,
      title: resolvedTitleState.title,
      titleMode: resolvedTitleState.titleMode,
      updatedAt: now,
      tasksById: {
        ...(conversation.tasksById ?? {}),
        ...Object.fromEntries((options?.taskEntries ?? []).map((task) => [task.taskId, task])),
      },
      messages: [...conversation.messages, userMessage, assistantMessage],
    }
  }

  return {
    resolveConversationTitleState,
    shouldGenerateConversationTitle,
    maybeGenerateConversationTitle,
    appendConversationEntry,
  }
}
