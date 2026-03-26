import type { ImageTask, SettingPrimitive, Side, SideMode, SingleSideSettings, Run } from '../../../types/conversation'
import type { ApiChannel } from '../../../types/channel'
import type { RunSourceImageRef } from '../../../types/image'

export interface PlannedRun {
  side: Side
  settings: SingleSideSettings
  modelId: string
  modelName: string
  paramsSnapshot: Record<string, SettingPrimitive>
  sourceImages: RunSourceImageRef[]
  channel: ApiChannel | undefined
  pendingRun: Run
}

export interface SendDraftPlan {
  batchId: string
  userPrompt: string
  templatePrompt: string
  finalPrompt: string
  variablesSnapshot: Record<string, string>
  mode: SideMode
  sideCount: number
  settingsBySide: Record<Side, SingleSideSettings>
  runPlans: PlannedRun[]
  imageTasks: ImageTask[]
  pendingRuns: Run[]
}

export type SendDraftPlanResult =
  | { ok: false; error: string }
  | { ok: true; value: SendDraftPlan }
