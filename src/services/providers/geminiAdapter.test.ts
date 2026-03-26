import { afterEach, describe, expect, it, vi } from 'vitest'
import { geminiAdapter } from './geminiAdapter'
import { resolveProviderId } from './providerId'

const GEMINI_TEST_KEY = `AIza${'g'.repeat(28)}`

const channel = {
  baseUrl: 'https://proxy.tuotuai.com',
  apiKey: GEMINI_TEST_KEY,
}

const officialChannel = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  apiKey: GEMINI_TEST_KEY,
}

describe('geminiAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('infers gemini provider from AIza key', () => {
    expect(resolveProviderId(channel)).toBe('gemini-api')
  })

  it('discovers models with x-goog-api-key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const ids = await geminiAdapter.discoverModels(channel)

    expect(ids).toEqual(['gemini-2.5-flash'])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://proxy.tuotuai.com/v1beta/models?pageSize=200',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'x-goog-api-key': channel.apiKey,
        },
      }),
    )
  })

  it('falls back to openai-style model payloads', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'not found',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'not found',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gemini-2.5-flash' },
            { id: 'gemini-2.5-pro' },
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const ids = await geminiAdapter.discoverModels(channel)

    expect(ids).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro'])
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe('https://proxy.tuotuai.com/v1/models')
    expect(String(fetchMock.mock.calls[2]?.[0])).not.toContain('limit=')
  })

  it('falls back to key query param when header auth returns unauthorized', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const ids = await geminiAdapter.discoverModels(channel)

    expect(ids).toEqual(['gemini-2.5-flash'])
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(`key=${encodeURIComponent(channel.apiKey)}`)
  })

  it('does not try openai-style discovery for official gemini hosts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'bad request',
      })
    vi.stubGlobal('fetch', fetchMock)

    await expect(geminiAdapter.discoverModels(officialChannel)).rejects.toThrow('HTTP 401')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/v1beta/models?pageSize=200')
    expect(fetchMock.mock.calls.every((call) => !String(call[0]).includes('/v1/models'))).toBe(true)
  })

  it('streams gemini text deltas', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"candidates":[{"content":{"parts":[{"text":"你好"}]}}]}\n\n',
          ),
        )
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"candidates":[{"content":{"parts":[{"text":"你好，世界"}]}}]}\n\n',
          ),
        )
        controller.close()
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    })
    vi.stubGlobal('fetch', fetchMock)

    const chunks: string[] = []
    await geminiAdapter.streamText({
      channel: {
        id: 'ch',
        name: 'gemini',
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
      },
      request: {
        modelId: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'hi' }],
      },
      onDelta: (chunk) => chunks.push(chunk),
    })

    expect(chunks).toEqual(['你好', '，世界'])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://proxy.tuotuai.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-goog-api-key': channel.apiKey,
        }),
      }),
    )
  })
})
