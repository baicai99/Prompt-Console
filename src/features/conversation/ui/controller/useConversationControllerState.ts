import { useCallback } from 'react'
import type {
  ConversationCommand,
  ConversationControllerResult,
  ConversationReadModel,
  ConversationSystemJob,
} from '../../application/conversationControllerContract'
import { useConversationsEngine } from './useConversationEngine'
export {
  buildMessageArchivePrefix,
  collectBatchDownloadImagesByRunId,
  sortConversationSummariesByLastMessageTime,
} from './useConversationEngine'

export function useConversations(): ConversationControllerResult<ConversationReadModel> {
  const engine = useConversationsEngine()
  const read = engine.queries

  const dispatch = useCallback(async (command: ConversationCommand): Promise<void> => {
    switch (command.type) {
      case 'draft/set':
        engine.commands.setDraft(command.value)
        return
      case 'draft/source-images/append':
        engine.commands.appendDraftSourceImages(command.files)
        return
      case 'draft/source-images/remove':
        engine.commands.removeDraftSourceImage(command.imageId)
        return
      case 'draft/source-images/clear':
        engine.commands.clearDraftSourceImages()
        return
      case 'ui/advanced-variables/set':
        engine.commands.setShowAdvancedVariables(command.value)
        return
      case 'ui/dynamic-prompt/set':
        engine.commands.setDynamicPromptEnabled(command.value)
        return
      case 'ui/auto-rename-title/set':
        engine.commands.setAutoRenameConversationTitle(command.value)
        return
      case 'ui/auto-rename-title-model/set':
        engine.commands.setAutoRenameConversationTitleModelId(command.value)
        return
      case 'variables/panel-format/set':
        engine.commands.setPanelValueFormat(command.value)
        return
      case 'variables/panel-rows/set':
        engine.commands.setPanelVariables(command.value)
        return
      case 'settings/favorite-models/set':
        engine.commands.setFavoriteModelIds(command.value)
        return
      case 'settings/run-concurrency/set':
        engine.commands.setRunConcurrency(command.value)
        return
      case 'settings/run-concurrency-unlimited/set':
        engine.commands.setRunConcurrencyUnlimited(command.value)
        return
      case 'settings/image-runtime/update':
        engine.commands.setImageRuntimeSettings(command.value)
        return
      case 'settings/logging/update':
        engine.commands.setLoggingSettings(command.value)
        return
      case 'conversation/create':
        engine.commands.createNewConversation()
        return
      case 'conversation/clear-all':
        engine.commands.clearAllConversations()
        return
      case 'conversation/remove':
        engine.commands.removeConversation(command.conversationId)
        return
      case 'conversation/rename':
        engine.commands.renameConversation(command.conversationId, command.title)
        return
      case 'conversation/toggle-pin':
        engine.commands.togglePinConversation(command.conversationId)
        return
      case 'conversation/switch':
        engine.commands.switchConversation(command.conversationId)
        return
      case 'settings/side-mode/update':
        engine.commands.updateSideMode(command.mode)
        return
      case 'settings/side-count/update':
        engine.commands.updateSideCount(command.count)
        return
      case 'settings/side/update':
        engine.commands.updateSideSettings(command.side, command.patch)
        return
      case 'settings/sides/update':
        engine.commands.updateSidesSettings(command.sides, command.patch)
        return
      case 'settings/generation-mode/set':
        engine.commands.setGenerationMode(command.mode)
        return
      case 'settings/side-model/set':
        engine.commands.setSideModel(command.side, command.modelId)
        return
      case 'settings/side-model-current-mode/set':
        engine.commands.setSideModelForCurrentMode(command.side, command.modelId)
        return
      case 'settings/model-shortcut/apply':
        engine.commands.applyModelShortcut(command.modelId)
        return
      case 'settings/side-param/set':
        engine.commands.setSideModelParam(command.side, command.paramKey, command.value)
        return
      case 'settings/channels/set':
        engine.commands.setChannels(command.channels)
        return
      case 'send/execute':
        await engine.commands.sendDraft()
        return
      case 'history/load-older':
        await engine.commands.loadOlderMessages()
        return
      case 'run/retry':
        await engine.commands.retryRun(command.runId)
        return
      case 'run/edit-template':
        await engine.commands.editRunTemplate(command.runId)
        return
      case 'run/cancel-message':
        await engine.commands.cancelMessageRuns(command.conversationId, command.messageId, command.runIds)
        return
      case 'run/replay':
        await engine.commands.replayRunAsNewMessage(command.runId)
        return
      case 'download/run/all':
        engine.commands.downloadAllRunImages(command.runId)
        return
      case 'download/run/single':
        engine.commands.downloadSingleRunImage(command.runId, command.imageId)
        return
      case 'download/run/batch':
        engine.commands.downloadBatchRunImages(command.runId)
        return
      case 'download/message':
        await engine.commands.downloadMessageRunImages(command.runIds)
        return
      default: {
        const unreachable: never = command
        throw new Error(`Unsupported command: ${JSON.stringify(unreachable)}`)
      }
    }
  }, [engine.commands])

  const runSystemJob = useCallback(async (job: ConversationSystemJob): Promise<void> => {
    if (job.type === 'persistence/flush-pending') {
      await engine.maintenance.flushPendingPersistence()
      return
    }
    throw new Error(`Unsupported system job: ${JSON.stringify(job)}`)
  }, [engine.maintenance])

  return {
    read,
    dispatch,
    runSystemJob,
  }
}

export function useConversationControllerState(): ConversationControllerResult<ConversationReadModel> {
  return useConversations()
}
