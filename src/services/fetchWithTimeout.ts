export interface FetchWithTimeoutInput {
  url: string
  init?: RequestInit
  timeoutMs: number
  timeoutMessage?: string
}

function createTimeoutError(message: string): Error {
  return Object.assign(new Error(message), { name: 'TimeoutError' })
}

export function isTimeoutError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: unknown }).name === 'TimeoutError',
  )
}

export async function fetchWithTimeout(input: FetchWithTimeoutInput): Promise<Response> {
  const { url, init, timeoutMs, timeoutMessage } = input
  const controller = new AbortController()
  const upstreamSignal = init?.signal
  let didTimeout = false

  if (upstreamSignal?.aborted) {
    throw upstreamSignal.reason ?? Object.assign(new Error('aborted'), { name: 'AbortError' })
  }

  const abortFromUpstream = () => {
    controller.abort(upstreamSignal?.reason)
  }
  upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true })

  const timer = globalThis.setTimeout(() => {
    didTimeout = true
    controller.abort(createTimeoutError(
      timeoutMessage ?? `Request timed out after ${timeoutMs}ms`,
    ))
  }, Math.max(1, Math.floor(timeoutMs)))

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (didTimeout) {
      throw createTimeoutError(timeoutMessage ?? `Request timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    globalThis.clearTimeout(timer)
    upstreamSignal?.removeEventListener('abort', abortFromUpstream)
  }
}
