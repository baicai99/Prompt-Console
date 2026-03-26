import { normalizeImageRuntimeSettings } from '../../../../utils/imageRuntimeSettings'
import { normalizeLoggingSettings } from '../../../../utils/loggingSettings'
import { filterActiveImageTasksRecord, isActiveImageTask } from '../../domain/imageTaskMemory'
import type { ConversationAction, ConversationState } from './types'

function reduceComposerState(state: ConversationState, action: ConversationAction): ConversationState | null {
  switch (action.type) {
    case 'draft/set':
      return { ...state, draft: action.payload, sendError: '' }
    case 'send/start':
      return { ...state, isSending: true, sendError: '' }
    case 'send/succeed':
      return { ...state, isSending: false, sendError: '' }
    case 'send/fail':
      return { ...state, isSending: false, sendError: action.payload }
    case 'send/clearError':
      return { ...state, sendError: '' }
    case 'variables/setPanelRows':
      return { ...state, panelVariables: action.payload, sendError: '' }
    case 'variables/setPanelValueFormat':
      return { ...state, panelValueFormat: action.payload, sendError: '' }
    case 'ui/setAdvancedVariables':
      return { ...state, showAdvancedVariables: action.payload }
    case 'ui/setDynamicPromptEnabled':
      return { ...state, dynamicPromptEnabled: action.payload, sendError: '' }
    case 'ui/setAutoRenameConversationTitle':
      return { ...state, autoRenameConversationTitle: action.payload, sendError: '' }
    case 'ui/setAutoRenameConversationTitleModelId':
      return { ...state, autoRenameConversationTitleModelId: action.payload, sendError: '' }
    default:
      return null
  }
}

function reduceSettingsState(state: ConversationState, action: ConversationAction): ConversationState | null {
  switch (action.type) {
    case 'settings/setFavoriteModels':
      return { ...state, favoriteModelIds: action.payload, sendError: '' }
    case 'settings/setRunConcurrency':
      return { ...state, runConcurrency: Math.max(1, Math.floor(action.payload)), sendError: '' }
    case 'settings/setRunConcurrencyUnlimited':
      return { ...state, runConcurrencyUnlimited: action.payload, sendError: '' }
    case 'settings/setImageRuntimeSettings':
      return {
        ...state,
        imageRuntimeSettings: normalizeImageRuntimeSettings({
          ...state.imageRuntimeSettings,
          ...action.payload,
        }),
        sendError: '',
      }
    case 'settings/setLoggingSettings':
      return {
        ...state,
        loggingSettings: normalizeLoggingSettings({
          ...state.loggingSettings,
          ...action.payload,
          features: {
            ...state.loggingSettings.features,
            ...(action.payload.features ?? {}),
          },
        }),
        sendError: '',
      }
    case 'settings/updateSide':
      return {
        ...state,
        stagedSideMode: action.payload.sideMode,
        stagedSideCount: action.payload.sideCount,
        stagedSettingsBySide: action.payload.settingsBySide,
      }
    case 'channels/set':
      return { ...state, channels: action.payload }
    default:
      return null
  }
}

function reduceConversationDataState(state: ConversationState, action: ConversationAction): ConversationState | null {
  switch (action.type) {
    case 'conversation/sync':
      return {
        ...state,
        summaries: action.payload.summaries,
        contents: Object.fromEntries(
          Object.entries(action.payload.contents).map(([conversationId, conversation]) => [
            conversationId,
            {
              ...conversation,
              tasksById: Object.keys(filterActiveImageTasksRecord(conversation.tasksById)).length > 0
                ? filterActiveImageTasksRecord(conversation.tasksById)
                : undefined,
            },
          ]),
        ),
        runtimeTasksByConversationId: Object.fromEntries(
          Object.entries(action.payload.contents).map(([conversationId, conversation]) => [
            conversationId,
            filterActiveImageTasksRecord({
              ...filterActiveImageTasksRecord(conversation.tasksById),
              ...filterActiveImageTasksRecord(state.runtimeTasksByConversationId[conversationId]),
            }),
          ]),
        ),
      }
    case 'conversation/content-upsert':
      return {
        ...state,
        contents: {
          ...state.contents,
          [action.payload.id]: {
            ...action.payload,
            tasksById: Object.keys(filterActiveImageTasksRecord(action.payload.tasksById)).length > 0
              ? filterActiveImageTasksRecord(action.payload.tasksById)
              : undefined,
          },
        },
      }
    case 'conversation/runtime-task-upsert':
      if (!isActiveImageTask(action.payload.task)) {
        return {
          ...state,
          runtimeTasksByConversationId: {
            ...state.runtimeTasksByConversationId,
            [action.payload.conversationId]: filterActiveImageTasksRecord(
              Object.fromEntries(
                Object.entries(state.runtimeTasksByConversationId[action.payload.conversationId] ?? {})
                  .filter(([taskId]) => taskId !== action.payload.task.taskId),
              ),
            ),
          },
        }
      }
      return {
        ...state,
        runtimeTasksByConversationId: {
          ...state.runtimeTasksByConversationId,
          [action.payload.conversationId]: {
            ...(state.runtimeTasksByConversationId[action.payload.conversationId] ?? {}),
            [action.payload.task.taskId]: action.payload.task,
          },
        },
      }
    case 'conversation/runtime-tasks-replace':
      return {
        ...state,
        runtimeTasksByConversationId: {
          ...state.runtimeTasksByConversationId,
          [action.payload.conversationId]: filterActiveImageTasksRecord(action.payload.tasksById),
        },
      }
    case 'conversation/switch':
      return { ...state, activeId: action.payload }
    case 'conversation/clear':
      return {
        ...state,
        summaries: [],
        contents: {},
        runtimeTasksByConversationId: {},
        activeId: null,
        draft: '',
        sendError: '',
      }
    default:
      return null
  }
}

export function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  return (
    reduceComposerState(state, action)
    ?? reduceSettingsState(state, action)
    ?? reduceConversationDataState(state, action)
    ?? state
  )
}
