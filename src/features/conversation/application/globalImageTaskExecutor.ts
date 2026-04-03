import type { ImageTask, Run } from '../../../types/conversation'
import { trackMetrics } from '../../performance/runtimeMetrics'
import { createRunTaskState } from '../domain/runTaskState'
import type { CreateRunInput } from './runExecutor'
import type { ProviderRequestRunner } from '../../../types/provider'
import { emitImageTaskDebug, getChannelDebugMeta } from '../../../services/imageTaskDebug'
import {
  buildCancelledRunImagePatch,
  buildFailedRunImagePatch,
  logImageTaskLifecycleBoundary,
  patchRunImage,
  settleRunTaskState,
  type TaskExecutionState,
} from './taskLifecycle/shared'

type RunPlanExecution = {
  batchId: string
  sideMode: CreateRunInput['sideMode']
  side: string
  settings: CreateRunInput['settings']
  templatePrompt: string
  finalPrompt: string
  variablesSnapshot: Record<string, string>
  modelId: string
  modelName: string
  paramsSnapshot: CreateRunInput['paramsSnapshot']
  sourceImages?: CreateRunInput['sourceImages']
  channel: CreateRunInput['channel']
  runtimeSettings?: CreateRunInput['runtimeSettings']
  pendingRunId: string
  pendingCreatedAt: string
  signal?: AbortSignal
  pendingRun: Run
}

interface ExecuteImageTaskPoolInput {
  createRun: (input: CreateRunInput) => Promise<Run>
  runPlans: RunPlanExecution[]
  imageTasks: ImageTask[]
  requestedConcurrency: number
  submitRequestRunner?: ProviderRequestRunner
  hooks?: {
    onTaskStateChange?: (event: {
      taskId: string
      runId: string
      seq: number
      state: TaskExecutionState
      reason?: string
    }) => void
    onTaskProgress?: (event: {
      taskId: string
      runId: string
      seq: number
      status: 'pending' | 'success' | 'failed'
      queuedAt?: Run['images'][number]['queuedAt']
      startedAt?: Run['images'][number]['startedAt']
      requestUrl?: string
      providerTaskStatus?: Run['images'][number]['providerTaskStatus']
      threadState?: Run['images'][number]['threadState']
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
      completedAt?: string
    }) => void
    onRunSettled?: (run: Run) => void
  }
}

const passthroughRequestRunner: ProviderRequestRunner = async (fn) => fn()

interface RunExecution {
  plan: RunPlanExecution
  run: Run
  completedTasks: number
  totalTasks: number
  started: boolean
  settled: boolean
}

function getRunImageTiming(run: Run, seq: number): Pick<Run['images'][number], 'queuedAt' | 'startedAt' | 'completedAt'> {
  const image = run.images.find((entry) => entry.seq === seq)
  return {
    queuedAt: image?.queuedAt,
    startedAt: image?.startedAt,
    completedAt: image?.completedAt,
  }
}

function getTaskImageSeqs(task: ImageTask): number[] {
  return Array.isArray(task.imageSeqs) && task.imageSeqs.length > 0 ? task.imageSeqs : [task.seq]
}

function patchRunImages(
  run: Run,
  seqs: number[],
  patch: Partial<Run['images'][number]>,
): Run {
  return seqs.reduce((current, seq) => patchRunImage(current, seq, patch), run)
}

function resolveTaskStateFromImages(images: Run['images']): TaskExecutionState {
  if (images.length === 0) {
    return 'failed'
  }
  if (images.some((image) => image.status === 'pending')) {
    return 'polling'
  }
  if (images.every((image) => image.status === 'success')) {
    return 'succeeded'
  }
  if (images.every((image) => image.status === 'failed' && image.errorCode === 'timeout')) {
    return 'timeout'
  }
  return 'failed'
}

function normalizeRequestedConcurrency(requested: number): number {
  return Math.max(1, Math.floor(requested))
}

function settleRun(execution: RunExecution, hooks: ExecuteImageTaskPoolInput['hooks'] | undefined): void {
  if (execution.settled) {
    return
  }

  execution.settled = true
  execution.run = settleRunTaskState(execution.run)
  hooks?.onRunSettled?.(execution.run)
}

export async function executeImageTaskPool(input: ExecuteImageTaskPoolInput): Promise<Run[]> {
  const requestedConcurrency = normalizeRequestedConcurrency(input.requestedConcurrency)
  const runWithRequestLimit = input.submitRequestRunner
  const executions = new Map<string, RunExecution>()
  const planByRunId = new Map<string, RunPlanExecution>()

  input.runPlans.forEach((plan) => {
    const totalTasks = input.imageTasks.filter((task) => task.runId === plan.pendingRunId).length
    planByRunId.set(plan.pendingRunId, plan)
    executions.set(plan.pendingRunId, {
      plan,
      run: {
        ...plan.pendingRun,
        images: plan.pendingRun.images.map((image) => ({ ...image })),
      },
      completedTasks: 0,
      totalTasks,
      started: false,
      settled: false,
    })
  })
  input.imageTasks.forEach((task) => {
    const plan = planByRunId.get(task.runId)
    emitImageTaskDebug({
      stage: 'global_pool_task_registered',
      runId: task.runId,
      batchId: task.batchId,
      taskId: task.taskId,
      seq: task.seq,
      state: 'waiting',
      nextState: task.status,
      model: plan?.modelId,
      ...getChannelDebugMeta(plan?.channel),
      detail: {
        requestedConcurrency,
      },
    })
  })

  trackMetrics('conversation.globalTaskPool.start', {
    batchId: input.runPlans[0]?.batchId ?? 'unknown',
    runCount: input.runPlans.length,
    taskCount: input.imageTasks.length,
    requestedConcurrency,
  })

  const queue = [...input.imageTasks]
  let nextIndex = 0

  const worker = async () => {
    while (true) {
      const taskIndex = nextIndex
      const task = queue[taskIndex]
      nextIndex += 1
      if (!task) {
        return
      }

      const execution = executions.get(task.runId)
      const plan = planByRunId.get(task.runId)
      if (!execution || !plan || execution.settled) {
        continue
      }
      const coveredSeqs = getTaskImageSeqs(task)

      emitImageTaskDebug({
        stage: 'local_queue_dequeued',
        runId: task.runId,
        batchId: task.batchId,
        taskId: task.taskId,
        seq: task.seq,
        previousState: task.status,
        nextState: 'submitting',
        model: plan.modelId,
        ...getChannelDebugMeta(plan.channel),
        detail: {
          workerIndex: taskIndex,
        },
      })

      if (plan.signal?.aborted) {
        const completedAt = new Date().toISOString()
        execution.run = patchRunImages(execution.run, coveredSeqs, buildCancelledRunImagePatch({ completedAt }))
        execution.completedTasks += 1
        input.hooks?.onTaskStateChange?.({
          taskId: task.taskId,
          runId: task.runId,
          seq: task.seq,
          state: 'cancelled',
          reason: 'external-abort',
        })
        emitImageTaskDebug({
          stage: 'request_dispatch_started',
          runId: task.runId,
          batchId: task.batchId,
          taskId: task.taskId,
          seq: task.seq,
          previousState: task.status,
          nextState: 'submitting',
          model: plan.modelId,
          ...getChannelDebugMeta(plan.channel),
        })
        coveredSeqs.forEach((seq) => {
          const timing = getRunImageTiming(execution.run, seq)
          input.hooks?.onTaskProgress?.({
            taskId: task.taskId,
            runId: task.runId,
            seq,
            status: 'failed',
            queuedAt: timing.queuedAt,
            startedAt: timing.startedAt,
            threadState: 'settled',
            error: '任务已取消',
            errorCode: 'unknown',
            completedAt,
          })
        })
        if (execution.completedTasks >= execution.totalTasks) {
          settleRun(execution, input.hooks)
        }
        continue
      }

      await (runWithRequestLimit ?? passthroughRequestRunner)(async () => {
        if (!execution.started) {
          execution.started = true
          execution.run = {
            ...execution.run,
            taskState: createRunTaskState({
              status: 'generating',
              now: new Date().toISOString(),
              previous: execution.run.taskState,
            }),
          }
        }

        input.hooks?.onTaskStateChange?.({
          taskId: task.taskId,
          runId: task.runId,
          seq: task.seq,
          state: 'running',
        })
        logImageTaskLifecycleBoundary({ phase: 'start', queueIndex: taskIndex, seq: task.seq, context: 'generate' })

        try {
          const completedRun = await input.createRun({
            batchId: plan.batchId,
            sideMode: plan.sideMode,
            side: plan.side,
            settings: {
              ...plan.settings,
              imageCount: coveredSeqs.length,
            },
            templatePrompt: plan.templatePrompt,
            finalPrompt: plan.finalPrompt,
            variablesSnapshot: plan.variablesSnapshot,
            modelId: plan.modelId,
            modelName: plan.modelName,
            paramsSnapshot: plan.paramsSnapshot,
            sourceImages: plan.sourceImages,
            channel: plan.channel,
            runtimeSettings: plan.runtimeSettings,
            runId: plan.pendingRunId,
            createdAt: plan.pendingCreatedAt,
            signal: plan.signal,
            runWithRequestLimit: passthroughRequestRunner,
            onImageProgress: (progress) => {
              if (plan.signal?.aborted) {
                return
              }
              input.hooks?.onTaskProgress?.({
                taskId: task.taskId,
                runId: task.runId,
                seq: progress.seq,
                status: progress.status,
                queuedAt: progress.queuedAt,
                startedAt: progress.startedAt,
                requestUrl: progress.requestUrl,
                providerTaskStatus: progress.providerTaskStatus,
                threadState: progress.threadState,
                fileRef: progress.fileRef,
                thumbRef: progress.thumbRef,
                fullRef: progress.fullRef,
                refKind: progress.refKind,
                refKey: progress.refKey,
                serverTaskId: progress.serverTaskId,
                serverTaskMeta: progress.serverTaskMeta,
                bytes: progress.bytes,
                error: progress.error,
                errorCode: progress.errorCode,
                completedAt: progress.status === 'pending' ? undefined : new Date().toISOString(),
              })

              execution.run = patchRunImage(execution.run, progress.seq, {
                status: progress.status,
                queuedAt: progress.queuedAt,
                startedAt: progress.startedAt,
                completedAt: progress.completedAt,
                requestUrl: progress.requestUrl,
                providerTaskStatus: progress.providerTaskStatus,
                threadState: progress.threadState,
                fileRef: progress.fileRef,
                thumbRef: progress.thumbRef,
                fullRef: progress.fullRef,
                refKind: progress.refKind,
                refKey: progress.refKey,
                serverTaskId: progress.serverTaskId,
                serverTaskMeta: progress.serverTaskMeta,
                bytes: progress.bytes,
                error: progress.error,
                errorCode: progress.errorCode,
              })
              emitImageTaskDebug({
                stage: 'executor_progress_received',
                runId: task.runId,
                batchId: task.batchId,
                taskId: task.taskId,
                seq: progress.seq,
                state: progress.status,
                model: plan.modelId,
                ...getChannelDebugMeta(plan.channel),
                parsed: {
                  providerTaskStatus: progress.providerTaskStatus,
                  hasServerTaskId: Boolean(progress.serverTaskId),
                  hasServerTaskMeta: Boolean(progress.serverTaskMeta),
                  hasFileRef: Boolean(progress.fileRef || progress.thumbRef || progress.fullRef),
                  errorCode: progress.errorCode,
                },
                detail: {
                  branch:
                    progress.status === 'success'
                      ? 'image_result_available'
                      : progress.serverTaskId || progress.serverTaskMeta
                        ? 'queue_or_resume_handle_detected'
                        : 'request_inflight',
                },
              })
            },
          })

          const completedImages = completedRun.images.filter((image) => coveredSeqs.includes(image.seq))
          const taskState = resolveTaskStateFromImages(completedImages)
          if (plan.signal?.aborted) {
            const completedAt = new Date().toISOString()
            execution.run = patchRunImages(execution.run, coveredSeqs, buildCancelledRunImagePatch({ completedAt }))
            execution.completedTasks += 1
            coveredSeqs.forEach((seq) => {
              const timing = getRunImageTiming(execution.run, seq)
              input.hooks?.onTaskProgress?.({
                taskId: task.taskId,
                runId: task.runId,
                seq,
                status: 'failed',
                queuedAt: timing.queuedAt,
                startedAt: timing.startedAt,
                threadState: 'settled',
                error: '任务已取消',
                errorCode: 'unknown',
                completedAt,
              })
            })
            input.hooks?.onTaskStateChange?.({
              taskId: task.taskId,
              runId: task.runId,
              seq: task.seq,
              state: 'cancelled',
              reason: 'external-abort',
            })
            return
          }
          completedImages.forEach((image) => {
            execution.run = patchRunImage(execution.run, image.seq, image)
          })

          execution.completedTasks += 1
          input.hooks?.onTaskStateChange?.({
            taskId: task.taskId,
            runId: task.runId,
            seq: task.seq,
            state: taskState,
          })
          emitImageTaskDebug({
            stage: 'executor_task_state_emitted',
            runId: task.runId,
            batchId: task.batchId,
            taskId: task.taskId,
            seq: task.seq,
            nextState: taskState === 'succeeded' ? 'completed' : taskState,
            model: plan.modelId,
            ...getChannelDebugMeta(plan.channel),
            parsed: {
              imageStatus: completedImages[0]?.status,
              hasServerTaskId: completedImages.some((image) => Boolean(image.serverTaskId)),
              hasRenderableResult: completedImages.some((image) => Boolean(image.fileRef || image.thumbRef || image.fullRef || image.refKey)),
            },
          })
        } catch (error) {
          if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
            const completedAt = new Date().toISOString()
            execution.run = patchRunImages(execution.run, coveredSeqs, buildCancelledRunImagePatch({ completedAt }))
            execution.completedTasks += 1
            coveredSeqs.forEach((seq) => {
              const timing = getRunImageTiming(execution.run, seq)
              input.hooks?.onTaskProgress?.({
                taskId: task.taskId,
                runId: task.runId,
                seq,
                status: 'failed',
                queuedAt: timing.queuedAt,
                startedAt: timing.startedAt,
                threadState: 'settled',
                error: '任务已取消',
                errorCode: 'unknown',
                completedAt,
              })
            })
            input.hooks?.onTaskStateChange?.({
              taskId: task.taskId,
              runId: task.runId,
              seq: task.seq,
              state: 'cancelled',
              reason: 'external-abort',
            })
            emitImageTaskDebug({
              stage: 'executor_task_cancelled',
              runId: task.runId,
              batchId: task.batchId,
              taskId: task.taskId,
              seq: task.seq,
              nextState: 'cancelled',
              model: plan.modelId,
              ...getChannelDebugMeta(plan.channel),
              error,
            })
            return
          }
          const message = error instanceof Error ? error.message : '图片生成失败'
          const completedAt = new Date().toISOString()
          execution.run = patchRunImages(execution.run, coveredSeqs, buildFailedRunImagePatch({
            error: message,
            errorCode: 'unknown',
            completedAt,
          }))
          execution.completedTasks += 1
          coveredSeqs.forEach((seq) => {
            const timing = getRunImageTiming(execution.run, seq)
            input.hooks?.onTaskProgress?.({
              taskId: task.taskId,
              runId: task.runId,
              seq,
              status: 'failed',
              queuedAt: timing.queuedAt,
              startedAt: timing.startedAt,
              threadState: 'settled',
              error: message,
              errorCode: 'unknown',
              completedAt,
            })
          })
          input.hooks?.onTaskStateChange?.({
            taskId: task.taskId,
            runId: task.runId,
            seq: task.seq,
            state: 'failed',
            reason: message,
          })
          emitImageTaskDebug({
            stage: 'executor_task_failed',
            runId: task.runId,
            batchId: task.batchId,
            taskId: task.taskId,
            seq: task.seq,
            nextState: 'failed',
            model: plan.modelId,
            ...getChannelDebugMeta(plan.channel),
            error: message,
          })
        } finally {
          logImageTaskLifecycleBoundary({ phase: 'finish', queueIndex: taskIndex, seq: task.seq, context: 'generate' })
          if (execution.completedTasks >= execution.totalTasks) {
            settleRun(execution, input.hooks)
          }
        }
      })
    }
  }

  await Promise.all(Array.from({ length: Math.min(requestedConcurrency, queue.length || 1) }, () => worker()))

  return input.runPlans.map((plan) => executions.get(plan.pendingRunId)?.run ?? plan.pendingRun)
}
