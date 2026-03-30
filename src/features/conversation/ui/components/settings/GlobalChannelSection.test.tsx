import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlobalChannelSection } from './GlobalChannelSection'
import * as jimengProxy from '../../../../../services/jimengProxy'

describe('GlobalChannelSection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens channel management when requested', async () => {
    const user = userEvent.setup()
    const onOpenDrawer = vi.fn()

    render(<GlobalChannelSection onOpenDrawer={onOpenDrawer} channels={[]} onChannelsChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '管理渠道' }))

    expect(onOpenDrawer).toHaveBeenCalledTimes(1)
  })

  it('opens the Jimeng proxy modal from the Jimeng login entry', async () => {
    const user = userEvent.setup()

    render(<GlobalChannelSection onOpenDrawer={vi.fn()} channels={[]} onChannelsChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /即梦扫码登录/ }))

    expect(await screen.findByText('即梦本地代理')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '刷新动态二维码' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /打开代理登录窗口/ })).toBeInTheDocument()
  })

  it('refreshes the dynamic qr through the proxy service', async () => {
    const user = userEvent.setup()
    vi.spyOn(jimengProxy, 'getJimengProxyLoginQr').mockResolvedValue({
      ok: true,
      pageUrl: 'https://jimeng.jianying.com/ai-tool/home',
      qr: {
        imageSrc: 'data:image/png;base64,ZmFrZQ==',
        width: 180,
        height: 180,
      },
    })

    render(<GlobalChannelSection onOpenDrawer={vi.fn()} channels={[]} onChannelsChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /即梦扫码登录/ }))
    await user.click(await screen.findByRole('button', { name: '刷新动态二维码' }))

    await waitFor(() => {
      expect(jimengProxy.getJimengProxyLoginQr).toHaveBeenCalledTimes(1)
    })
    const image = await screen.findByAltText('即梦动态二维码')
    expect(image).toHaveAttribute('src', 'data:image/png;base64,ZmFrZQ==')
  })
})
