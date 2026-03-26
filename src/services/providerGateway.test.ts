import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  discoverModelsByProvider,
  generateImagesByProvider,
  resumeImageTaskByProvider,
  streamImageTaskByProvider,
  streamTextByProvider,
} from './providerGateway'
import { MAX_CONCURRENT_IMAGE_REQUESTS } from './imageRequestLimiter'

describe('providerGateway', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('routes to midjourney adapter by baseUrl and falls back to built-in models', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    const models = await discoverModelsByProvider({
      baseUrl: 'https://api.example.com/mj',
      apiKey: 'k',
    })

    expect(models).toEqual(['midjourney', 'midjourney-v6'])
  })

  it('routes openai-compatible image generation and normalizes payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: 'https://img.example/a.png' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const onTaskRegistered = vi.fn()

    const result = await generateImagesByProvider({
      channel: {
        id: 'ch',
        name: 'main',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'k',
        providerId: 'openai-compatible',
      },
      request: {
        modelId: 'gemini-3-pro-image-preview',
        prompt: 'a cat',
        imageCount: 1,
        paramValues: {
          size: '2K',
          aspectRatio: '16:9',
          responseFormat: 'url',
        },
      },
      onTaskRegistered,
    })

    expect(result.items[0]?.src).toBe('https://img.example/a.png')
    expect(onTaskRegistered).not.toHaveBeenCalled()
    const request = fetchMock.mock.calls[0]?.[1] as { body?: string }
    const body = JSON.parse(request.body ?? '{}') as Record<string, unknown>
    expect(body.size).toBe('2752x1536')
  })

  it('routes openai-compatible image generation with a finalized pixel size only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: 'https://img.example/a.png' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await generateImagesByProvider({
      channel: {
        id: 'ch',
        name: 'main',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'k',
        providerId: 'openai-compatible',
      },
      request: {
        modelId: 'gpt-image-1',
        prompt: 'a cat',
        imageCount: 1,
        paramValues: {
          size: '2752x1536',
          responseFormat: 'url',
        },
      },
    })

    const request = fetchMock.mock.calls[0]?.[1] as { body?: string }
    const body = JSON.parse(request.body ?? '{}') as Record<string, unknown>
    expect(body.size).toBe('2752x1536')
  })

  it('routes byteplus image generation to ark endpoint and preserves provider params', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'aGVsbG8=' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImagesByProvider({
      channel: {
        id: 'ch',
        name: 'byteplus',
        baseUrl: 'https://ark.ap-southeast.bytepluses.com',
        apiKey: 'k',
        providerId: 'byteplus-ark',
      },
      request: {
        modelId: 'seedream-5.0-lite',
        prompt: 'a cat',
        imageCount: 1,
        paramValues: {
          size: '3K',
          responseFormat: 'b64_json',
          outputFormat: 'png',
          sequentialImageGeneration: 'auto',
          sequentialMaxImages: 3,
          watermark: false,
        },
      },
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://ark.ap-southeast.bytepluses.com/api/v3/images/generations')
    const request = fetchMock.mock.calls[0]?.[1] as { body?: string }
    const body = JSON.parse(request.body ?? '{}') as Record<string, unknown>
    expect(body.model).toBe('seedream-5.0-lite')
    expect(body.size).toBe('3K')
    expect(body.output_format).toBe('png')
    expect(body.sequential_image_generation).toBe('auto')
    expect(body.sequential_image_generation_options).toEqual({ max_images: 3 })
    expect(body.watermark).toBe(false)
    expect(result.items[0]?.src).toBe('data:image/jpeg;base64,aGVsbG8=')
  })

  it('infers byteplus provider from ark baseUrl and returns remote model list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'seedream-5.0-lite', owned_by: 'byteplus' },
          { id: 'deepseek-v3-2', owned_by: 'byteplus' },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const models = await discoverModelsByProvider({
      baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3',
      apiKey: 'k',
    })

    expect(models).toContain('seedream-5.0-lite')
    expect(models).toContain('deepseek-v3-2')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ark.ap-southeast.bytepluses.com/api/v3/models?limit=200',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer k' },
      }),
    )
  })

  it('resumes midjourney task and keeps pending while still processing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ task_id: 'task-1', status: 'processing' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resumeImageTaskByProvider({
      channel: {
        id: 'ch',
        name: 'main',
        baseUrl: 'https://api.example.com/mj',
        apiKey: 'k',
        providerId: 'midjourney-proxy',
      },
      taskId: 'task-1',
    })

    expect(result).toEqual({
      state: 'pending',
      providerTaskStatus: 'processing',
      serverTaskId: 'task-1',
      serverTaskMeta: { resumeUrl: 'https://api.example.com/mj/task/task-1/fetch' },
    })
  })

  it('streams image task updates via openai-compatible SSE when available', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"data":[{"url":"https://img.example/stream.png"}]}\n\n'))
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })))
    const onEvent = vi.fn()

    const result = await streamImageTaskByProvider({
      channel: {
        id: 'ch',
        name: 'main',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'k',
        providerId: 'openai-compatible',
      },
      taskId: 'task-1',
      taskMeta: { resumeUrl: 'https://api.example.com/v1/images/generations/task-1' },
      onEvent,
    })

    expect(result).toEqual({ state: 'completed' })
    expect(onEvent).toHaveBeenCalledWith({
      state: 'success',
      src: 'https://img.example/stream.png',
      serverTaskId: 'task-1',
      serverTaskMeta: { resumeUrl: 'https://api.example.com/v1/images/generations/task-1' },
    })
  })

  it('returns unsupported when the provider has no image stream transport', async () => {
    const result = await streamImageTaskByProvider({
      channel: {
        id: 'ch',
        name: 'main',
        baseUrl: 'https://ark.ap-southeast.bytepluses.com',
        apiKey: 'k',
        providerId: 'byteplus-ark',
      },
      taskId: 'task-1',
      onEvent: vi.fn(),
    })

    expect(result).toEqual({ state: 'unsupported' })
  })

  it('submits mj imagine payload using prompt/botType/base64Array and returns pending task', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 1,
        description: 'Submit success',
        result: '1725017986212425',
        properties: {
          discordChannelId: '1278917486263402612',
          discordInstanceId: '1550466896007176192',
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImagesByProvider({
      channel: {
        id: 'ch',
        name: 'mj',
        baseUrl: 'https://api.gpt.ge',
        apiKey: 'k',
        providerId: 'midjourney-proxy',
      },
      request: {
        modelId: 'midjourney-v7',
        prompt: '沙滩、阳光、风筝、长发女孩、甜美微笑',
        imageCount: 1,
        paramValues: {
          botType: 'MID_JOURNEY',
          base64Array: 'data:image/png;base64,xxx1',
        },
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.gpt.ge/mj/submit/imagine',
      expect.objectContaining({ method: 'POST' }),
    )
    const request = fetchMock.mock.calls[0]?.[1] as { body?: string }
    const body = JSON.parse(request.body ?? '{}') as Record<string, unknown>
    expect(body.prompt).toBe('沙滩、阳光、风筝、长发女孩、甜美微笑')
    expect(body.botType).toBe('MID_JOURNEY')
    expect(body.base64Array).toEqual(['data:image/png;base64,xxx1'])
    expect(result.items[0]).toMatchObject({
      seq: 1,
      serverTaskId: '1725017986212425',
      serverTaskMeta: {
        resumeUrl: 'https://api.gpt.ge/mj/task/1725017986212425/fetch',
      },
    })
  })

  it('auto-routes mj-like model ids to midjourney adapter when providerId is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 1,
        description: 'Submit success',
        result: 'task-mj-1',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImagesByProvider({
      channel: {
        id: 'ch',
        name: 'main',
        baseUrl: 'https://ai.t8star.cn',
        apiKey: 'k',
      },
      request: {
        modelId: 'mj_fast_imagine',
        prompt: '1girl',
        imageCount: 1,
        paramValues: {},
      },
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://ai.t8star.cn/mj/submit/imagine')
    expect(result.items[0]).toMatchObject({
      seq: 1,
      serverTaskId: 'task-mj-1',
      serverTaskMeta: { resumeUrl: 'https://ai.t8star.cn/mj/task/task-mj-1/fetch' },
    })
  })

  it('auto-routes mj-like model ids to midjourney adapter even when providerId is openai-compatible', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 1,
        description: 'Submit success',
        result: 'task-mj-2',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImagesByProvider({
      channel: {
        id: 'ch',
        name: 'main',
        baseUrl: 'https://ai.t8star.cn',
        apiKey: 'k',
        providerId: 'openai-compatible',
      },
      request: {
        modelId: 'mj_fast_imagine',
        prompt: '1girl',
        imageCount: 1,
        paramValues: {},
      },
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://ai.t8star.cn/mj/submit/imagine')
    expect(result.items[0]).toMatchObject({
      seq: 1,
      serverTaskId: 'task-mj-2',
    })
  })

  it('submits multiple midjourney images concurrently', async () => {
    let activeRequests = 0
    let maxActiveRequests = 0
    let sequence = 0
    const fetchMock = vi.fn().mockImplementation(async () => {
      activeRequests += 1
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
      await new Promise((resolve) => setTimeout(resolve, 10))
      activeRequests -= 1
      sequence += 1
      return {
        ok: true,
        status: 200,
        json: async () => ({
          code: 1,
          description: 'Submit success',
          result: `task-${sequence}`,
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImagesByProvider({
      channel: {
        id: 'ch',
        name: 'mj',
        baseUrl: 'https://api.gpt.ge',
        apiKey: 'k',
        providerId: 'midjourney-proxy',
      },
      request: {
        modelId: 'midjourney-v7',
        prompt: 'parallel',
        imageCount: 4,
        paramValues: {},
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(maxActiveRequests).toBeGreaterThan(1)
    expect(result.items).toHaveLength(4)
  })

  it('limits aggregate image submit fan-out across concurrent openai batches', async () => {
    let activeRequests = 0
    let maxActiveRequests = 0
    const fetchMock = vi.fn().mockImplementation(async () => {
      activeRequests += 1
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
      await new Promise((resolve) => setTimeout(resolve, 10))
      activeRequests -= 1
      return {
        ok: true,
        json: async () => ({ data: [{ url: 'https://img.example/a.png' }] }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([
      generateImagesByProvider({
        channel: {
          id: 'ch-1',
          name: 'main',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'k',
          providerId: 'openai-compatible',
        },
        request: {
          modelId: 'gemini-3-pro-image-preview',
          prompt: 'batch-a',
          imageCount: 4,
          paramValues: {
            size: '1K',
            aspectRatio: '1:1',
            responseFormat: 'url',
          },
        },
      }),
      generateImagesByProvider({
        channel: {
          id: 'ch-2',
          name: 'main',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'k',
          providerId: 'openai-compatible',
        },
        request: {
          modelId: 'gemini-3-pro-image-preview',
          prompt: 'batch-b',
          imageCount: 4,
          paramValues: {
            size: '1K',
            aspectRatio: '1:1',
            responseFormat: 'url',
          },
        },
      }),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(8)
    expect(maxActiveRequests).toBe(MAX_CONCURRENT_IMAGE_REQUESTS)
  })

  it('auto-routes resume by mj resumeUrl hint when providerId is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        task_id: 'task-mj-2',
        status: 'pending',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resumeImageTaskByProvider({
      channel: {
        id: 'ch',
        name: 'main',
        baseUrl: 'https://ai.t8star.cn',
        apiKey: 'k',
      },
      taskMeta: {
        resumeUrl: 'https://ai.t8star.cn/mj/task/task-mj-2/fetch',
      },
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://ai.t8star.cn/mj/task/task-mj-2/fetch')
    expect(result).toMatchObject({
      state: 'pending',
      serverTaskId: 'task-mj-2',
    })
  })

  it('streams text deltas from openai-compatible provider', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"，世界"}}]}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
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
    await streamTextByProvider({
      channel: {
        id: 'ch',
        name: 'main',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'k',
        providerId: 'openai-compatible',
      },
      request: {
        modelId: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      },
      onDelta: (chunk) => chunks.push(chunk),
    })

    expect(chunks).toEqual(['你好', '，世界'])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('throws mapped auth error when text stream response is unauthorized', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
      body: null,
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      streamTextByProvider({
        channel: {
          id: 'ch',
          name: 'main',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'k',
          providerId: 'openai-compatible',
        },
        request: {
          modelId: 'gpt-4o',
          messages: [{ role: 'user', content: 'hi' }],
        },
        onDelta: () => {},
      }),
    ).rejects.toMatchObject({
      code: 'auth',
      providerId: 'openai-compatible',
    })
  })

  it('passes allowNonStreamFallback through text requests', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    })
    vi.stubGlobal('fetch', fetchMock)

    await streamTextByProvider({
      channel: {
        id: 'ch',
        name: 'main',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'k',
        providerId: 'openai-compatible',
      },
      request: {
        modelId: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
        allowNonStreamFallback: true,
      },
      onDelta: () => {},
    })

    const request = fetchMock.mock.calls[0]?.[1] as { body?: string }
    const body = JSON.parse(request.body ?? '{}') as Record<string, unknown>
    expect(body.stream).toBe(true)
  })
})
