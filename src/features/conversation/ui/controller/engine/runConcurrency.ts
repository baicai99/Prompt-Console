export const UNLIMITED_RUN_CONCURRENCY = Number.MAX_SAFE_INTEGER

export function normalizeRunConcurrency(value: number): number {
  return Math.max(1, Math.floor(value))
}

export function resolveRequestedRunConcurrency(input: {
  configured: number
  unlimited?: boolean
  max?: number
}): number {
  if (!input.unlimited) {
    return normalizeRunConcurrency(input.configured)
  }

  if (typeof input.max === 'number' && Number.isFinite(input.max) && input.max > 0) {
    return normalizeRunConcurrency(input.max)
  }

  return UNLIMITED_RUN_CONCURRENCY
}
