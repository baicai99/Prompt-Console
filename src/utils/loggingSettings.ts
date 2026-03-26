import type { LogDetailLevel, LoggingFeatureKey, LoggingSettings } from '../types/conversation'

export const LOGGING_FEATURE_KEYS: LoggingFeatureKey[] = [
  'imageGeneration',
  'textConversation',
  'multiWindow',
  'dynamicPrompt',
  'concurrencyPool',
  'polling',
  'stateTransition',
  'uiRender',
]

export const DEFAULT_LOGGING_SETTINGS: LoggingSettings = {
  enabled: false,
  detailLevel: 'standard',
  features: {
    imageGeneration: false,
    textConversation: false,
    multiWindow: false,
    dynamicPrompt: false,
    concurrencyPool: false,
    polling: false,
    stateTransition: false,
    uiRender: false,
  },
}

export const LOGGING_FEATURE_OPTIONS: Array<{
  key: LoggingFeatureKey
  label: string
  description: string
}> = [
  { key: 'imageGeneration', label: '图片生成链路日志', description: '记录请求创建、响应解析、状态切换、轮询与图片渲染过程。' },
]

function normalizeDetailLevel(value: unknown): LogDetailLevel {
  return value === 'brief' || value === 'standard' || value === 'verbose'
    ? value
    : DEFAULT_LOGGING_SETTINGS.detailLevel
}

export function normalizeLoggingSettings(
  value: Partial<LoggingSettings> | null | undefined,
): LoggingSettings {
  const rawFeatures =
    value?.features && typeof value.features === 'object'
      ? (value.features as Partial<Record<LoggingFeatureKey, unknown>>)
      : {}

  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : DEFAULT_LOGGING_SETTINGS.enabled,
    detailLevel: normalizeDetailLevel(value?.detailLevel),
    features: Object.fromEntries(
      LOGGING_FEATURE_KEYS.map((key) => [
        key,
        typeof rawFeatures[key] === 'boolean'
          ? Boolean(rawFeatures[key])
          : DEFAULT_LOGGING_SETTINGS.features[key],
      ]),
    ) as Record<LoggingFeatureKey, boolean>,
  }
}
