import type { Conversation, Side, SingleSideSettings } from '../../../../../../types/conversation'
import type { RunSourceImageRef } from '../../../../../../types/image'
import { createConversation } from '../../../../../../utils/chat'
import { conversationLoggingPort } from '../../../../application/ports/loggingPort'
import { isAbortLikeError } from '../helpers'
import { resolveRequestedRunConcurrency } from '../runConcurrency'
import { createQueuedTaskUpdateBuffer } from './progressBuffer'
import type { ActiveConversationState, AppliedModelCommand, SendDraftHelpers, SendFlowDeps } from './types'

const { emitImageTaskDebug, getChannelDebugMeta } = conversationLoggingPort

interface HandleImageModeSendInput {
  snapshot: SendFlowDeps['stateRef']['current']
  currentActive: Conversation | null
  activeState: ActiveConversationState
  effectiveDraft: string
  titleEligible: boolean
  modelCommand: AppliedModelCommand | null
  effectiveSettingsBySide: Record<Side, SingleSideSettings>
  deps: SendFlowDeps & SendDraftHelpers
}

export async function handleImageModeSend(input: HandleImageModeSendInput): Promise<void> {
  const {
    snapshot,
    currentActive,
    activeState,
    effectiveDraft,
    titleEligible,
    modelCommand,
    effectiveSettingsBySide,
    deps,
  } = input

  let sourceImageRefs: RunSourceImageRef[] = []
  const draftSourceImageSnapshot = [...deps.draftSourceImagesRef.current]
  if (draftSourceImageSnapshot.length > 0) {
    try {
      sourceImageRefs = await deps.persistDraftSourceImages(draftSourceImageSnapshot)
    } catch (error) {
      const reason = error instanceof Error ? error.message : '参考图写入失败'
      deps.dispatch({ type: 'send/fail', payload: reason })
      return
    }
  }

  const planned = deps.orchestrator.planSendDraft({
    ...snapshot,
    draft: effectiveDraft,
  }, {
    mode: activeState.activeSideMode,
    sideCount: activeState.activeSideCount,
    settingsBySide: effectiveSettingsBySide,
    modelCatalog: deps.modelCatalog,
    sourceImages: sourceImageRefs,
  })

  if (!planned.ok) {
    emitImageTaskDebug({
      stage: 'plan_failed',
      conversationId: snapshot.activeId ?? undefined,
      error: planned.error,
    })
    deps.dispatch({ type: 'send/fail', payload: planned.error })
    return
  }

  const plan = planned.value
  plan.imageTasks.forEach((task) => {
    const runPlan = plan.runPlans.find((item) => item.pendingRun.id === task.runId)
    emitImageTaskDebug({
      stage: 'frontend_task_created',
      runId: task.runId,
      batchId: task.batchId,
      taskId: task.taskId,
      seq: task.seq,
      state: task.status,
      nextState: task.status,
      model: runPlan?.modelId,
      ...getChannelDebugMeta(runPlan?.channel),
      detail: {
        prompt: task.finalPrompt,
        side: task.side,
      },
    })
    emitImageTaskDebug({
      stage: 'local_queue_entered',
      runId: task.runId,
      batchId: task.batchId,
      taskId: task.taskId,
      seq: task.seq,
      state: 'waiting',
      nextState: task.status,
      model: runPlan?.modelId,
      ...getChannelDebugMeta(runPlan?.channel),
      detail: {
        pendingRunCreatedAt: runPlan?.pendingRun.createdAt,
      },
    })
  })

  let targetConversationId: string
  let assistantMessageId: string | null = null

  if (!currentActive) {
    const conversation = createConversation(
      activeState.activeSettingsBySide,
      activeState.activeSideMode,
      activeState.activeSideCount,
    )
    const assistantContent = modelCommand?.scope === 'temporary'
      ? `已临时切换到 ${modelCommand.model.name} 执行本次请求，点击图片可预览。`
      : '已完成生成请求，点击图片可预览。'
    const shouldGenerateTitle = deps.shouldGenerateConversationTitle(conversation, titleEligible)
    const updatedConversation = deps.appendConversationEntry(
      conversation,
      snapshot.draft,
      assistantContent,
      plan.pendingRuns,
      effectiveDraft,
      sourceImageRefs,
      undefined,
      { titleEligible, taskEntries: plan.imageTasks },
    )
    deps.persistConversation(updatedConversation)
    deps.maybeGenerateConversationTitle({
      conversationId: updatedConversation.id,
      titleSource: effectiveDraft,
      shouldGenerateTitle,
      preferredChannelId: plan.runPlans[0]?.channel?.id ?? null,
    })
    deps.setActiveConversation(updatedConversation.id)
    targetConversationId = updatedConversation.id
    assistantMessageId = updatedConversation.messages.at(-1)?.id ?? null
  } else {
    const assistantContent = modelCommand?.scope === 'temporary'
      ? `已临时切换到 ${modelCommand.model.name} 执行本次请求，点击图片可预览。`
      : '已完成生成请求，点击图片可预览。'
    const shouldGenerateTitle = deps.shouldGenerateConversationTitle(currentActive, titleEligible)
    const updatedConversation = deps.appendConversationEntry(
      currentActive,
      snapshot.draft,
      assistantContent,
      plan.pendingRuns,
      effectiveDraft,
      sourceImageRefs,
      undefined,
      { titleEligible, taskEntries: plan.imageTasks },
    )
    deps.persistConversation(updatedConversation)
    deps.maybeGenerateConversationTitle({
      conversationId: updatedConversation.id,
      titleSource: effectiveDraft,
      shouldGenerateTitle,
      preferredChannelId: plan.runPlans[0]?.channel?.id ?? null,
    })
    targetConversationId = updatedConversation.id
    assistantMessageId = updatedConversation.messages.at(-1)?.id ?? null
  }
  deps.setSendScrollTargetMessageId(assistantMessageId)
  deps.setSendScrollTrigger((prev) => prev + 1)

  deps.actions.setDraft('')
  deps.clearDraftSourceImages()
  if (modelCommand?.scope === 'temporary') {
    deps.notifier.success(`本次已临时切换到 ${modelCommand.model.name}`)
  }

  const progressBuffer = createQueuedTaskUpdateBuffer({
    targetConversationId,
    isRunStillActive: deps.isRunStillActive,
    updateImageTaskInConversation: deps.updateImageTaskInConversation,
    updateRunImageInConversation: deps.updateRunImageInConversation,
    updateRunTaskStateInConversation: deps.updateRunTaskStateInConversation,
  })

  try {
    const requestedConcurrency = resolveRequestedRunConcurrency({
      configured: snapshot.runConcurrency,
      unlimited: snapshot.runConcurrencyUnlimited,
      max: plan.imageTasks.length,
    })
    const adaptiveConcurrency = snapshot.runConcurrencyUnlimited
      ? requestedConcurrency
      : deps.resolveAdaptiveRunConcurrency(requestedConcurrency)
    if (!assistantMessageId) {
      throw new Error('Missing assistant message id for pending runs')
    }
    const runControllers = new Map(plan.runPlans.map((runPlan) => [runPlan.pendingRun.id, new AbortController()]))
    const settledRunIds = new Set<string>()
    runControllers.forEach((controller, runId) => deps.registerActiveRun(targetConversationId, assistantMessageId, runId, controller))
    await deps.orchestrator.executeRunPlans(
      plan.runPlans.map((runPlan) => ({
        batchId: plan.batchId,
        sideMode: plan.mode,
        side: runPlan.side,
        settings: runPlan.settings,
        templatePrompt: runPlan.pendingRun.templatePrompt,
        finalPrompt: runPlan.pendingRun.finalPrompt,
        variablesSnapshot: runPlan.pendingRun.variablesSnapshot,
        modelId: runPlan.modelId,
        modelName: runPlan.modelName,
        paramsSnapshot: runPlan.paramsSnapshot,
        sourceImages: runPlan.sourceImages,
        channel: runPlan.channel,
        runtimeSettings: snapshot.imageRuntimeSettings,
        pendingRunId: runPlan.pendingRun.id,
        pendingCreatedAt: runPlan.pendingRun.createdAt,
        pendingRun: runPlan.pendingRun,
        signal: runControllers.get(runPlan.pendingRun.id)?.signal,
      })),
      plan.imageTasks,
      adaptiveConcurrency,
      {
        onTaskProgress: (progress) => {
          if (!deps.isRunStillActive(targetConversationId, progress.runId)) {
            emitImageTaskDebug({
              stage: 'task_progress_ignored',
              conversationId: targetConversationId,
              runId: progress.runId,
              taskId: progress.taskId,
              seq: progress.seq,
              state: progress.status,
              detail: {
                reason: 'run_not_active',
              },
            })
            return
          }
          emitImageTaskDebug({
            stage: 'task_progress_received',
            conversationId: targetConversationId,
            runId: progress.runId,
            taskId: progress.taskId,
            seq: progress.seq,
            state: progress.status,
            parsed: {
              providerTaskStatus: progress.providerTaskStatus,
              serverTaskId: progress.serverTaskId,
              serverTaskMeta: progress.serverTaskMeta,
              hasRenderableResult: Boolean(progress.fileRef || progress.thumbRef || progress.fullRef || progress.refKey),
              errorCode: progress.errorCode,
            },
          })
          progressBuffer.queueProgress(progress)
        },
        onTaskStateChange: (progress) => {
          if (!deps.isRunStillActive(targetConversationId, progress.runId)) {
            emitImageTaskDebug({
              stage: 'task_state_ignored',
              conversationId: targetConversationId,
              runId: progress.runId,
              taskId: progress.taskId,
              seq: progress.seq,
              state: progress.state,
              detail: {
                reason: 'run_not_active',
              },
            })
            return
          }
          emitImageTaskDebug({
            stage: 'task_state_received',
            conversationId: targetConversationId,
            runId: progress.runId,
            taskId: progress.taskId,
            seq: progress.seq,
            previousState: undefined,
            nextState: progress.state,
            detail: {
              reason: progress.reason,
            },
          })
          progressBuffer.queueState(progress)
        },
        onRunSettled: (run) => {
          if (!deps.isRunStillActive(targetConversationId, run.id)) {
            return
          }
          progressBuffer.flush()
          deps.replaceRunsInConversation(targetConversationId, new Map([[run.id, run]]))
          deps.unregisterActiveRun(targetConversationId, run.id)
          settledRunIds.add(run.id)
        },
      },
      deps.submitRequestRunner,
    )
    progressBuffer.flush()
    plan.runPlans
      .filter((runPlan) => !settledRunIds.has(runPlan.pendingRun.id))
      .forEach((runPlan) => deps.unregisterActiveRun(targetConversationId, runPlan.pendingRun.id))
    deps.dispatch({ type: 'send/succeed' })
  } catch (error) {
    progressBuffer.flush()
    plan.runPlans.forEach((runPlan) => deps.unregisterActiveRun(targetConversationId, runPlan.pendingRun.id))
    if (isAbortLikeError(error)) {
      deps.dispatch({ type: 'send/succeed' })
      return
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    deps.dispatch({ type: 'send/fail', payload: message })
  }
}
