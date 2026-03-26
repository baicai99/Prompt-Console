import { describe, expect, it } from 'vitest'
import {
  findOfficialChannelPresetById,
  matchOfficialChannelPreset,
  OFFICIAL_CHANNEL_PRESETS,
} from './officialChannelPresets'

describe('officialChannelPresets', () => {
  it('finds supported preset by id', () => {
    expect(findOfficialChannelPresetById('openai')).toMatchObject({
      label: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      supported: true,
    })
  })

  it('matches official preset by normalized base url', () => {
    expect(matchOfficialChannelPreset('https://api.openai.com/v1/')).toMatchObject({
      id: 'openai',
    })
    expect(matchOfficialChannelPreset('https://generativelanguage.googleapis.com/v1beta')).toMatchObject({
      id: 'google-gemini',
    })
  })

  it('keeps unsupported vendors visible in the preset list', () => {
    expect(OFFICIAL_CHANNEL_PRESETS.some((item) => item.id === 'anthropic' && item.supported === false)).toBe(true)
  })

  it('maps google preset to gemini provider explicitly', () => {
    expect(findOfficialChannelPresetById('google-gemini')).toMatchObject({
      providerId: 'gemini-api',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    })
  })
})
