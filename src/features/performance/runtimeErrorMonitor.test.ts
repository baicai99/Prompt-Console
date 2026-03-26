import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('runtimeErrorMonitor', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  it('records runtime errors with version metadata', async () => {
    const monitor = await import('./runtimeErrorMonitor')

    monitor.reportRuntimeError({
      kind: 'error',
      message: 'boom',
      filename: '/app.js',
      lineno: 12,
      colno: 8,
    })

    expect(monitor.getRuntimeErrorState().events[0]).toMatchObject({
      kind: 'error',
      message: 'boom',
      filename: '/app.js',
      lineno: 12,
      colno: 8,
      version: 'test',
    })
    expect(window.localStorage.getItem('m3:runtime-error-events')).toContain('boom')
  })

  it('captures unhandled promise rejections after initialization', async () => {
    const monitor = await import('./runtimeErrorMonitor')

    monitor.initializeRuntimeErrorMonitoring()
    window.dispatchEvent(new Event('unhandledrejection'))
    monitor.reportRuntimeError({
      kind: 'unhandledrejection',
      message: 'async boom',
    })

    expect(monitor.getRuntimeErrorState().events.some((event) => event.kind === 'unhandledrejection')).toBe(true)
  })

  it('clears persisted runtime errors', async () => {
    const monitor = await import('./runtimeErrorMonitor')

    monitor.reportRuntimeError({
      kind: 'error',
      message: 'to-clear',
    })
    monitor.clearRuntimeErrorState()

    expect(monitor.getRuntimeErrorState()).toEqual({ events: [] })
    expect(window.localStorage.getItem('m3:runtime-error-events')).toBe('[]')
  })
})
