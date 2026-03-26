import { describe, expect, it } from 'vitest'
import {
  buildChatCompletionsUrl,
  buildEditUrlCandidates,
  buildGenerationUrlCandidates,
} from './openaiCompatible/urlBuilders'
import { buildEditsFormData, buildRequestBody } from './openaiCompatible/requestBuilders'
import { toImageSrc } from './openaiCompatible/imagePayloadParser'
import {
  hasAcceptedAsyncHandle,
  parseSseDataBlocks,
  parseTaskRegistration,
  resolveResumeResultFromPayload,
  resolveResumeUrl,
} from './openaiCompatible/taskRegistrationParser'
import {
  buildUnsupportedModelMessage,
  buildUnsupportedSizeMessage,
  createProviderError,
  isAbortError,
  isEndpointMismatchError,
  isSensitiveContentError,
  isUnsupportedModelError,
  isUnsupportedSizeError,
} from './openaiCompatible/providerErrors'

describe('openAICompatibleAdapter helpers', () => {
  it('builds generation/edit/chat url candidates', () => {
    expect(buildGenerationUrlCandidates('https://api.example.com/v1')).toEqual([
      'https://api.example.com/v1/images/generations',
      'https://api.example.com/v1/image/generations',
      'https://api.example.com/v1/volcv/v1/images/generations',
      'https://api.example.com/v1/kling/v1/images/generations',
    ])
    expect(buildEditUrlCandidates('https://api.example.com/v1')).toEqual([
      'https://api.example.com/v1/images/edits',
      'https://api.example.com/v1/image/edits',
    ])
    expect(buildChatCompletionsUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1/chat/completions')
  })

  it('builds request body variants for default, flux, and kling models', () => {
    expect(
      buildRequestBody('gpt-image-1', 'cat', { responseFormat: 'url', size: '1024x1024', aspectRatio: '1:1' }),
    ).toEqual({
      model: 'gpt-image-1',
      prompt: 'cat',
      response_format: 'url',
      size: '1024x1024',
    })

    expect(
      buildRequestBody('flux-dev', 'cat', {
        size: '2K',
        aspectRatio: '16:9',
        outputFormat: 'jpeg',
        seed: 7,
        promptUpsampling: true,
        safetyTolerance: 4,
      }),
    ).toEqual({
      model: 'flux-dev',
      prompt: 'cat',
      size: '16:9',
      output_format: 'jpeg',
      seed: 7,
      prompt_upsampling: true,
      safety_tolerance: 4,
    })

    expect(
      buildRequestBody('kling-v1', 'cat', {
        aspectRatio: '9:16',
        negativePrompt: 'bad',
        callbackUrl: 'https://callback.example.com',
      }),
    ).toEqual({
      prompt: 'cat',
      model_name: 'kling-v1',
      n: 1,
      aspect_ratio: '9:16',
      negative_prompt: 'bad',
      callback_url: 'https://callback.example.com',
    })
  })

  it('builds edits form data with normalized fields and images', () => {
    const formData = buildEditsFormData(
      'gpt-image-1',
      'cat',
      { responseFormat: 'b64_json', size: '1K', aspectRatio: '4:3' },
      [
        {
          blob: new Blob(['a'], { type: 'image/png' }),
          fileName: 'a.png',
          mimeType: 'image/png',
        },
      ],
    )

    expect(formData.get('model')).toBe('gpt-image-1')
    expect(formData.get('prompt')).toBe('cat')
    expect(formData.get('response_format')).toBe('b64_json')
    expect(formData.get('aspect_ratio')).toBe('4:3')
    expect(formData.getAll('image')).toHaveLength(1)
  })

  it('parses image payload from nested output, url and base64', () => {
    expect(toImageSrc({ url: 'https://image.example.com/a.png' })).toBe('https://image.example.com/a.png')
    expect(toImageSrc({ b64_json: 'Zm9v' })).toBe('data:image/png;base64,Zm9v')
    expect(
      toImageSrc({
        output: {
          image_url: 'https://image.example.com/b.png',
        },
      }),
    ).toBe('https://image.example.com/b.png')
    expect(toImageSrc({ data: 'not base64 ???' })).toBeNull()
  })

  it('parses task registration and resume results', () => {
    const acceptedResponse = new Response(JSON.stringify({
      status: 'queued',
      task_id: 'task-1',
      data: [{ id: 'task-1', status_url: 'https://api.example.com/tasks/task-1' }],
    }), {
      status: 202,
      headers: { location: 'https://api.example.com/tasks/task-1' },
    })

    const taskRegistration = parseTaskRegistration({
      baseUrl: 'https://api.example.com/v1',
      requestUrl: 'https://api.example.com/v1/images/generations',
      payload: {
        status: 'queued',
        task_id: 'task-1',
        data: [{ id: 'task-1', status_url: 'https://api.example.com/tasks/task-1' }],
      },
      response: acceptedResponse,
    })
    expect(taskRegistration.serverTaskId).toBe('task-1')
    expect(taskRegistration.providerTaskStatus).toBe('queued')
    expect(taskRegistration.serverTaskMeta?.resumeUrl).toBe('https://api.example.com/tasks/task-1')
    expect(hasAcceptedAsyncHandle({
      taskId: taskRegistration.serverTaskId,
      taskMeta: taskRegistration.serverTaskMeta,
      providerTaskStatus: taskRegistration.providerTaskStatus,
    })).toBe(true)

    const successResponse = new Response(JSON.stringify({
      data: [{ url: 'https://image.example.com/final.png' }],
    }), { status: 200 })
    expect(resolveResumeResultFromPayload({
      channelBaseUrl: 'https://api.example.com/v1',
      taskId: 'task-1',
      taskMeta: { resumeUrl: 'https://api.example.com/tasks/task-1' },
      response: successResponse,
      payload: { data: [{ url: 'https://image.example.com/final.png' }] },
    })).toEqual({
      state: 'success',
      src: 'https://image.example.com/final.png',
      serverTaskId: 'task-1',
      serverTaskMeta: { resumeUrl: 'https://api.example.com/tasks/task-1' },
    })

    expect(resolveResumeUrl('https://api.example.com/v1', 'task-2')).toBe('https://api.example.com/v1/images/generations/task-2')
  })

  it('parses SSE data blocks and maps provider error helpers', () => {
    expect(parseSseDataBlocks('data: {"a":1}\n\ndata: {"b":2}\n\n')).toEqual(['{"a":1}', '{"b":2}'])
    expect(buildUnsupportedSizeMessage('2048x2048')).toContain('2048x2048')
    expect(buildUnsupportedModelMessage('https://api.example.com/v1', 'bad-model', ['bad-model'], new Error('boom'))).toContain('bad-model')
    expect(isUnsupportedSizeError(451, 'invalidParameter size image size must be at least')).toBe(true)
    expect(isSensitiveContentError(451, 'sensitive content')).toBe(true)
    expect(isUnsupportedModelError(new Error('not supported model for image generation'))).toBe(true)
    expect(isAbortError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(true)
    expect(isEndpointMismatchError(Object.assign(new Error('invalid url (POST)'), { status: 404 }))).toBe(true)

    const providerError = createProviderError({ message: 'boom', code: 'provider_unavailable', retriable: true })
    expect(providerError.providerId).toBe('openai-compatible')
    expect(providerError.retriable).toBe(true)
  })
})
