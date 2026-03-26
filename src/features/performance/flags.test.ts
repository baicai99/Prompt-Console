import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadFlagsModule() {
  vi.resetModules()
  return import('./flags')
}

describe('performance flags', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('keeps chat diagnostics disabled by default', async () => {
    vi.stubEnv('VITE_ENABLE_CHAT_MEMORY_DIAGNOSTICS', 'false')

    const flags = await loadFlagsModule()

    expect(flags.DEFAULT_CHAT_MEMORY_DIAGNOSTICS_ENABLED).toBe(false)
  })

  it('uses the environment variable as the default diagnostics state', async () => {
    vi.stubEnv('VITE_ENABLE_CHAT_MEMORY_DIAGNOSTICS', 'true')

    const flags = await loadFlagsModule()

    expect(flags.DEFAULT_CHAT_MEMORY_DIAGNOSTICS_ENABLED).toBe(true)
  })

  it('keeps strict mode disabled by default in development', async () => {
    vi.stubEnv('VITE_ENABLE_STRICT_MODE', 'false')

    const flags = await loadFlagsModule()

    expect(flags.ENABLE_STRICT_MODE).toBe(false)
  })

  it('enables strict mode when explicitly requested in development', async () => {
    vi.stubEnv('VITE_ENABLE_STRICT_MODE', 'true')

    const flags = await loadFlagsModule()

    expect(flags.ENABLE_STRICT_MODE).toBe(true)
  })
})
