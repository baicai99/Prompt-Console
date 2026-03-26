import { useCallback } from 'react'
import { recordChatMemoryEvent } from '../../../performance/chatMemoryDiagnostics'

interface UseWorkspaceNavigationActionsInput {
  activeId: string | null
  activeConversationId: string | null
  setIsLeftNavDrawerOpen: (value: boolean) => void
  requestComposerFocus: () => void
  createNewConversation: () => void
  clearAllConversations: () => void
  removeConversation: (conversationId: string) => void
  switchConversation: (conversationId: string) => void
  setDraft: (value: string) => void
  appendDraftSourceImages: (files: File[]) => void
  cancelMessageRuns: (conversationId: string, messageId: string, runIds: string[]) => Promise<void>
}

export function useWorkspaceNavigationActions(input: UseWorkspaceNavigationActionsInput) {
  const handleCreateConversation = useCallback(() => {
    recordChatMemoryEvent('conversation-create')
    input.createNewConversation()
    input.requestComposerFocus()
  }, [input])

  const handleClearAllConversations = useCallback(() => {
    recordChatMemoryEvent('conversation-clear-all')
    input.clearAllConversations()
    input.requestComposerFocus()
  }, [input])

  const handleRemoveConversation = useCallback((conversationId: string) => {
    recordChatMemoryEvent('conversation-remove', conversationId)
    input.removeConversation(conversationId)
    if (conversationId === input.activeId) {
      input.requestComposerFocus()
    }
  }, [input])

  const handleSwitchConversation = useCallback((conversationId: string) => {
    recordChatMemoryEvent('conversation-switch', `${input.activeId ?? 'none'} -> ${conversationId}`)
    input.switchConversation(conversationId)
    input.setIsLeftNavDrawerOpen(false)
    input.requestComposerFocus()
  }, [input])

  const handleUsePrompt = useCallback((prompt: string) => {
    input.setDraft(prompt)
    input.requestComposerFocus()
  }, [input])

  const handleAppendDraftSourceImages = useCallback((files: File[]) => {
    input.appendDraftSourceImages(files)
    input.requestComposerFocus()
  }, [input])

  const handleCancelMessageRuns = useCallback(async (messageId: string, runIds: string[]) => {
    if (!input.activeConversationId) {
      return
    }
    await input.cancelMessageRuns(input.activeConversationId, messageId, runIds)
  }, [input])

  return {
    handleCreateConversation,
    handleClearAllConversations,
    handleRemoveConversation,
    handleSwitchConversation,
    handleUsePrompt,
    handleAppendDraftSourceImages,
    handleCancelMessageRuns,
  }
}
