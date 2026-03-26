import { describe, expect, it } from 'vitest'
import { runNonReentrant } from './runNonReentrant'

describe('runNonReentrant', () => {
  it('skips overlapping executions while a task is in flight', async () => {
    let resolveTask: undefined | (() => void)
    let runCount = 0
    const inFlightRef = { current: false }

    const first = runNonReentrant(inFlightRef, async () => {
      runCount += 1
      await new Promise<void>((resolve) => {
        resolveTask = resolve
      })
    })
    const second = await runNonReentrant(inFlightRef, async () => {
      runCount += 1
    })

    expect(second).toBeUndefined()
    expect(runCount).toBe(1)

    resolveTask?.()
    await first
    expect(inFlightRef.current).toBe(false)
  })
})
