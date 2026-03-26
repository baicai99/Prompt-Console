import { createAssistantMessageMutations } from './runMutation/assistantMessageMutations'
import { createCancelRunMutations } from './runMutation/cancelRunMutations'
import { createRunImagePatchApplier } from './runMutation/runImagePatchApplier'
import { createRunTaskStateUpdater } from './runMutation/runTaskStateUpdater'
import { findRunInConversation, markFailedImagesPending, mergeRetryResultIntoRun } from './runMutation/retryMerge'
import { createTaskMirrorUpdater } from './runMutation/taskMirrorUpdater'
import type { RunMutationDeps } from './runMutation/types'

export type {
  UpdateImageTaskInput,
  UpdateRunImageInput,
  UpdateRunTaskStateInput,
} from './runMutation/types'

export function createRunMutationModule(deps: RunMutationDeps) {
  const {
    stateRef,
    runLocationByConversationRef,
    upsertRuntimeTask,
    replaceRuntimeTasksForConversation,
    persistConversation,
    scheduleConversationPersistence,
    notifyRunCompleted,
  } = deps

  const { updateAssistantMessageContent, replaceRunsInConversation, appendRunsToMessage } = createAssistantMessageMutations({
    stateRef,
    runLocationByConversationRef,
    persistConversation,
    scheduleConversationPersistence,
    notifyRunCompleted,
  })
  const { cancelMessageRunsInConversation, classifyRunImageError } = createCancelRunMutations({
    stateRef,
    replaceRuntimeTasksForConversation,
    persistConversation,
    scheduleConversationPersistence,
  })

  const updateRunImageInConversation = createRunImagePatchApplier({
    stateRef,
    runLocationByConversationRef,
    upsertRuntimeTask,
    persistConversation,
    scheduleConversationPersistence,
    notifyRunCompleted,
  })
  const updateRunTaskStateInConversation = createRunTaskStateUpdater({
    stateRef,
    runLocationByConversationRef,
    persistConversation,
    scheduleConversationPersistence,
  })
  const updateImageTaskInConversation = createTaskMirrorUpdater({
    stateRef,
    upsertRuntimeTask,
  })

  return {
    updateAssistantMessageContent,
    replaceRunsInConversation,
    appendRunsToMessage,
    updateRunImageInConversation,
    updateRunTaskStateInConversation,
    updateImageTaskInConversation,
    findRunInConversation,
    mergeRetryResultIntoRun,
    markFailedImagesPending,
    cancelMessageRunsInConversation,
    classifyRunImageError,
  }
}
