import { useMemo, useReducer } from 'react'
import type { PanelValueFormat, PanelVariableRow } from '../domain/types'
import { createInitialConversationState } from './conversationState/initialState'
import { conversationReducer } from './conversationState/reducers'
import { conversationSelectors } from './conversationState/selectors'
import type { ConversationSelectors } from './conversationState/selectors'
import type {
  ConversationAction,
  ConversationComposerState,
  ConversationContentState,
  ConversationRuntimeState,
  ConversationSettingsState,
  ConversationState,
} from './conversationState/types'

export type {
  ConversationAction,
  ConversationComposerState,
  ConversationContentState,
  ConversationRuntimeState,
  ConversationSelectors,
  ConversationSettingsState,
  ConversationState,
}

export {
  createInitialConversationState,
  conversationReducer,
  conversationSelectors,
}

export function useConversationState(initial: ConversationState) {
  const [state, dispatch] = useReducer(conversationReducer, initial)

  const actions = useMemo(
    () => ({
      setDraft: (value: string) => dispatch({ type: 'draft/set', payload: value }),
      setPanelVariables: (value: PanelVariableRow[]) => dispatch({ type: 'variables/setPanelRows', payload: value }),
      setPanelValueFormat: (value: PanelValueFormat) =>
        dispatch({ type: 'variables/setPanelValueFormat', payload: value }),
      setAdvancedVariables: (value: boolean) => dispatch({ type: 'ui/setAdvancedVariables', payload: value }),
      setDynamicPromptEnabled: (value: boolean) => dispatch({ type: 'ui/setDynamicPromptEnabled', payload: value }),
      setAutoRenameConversationTitle: (value: boolean) =>
        dispatch({ type: 'ui/setAutoRenameConversationTitle', payload: value }),
      setAutoRenameConversationTitleModelId: (value: string | null) =>
        dispatch({ type: 'ui/setAutoRenameConversationTitleModelId', payload: value }),
    }),
    [],
  )

  return { state, dispatch, actions }
}
