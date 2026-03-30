import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as jimengProxy from '../../../../../services/jimengProxy'
import { JimengProxyModal } from './JimengProxyModal'

describe('JimengProxyModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('loads Jimeng models after login and upserts the virtual channel', async () => {
    const user = userEvent.setup()
    const onChannelsChange = vi.fn()

    vi.spyOn(jimengProxy, 'getJimengProxyStatus').mockResolvedValue({
      ok: true,
      browserRunning: true,
      browserMode: 'interactive',
      pageUrl: 'https://jimeng.jianying.com/ai-tool/home',
      loginCheck: {
        loggedIn: true,
        status: 200,
        payload: { ok: true },
        snippet: '',
      },
    })

    vi.spyOn(jimengProxy, 'fetchJimengImageModelConfig').mockResolvedValue({
      ok: true,
      proxy: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        text: '',
        finalUrl: 'https://jimeng.jianying.com/mweb/v1/get_common_config',
        json: {
          data: {
            model_list: [
              {
                model_req_key: 'high_aes_general_v50',
                model_name: '图片5.0 Lite',
                generation_category_name: '5.0 Lite',
                sample_steps: {
                  steps: 16,
                  min_steps: 10,
                  max_steps: 41,
                },
                resolution_map: {
                  '2k': {
                    image_ratio_sizes: [
                      { ratio_type: 1, width: 2048, height: 2048 },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    })

    render(
      <JimengProxyModal
        open
        onClose={vi.fn()}
        channels={[]}
        onChannelsChange={onChannelsChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: /检查代理状态/ }))

    await waitFor(() => {
      expect(jimengProxy.fetchJimengImageModelConfig).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(onChannelsChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: '__jimeng-proxy__',
          name: '即梦本地代理',
          baseUrl: 'http://127.0.0.1:8787',
          providerId: 'jimeng-proxy',
          models: ['high_aes_general_v50'],
        }),
      ])
    })
    expect(await screen.findByText('已映射 1 个模型')).toBeInTheDocument()
  })
})
