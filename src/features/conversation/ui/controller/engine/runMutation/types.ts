import type { MutableRefObject } from 'react'
import type { RunLocation } from '../../../../application/queries/conversationIndexes'
import type { ConversationState } from '../../../../state/conversationState'
import type { Conversation, ImageTask, Run } from '../../../../../../types/conversation'

export interface UpdateRunImageInput {
  runId: string
  seq: number
  status?: 'pending' | 'success' | 'failed'
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  pendingStartedAt?: string
  requestUrl?: string
  providerTaskStatus?: Run['images'][number]['providerTaskStatus']
  threadState?: Run['images'][number]['threadState']
  resumeTransport?: Run['images'][number]['resumeTransport']
  fileRef?: string
  thumbRef?: string
  fullRef?: string
  refKind?: Run['images'][number]['refKind']
  refKey?: Run['images'][number]['refKey']
  serverTaskId?: Run['images'][number]['serverTaskId']
  serverTaskMeta?: Run['images'][number]['serverTaskMeta']
  bytes?: number
  error?: string
  errorCode?: Run['images'][number]['errorCode']
  detachedAt?: string
  lastResumeAttemptAt?: string
}

export interface UpdateRunTaskStateInput {
  runId: string
  status: NonNullable<Run['taskState']>['status']
  reason?: string
}

export interface UpdateImageTaskInput {
  taskId: string
  runId: string
  seq: number
  status?: ImageTask['status']
  requestUrl?: string
  providerTaskStatus?: ImageTask['providerTaskStatus']
  threadState?: ImageTask['threadState']
  resumeTransport?: ImageTask['resumeTransport']
  fileRef?: ImageTask['fileRef']
  thumbRef?: ImageTask['thumbRef']
  fullRef?: ImageTask['fullRef']
  refKind?: ImageTask['refKind']
  refKey?: ImageTask['refKey']
  serverTaskId?: ImageTask['serverTaskId']
  serverTaskMeta?: ImageTask['serverTaskMeta']
  bytes?: ImageTask['bytes']
  error?: ImageTask['error']
  errorCode?: ImageTask['errorCode']
  startedAt?: string
  completedAt?: string
}

export interface RunMutationDeps {
  stateRef: MutableRefObject<ConversationState>
  runLocationByConversationRef: MutableRefObject<Record<string, Map<string, RunLocation>>>
  upsertRuntimeTask: (conversationId: string, task: ImageTask) => void
  replaceRuntimeTasksForConversation: (conversationId: string, tasksById: Record<string, ImageTask>) => void
  persistConversation: (
    conversation: Conversation,
    options?: { saveStorage?: boolean; saveIndex?: boolean; skipSummaryUpdate?: boolean },
  ) => void
  scheduleConversationPersistence: (conversationId: string) => void
  notifyRunCompleted: (conversationId: string, run: Run) => void
}
