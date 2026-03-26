import { useMemo, useState } from 'react'
import { conversationModelCatalogPort } from '../../application/ports/modelCatalogPort'
import { sortConversationSummariesByLastMessageTime } from '../../application/queries/conversationView'
import { createConversationRepository } from '../../infra/conversationRepository'
import { createInitialConversationState } from '../../state/conversationState'

export function useConversationBootstrap() {
  const repository = useMemo(() => createConversationRepository(), [])
  const [initialState] = useState(() => {
    const channels = repository.loadChannels()
    const modelCatalog = conversationModelCatalogPort.getModelCatalogFromChannels(channels)
    const initialLoad = repository.load()
    const initialSummaries = sortConversationSummariesByLastMessageTime(initialLoad.summaries, {})

    return createInitialConversationState({
      channels,
      modelCatalog,
      initialLoad: {
        summaries: initialSummaries,
        contents: {},
        activeId: initialLoad.activeId,
      },
      initialStaged: repository.loadStagedSettings(),
    })
  })

  return {
    repository,
    initialState,
  }
}
