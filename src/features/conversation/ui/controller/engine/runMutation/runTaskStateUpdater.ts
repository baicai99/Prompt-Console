import { conversationLoggingPort } from '../../../../application/ports/loggingPort'
import { createRunTaskState } from '../../../../domain/runTaskState'
import type { RunMutationDeps, UpdateRunTaskStateInput } from './types'

const { emitImageTaskDebug } = conversationLoggingPort

export function createRunTaskStateUpdater(deps: Pick<
  RunMutationDeps,
  'stateRef' | 'runLocationByConversationRef' | 'persistConversation' | 'scheduleConversationPersistence'
>) {
  return (conversationId: string, input: UpdateRunTaskStateInput) => {
    const snapshot = deps.stateRef.current
    const currentConversation = snapshot.contents[conversationId]
    if (!currentConversation) {
      return
    }

    const locationMap = deps.runLocationByConversationRef.current[conversationId]
    const location = locationMap?.get(input.runId)
    if (!location) {
      return
    }

    const message = currentConversation.messages[location.messageIndex]
    const runs = message.runs ?? []
    const run = runs[location.runIndex]
    if (!run || run.id !== input.runId) {
      return
    }

    const nextTaskState = createRunTaskState({
      status: input.status,
      previous: run.taskState,
      reason: input.reason,
    })
    if (
      run.taskState?.status === nextTaskState.status &&
      run.taskState?.reason === nextTaskState.reason
    ) {
      return
    }

    const nextRuns = [...runs]
    nextRuns[location.runIndex] = {
      ...run,
      taskState: nextTaskState,
    }
    const nextMessages = [...currentConversation.messages]
    nextMessages[location.messageIndex] = {
      ...message,
      runs: nextRuns,
    }

    deps.persistConversation({
      ...currentConversation,
      updatedAt: nextTaskState.updatedAt,
      messages: nextMessages,
    }, {
      saveStorage: false,
      saveIndex: false,
      skipSummaryUpdate: true,
    })
    emitImageTaskDebug({
      stage: 'run_task_state_updated',
      runId: input.runId,
      batchId: run.batchId,
      previousState: run.taskState?.status,
      nextState: nextTaskState.status,
      detail: {
        reason: nextTaskState.reason,
      },
    })
    deps.scheduleConversationPersistence(conversationId)
  }
}
