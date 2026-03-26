import { describe, expect, it } from 'vitest'
import type { ApiChannel } from '../types/channel'
import {
  applyChannelImport,
  buildChannelImportPreview,
  normalizeChannelBaseUrl,
  parseApiChannelsFromText,
} from './channelImport'

const OPENAI_TEST_KEY_A = `sk-${'a'.repeat(24)}`
const OPENAI_TEST_KEY_B = `sk-${'b'.repeat(24)}`
const OPENAI_TEST_KEY_C = `sk-${'c'.repeat(24)}`
const OPENAI_TEST_KEY_D = `sk-${'d'.repeat(24)}`
const OPENAI_TEST_KEY_E = `sk-${'e'.repeat(24)}`
const GEMINI_TEST_KEY = `AIza${'g'.repeat(28)}`

describe('channelImport parser', () => {
  it('parses complex channel text and ignores unrelated urls', () => {
    const input = `
第三方省钱API渠道：
Gemini 生图小工具（线上版）：https://xh-gemini-internal.tuotuai.com/

API设置：

名称：随意
渠道1:
API Base : https://ai.qiaojiangapp.cn
API 密钥：${OPENAI_TEST_KEY_A}
渠道2:
API Base : https://ai.t8star.cn
API 密钥：${OPENAI_TEST_KEY_B}
    `

    const parsed = parseApiChannelsFromText(input)
    const valid = parsed.candidates.filter((item) => !item.invalidReason)
    expect(valid).toHaveLength(2)
    expect(valid[0].baseUrl).toBe('https://ai.qiaojiangapp.cn')
    expect(valid[0].apiKey).toContain('sk-')
    expect(valid[1].baseUrl).toBe('https://ai.t8star.cn')
  })

  it('supports mixed punctuation and whitespace', () => {
    const input = `
渠道A
API Base：https://api.example.com/v1/。
API Key :   ${OPENAI_TEST_KEY_C}
    `
    const parsed = parseApiChannelsFromText(input)
    const valid = parsed.candidates.filter((item) => !item.invalidReason)
    expect(valid).toHaveLength(1)
    expect(valid[0].baseUrl).toBe('https://api.example.com/v1')
    expect(valid[0].name).toBe('api.example.com')
  })

  it('supports gemini style api keys', () => {
    const input = `
渠道A
API Base: https://proxy.tuotuai.com
API Key: ${GEMINI_TEST_KEY}
    `
    const parsed = parseApiChannelsFromText(input)
    const valid = parsed.candidates.filter((item) => !item.invalidReason)
    expect(valid).toHaveLength(1)
    expect(valid[0].apiKey).toBe(GEMINI_TEST_KEY)
  })

  it('returns invalid candidate when labeled base misses key', () => {
    const parsed = parseApiChannelsFromText('API Base: https://api.example.com/v1')
    expect(parsed.candidates).toHaveLength(1)
    expect(parsed.candidates[0].invalidReason).toContain('缺少 API Key')
  })

  it('prioritizes labeled pairing over noisy nearby values', () => {
    const input = `
https://noise.example.com
${OPENAI_TEST_KEY_D}
渠道1:
API Base: https://api.a.com
API Key: ${OPENAI_TEST_KEY_E}
    `
    const parsed = parseApiChannelsFromText(input)
    const valid = parsed.candidates.filter((item) => !item.invalidReason)
    expect(valid).toHaveLength(2)
    expect(valid[1].baseUrl).toBe('https://api.a.com')
  })
})

describe('channelImport decisions', () => {
  const channels: ApiChannel[] = [
    {
      id: 'c1',
      name: 'Old',
      baseUrl: 'https://api.example.com/v1/',
      apiKey: OPENAI_TEST_KEY_A,
      models: ['a'],
    },
  ]

  it('marks duplicates as overwrite by default', () => {
    const parsed = parseApiChannelsFromText(`API Base: https://api.example.com/v1\nAPI Key: ${OPENAI_TEST_KEY_B}`)
    const preview = buildChannelImportPreview(parsed.candidates, channels)
    expect(preview).toHaveLength(1)
    expect(preview[0].status).toBe('duplicate')
    expect(preview[0].action).toBe('overwrite')
    expect(preview[0].existingChannelId).toBe('c1')
  })

  it('applies mixed create/overwrite/skip actions', () => {
    const parsed = parseApiChannelsFromText(`
API Base: https://api.example.com/v1
API Key: ${OPENAI_TEST_KEY_B}
API Base: https://api.new.com
API Key: ${OPENAI_TEST_KEY_C}
    `)

    const preview = buildChannelImportPreview(parsed.candidates, channels).map((item) =>
      item.baseUrl.includes('api.new.com') ? { ...item, action: 'skip' as const, selected: true } : item,
    )
    const modelsByCandidateId: Record<string, string[]> = Object.fromEntries(preview.map((item) => [item.id, ['m1']]))
    const result = applyChannelImport(channels, preview, modelsByCandidateId)

    expect(result.overwritten).toBe(1)
    expect(result.created).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.channels).toHaveLength(1)
    expect(result.channels[0].apiKey).toBe(OPENAI_TEST_KEY_B)
  })

  it('normalizes base url for duplicate comparison', () => {
    expect(normalizeChannelBaseUrl('https://API.EXAMPLE.com/v1/')).toBe('https://api.example.com/v1')
  })
})
