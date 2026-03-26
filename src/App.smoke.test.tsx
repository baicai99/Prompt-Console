import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const APP_SMOKE_TIMEOUT_MS = 30_000

function clickSegmentedOption(label: string) {
  const radio = screen.getByRole('radio', { name: label })
  fireEvent.click(radio.closest('label') ?? radio)
}

async function renderHomeApp() {
  const result = render(<App />)
  await waitFor(() => {
    expect(result.container.querySelector('.chat-stage')).toBeInTheDocument()
  }, { timeout: APP_SMOKE_TIMEOUT_MS })
  return result
}

describe('App smoke flow', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('keeps the composer in the bottom panel from empty state through first send', async () => {
    const user = userEvent.setup()
    const { container } = await renderHomeApp()

    const chatStage = container.querySelector('.chat-stage')
    const chatBody = container.querySelector('.chat-body')
    const composerPanel = container.querySelector('.chat-composer-panel')
    expect(chatStage).toBeInTheDocument()
    expect(chatBody).toBeInTheDocument()
    expect(composerPanel).toBeInTheDocument()
    expect(chatStage?.lastElementChild).toBe(composerPanel)
    expect(screen.getByText('我可以怎么帮你？')).toBeInTheDocument()

    const input = screen.getByRole('textbox')
    await user.type(input, 'a cat portrait')
    await user.click(screen.getByRole('button', { name: /发送|send/i }))

    await waitFor(() => {
      expect(screen.queryByText('我可以怎么帮你？')).not.toBeInTheDocument()
    })

    expect(chatStage?.lastElementChild).toBe(composerPanel)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  }, APP_SMOKE_TIMEOUT_MS)

  it('keeps the composer in the dedicated bottom panel after the textarea grows to multiple lines', async () => {
    const user = userEvent.setup()
    const { container } = await renderHomeApp()

    const input = screen.getByRole('textbox')
    await user.type(input, 'a cat portrait')
    await user.click(screen.getByRole('button', { name: /发送|send/i }))

    const composerPanel = container.querySelector('.chat-composer-panel')
    expect(composerPanel).not.toBeNull()
    const composerInput = screen.getByRole('textbox') as HTMLTextAreaElement
    const multilineText = 'line 1\nline 2\nline 3'

    fireEvent.change(composerInput, {
      target: { value: multilineText, selectionStart: multilineText.length, selectionEnd: multilineText.length },
    })

    expect(composerInput.value).toBe(multilineText)
    expect(container.querySelector('.chat-stage')?.lastElementChild).toBe(composerPanel)
  }, APP_SMOKE_TIMEOUT_MS)

  it('keeps the composer in the dedicated bottom panel after deleting the leading line from a multiline draft', async () => {
    const user = userEvent.setup()
    const { container } = await renderHomeApp()

    const input = screen.getByRole('textbox')
    await user.type(input, 'a cat portrait')
    await user.click(screen.getByRole('button', { name: /发送|send/i }))

    const composerPanel = container.querySelector('.chat-composer-panel')
    expect(composerPanel).not.toBeNull()
    const composerInput = screen.getByRole('textbox') as HTMLTextAreaElement
    const multilineText = 'very long leading line for width\nok'

    fireEvent.change(composerInput, {
      target: { value: multilineText, selectionStart: multilineText.length, selectionEnd: multilineText.length },
    })

    fireEvent.change(composerInput, {
      target: { value: 'ok', selectionStart: 2, selectionEnd: 2 },
    })

    expect(composerInput.value).toBe('ok')
    expect(container.querySelector('.chat-stage')?.lastElementChild).toBe(composerPanel)
  }, APP_SMOKE_TIMEOUT_MS)

  it('marks long text paste with overshoot metadata while staying in the bottom panel', async () => {
    const user = userEvent.setup()
    const { container } = await renderHomeApp()

    const input = screen.getByRole('textbox')
    await user.type(input, 'a cat portrait')
    await user.click(screen.getByRole('button', { name: /发送|send/i }))

    const composerPanel = container.querySelector('.chat-composer-panel')
    const composerShell = container.querySelector('.composer-shell') as HTMLElement
    const composerCard = container.querySelector('.composer-card') as HTMLDivElement
    const composerInput = screen.getByRole('textbox') as HTMLTextAreaElement
    const longText = Array.from({ length: 8 }, (_, index) => `line ${index + 1} ` + 'wide scenic landscape '.repeat(4)).join('\n')
    let cardSize = { width: 420, height: 88 }

    Object.defineProperty(composerCard, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        ({
          width: cardSize.width,
          height: cardSize.height,
          top: 0,
          right: cardSize.width,
          bottom: cardSize.height,
          left: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    })

    fireEvent.paste(composerInput, {
      clipboardData: {
        files: [],
        getData: (type: string) => (type === 'text/plain' ? longText : ''),
      },
    })
    cardSize = { width: 780, height: 236 }
    fireEvent.change(composerInput, {
      target: { value: longText, selectionStart: longText.length, selectionEnd: longText.length },
    })

    expect(composerShell).toHaveAttribute('data-overshoot-active', 'true')
    expect(composerShell).toHaveAttribute('data-overshoot-reason', 'paste-expand')
    expect(container.querySelector('.chat-stage')?.lastElementChild).toBe(composerPanel)
  }, APP_SMOKE_TIMEOUT_MS)

  it('keeps the composer in the shared bottom panel when empty conversation switches to multi-window mode', async () => {
    const user = userEvent.setup()
    const { container } = await renderHomeApp()

    const chatStage = container.querySelector('.chat-stage')
    const composerPanel = container.querySelector('.chat-composer-panel')
    const input = screen.getByRole('textbox')

    await user.type(input, '/')
    await user.click(screen.getByRole('button', { name: '对照模式' }))

    expect(container.querySelector('.chat-body.chat-body-multi')).toBeInTheDocument()
    expect(container.querySelectorAll('.chat-composer-panel')).toHaveLength(1)
    expect(chatStage?.lastElementChild).toBe(composerPanel)
  }, APP_SMOKE_TIMEOUT_MS)

  it('keeps the active window selection when switching from settings to image params in compare mode', async () => {
    const user = userEvent.setup()
    await renderHomeApp()

    await user.type(screen.getByRole('textbox'), '/')
    await user.click(screen.getByRole('button', { name: '对照模式' }))
    await user.click(screen.getByRole('button', { name: '打开设置' }))
    const windowTab = await screen.findByRole('tab', { name: '窗口 2' })
    await user.click(windowTab)
    expect(windowTab).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: '打开生图参数' }))
    clickSegmentedOption('仅当前窗口')

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '窗口 2' })).toHaveAttribute('aria-selected', 'true')
    })
  }, APP_SMOKE_TIMEOUT_MS)

  it('collapses the composer and restores focus after expanding from the right rail footer', async () => {
    const user = userEvent.setup()
    const { container } = await renderHomeApp()

    await user.type(screen.getByRole('textbox'), 'preview area')
    await user.click(screen.getByRole('button', { name: '收起输入框' }))

    expect(localStorage.getItem('m3:composer-panel-collapsed')).toBe('1')
    expect(container.querySelector('.chat-composer-panel-collapsed')).toBeNull()
    expect(container.querySelector('.chat-composer-panel')).toBeNull()
    expect(container.querySelector('.composer-card')).toBeNull()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开输入框' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '展开输入框' }))

    expect(localStorage.getItem('m3:composer-panel-collapsed')).toBe('0')
    await waitFor(() => {
      const composer = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(composer).toHaveFocus()
      expect(composer.value).toBe('preview area')
    })
  }, APP_SMOKE_TIMEOUT_MS)

  it('restores the collapsed composer state from persisted storage', async () => {
    const user = userEvent.setup()
    const firstRender = await renderHomeApp()

    await user.click(screen.getByRole('button', { name: '收起输入框' }))
    expect(localStorage.getItem('m3:composer-panel-collapsed')).toBe('1')

    firstRender.unmount()
    const { container } = await renderHomeApp()

    expect(container.querySelector('.chat-composer-panel-collapsed')).toBeNull()
    expect(container.querySelector('.chat-composer-panel')).toBeNull()
    expect(screen.getByRole('button', { name: '展开输入框' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  }, APP_SMOKE_TIMEOUT_MS)

  it('keeps the collapsed composer hidden in multi-window mode until reopened from the right rail', async () => {
    const user = userEvent.setup()
    const { container } = await renderHomeApp()

    await user.type(screen.getByRole('textbox'), '/')
    await user.click(screen.getByRole('button', { name: '对照模式' }))
    await user.click(screen.getByRole('button', { name: '收起输入框' }))

    expect(container.querySelector('.chat-body.chat-body-multi')).toBeInTheDocument()
    expect(container.querySelectorAll('.chat-composer-panel')).toHaveLength(0)
    expect(container.querySelector('.chat-composer-panel-collapsed')).toBeNull()
    expect(screen.getByRole('button', { name: '展开输入框' })).toBeInTheDocument()
  }, APP_SMOKE_TIMEOUT_MS)

  it('uses the unified right-rail default-model entry in multi-window mode', async () => {
    const user = userEvent.setup()
    const { container } = await renderHomeApp()

    await user.type(screen.getByRole('textbox'), '/')
    await user.click(screen.getByRole('button', { name: '对照模式' }))

    expect(container.querySelector('.ab-window-card')).toBeNull()
    expect(container.querySelector('.chat-favorite-model-layer')).toBeNull()
    expect(container.querySelector('.ab-window-pill')).toBeNull()
    expect(screen.getByRole('button', { name: '打开默认模型' })).toBeInTheDocument()
  }, APP_SMOKE_TIMEOUT_MS)

  it('keeps multi-window viewports using fixed bottom padding independent of the composer panel', async () => {
    const user = userEvent.setup()
    const { container } = await renderHomeApp()

    await user.type(screen.getByRole('textbox'), '/')
    await user.click(screen.getByRole('button', { name: '对照模式' }))
    await user.type(screen.getByRole('textbox'), 'multi viewport check')
    await user.click(screen.getByRole('button', { name: /发送|send/i }))

    const chatBody = container.querySelector('.chat-body.chat-body-multi') as HTMLDivElement

    expect(chatBody).toBeInTheDocument()
    await waitFor(() => {
      expect(container.querySelectorAll('.ab-window-shell .message-list-viewport')).toHaveLength(2)
    })

    const viewports = Array.from(container.querySelectorAll('.ab-window-shell .message-list-viewport')) as HTMLDivElement[]
    viewports.forEach((viewport) => {
      const viewportStyle = window.getComputedStyle(viewport)
      expect(viewportStyle.paddingBottom).toBe('16px')
      expect(viewportStyle.scrollPaddingBottom).toBe('16px')
    })
  }, APP_SMOKE_TIMEOUT_MS)

  it('restores focus to the composer when creating a conversation or reusing a prompt', async () => {
    const user = userEvent.setup()
    await renderHomeApp()

    const input = screen.getByRole('textbox')
    await user.type(input, 'first prompt')
    await user.click(screen.getByRole('button', { name: /发送|send/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '发送到输入框' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '发送到输入框' }))

    await waitFor(() => {
      const composer = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(composer).toHaveFocus()
      expect(composer.value).toBe('first prompt')
    })

    const createConversationButton = screen.getAllByRole('button', { name: 'create-conversation' })[0]
    await user.click(createConversationButton)

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveFocus()
    })
  }, APP_SMOKE_TIMEOUT_MS)

  it('renders the standalone model stats page on the dedicated route', async () => {
    window.history.replaceState({}, '', '/model-stats')

    render(<App />)

    expect(await screen.findByRole('heading', { name: '模型分析' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /返回对话区/ })).toBeInTheDocument()
    expect(await screen.findByText('时间范围')).toBeInTheDocument()
  }, APP_SMOKE_TIMEOUT_MS)

  it('navigates from the sidebar entry card to the standalone model stats page', async () => {
    const user = userEvent.setup()
    await renderHomeApp()

    await user.click(screen.getByRole('button', { name: '打开运行分析' }))
    await user.click(await screen.findByRole('button', { name: '进入模型分析' }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/model-stats')
      expect(screen.getByRole('heading', { name: '模型分析' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /返回对话区/ }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/')
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  }, APP_SMOKE_TIMEOUT_MS)

  it('renders the standalone logs page on the dedicated route', async () => {
    window.history.replaceState({}, '', '/logs')

    render(<App />)

    expect(await screen.findByRole('heading', { name: '结构化运行日志' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /返回对话区/ })).toBeInTheDocument()
    expect(await screen.findByText('日志系统未开启')).toBeInTheDocument()
  }, APP_SMOKE_TIMEOUT_MS)

  it('navigates from the sidebar logs entry card to the standalone logs page', async () => {
    const user = userEvent.setup()
    await renderHomeApp()

    await user.click(screen.getByRole('button', { name: '打开运行分析' }))
    await user.click(await screen.findByRole('button', { name: '进入日志页' }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/logs')
      expect(screen.getByRole('heading', { name: '结构化运行日志' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /返回对话区/ }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/')
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  }, APP_SMOKE_TIMEOUT_MS)

  it('opens the dynamic prompt drawer from the right mini bar and keeps the composer available', async () => {
    const user = userEvent.setup()
    await renderHomeApp()

    await user.click(screen.getByRole('button', { name: '打开动态提示词' }))

    await waitFor(() => {
      expect(screen.getByText('启用动态提示词')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /发送|send/i })).toBeInTheDocument()
    })
  }, APP_SMOKE_TIMEOUT_MS)

  it('opens the dynamic prompt drawer from the composer after enabling dynamic prompt', async () => {
    const user = userEvent.setup()
    await renderHomeApp()

    await user.type(screen.getByRole('textbox'), '/')
    await user.click(screen.getByRole('button', { name: '动态提示词' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '打开动态提示词抽屉' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '打开动态提示词抽屉' }))

    await waitFor(() => {
      expect(screen.getByText('启用动态提示词')).toBeInTheDocument()
    })
  }, APP_SMOKE_TIMEOUT_MS)

  it('opens the left navigation drawer from the collapsed rail', async () => {
    const user = userEvent.setup()
    await renderHomeApp()

    await user.click(screen.getByLabelText('open-left-sidebar-drawer'))

    expect(await screen.findByText('会话导航')).toBeInTheDocument()
    const closeButton = document.querySelector('.conversation-nav-drawer-root .ant-drawer-close') as HTMLButtonElement
    expect(closeButton).not.toBeNull()

    await user.click(closeButton)

    await waitFor(() => {
      expect(document.querySelector('.conversation-nav-drawer-root .ant-drawer-open')).toBeNull()
    })
  }, APP_SMOKE_TIMEOUT_MS)

})
