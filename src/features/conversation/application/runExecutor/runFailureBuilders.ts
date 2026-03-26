import type {
  ImageRuntimeSettings,
  Run,
  Side,
  SideMode,
  SingleSideSettings,
  SettingPrimitive,
} from '../../../../types/conversation'
import type { ApiChannel } from '../../../../types/channel'
import type { RunSourceImageRef } from '../../../../types/image'
import { makeId, toSettingsSnapshot } from '../../../../utils/chat'
import { classifyFailureFromError } from '../../domain/failureClassifier'
import { buildRunAttemptFromRun } from '../../domain/runAttempts'
import { createRunTaskState } from '../../domain/runTaskState'

interface BuildBaseRunInput {
  batchId: string
  sideMode: SideMode
  side: Side
  settings: SingleSideSettings
  templatePrompt: string
  finalPrompt: string
  variablesSnapshot: Record<string, string>
  modelId: string
  modelName: string
  paramsSnapshot: Record<string, SettingPrimitive>
  sourceImages?: RunSourceImageRef[]
  channel: ApiChannel | undefined
  retryOfRunId?: string
  retryAttempt: number
  runId: string
  createdAt: string
  runtimeSettings?: ImageRuntimeSettings
}

interface BuildFailedRunInput {
  baseRun: Omit<Run, 'images'>
  imageCount: number
  createdAt: string
}

export function buildBaseRun(input: BuildBaseRunInput): Omit<Run, 'images'> {
  return {
    id: input.runId,
    batchId: input.batchId,
    createdAt: input.createdAt,
    sideMode: input.sideMode,
    side: input.side,
    prompt: input.finalPrompt,
    imageCount: Math.max(1, Math.floor(input.settings.imageCount)),
    channelId: input.channel?.id ?? null,
    channelName: input.channel?.name ?? null,
    modelId: input.modelId,
    modelName: input.modelName,
    templatePrompt: input.templatePrompt,
    finalPrompt: input.finalPrompt,
    variablesSnapshot: input.variablesSnapshot,
    paramsSnapshot: input.paramsSnapshot,
    sourceImages: input.sourceImages ?? [],
    settingsSnapshot: toSettingsSnapshot(input.settings),
    retryOfRunId: input.retryOfRunId,
    retryAttempt: input.retryAttempt,
  }
}

export function withInitialAttempt(run: Run): Run {
  return {
    ...run,
    attempts: [buildRunAttemptFromRun(run)],
  }
}

export function buildMissingChannelRun(input: BuildFailedRunInput): Run {
  const failedRun: Run = {
    ...input.baseRun,
    taskState: createRunTaskState({
      status: 'failed',
      now: input.createdAt,
      reason: 'missing-channel',
    }),
    images: Array.from({ length: input.imageCount }, (_, index) => ({
      id: makeId(),
      seq: index + 1,
      status: 'failed',
      queuedAt: input.createdAt,
      startedAt: input.createdAt,
      completedAt: input.createdAt,
      threadState: 'settled',
      error: '请先配置可用渠道（Base URL + API Key）',
      errorCode: 'auth',
    })),
  }

  return withInitialAttempt(failedRun)
}

export function buildMissingSourceImagesRun(input: BuildFailedRunInput & {
  missingSummary: string
}): Run {
  const failedRun: Run = {
    ...input.baseRun,
    taskState: createRunTaskState({
      status: 'failed',
      now: input.createdAt,
      reason: 'missing-source-image',
    }),
    images: Array.from({ length: input.imageCount }, (_, index) => ({
      id: makeId(),
      seq: index + 1,
      status: 'failed',
      queuedAt: input.createdAt,
      startedAt: input.createdAt,
      completedAt: input.createdAt,
      threadState: 'settled',
      error: `参考图已失效（${input.missingSummary}），请重新上传后重试。`,
      errorCode: 'unknown',
    })),
  }

  return withInitialAttempt(failedRun)
}

export function buildRunFailureFromError(input: BuildFailedRunInput & {
  error: unknown
}): Run {
  const message = input.error instanceof Error ? input.error.message : '未知错误'
  const code = classifyFailureFromError(input.error)
  const failedRun: Run = {
    ...input.baseRun,
    createdAt: input.createdAt,
    taskState: createRunTaskState({
      status: code === 'timeout' ? 'timeout' : 'failed',
      now: new Date().toISOString(),
      reason: code === 'timeout' ? 'generating-timeout' : 'generate-failed',
    }),
    images: Array.from({ length: input.imageCount }, (_, index) => {
      const completedAt = new Date().toISOString()
      return {
        id: makeId(),
        seq: index + 1,
        status: 'failed',
        queuedAt: input.createdAt,
        startedAt: input.createdAt,
        completedAt,
        threadState: 'settled',
        error: message,
        errorCode: code,
      }
    }),
  }

  return withInitialAttempt(failedRun)
}
