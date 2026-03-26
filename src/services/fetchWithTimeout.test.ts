import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout, isTimeoutError } from './fetchWithTimeout'

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('throws a timeout error when fetch hangs past the deadline', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_, init?: RequestInit) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(init.signal?.reason ?? Object.assign(new Error('aborted'), { name: 'AbortError' }))
      }, { once: true })
    })))

    const request = fetchWithTimeout({
      url: 'https://example.com/image',
      timeoutMs: 50,
      timeoutMessage: 'timed out',
    })
    const assertion = expect(request).rejects.toMatchObject({ name: 'TimeoutError', message: 'timed out' })

    await vi.advanceTimersByTimeAsync(60)
    await assertion
  })

  it('detects timeout errors', () => {
    expect(isTimeoutError(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toBe(true)
    expect(isTimeoutError(new Error('x'))).toBe(false)
  })
})
