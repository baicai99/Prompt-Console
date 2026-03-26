import { afterEach, describe, expect, it, vi } from 'vitest'
import { byteplusArkAdapter } from './byteplusArkAdapter'
import { geminiAdapter } from './geminiAdapter'
import { midjourneyAdapter } from './midjourneyAdapter'
import { openAICompatibleAdapter } from './openaiCompatibleAdapter'

const openAiChannel = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'k',
}

describe('provider adapter contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('openai-compatible supports discoverModels and discoverModelEntries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'gpt-image-1' }, { id: 'gpt-4o-mini' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const ids = await openAICompatibleAdapter.discoverModels(openAiChannel)
    const entries = await openAICompatibleAdapter.discoverModelEntries?.(openAiChannel)

    expect(ids).toEqual(['gpt-image-1', 'gpt-4o-mini'])
    expect(entries?.map((item) => item.id)).toEqual(ids)
    expect(entries?.[0]?.metadata).toMatchObject({ id: 'gpt-image-1' })
  })

  it('midjourney streamText returns unsupported_param', async () => {
    await expect(
      midjourneyAdapter.streamText({
        channel: {
          id: 'mj',
          name: 'mj',
          baseUrl: 'https://api.example.com/mj',
          apiKey: 'k',
        },
        request: {
          modelId: 'midjourney-v7',
          messages: [{ role: 'user', content: 'hello' }],
        },
        onDelta: () => {},
      }),
    ).rejects.toMatchObject({
      code: 'unsupported_param',
      providerId: 'midjourney-proxy',
    })
  })

  it('byteplus discovers remote ark model entries and keeps provider-scoped errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'seedream-5.0-lite', family: 'seedream' },
          { id: 'seed-1-6-250915', family: 'seed' },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const ids = await byteplusArkAdapter.discoverModels(openAiChannel)
    const entries = await byteplusArkAdapter.discoverModelEntries?.(openAiChannel)

    expect(ids).toContain('seedream-5.0-lite')
    expect(ids).toContain('seed-1-6-250915')
    expect(entries?.find((item) => item.id === 'seed-1-6-250915')?.metadata).toMatchObject({ family: 'seed' })

    const error = byteplusArkAdapter.normalizeError(new Error('boom'))
    expect(error.providerId).toBe('byteplus-ark')
  })

  it('normalizeError returns provider-scoped error', () => {
    const openaiError = openAICompatibleAdapter.normalizeError(new Error('boom'))
    const byteplusError = byteplusArkAdapter.normalizeError(new Error('boom'))
    const geminiError = geminiAdapter.normalizeError(new Error('boom'))
    const midjourneyError = midjourneyAdapter.normalizeError(new Error('boom'))

    expect(openaiError.providerId).toBe('openai-compatible')
    expect(byteplusError.providerId).toBe('byteplus-ark')
    expect(geminiError.providerId).toBe('gemini-api')
    expect(midjourneyError.providerId).toBe('midjourney-proxy')
  })

  it('normalizes billing exhaustion messages into insufficient balance errors', () => {
    const message = 'insufficient_quota: account balance exhausted, billing required'

    expect(openAICompatibleAdapter.normalizeError(new Error(message))).toMatchObject({ code: 'insufficient_balance' })
    expect(byteplusArkAdapter.normalizeError(new Error(message))).toMatchObject({ code: 'insufficient_balance' })
    expect(geminiAdapter.normalizeError(new Error(message))).toMatchObject({ code: 'insufficient_balance' })
    expect(midjourneyAdapter.normalizeError(new Error(message))).toMatchObject({ code: 'insufficient_balance' })
  })
})
