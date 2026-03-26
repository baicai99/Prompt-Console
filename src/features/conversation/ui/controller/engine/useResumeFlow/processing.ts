import type { MutableRefObject } from 'react'
import type { ProviderRequestRunner } from '../../../../../../types/provider'
import type { ConversationState } from '../../../../state/conversationState'
import type { Conversation, ImageTask, Run } from '../../../../../../types/conversation'
import { runWithConcurrency } from '../../../../../../utils/runWithConcurrency'
import { toImageRuntimeMilliseconds } from '../../../../../../utils/imageRuntimeSettings'
import { toEpoch } from '../helpers'
import { conversationLoggingPort } from '../../../../application/ports/loggingPort'
import { conversationRequestLimiterPort } from '../../../../application/ports/requestLimiterPort'
import { conversationWindowLeasePort } from '../../../../application/ports/windowLeasePort'
import { createResumeUpdateBuffer, type UpdateRunImageInput } from '../../../../application/runtime/resumeUpdateBuffer'
import { createResumeStateTransitions } from '../../../../application/runtime/resumeStateTransitions'
import { createImageResultReferenceStore } from '../../../../application/imageResultReferenceStore'
import {
  buildFairResumableImageQueue as buildFairResumableImageQueueFromQueries,
  findRunMessageId,
  type ResumableImageEntry,
} from '../../../../application/queries/conversationQueries'
import {
  buildFailedRunImagePatch,
  logImageTaskLifecycleBoundary,
} from '../../../../application/taskLifecycle/shared'

export type { UpdateRunImageInput } from '../../../../application/runtime/resumeUpdateBuffer'

export interface ResumeTaskService {
  resumeTask: (input: {
    channel: NonNullable<ConversationState['channels'][number]>
    taskId?: string
    taskMeta?: Record<string, string>
    signal?: AbortSignal
    runWithRequestLimit?: ProviderRequestRunner
  }) => Promise<{
    state: 'pending' | 'failed' | 'success'
    src?: string
    error?: string
    providerTaskStatus?: string
    serverTaskId?: string
    serverTaskMeta?: Record<string, string>
  }>
  streamTask: (input: {
    channel: NonNullable<ConversationState['channels'][number]>
    taskId?: string
    taskMeta?: Record<string, string>
    signal?: AbortSignal
    onEvent: (event: {
      state: 'pending' | 'failed' | 'success'
      src?: string
      error?: string
      providerTaskStatus?: string
      serverTaskId?: string
      serverTaskMeta?: Record<string, string>
    }) => void
  }) => Promise<{ state: 'unsupported' | 'aborted' | 'completed' }>
}

export interface ProcessPendingImageResumesInput {
  conversationId: string
  snapshot: ConversationState
  requestedConcurrency?: number
  resumeOwnerId: string
  resumingImageIdsRef: MutableRefObject<Set<string>>
  taskResumeService: ResumeTaskService
  registerActiveRun: (conversationId: string, messageId: string, runId: string, controller: AbortController) => void
  unregisterActiveRun: (conversationId: string, runId: string) => void
  isRunStillActive: (conversationId: string, runId: string) => boolean
  isRunOwnedByMessage: (conversationId: string, runId: string, messageId: string) => boolean
  updateImageTaskInConversation: (conversationId: string, input: {
    taskId: string
    runId: string
    seq: number
    status?: ImageTask['status']
    requestUrl?: string
    providerTaskStatus?: ImageTask['providerTaskStatus']
    threadState?: ImageTask['threadState']
    resumeTransport?: ImageTask['resumeTransport']
    fileRef?: string
    thumbRef?: string
    fullRef?: string
    refKind?: ImageTask['refKind']
    refKey?: ImageTask['refKey']
    serverTaskId?: ImageTask['serverTaskId']
    serverTaskMeta?: ImageTask['serverTaskMeta']
    bytes?: ImageTask['bytes']
    error?: ImageTask['error']
    errorCode?: ImageTask['errorCode']
    startedAt?: string
    completedAt?: string
  }) => void
  updateRunImageInConversation: (conversationId: string, input: UpdateRunImageInput) => void
  updateRunTaskStateInConversation: (
    conversationId: string,
    input: {
      runId: string
      status: NonNullable<Run['taskState']>['status']
      reason?: string
    },
  ) => void
}

export interface ProcessBackgroundPendingTaskConversationsInput {
  conversationIds: string[]
  ensureConversationLoaded: (conversationId: string) => Promise<void>
  resumePendingImagesForConversation: (conversationId: string) => Promise<void>
}

const RESUME_TASK_CONCURRENCY = 4
const BACKGROUND_CONVERSATION_RESUME_CONCURRENCY = 2
const IMAGE_RESUME_LEASE_TTL_MS = 75_000
const { createImageRequestRunner } = conversationRequestLimiterPort
const { acquireWindowLease, isWindowLeaseOwner, releaseWindowLease } = conversationWindowLeasePort
const { emitImageTaskDebug, getChannelDebugMeta, summarizeProviderPayload } = conversationLoggingPort

function buildImageResumeLeaseKey(input: {
  conversationId: string
  runId: string
  imageId: string
}): string {
  return `m3:image-resume:${input.conversationId}:${input.runId}:${input.imageId}`
}

export function buildFairResumableImageQueue(
  conversation: Conversation,
  runtimeTasksById?: Record<string, ImageTask>,
): ResumableImageEntry[] {
  return buildFairResumableImageQueueFromQueries(conversation, runtimeTasksById, toEpoch)
}

export async function processPendingImageResumes(input: ProcessPendingImageResumesInput): Promise<void> {
  const {
    conversationId,
    snapshot,
    resumeOwnerId,
    resumingImageIdsRef,
    taskResumeService,
    registerActiveRun,
    unregisterActiveRun,
    isRunStillActive,
    isRunOwnedByMessage,
    updateImageTaskInConversation,
    updateRunImageInConversation,
    updateRunTaskStateInConversation,
  } = input
  const conversation = snapshot.contents[conversationId]
  if (!conversation) {
    return
  }
  const resumable = buildFairResumableImageQueue(
    conversation,
    snapshot.runtimeTasksByConversationId?.[conversationId],
  )
  const requestedConcurrency = Math.max(1, Math.floor(input.requestedConcurrency ?? RESUME_TASK_CONCURRENCY))
  const { generationTimeoutMs } = toImageRuntimeMilliseconds(snapshot.imageRuntimeSettings)
  const runWithRequestLimit = createImageRequestRunner(requestedConcurrency, 'resume')
  const imageResultReferenceStore = createImageResultReferenceStore()
  const resumeUpdateBuffer = createResumeUpdateBuffer({
    conversationId,
    updateImageTaskInConversation,
    updateRunImageInConversation,
    updateRunTaskStateInConversation,
  })
  const {
    queueTaskUpdate,
    queueRunImageUpdate,
    queueRunTaskStateUpdate,
    flush: flushQueuedResumeUpdates,
  } = resumeUpdateBuffer

  await runWithConcurrency({
    items: resumable,
    concurrency: Math.min(requestedConcurrency, resumable.length || 1),
    worker: async (entry, index) => {
      const imageKey = `${conversationId}:${entry.task.taskId}`
      const leaseKey = buildImageResumeLeaseKey({
        conversationId,
        runId: entry.run.id,
        imageId: entry.task.taskId,
      })
      if (resumingImageIdsRef.current.has(imageKey)) {
        return
      }
      const acquired = acquireWindowLease({
        leaseKey,
        ownerId: resumeOwnerId,
        ttlMs: IMAGE_RESUME_LEASE_TTL_MS,
      })
      if (!acquired && !isWindowLeaseOwner({ leaseKey, ownerId: resumeOwnerId })) {
        return
      }

      const channel = snapshot.channels.find((item) => item.id === entry.run.channelId)
      if (!channel) {
        const attemptedAt = new Date().toISOString()
        releaseWindowLease({ leaseKey, ownerId: resumeOwnerId })
        queueRunImageUpdate({
          runId: entry.run.id,
          seq: entry.image.seq,
          ...buildFailedRunImagePatch({
            queuedAt: entry.image.queuedAt ?? entry.task.queuedAt ?? attemptedAt,
            startedAt: entry.image.startedAt ?? entry.task.startedAt ?? attemptedAt,
            completedAt: attemptedAt,
            error: '图片生成失败',
            errorCode: 'unknown',
          }),
          lastResumeAttemptAt: attemptedAt,
        })
        flushQueuedResumeUpdates()
        return
      }

      const messageId = findRunMessageId(conversation, entry.run.id)
      if (!messageId) {
        releaseWindowLease({ leaseKey, ownerId: resumeOwnerId })
        return
      }

      if (isRunStillActive(conversationId, entry.run.id)) {
        releaseWindowLease({ leaseKey, ownerId: resumeOwnerId })
        return
      }

      resumingImageIdsRef.current.add(imageKey)
      const controller = new AbortController()
      registerActiveRun(conversationId, messageId, entry.run.id, controller)
      const attemptedAt = new Date().toISOString()
      let settled = false
      const fallbackServerTaskId = entry.task.serverTaskId ?? entry.image.serverTaskId
      const fallbackServerTaskMeta = entry.task.serverTaskMeta ?? entry.image.serverTaskMeta
      const canApplyUpdate = () => (
        isRunStillActive(conversationId, entry.run.id)
        && isRunOwnedByMessage(conversationId, entry.run.id, messageId)
      )
      const pendingSinceEpoch = toEpoch(
        entry.image.startedAt
        ?? entry.image.queuedAt
        ?? entry.image.pendingStartedAt
        ?? entry.task.startedAt
        ?? entry.task.queuedAt
        ?? entry.run.taskState?.generatingStartedAt
        ?? entry.run.createdAt,
      )
      if (pendingSinceEpoch > 0 && Date.now() - pendingSinceEpoch >= generationTimeoutMs) {
        queueTaskUpdate({
          taskId: entry.task.taskId,
          runId: entry.run.id,
          seq: entry.image.seq,
          status: 'timeout',
          threadState: 'settled',
          error: '图片生成超时（超过 10 分钟）',
          errorCode: 'timeout',
          completedAt: attemptedAt,
        })
        queueRunTaskStateUpdate({
          runId: entry.run.id,
          status: 'timeout',
          reason: 'generating-timeout',
        })
        queueRunImageUpdate({
          runId: entry.run.id,
          seq: entry.image.seq,
          ...buildFailedRunImagePatch({
            queuedAt: entry.image.queuedAt ?? entry.task.queuedAt ?? attemptedAt,
            startedAt: entry.image.startedAt ?? entry.task.startedAt ?? attemptedAt,
            completedAt: attemptedAt,
            error: '图片生成超时（超过 10 分钟）',
            errorCode: 'timeout',
          }),
          lastResumeAttemptAt: attemptedAt,
        })
        flushQueuedResumeUpdates()
        unregisterActiveRun(conversationId, entry.run.id)
        releaseWindowLease({ leaseKey, ownerId: resumeOwnerId })
        resumingImageIdsRef.current.delete(imageKey)
        return
      }
      emitImageTaskDebug({
        stage: 'resume_flow_entered',
        conversationId,
        runId: entry.run.id,
        batchId: entry.run.batchId,
        taskId: entry.task.taskId,
        imageId: entry.image.id,
        seq: entry.image.seq,
        model: entry.run.modelId,
        ...getChannelDebugMeta(channel),
        parsed: {
          taskStatus: entry.task.status,
          providerTaskStatus: entry.task.providerTaskStatus ?? entry.image.providerTaskStatus,
          serverTaskId: fallbackServerTaskId,
          serverTaskMeta: fallbackServerTaskMeta,
        },
      })
      const { applyPendingState, applyFailedState, applySuccessState } = createResumeStateTransitions({
        conversationId,
        entry,
        channel,
        attemptedAt,
        fallbackServerTaskId,
        fallbackServerTaskMeta,
        canApplyUpdate,
        queueTaskUpdate,
        queueRunImageUpdate,
        queueRunTaskStateUpdate,
        persistImageResultSource: imageResultReferenceStore.persistImageResultSource,
        markSettled: () => {
          settled = true
        },
        logging: {
          emitImageTaskDebug,
          getChannelDebugMeta,
        },
      })

      applyPendingState('stream')
      flushQueuedResumeUpdates()
      logImageTaskLifecycleBoundary({ phase: 'start', queueIndex: index, seq: entry.image.seq, context: 'resume' })

      try {
        let streamSuccessTask: Promise<void> | null = null
        const streamResult = await taskResumeService.streamTask({
          channel,
          taskId: fallbackServerTaskId,
          taskMeta: fallbackServerTaskMeta,
          signal: controller.signal,
          onEvent: (event) => {
            if (!canApplyUpdate()) {
              return
            }
            emitImageTaskDebug({
              stage: 'stream_event_received',
              conversationId,
              runId: entry.run.id,
              batchId: entry.run.batchId,
              taskId: entry.task.taskId,
              imageId: entry.image.id,
              seq: entry.image.seq,
              model: entry.run.modelId,
              ...getChannelDebugMeta(channel),
              state: event.state,
              responseSummary: summarizeProviderPayload(event),
            })
            if (event.state === 'pending') {
              applyPendingState('stream', {
                serverTaskId: event.serverTaskId,
                serverTaskMeta: event.serverTaskMeta,
                providerTaskStatus: event.providerTaskStatus,
              })
              return
            }
            if (event.state === 'failed') {
              applyFailedState('stream', event)
              return
            }
            streamSuccessTask = applySuccessState('stream', {
              src: event.src!,
              serverTaskId: event.serverTaskId,
              serverTaskMeta: event.serverTaskMeta,
            })
          },
        })

        if (streamSuccessTask) {
          await streamSuccessTask
          flushQueuedResumeUpdates()
          return
        }

        if (settled || streamResult.state === 'aborted') {
          flushQueuedResumeUpdates()
          emitImageTaskDebug({
            stage: 'stream_transport_finished',
            conversationId,
            runId: entry.run.id,
            batchId: entry.run.batchId,
            taskId: entry.task.taskId,
            imageId: entry.image.id,
            seq: entry.image.seq,
            model: entry.run.modelId,
            ...getChannelDebugMeta(channel),
            state: streamResult.state,
          })
          return
        }

        applyPendingState('polling')
        flushQueuedResumeUpdates()
        emitImageTaskDebug({
          stage: 'poll_request_started',
          conversationId,
          runId: entry.run.id,
          batchId: entry.run.batchId,
          taskId: entry.task.taskId,
          imageId: entry.image.id,
          seq: entry.image.seq,
          model: entry.run.modelId,
          ...getChannelDebugMeta(channel),
          pollTriggered: true,
          parsed: {
            serverTaskId: fallbackServerTaskId,
            serverTaskMeta: fallbackServerTaskMeta,
          },
        })
        const resumed = await taskResumeService.resumeTask({
          channel,
          taskId: fallbackServerTaskId,
          taskMeta: fallbackServerTaskMeta,
          signal: controller.signal,
          runWithRequestLimit,
        })
        if (!resumed) {
          applyFailedState('polling', {
            error: '图片生成失败',
            serverTaskId: fallbackServerTaskId,
            serverTaskMeta: fallbackServerTaskMeta,
          })
          flushQueuedResumeUpdates()
          return
        }
        emitImageTaskDebug({
          stage: 'poll_response_received',
          conversationId,
          runId: entry.run.id,
          batchId: entry.run.batchId,
          taskId: entry.task.taskId,
          imageId: entry.image.id,
          seq: entry.image.seq,
          model: entry.run.modelId,
          ...getChannelDebugMeta(channel),
          state: resumed.state,
          responseSummary: summarizeProviderPayload(resumed),
          parsed: {
            providerTaskStatus: resumed.state === 'pending' ? resumed.providerTaskStatus : undefined,
            serverTaskId: resumed.serverTaskId,
            serverTaskMeta: resumed.serverTaskMeta,
          },
        })
        if (resumed.state === 'pending') {
          applyPendingState('polling', {
            serverTaskId: resumed.serverTaskId,
            serverTaskMeta: resumed.serverTaskMeta,
            providerTaskStatus: resumed.providerTaskStatus,
          })
          flushQueuedResumeUpdates()
          return
        }
        if (resumed.state === 'failed') {
          applyFailedState('polling', resumed)
          flushQueuedResumeUpdates()
          return
        }
        await applySuccessState('polling', {
          src: resumed.src!,
          serverTaskId: resumed.serverTaskId,
          serverTaskMeta: resumed.serverTaskMeta,
        })
        flushQueuedResumeUpdates()
      } finally {
        logImageTaskLifecycleBoundary({ phase: 'finish', queueIndex: index, seq: entry.image.seq, context: 'resume' })
        flushQueuedResumeUpdates()
        unregisterActiveRun(conversationId, entry.run.id)
        resumingImageIdsRef.current.delete(imageKey)
        releaseWindowLease({ leaseKey, ownerId: resumeOwnerId })
      }
    },
  })
  flushQueuedResumeUpdates()
}

export async function processBackgroundPendingTaskConversations(
  input: ProcessBackgroundPendingTaskConversationsInput,
): Promise<void> {
  const conversationIds = Array.from(new Set(input.conversationIds))
  await runWithConcurrency({
    items: conversationIds,
    concurrency: Math.min(BACKGROUND_CONVERSATION_RESUME_CONCURRENCY, conversationIds.length || 1),
    worker: async (conversationId) => {
      await input.ensureConversationLoaded(conversationId)
      await input.resumePendingImagesForConversation(conversationId)
    },
  })
}
