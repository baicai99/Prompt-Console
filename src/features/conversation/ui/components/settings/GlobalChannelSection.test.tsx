import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GlobalChannelSection } from './GlobalChannelSection'

describe('GlobalChannelSection', () => {
  it('opens channel management when requested', async () => {
    const user = userEvent.setup()
    const onOpenDrawer = vi.fn()

    render(<GlobalChannelSection onOpenDrawer={onOpenDrawer} channels={[]} onChannelsChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '管理渠道' }))

    expect(onOpenDrawer).toHaveBeenCalledTimes(1)
  })
})
