import { afterEach, describe, expect, it } from 'vitest'
import { clearLoggingEntries, emitImageTaskDebug, getLoggingEntries, setLoggingSettingsForRuntime } from './imageTaskDebug'
import { DEFAULT_LOGGING_SETTINGS } from '../utils/loggingSettings'

describe('imageTaskDebug', () => {
  afterEach(() => {
    clearLoggingEntries()
    setLoggingSettingsForRuntime(DEFAULT_LOGGING_SETTINGS)
  })

  it('does not record logs when the total switch is off', () => {
    setLoggingSettingsForRuntime(DEFAULT_LOGGING_SETTINGS)

    emitImageTaskDebug({ stage: 'user_submit_request' })

    expect(getLoggingEntries()).toHaveLength(0)
  })

  it('does not record image logs when the feature switch is off', () => {
    setLoggingSettingsForRuntime({
      ...DEFAULT_LOGGING_SETTINGS,
      enabled: true,
    })

    emitImageTaskDebug({ stage: 'user_submit_request' })

    expect(getLoggingEntries()).toHaveLength(0)
  })

  it('filters verbose-only stages under standard detail', () => {
    setLoggingSettingsForRuntime({
      ...DEFAULT_LOGGING_SETTINGS,
      enabled: true,
      detailLevel: 'standard',
      features: {
        ...DEFAULT_LOGGING_SETTINGS.features,
        imageGeneration: true,
      },
    })

    emitImageTaskDebug({ stage: 'user_submit_request' })
    emitImageTaskDebug({ stage: 'ui_placeholder_rendered' })

    expect(getLoggingEntries().map((entry) => entry.stage)).toEqual(['user_submit_request'])
  })

  it('records verbose stages under verbose detail', () => {
    setLoggingSettingsForRuntime({
      ...DEFAULT_LOGGING_SETTINGS,
      enabled: true,
      detailLevel: 'verbose',
      features: {
        ...DEFAULT_LOGGING_SETTINGS.features,
        imageGeneration: true,
      },
    })

    emitImageTaskDebug({ stage: 'ui_placeholder_rendered', label: '请求发送中' })

    expect(getLoggingEntries()).toHaveLength(1)
    expect(getLoggingEntries()[0]?.stage).toBe('ui_placeholder_rendered')
  })
})
