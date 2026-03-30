import { afterEach, describe, expect, it, vi } from 'vitest'
import * as jimengProxy from '../jimengProxy'
import { jimengProxyAdapter } from './jimengProxyAdapter'

describe('jimengProxyAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits Jimeng image generation through the local bff and returns pending tasks', async () => {
    vi.spyOn(jimengProxy, 'generateJimengImage').mockResolvedValue({
      ok: true,
      clickInfo: {
        target: {
          index: 0,
          text: '',
          x: 0,
          y: 0,
        },
      },
      request: {
        url: 'http://127.0.0.1:8787/generated',
        method: 'POST',
        headers: {},
        body: '{}',
      },
      response: {
        ok: true,
        status: 200,
        statusText: 'OK',
        url: 'https://jimeng.jianying.com/mweb/v1/aigc_draft/generate',
        text: '',
        json: {
          ret: '0',
          data: {
            aigc_data: {
              history_record_id: '30256091661324',
              status: 42,
              item_list: [],
            },
          },
        },
      },
    })

    const result = await jimengProxyAdapter.generateImages({
      channel: {
        id: '__jimeng-proxy__',
        name: '即梦本地代理',
        baseUrl: 'http://127.0.0.1:8787',
        apiKey: 'local-session',
      },
      request: {
        modelId: 'high_aes_general_v50',
        prompt: '1girl',
        imageCount: 1,
        paramValues: {
          resolution: '2k',
        },
      },
    })

    expect(result.items).toEqual([
      expect.objectContaining({
        seq: 1,
        serverTaskId: '30256091661324',
        providerTaskStatus: '42',
        serverTaskMeta: {
          historyId: '30256091661324',
          itemIndex: '0',
          resolutionType: '2k',
        },
      }),
    ])
  })

  it('resolves completed images from generated asset polling', async () => {
    vi.spyOn(jimengProxy, 'getJimengGeneratedAsset').mockResolvedValue({
      ok: true,
      found: true,
      state: 'success',
      historyId: '30256091661324',
      imageUrl: 'https://example.com/result.png',
      imageUrls: ['https://example.com/result.png'],
      raw: {},
    })

    const resumed = await jimengProxyAdapter.resumeImageTask({
      channel: {
        id: '__jimeng-proxy__',
        name: '即梦本地代理',
        baseUrl: 'http://127.0.0.1:8787',
        apiKey: 'local-session',
      },
      taskId: '30256091661324',
      taskMeta: {
        historyId: '30256091661324',
        resolutionType: '2k',
      },
    })

    expect(resumed).toEqual({
      state: 'success',
      src: 'https://example.com/result.png',
      serverTaskId: '30256091661324',
      serverTaskMeta: {
        historyId: '30256091661324',
        itemIndex: '0',
        resolutionType: '2k',
      },
    })
  })
})
