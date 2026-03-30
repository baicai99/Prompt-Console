import { afterEach, describe, expect, it } from 'vitest'
import { clearJimengModelCatalog, saveJimengModelCatalog } from './jimengModelMapping'
import { getModelCatalogFromChannels } from './modelCatalog'

describe('modelCatalog', () => {
  afterEach(() => {
    clearJimengModelCatalog()
  })

  it('keeps shared size controls out of model params', () => {
    const catalog = getModelCatalogFromChannels([
      {
        id: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'k',
        providerId: 'openai-compatible',
        models: ['gpt-image-1'],
      },
      {
        id: 'byteplus',
        name: 'BytePlus',
        baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3',
        apiKey: 'k',
        providerId: 'byteplus-ark',
        models: ['seedream-5.0-lite'],
      },
      {
        id: 'gemini',
        name: 'Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: 'k',
        providerId: 'gemini-api',
        models: ['gemini-2.5-flash-image'],
      },
    ])

    expect(catalog.models.find((item) => item.rawId === 'gpt-image-1')?.params.map((item) => item.key)).toEqual([
      'responseFormat',
    ])
    expect(catalog.models.find((item) => item.rawId === 'gpt-image-1')?.params[0]?.default).toBe('b64_json')
    expect(catalog.models.find((item) => item.rawId === 'seedream-5.0-lite')?.params.map((item) => item.key)).toEqual([
      'responseFormat',
      'watermark',
      'sequentialImageGeneration',
      'sequentialMaxImages',
      'stream',
      'guidanceScale',
      'seed',
      'outputFormat',
      'optimizePromptMode',
    ])
    expect(catalog.models.find((item) => item.rawId === 'seedream-5.0-lite')?.params[0]?.default).toBe('b64_json')
    expect(catalog.models.find((item) => item.rawId === 'gemini-2.5-flash-image')?.params).toEqual([
      {
        key: 'responseFormat',
        label: '返回格式',
        type: 'enum',
        default: 'b64_json',
        min: undefined,
        max: undefined,
        options: ['b64_json'],
      },
    ])
  })

  it('keeps duplicate raw ids from different suppliers as separate model options', () => {
    const catalog = getModelCatalogFromChannels([
      {
        id: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'k',
        providerId: 'openai-compatible',
        models: ['gpt-4.1'],
      },
      {
        id: 'anthropic-proxy',
        name: 'Anthropic',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'k',
        providerId: 'openai-compatible',
        models: ['gpt-4.1'],
      },
    ])

    expect(catalog.models).toHaveLength(2)
    expect(catalog.models.map((item) => item.name)).toEqual(['gpt-4.1（OpenAI）', 'gpt-4.1（Anthropic）'])
    expect(new Set(catalog.models.map((item) => item.id)).size).toBe(2)
    expect(catalog.models.every((item) => item.rawId === 'gpt-4.1')).toBe(true)
  })

  it('merges cached Jimeng models into the main catalog', () => {
    saveJimengModelCatalog({
      models: [
        {
          id: '__jimeng-proxy__::high_aes_general_v50',
          rawId: 'high_aes_general_v50',
          name: '图片5.0 Lite（即梦图片）',
          channelId: '__jimeng-proxy__',
          sourceName: '即梦图片',
          tags: ['jimeng-proxy', '即梦'],
          params: [
            {
              key: 'resolution',
              label: '清晰度',
              type: 'enum',
              default: '2k',
              options: ['2k', '4k'],
            },
          ],
        },
      ],
    })

    const catalog = getModelCatalogFromChannels([])

    expect(catalog.models).toHaveLength(1)
    expect(catalog.models[0]).toMatchObject({
      id: '__jimeng-proxy__::high_aes_general_v50',
      channelId: '__jimeng-proxy__',
      sourceName: '即梦图片',
    })
  })
})
