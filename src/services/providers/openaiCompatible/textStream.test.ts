import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractStreamDeltaText, streamOpenAICompatibleText } from './textStream'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('extractStreamDeltaText', () => {
  it('reads text from content segment arrays', () => {
    expect(extractStreamDeltaText({
      choices: [
        {
          delta: {
            content: [
              { type: 'text', text: '猫咪' },
              { type: 'output_text', text: { value: '海报' } },
            ],
          },
        },
      ],
    })).toBe('猫咪海报')
  })

  it('reads responses-style top-level delta payloads', () => {
    expect(extractStreamDeltaText({
      type: 'response.output_text.delta',
      delta: '你好',
    })).toBe('你好')

    expect(extractStreamDeltaText({
      type: 'response.output_text.delta',
      output_text: { value: '世界' },
    })).toBe('世界')
  })

  it('reads final text from message and response wrapper payloads', () => {
    expect(extractStreamDeltaText({
      choices: [
        {
          message: {
            content: '最终标题',
          },
        },
      ],
    })).toBe('最终标题')

    expect(extractStreamDeltaText({
      type: 'response.output_item.done',
      item: {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: '收尾标题',
          },
        ],
      },
    })).toBe('收尾标题')

    expect(extractStreamDeltaText({
      type: 'response.completed',
      response: {
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: '完成标题',
              },
            ],
          },
        ],
      },
    })).toBe('完成标题')

    expect(extractStreamDeltaText({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: '顶层输出标题',
            },
          ],
        },
      ],
    })).toBe('顶层输出标题')

    expect(extractStreamDeltaText({
      data: {
        result: {
          message: {
            content: '嵌套结果标题',
          },
        },
      },
    })).toBe('嵌套结果标题')
  })

  it('falls back to legacy choice text deltas', () => {
    expect(extractStreamDeltaText({
      choices: [
        {
          text: '标题结果',
        },
      ],
    })).toBe('标题结果')
  })

  it('recovers empty streams via a non-stream fallback request', async () => {
    const encoder = new TextEncoder()
    const streamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"response.created"}\n\n'))
        controller.enqueue(encoder.encode('data: {"type":"response.completed"}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(streamBody, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: '恢复出的标题',
            },
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))

    vi.stubGlobal('fetch', fetchMock)

    const chunks: string[] = []
    await streamOpenAICompatibleText({
      url: 'https://api.example.com/v1/chat/completions',
      apiKey: 'test-key',
      request: {
        modelId: 'gpt-5-nano',
        messages: [{ role: 'user', content: 'hello' }],
        allowNonStreamFallback: true,
      },
      onDelta: (chunk) => {
        chunks.push(chunk)
      },
      isAbortError: () => false,
      createProviderError: ({ message, code = 'unknown', status, retriable = false, detail }) =>
        Object.assign(new Error(message), {
          code,
          status,
          retriable,
          detail,
          providerId: 'openai-compatible',
        }),
    })

    expect(chunks.join('')).toBe('恢复出的标题')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      model: 'gpt-5-nano',
      stream: false,
    })
  })

  it('does not replay the request when non-stream fallback is not allowed', async () => {
    const encoder = new TextEncoder()
    const streamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"response.created"}\n\n'))
        controller.enqueue(encoder.encode('data: {"type":"response.completed"}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    const fetchMock = vi.fn().mockResolvedValue(new Response(streamBody, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const chunks: string[] = []
    await streamOpenAICompatibleText({
      url: 'https://api.example.com/v1/chat/completions',
      apiKey: 'test-key',
      request: {
        modelId: 'gpt-5-nano',
        messages: [{ role: 'user', content: 'hello' }],
      },
      onDelta: (chunk) => {
        chunks.push(chunk)
      },
      isAbortError: () => false,
      createProviderError: ({ message, code = 'unknown', status, retriable = false, detail }) =>
        Object.assign(new Error(message), {
          code,
          status,
          retriable,
          detail,
          providerId: 'openai-compatible',
        }),
    })

    expect(chunks).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
