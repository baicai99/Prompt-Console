import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OverflowTabs } from '../OverflowTabs'
import { WindowSettingsTabs } from './WindowSettingsTabs'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mockTabsOverflowLayout() {
  class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: target.getBoundingClientRect(),
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      )
    }

    unobserve() {}

    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock as unknown as typeof ResizeObserver)

  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('settings-tabs-test-host')) {
      return 220
    }
    if (this.classList.contains('ant-tabs-nav')) {
      return 220
    }
    if (this.classList.contains('ant-tabs-nav-wrap')) {
      return 168
    }
    if (this.classList.contains('ant-tabs-nav-list')) {
      return 520
    }
    if (this.classList.contains('ant-tabs-nav-operations') || this.classList.contains('ant-tabs-nav-more')) {
      return 36
    }
    if (this.classList.contains('ant-tabs-tab')) {
      return 92
    }
    return 80
  })

  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('ant-tabs-tab')) {
      const siblings = Array.from(this.parentElement?.children ?? []).filter((item) =>
        item instanceof HTMLElement && item.classList.contains('ant-tabs-tab'),
      )
      const index = siblings.indexOf(this)
      return index >= 0 ? index * 92 : 0
    }

    return 0
  })

  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(() => 0)

  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.offsetWidth
  })

  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('ant-tabs-nav-list')) {
      return 520
    }
    return this.offsetWidth
  })

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = this.offsetWidth
    const left = this.offsetLeft
    return {
      x: 0,
      y: 0,
      top: 0,
      left,
      bottom: 32,
      right: left + width,
      width,
      height: 32,
      toJSON: () => ({}),
    } as DOMRect
  })
}

function renderTopTabsHarness() {
  function Harness() {
    const [activeKey, setActiveKey] = useState('settings')

    return (
      <div className="settings-tabs-test-host">
        <OverflowTabs
          className="settings-sider-tabs"
          activeKey={activeKey}
          onChange={setActiveKey}
          items={[
            { key: 'settings', label: '设置', children: <div>panel-settings</div> },
            { key: 'imageParams', label: '生图参数', children: <div>panel-image-params</div> },
            { key: 'advanced', label: '高级功能', children: <div>panel-advanced</div> },
            { key: 'logs', label: '日志', children: <div>panel-logs</div> },
            { key: 'storage', label: '本地存储', children: <div>panel-storage</div> },
          ]}
        />
      </div>
    )
  }

  return render(<Harness />)
}

function renderNestedTabsHarness() {
  function Harness() {
    const [activeOuterKey, setActiveOuterKey] = useState('settings')
    const [activeInnerKey, setActiveInnerKey] = useState('win-1')

    return (
      <div className="settings-tabs-test-host">
        <OverflowTabs
          className="settings-sider-tabs"
          activeKey={activeOuterKey}
          onChange={setActiveOuterKey}
          items={[
            {
              key: 'settings',
              label: '设置',
              children: (
                <div className="settings-panel-window-section">
                  <WindowSettingsTabs
                    sideMode="multi"
                    sideIds={['win-1', 'win-2', 'win-3', 'win-4']}
                    activeSideTab={activeInnerKey}
                    onSideTabChange={setActiveInnerKey}
                    renderSettingForm={(side) => <div>{`panel-${side}`}</div>}
                  />
                </div>
              ),
            },
            { key: 'imageParams', label: '生图参数', children: <div>panel-image-params</div> },
            { key: 'advanced', label: '高级功能', children: <div>panel-advanced</div> },
            { key: 'logs', label: '日志', children: <div>panel-logs</div> },
            { key: 'storage', label: '本地存储', children: <div>panel-storage</div> },
          ]}
        />
      </div>
    )
  }

  return render(<Harness />)
}

describe('OverflowTabs', () => {
  it('shows a more entry for top tabs and switches to hidden tabs from it when width is constrained', async () => {
    mockTabsOverflowLayout()
    const user = userEvent.setup()
    const { container } = renderTopTabsHarness()

    await waitFor(() => {
      expect(container.querySelector('.ant-tabs-nav-more')).not.toBeNull()
    })

    const moreButton = container.querySelector('.ant-tabs-nav-more') as HTMLElement
    expect(moreButton.querySelector('.anticon-ellipsis')).not.toBeNull()

    await user.click(moreButton)

    const storageEntry = await screen.findByText('本地存储')
    await user.click(storageEntry)

    expect(await screen.findByText('panel-storage')).toBeInTheDocument()
  })

  it('renders the shared more icon', () => {
    mockTabsOverflowLayout()
    renderTopTabsHarness()

    expect(document.querySelector('.ant-tabs-nav-more .anticon-ellipsis')).not.toBeNull()
  })

  it('preserves overflow behavior when top-level and nested window tabs are both constrained', async () => {
    mockTabsOverflowLayout()
    const user = userEvent.setup()
    const { container } = renderNestedTabsHarness()

    await waitFor(() => {
      expect(container.querySelectorAll('.ant-tabs-nav-more').length).toBeGreaterThanOrEqual(2)
    })

    const moreButtons = Array.from(container.querySelectorAll('.ant-tabs-nav-more')) as HTMLElement[]
    expect(moreButtons.length).toBeGreaterThanOrEqual(2)

    await user.click(moreButtons[1])
    const hiddenWindowEntry = await screen.findByText('窗口 4')
    await user.click(hiddenWindowEntry)

    expect(await screen.findByText('panel-win-4')).toBeInTheDocument()
  })
})
