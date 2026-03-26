import type { Run } from '../../../types/conversation'
import type { SettingPrimitive } from '../../../types/primitives'

export const URL_RESPONSE_FORMAT_BATCH_DOWNLOAD_HINT = '当前返回格式为 URL，批量下载不可用，请切换为 b64_json。'

function normalizeResponseFormat(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function isUrlResponseFormat(value: unknown): boolean {
  return normalizeResponseFormat(value) === 'url'
}

export function isBatchDownloadBlockedForParamValues(
  paramValues: Record<string, SettingPrimitive> | undefined,
): boolean {
  return isUrlResponseFormat(paramValues?.responseFormat)
}

export function isBatchDownloadBlockedForRun(run: Pick<Run, 'paramsSnapshot'>): boolean {
  return isBatchDownloadBlockedForParamValues(run.paramsSnapshot)
}

export function isBatchDownloadBlockedForRuns(runs: Array<Pick<Run, 'paramsSnapshot'>>): boolean {
  return runs.some((run) => isBatchDownloadBlockedForRun(run))
}
