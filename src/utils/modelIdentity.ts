export const SCOPED_MODEL_ID_SEPARATOR = '::'

export function buildScopedModelId(channelId: string, modelId: string): string {
  return `${channelId}${SCOPED_MODEL_ID_SEPARATOR}${modelId}`
}

export function parseScopedModelId(value: string): { channelId: string; modelId: string } | null {
  const normalized = value.trim()
  const separatorIndex = normalized.indexOf(SCOPED_MODEL_ID_SEPARATOR)
  if (separatorIndex <= 0) {
    return null
  }

  const channelId = normalized.slice(0, separatorIndex).trim()
  const modelId = normalized.slice(separatorIndex + SCOPED_MODEL_ID_SEPARATOR.length).trim()
  if (!channelId || !modelId) {
    return null
  }

  return { channelId, modelId }
}
