import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from 'antd'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PanelValueFormat, PanelVariableRow } from '../../domain/types'
import type { ModelSpec } from '../../../../types/model'
import type { SideMode } from '../../../../types/conversation'
import { Composer } from './Composer'
import { DynamicPromptPanel } from './DynamicPromptPanel'

afterEach(() => {
  Modal.destroyAll()
})

function makeRows(): PanelVariableRow[] {
  return [{ id: 'row-1', key: 'subject', valuesText: '', selectedValue: '' }]
}

function makeModels(): ModelSpec[] {
  return [
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', tags: ['google'], params: [] },
    { id: 'gpt-image-1', name: 'GPT Image 1', tags: ['openai'], params: [] },
  ]
}

function renderComposer(
  format: PanelValueFormat,
  onFormatChange = vi.fn(),
  onPanelVariablesChange = vi.fn(),
  onSend = vi.fn(),
  isSending = false,
  draft = '',
  onDraftChange = vi.fn(),
  dynamicPromptEnabled = true,
  onAdvancedFeaturesEnabledChange = vi.fn(),
  sideMode: SideMode = 'single',
  onSideModeChange = vi.fn(),
  isSideConfigLocked = false,
  panelVariables: PanelVariableRow[] = makeRows(),
  models: ModelSpec[] = makeModels(),
  showAdvancedVariables = true,
  panelBatchError = '',
  onOpenDynamicPromptDrawer = vi.fn(),
) {
  return render(
    <div className="chat-composer-panel">
      <div className="chat-composer-panel-inner">
        <Composer
          draft={draft}
          sourceImages={[]}
          sendError=""
          models={models}
          showAdvancedVariables={showAdvancedVariables}
          dynamicPromptEnabled={dynamicPromptEnabled}
          panelValueFormat={format}
          panelVariables={panelVariables}
          resolvedVariables={{}}
          finalPromptPreview=""
          missingKeys={[]}
          unusedVariableKeys={[]}
          isSending={isSending}
          isSendBlocked={false}
          panelBatchError={panelBatchError}
          panelMismatchRowIds={[]}
          sideMode={sideMode}
          isSideConfigLocked={isSideConfigLocked}
          onDraftChange={onDraftChange}
          onSourceImagesAppend={vi.fn()}
          onSourceImageRemove={vi.fn()}
          onSourceImagesClear={vi.fn()}
          onPanelValueFormatChange={onFormatChange}
          onPanelVariablesChange={onPanelVariablesChange}
          onAdvancedFeaturesEnabledChange={onAdvancedFeaturesEnabledChange}
          onSideModeChange={onSideModeChange}
          onOpenDynamicPromptDrawer={onOpenDynamicPromptDrawer}
          onSend={onSend}
        />
      </div>
    </div>,
  )
}

function renderDynamicPromptPanel(
  format: PanelValueFormat,
  onFormatChange = vi.fn(),
  onPanelVariablesChange = vi.fn(),
  panelVariables: PanelVariableRow[] = makeRows(),
) {
  const onAdvancedFeaturesEnabledChange = vi.fn()
  const requestComposerFocus = vi.fn()

  render(
    <DynamicPromptPanel
      showAdvancedVariables
      dynamicPromptEnabled
      requestedTab="table"
      openRequestToken={1}
      panelValueFormat={format}
      panelVariables={panelVariables}
      resolvedVariables={{}}
      finalPromptPreview=""
      missingKeys={[]}
      unusedVariableKeys={[]}
      panelBatchError=""
      panelMismatchRowIds={[]}
      onPanelValueFormatChange={onFormatChange}
      onPanelVariablesChange={onPanelVariablesChange}
      onAdvancedFeaturesEnabledChange={onAdvancedFeaturesEnabledChange}
      requestComposerFocus={requestComposerFocus}
    />,
  )

  return {
    onAdvancedFeaturesEnabledChange,
    requestComposerFocus,
  }
}

function renderControlledComposer(initialDraft = '') {
  const onSend = vi.fn()

  function Harness() {
    const [draft, setDraft] = useState(initialDraft)
    return (
      <div className="chat-composer-panel">
        <div className="chat-composer-panel-inner">
          <Composer
            draft={draft}
            sourceImages={[]}
            sendError=""
            models={makeModels()}
            showAdvancedVariables
            dynamicPromptEnabled
            panelValueFormat="json"
            panelVariables={makeRows()}
            resolvedVariables={{}}
            finalPromptPreview=""
            missingKeys={[]}
            unusedVariableKeys={[]}
            isSending={false}
            isSendBlocked={false}
            panelBatchError=""
            panelMismatchRowIds={[]}
            sideMode="single"
            isSideConfigLocked={false}
            onDraftChange={setDraft}
            onSourceImagesAppend={vi.fn()}
            onSourceImageRemove={vi.fn()}
            onSourceImagesClear={vi.fn()}
            onPanelValueFormatChange={vi.fn()}
            onPanelVariablesChange={vi.fn()}
            onAdvancedFeaturesEnabledChange={vi.fn()}
            onSideModeChange={vi.fn()}
            onOpenDynamicPromptDrawer={vi.fn()}
            onSend={onSend}
          />
        </div>
      </div>
    )
  }

  return {
    onSend,
    ...render(<Harness />),
  }
}

function renderComposerWithStaleParentDraft(input?: {
  draft?: string
  generationMode?: 'image' | 'text'
  panelBatchError?: string
  onCollapse?: () => void
}) {
  const onSend = vi.fn()
  const onDraftChange = vi.fn()
  const onCollapse = input?.onCollapse ?? vi.fn()
  let collapseAction: (() => void) | null = null

  render(
    <div className="chat-composer-panel">
      <div className="chat-composer-panel-inner">
        <Composer
          draft={input?.draft ?? ''}
          sourceImages={[]}
          sendError=""
          models={makeModels()}
          showAdvancedVariables
          dynamicPromptEnabled
          generationMode={input?.generationMode ?? 'image'}
          panelValueFormat="json"
          panelVariables={makeRows()}
          resolvedVariables={{}}
          finalPromptPreview=""
          missingKeys={[]}
          unusedVariableKeys={[]}
          isSending={false}
          isSendBlocked
          panelBatchError={input?.panelBatchError ?? ''}
          panelMismatchRowIds={[]}
          sideMode="single"
          isSideConfigLocked={false}
          onDraftChange={onDraftChange}
          onSourceImagesAppend={vi.fn()}
          onSourceImageRemove={vi.fn()}
          onSourceImagesClear={vi.fn()}
          onPanelValueFormatChange={vi.fn()}
          onPanelVariablesChange={vi.fn()}
          onAdvancedFeaturesEnabledChange={vi.fn()}
          onGenerationModeChange={vi.fn()}
          onSideModeChange={vi.fn()}
          onOpenDynamicPromptDrawer={vi.fn()}
          onCollapse={onCollapse}
          registerCollapseAction={(action) => {
            collapseAction = action
          }}
          onSend={onSend}
        />
      </div>
    </div>,
  )

  return {
    onSend,
    onDraftChange,
    onCollapse,
    getCollapseAction: () => collapseAction,
  }
}

function renderControlledComposerWithUnused(initialDraft = '', unusedVariableKeys: string[] = ['style']) {
  const onSend = vi.fn()

  function Harness() {
    const [draft, setDraft] = useState(initialDraft)
    return (
      <div className="chat-composer-panel">
        <div className="chat-composer-panel-inner">
          <Composer
            draft={draft}
            sourceImages={[]}
            sendError=""
            models={makeModels()}
            showAdvancedVariables
            dynamicPromptEnabled
            panelValueFormat="json"
            panelVariables={makeRows()}
            resolvedVariables={{}}
            finalPromptPreview=""
            missingKeys={[]}
            unusedVariableKeys={unusedVariableKeys}
            isSending={false}
            isSendBlocked={false}
            panelBatchError=""
            panelMismatchRowIds={[]}
            sideMode="single"
            isSideConfigLocked={false}
            onDraftChange={setDraft}
            onSourceImagesAppend={vi.fn()}
            onSourceImageRemove={vi.fn()}
            onSourceImagesClear={vi.fn()}
            onPanelValueFormatChange={vi.fn()}
            onPanelVariablesChange={vi.fn()}
            onAdvancedFeaturesEnabledChange={vi.fn()}
            onSideModeChange={vi.fn()}
            onOpenDynamicPromptDrawer={vi.fn()}
            onSend={onSend}
          />
        </div>
      </div>
    )
  }

  return {
    onSend,
    ...render(<Harness />),
  }
}

function renderControlledComparisonModeComposer() {
  function Harness() {
    const [sideMode, setSideMode] = useState<SideMode>('multi')

    return (
      <div className="chat-composer-panel">
        <div className="chat-composer-panel-inner">
          <Composer
            draft=""
            sourceImages={[]}
            sendError=""
            models={makeModels()}
            showAdvancedVariables={false}
            dynamicPromptEnabled={false}
            generationMode="image"
            panelValueFormat="json"
            panelVariables={makeRows()}
            resolvedVariables={{}}
            finalPromptPreview=""
            missingKeys={[]}
            unusedVariableKeys={[]}
            isSending={false}
            isSendBlocked={false}
            panelBatchError=""
            panelMismatchRowIds={[]}
            sideMode={sideMode}
            isSideConfigLocked={false}
            onDraftChange={vi.fn()}
            onSourceImagesAppend={vi.fn()}
            onSourceImageRemove={vi.fn()}
            onSourceImagesClear={vi.fn()}
            onPanelValueFormatChange={vi.fn()}
            onPanelVariablesChange={vi.fn()}
            onAdvancedFeaturesEnabledChange={vi.fn()}
            onGenerationModeChange={vi.fn()}
            onSideModeChange={setSideMode}
            onOpenDynamicPromptDrawer={vi.fn()}
            onSend={vi.fn()}
          />
        </div>
      </div>
    )
  }

  return render(<Harness />)
}

const MULTILINE_DYNAMIC_PROMPT_DRAFT = `{{style_names}}题材作品，{{style_descriptions}}。

{{age}}岁的{{gender}}性中国角色，角色全身照，头顶与脚底各留出安全边距。

正交视图，无透视、无广角畸变、无镜头景深。

{{appearance}}，

{{clothing}}，

禁止出现任何文字、标注、logo、水印。`

describe('Composer panel value format', () => {
  it('renders the dynamic prompt panel inline inside the sidebar drawer surface', () => {
    renderDynamicPromptPanel('json')

    expect(screen.getByText('JSON 数组：每项必须是字符串。')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('["long hair, wavy", "short hair", "black hair"]')).toBeInTheDocument()
  })

  it('calls onPanelValueFormatChange when switching format tab', async () => {
    const onChange = vi.fn()
    renderDynamicPromptPanel('json', onChange)

    fireEvent.click(screen.getByText('YAML'))
    expect(onChange).toHaveBeenCalledWith('yaml')
  })

  it('shows bulk import tab and detects format after paste', () => {
    renderDynamicPromptPanel('json')

    fireEvent.click(screen.getByRole('tab', { name: '批量导入' }))
    const textarea = screen.getByPlaceholderText('{"hair":["long hair","short hair"]}')
    fireEvent.change(textarea, { target: { value: '{"hair":["long hair","short hair"]}' } })

    expect(screen.getByText(/识别类型：json/)).toBeInTheDocument()
    expect(screen.getByText(/变量数：1/)).toBeInTheDocument()
  })

  it('opens sync preview drawer from bulk tab', () => {
    renderDynamicPromptPanel('json')

    fireEvent.click(screen.getByRole('tab', { name: '批量导入' }))
    const textarea = screen.getByPlaceholderText('{"hair":["long hair","short hair"]}')
    fireEvent.change(textarea, { target: { value: '{"hair":["long hair","short hair"]}' } })
    fireEvent.click(screen.getByRole('button', { name: '预览同步到表格' }))

    expect(screen.getByText('预览：批量导入同步到表格')).toBeInTheDocument()
  })

  it('syncs bulk rows to JSON-encoded table rows when panel format is json', () => {
    const onPanelVariablesChange = vi.fn()
    renderDynamicPromptPanel('json', vi.fn(), onPanelVariablesChange)

    fireEvent.click(screen.getByRole('tab', { name: '批量导入' }))
    const textarea = screen.getByPlaceholderText('{"hair":["long hair","short hair"]}')
    fireEvent.change(textarea, { target: { value: '{"style":["a, b, c"]}' } })
    fireEvent.click(screen.getByRole('button', { name: '预览同步到表格' }))
    fireEvent.click(screen.getByRole('button', { name: '确认同步' }))

    expect(onPanelVariablesChange).toHaveBeenCalled()
    const lastCall = onPanelVariablesChange.mock.calls.at(-1)?.[0] as PanelVariableRow[]
    expect(lastCall[0].key).toBe('style')
    expect(lastCall[0].valuesText).toBe('["a, b, c"]')
  })

  it('syncs bulk rows to detected structured format when panel format is auto', () => {
    const onPanelVariablesChange = vi.fn()
    const onFormatChange = vi.fn()
    renderDynamicPromptPanel('auto', onFormatChange, onPanelVariablesChange)

    fireEvent.click(screen.getByRole('tab', { name: '批量导入' }))
    const textarea = screen.getByPlaceholderText('{"hair":["long hair","short hair"]}')
    fireEvent.change(textarea, { target: { value: 'style: cinematic | editorial' } })
    fireEvent.click(screen.getByRole('button', { name: '预览同步到表格' }))
    fireEvent.click(screen.getByRole('button', { name: '确认同步' }))

    expect(onFormatChange).toHaveBeenCalledWith('line')
    const lastCall = onPanelVariablesChange.mock.calls.at(-1)?.[0] as PanelVariableRow[]
    expect(lastCall[0].key).toBe('style')
    expect(lastCall[0].valuesText).toBe('cinematic\neditorial')
  })

  it('keeps send button enabled without loading while isSending is true', () => {
    const onSend = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), onSend, true, 'draw cat')

    const sendButton = screen.getByRole('button', { name: /发送/ })
    expect(sendButton).toBeEnabled()
    expect(sendButton).not.toHaveClass('ant-btn-loading')

    fireEvent.click(sendButton)
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('allows Enter submit when isSending is true', () => {
    const onSend = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), onSend, true, 'draw cat')

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })

    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('re-enables send button from local draft even when parent draft is still empty', () => {
    const { onSend, onDraftChange } = renderComposerWithStaleParentDraft()

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: 'draw cat', selectionStart: 8, selectionEnd: 8 } })

    const sendButton = screen.getByRole('button', { name: /发送/ })
    expect(sendButton).toBeEnabled()

    fireEvent.click(sendButton)

    expect(onDraftChange).toHaveBeenCalledWith('draw cat')
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('allows Enter submit from local draft even when parent draft is still empty', () => {
    const { onSend, onDraftChange } = renderComposerWithStaleParentDraft()

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: 'draw cat', selectionStart: 8, selectionEnd: 8 } })
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })

    expect(onDraftChange).toHaveBeenCalledWith('draw cat')
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('keeps send blocked when panel batch validation fails even if local draft is non-empty', () => {
    renderComposerWithStaleParentDraft({ panelBatchError: '批量变量格式错误' })

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: 'draw cat', selectionStart: 8, selectionEnd: 8 } })

    const sendButton = screen.getByRole('button', { name: /发送/ })
    expect(sendButton).toBeDisabled()

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    expect(sendButton).toBeDisabled()
  })

  it('keeps the main prompt textarea on a single-line baseline by default', () => {
    renderComposer('json')

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea).toHaveStyle({ fontSize: '15px', lineHeight: '1.5', minHeight: '34px' })
  })

  it('keeps multiline draft editing and Enter send behavior working after textarea growth', async () => {
    const user = userEvent.setup()
    const { onSend } = renderControlledComposer()

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    await user.type(textarea, 'line 1{shift>}{enter}{/shift}line 2{shift>}{enter}{/shift}line 3')
    expect(textarea.value).toBe('line 1\nline 2\nline 3')

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('syncs the latest local draft before sending so image mode can submit a new round', () => {
    const { onSend, onDraftChange } = renderComposerWithStaleParentDraft({ draft: '', generationMode: 'image' })

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: 'second round prompt', selectionStart: 19, selectionEnd: 19 } })

    fireEvent.click(screen.getByRole('button', { name: /发送/ }))

    expect(onDraftChange).toHaveBeenLastCalledWith('second round prompt')
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('syncs the latest local draft before collapsing the composer', () => {
    const onCollapse = vi.fn()
    const { onDraftChange, getCollapseAction } = renderComposerWithStaleParentDraft({ onCollapse })

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: 'preview this image', selectionStart: 18, selectionEnd: 18 } })

    act(() => {
      getCollapseAction()?.()
    })

    expect(onDraftChange).toHaveBeenLastCalledWith('preview this image')
    expect(onCollapse).toHaveBeenCalledTimes(1)
    expect(onDraftChange.mock.invocationCallOrder.at(-1) ?? 0).toBeLessThan(onCollapse.mock.invocationCallOrder[0] ?? 0)
  })

  it('defers draft sync to the parent until IME composition ends', async () => {
    const onDraftChange = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', onDraftChange)

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    fireEvent.compositionStart(textarea)
    fireEvent.change(textarea, {
      target: { value: 'nihaoma', selectionStart: 7, selectionEnd: 7 },
    })

    expect(textarea.value).toBe('nihaoma')
    expect(onDraftChange).not.toHaveBeenCalled()

    fireEvent.compositionEnd(textarea, {
      data: '你好吗',
      target: { value: '你好吗', selectionStart: 3, selectionEnd: 3 },
    })

    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith('你好吗')
    })
  })

  it('keeps committed IME text at the current cursor position', async () => {
    renderControlledComposer('hello world')

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange(6, 6)

    fireEvent.compositionStart(textarea)
    fireEvent.change(textarea, {
      target: {
        value: 'hello nihaomaworld',
        selectionStart: 13,
        selectionEnd: 13,
      },
    })
    fireEvent.compositionEnd(textarea, {
      data: '你好吗',
      target: {
        value: 'hello 你好吗world',
        selectionStart: 9,
        selectionEnd: 9,
      },
    })

    await waitFor(() => {
      expect(textarea.value).toBe('hello 你好吗world')
    })
  })

  it('keeps textarea soft-wrapped for both initial and long single-line drafts', () => {
    const { container } = renderControlledComposer('initial prompt')
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    const composerPanel = container.querySelector('.chat-composer-panel-inner') as HTMLElement

    expect(textarea.getAttribute('wrap')).toBe('soft')
    expect(composerPanel.style.getPropertyValue('--chat-composer-target-width')).toBe('')

    const longDraft = 'this is a much longer prompt that should wrap to a new visual line instead of widening the composer'
    fireEvent.change(textarea, {
      target: {
        value: longDraft,
        selectionStart: longDraft.length,
        selectionEnd: longDraft.length,
      },
    })

    expect(textarea.value).toBe(longDraft)
    expect(textarea.getAttribute('wrap')).toBe('soft')
    expect(composerPanel.style.getPropertyValue('--chat-composer-target-width')).toBe('')
  })

  it('keeps a stable composer width while deleting content from a multiline draft', () => {
    const { container } = renderControlledComposer(MULTILINE_DYNAMIC_PROMPT_DRAFT)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    const composerPanel = container.querySelector('.chat-composer-panel-inner') as HTMLElement
    const initialStyle = composerPanel.getAttribute('style')
    const nextDraft = MULTILINE_DYNAMIC_PROMPT_DRAFT.replace('{{age}}', '')
    const cursorPosition = nextDraft.indexOf('岁的')

    fireEvent.change(textarea, {
      target: {
        value: nextDraft,
        selectionStart: cursorPosition,
        selectionEnd: cursorPosition,
      },
    })

    expect(textarea.value).toBe(nextDraft)
    expect(textarea).toHaveStyle({ minHeight: '34px' })
    expect(textarea.getAttribute('wrap')).toBe('soft')
    expect(composerPanel.getAttribute('style')).toBe(initialStyle)
  })

  it('activates overshoot metadata for long text paste growth', () => {
    const longText = Array.from({ length: 8 }, (_, index) => `line ${index + 1} ` + 'cinematic portrait '.repeat(4)).join('\n')
    const { container } = renderControlledComposer()
    const shell = container.querySelector('.composer-shell') as HTMLElement
    const card = container.querySelector('.composer-card') as HTMLDivElement
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    let cardSize = { width: 420, height: 88 }

    Object.defineProperty(card, 'getBoundingClientRect', {
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

    fireEvent.paste(textarea, {
      clipboardData: {
        files: [],
        getData: (type: string) => (type === 'text/plain' ? longText : ''),
      },
    })
    cardSize = { width: 760, height: 232 }
    fireEvent.change(textarea, { target: { value: longText, selectionStart: longText.length, selectionEnd: longText.length } })

    expect(shell).toHaveAttribute('data-overshoot-active', 'true')
    expect(shell).toHaveAttribute('data-overshoot-reason', 'paste-expand')
    expect(Number(shell.getAttribute('data-overshoot-intensity'))).toBeGreaterThan(0)
  })

  it('does not activate paste overshoot metadata for regular multiline typing', () => {
    const { container } = renderControlledComposer()
    const shell = container.querySelector('.composer-shell') as HTMLElement
    const card = container.querySelector('.composer-card') as HTMLDivElement
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    let cardSize = { width: 420, height: 88 }

    Object.defineProperty(card, 'getBoundingClientRect', {
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

    cardSize = { width: 560, height: 160 }
    fireEvent.change(textarea, { target: { value: 'line 1\nline 2\nline 3', selectionStart: 20, selectionEnd: 20 } })

    expect(shell).toHaveAttribute('data-overshoot-active', 'false')
    expect(shell).toHaveAttribute('data-overshoot-reason', 'idle')
  })

  it('opens quick picker when typing "/" at line start', () => {
    renderComposer('json')

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: '/', selectionStart: 1, selectionEnd: 1 } })

    const quickPicker = screen.getByRole('listbox', { name: '快捷功能选择' })
    expect(quickPicker).toBeInTheDocument()
    expect(within(quickPicker).getByRole('button', { name: '动态提示词' })).toBeInTheDocument()
    expect(within(quickPicker).getByRole('button', { name: '对照模式' })).toBeInTheDocument()
  })

  it('calls onSourceImagesAppend when selecting upload files', () => {
    const onSourceImagesAppend = vi.fn()
    const file = new File(['a'], 'ref.png', { type: 'image/png' })

    const { container } = render(
      <Composer
        draft=""
        sourceImages={[]}
        sendError=""
        models={makeModels()}
        showAdvancedVariables
        dynamicPromptEnabled
        panelValueFormat="json"
        panelVariables={makeRows()}
        resolvedVariables={{}}
        finalPromptPreview=""
        missingKeys={[]}
        unusedVariableKeys={[]}
        isSending={false}
        isSendBlocked={false}
        panelBatchError=""
        panelMismatchRowIds={[]}
        sideMode="single"
        isSideConfigLocked={false}
        onDraftChange={vi.fn()}
        onSourceImagesAppend={onSourceImagesAppend}
        onSourceImageRemove={vi.fn()}
        onSourceImagesClear={vi.fn()}
        onPanelValueFormatChange={vi.fn()}
        onPanelVariablesChange={vi.fn()}
        onAdvancedFeaturesEnabledChange={vi.fn()}
        onSideModeChange={vi.fn()}
        onOpenDynamicPromptDrawer={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    expect(onSourceImagesAppend).toHaveBeenCalledTimes(1)
    expect(onSourceImagesAppend.mock.calls[0]?.[0]).toHaveLength(1)
  })

  it('calls onSourceImagesAppend when pasting image from clipboard', () => {
    const onSourceImagesAppend = vi.fn()
    const file = new File(['img'], 'paste.png', { type: 'image/png' })

    render(
      <Composer
        draft=""
        sourceImages={[]}
        sendError=""
        models={makeModels()}
        showAdvancedVariables
        dynamicPromptEnabled
        panelValueFormat="json"
        panelVariables={makeRows()}
        resolvedVariables={{}}
        finalPromptPreview=""
        missingKeys={[]}
        unusedVariableKeys={[]}
        isSending={false}
        isSendBlocked={false}
        panelBatchError=""
        panelMismatchRowIds={[]}
        sideMode="single"
        isSideConfigLocked={false}
        onDraftChange={vi.fn()}
        onSourceImagesAppend={onSourceImagesAppend}
        onSourceImageRemove={vi.fn()}
        onSourceImagesClear={vi.fn()}
        onPanelValueFormatChange={vi.fn()}
        onPanelVariablesChange={vi.fn()}
        onAdvancedFeaturesEnabledChange={vi.fn()}
        onSideModeChange={vi.fn()}
        onOpenDynamicPromptDrawer={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.paste(textarea, {
      clipboardData: {
        files: [file],
      },
    })

    expect(onSourceImagesAppend).toHaveBeenCalledTimes(1)
    expect(onSourceImagesAppend).toHaveBeenCalledWith([file])
  })

  it('renders plus upload trigger and forwards click to file input', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Composer
        draft=""
        sourceImages={[]}
        sendError=""
        models={makeModels()}
        showAdvancedVariables
        dynamicPromptEnabled
        panelValueFormat="json"
        panelVariables={makeRows()}
        resolvedVariables={{}}
        finalPromptPreview=""
        missingKeys={[]}
        unusedVariableKeys={[]}
        isSending={false}
        isSendBlocked={false}
        panelBatchError=""
        panelMismatchRowIds={[]}
        sideMode="single"
        isSideConfigLocked={false}
        onDraftChange={vi.fn()}
        onSourceImagesAppend={vi.fn()}
        onSourceImageRemove={vi.fn()}
        onSourceImagesClear={vi.fn()}
        onPanelValueFormatChange={vi.fn()}
        onPanelVariablesChange={vi.fn()}
        onAdvancedFeaturesEnabledChange={vi.fn()}
        onSideModeChange={vi.fn()}
        onOpenDynamicPromptDrawer={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')
    await user.click(screen.getByRole('button', { name: '上传参考图' }))
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('renders toolbar controls and opens quick actions from the toolbar button', async () => {
    const { container } = renderComposer('json')

    const toolbar = container.querySelector('.composer-toolbar') as HTMLElement

    expect(within(toolbar).getByRole('button', { name: '上传参考图' })).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: '发送' })).toBeInTheDocument()

    fireEvent.mouseDown(within(toolbar).getByRole('button', { name: '快捷功能' }))

    expect(screen.getByRole('listbox', { name: '快捷功能选择' })).toBeInTheDocument()
  })

  it('shows the dynamic prompt toolbar button only when dynamic prompt is enabled', () => {
    const enabledView = renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), true)

    expect(screen.getByRole('button', { name: '打开动态提示词抽屉' })).toBeInTheDocument()

    enabledView.unmount()

    renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), false)

    expect(screen.queryByRole('button', { name: '打开动态提示词抽屉' })).not.toBeInTheDocument()
  })

  it('opens the dynamic prompt drawer from the composer toolbar button', async () => {
    const user = userEvent.setup()
    const onOpenDynamicPromptDrawer = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), true, vi.fn(), 'single', vi.fn(), false, makeRows(), makeModels(), true, '', onOpenDynamicPromptDrawer)

    await user.click(screen.getByRole('button', { name: '打开动态提示词抽屉' }))

    expect(onOpenDynamicPromptDrawer).toHaveBeenCalledWith('table')
  })

  it('keeps the send button as the trailing action in the composer toolbar', () => {
    render(
      <div className="chat-composer-panel">
        <div className="chat-composer-panel-inner">
          <Composer
            draft=""
            sourceImages={[]}
            sendError=""
            models={makeModels()}
            showAdvancedVariables
            dynamicPromptEnabled
            panelValueFormat="json"
            panelVariables={makeRows()}
            resolvedVariables={{}}
            finalPromptPreview=""
            missingKeys={[]}
            unusedVariableKeys={[]}
            isSending={false}
            isSendBlocked={false}
            panelBatchError=""
            panelMismatchRowIds={[]}
            sideMode="single"
            isSideConfigLocked={false}
            onDraftChange={vi.fn()}
            onSourceImagesAppend={vi.fn()}
            onSourceImageRemove={vi.fn()}
            onSourceImagesClear={vi.fn()}
            onPanelValueFormatChange={vi.fn()}
            onPanelVariablesChange={vi.fn()}
            onAdvancedFeaturesEnabledChange={vi.fn()}
            onSideModeChange={vi.fn()}
            onOpenDynamicPromptDrawer={vi.fn()}
            onCollapse={vi.fn()}
            onSend={vi.fn()}
          />
        </div>
      </div>,
    )

    const actionButtons = Array.from(document.querySelectorAll('.composer-action-col > button')) as HTMLButtonElement[]
    expect(actionButtons.map((button) => button.getAttribute('aria-label'))).toEqual(['打开动态提示词抽屉', '发送'])
  })

  it('applies toolbar-opened quick actions on the first pointer down', () => {
    const onAdvancedFeaturesEnabledChange = vi.fn()
    const { container } = renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), false, onAdvancedFeaturesEnabledChange)

    const toolbar = container.querySelector('.composer-toolbar') as HTMLElement
    fireEvent.mouseDown(within(toolbar).getByRole('button', { name: '快捷功能' }))
    expect(screen.getByRole('listbox', { name: '快捷功能选择' })).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('button', { name: '动态提示词' }))

    expect(onAdvancedFeaturesEnabledChange).toHaveBeenCalledWith(true)
  })

  it('removes a quick-action chip on the first click even while the picker is open', async () => {
    const user = userEvent.setup()
    const onAdvancedFeaturesEnabledChange = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), true, onAdvancedFeaturesEnabledChange)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '/', selectionStart: 1, selectionEnd: 1 },
    })
    expect(screen.getByRole('listbox', { name: '快捷功能选择' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '移除 动态提示词' }))

    expect(onAdvancedFeaturesEnabledChange).toHaveBeenCalledWith(false)
  })

  it('reopens toolbar quick actions with a reset picker state after outside click closes it', async () => {
    const user = userEvent.setup()
    const { container } = renderComposer('json')

    const toolbar = container.querySelector('.composer-toolbar') as HTMLElement
    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')

    fireEvent.change(textarea, { target: { value: '--', selectionStart: 2, selectionEnd: 2 } })
    fireEvent.keyDown(textarea, { key: 'ArrowDown', code: 'ArrowDown' })
    expect(screen.getByRole('button', { name: '--size' })).toHaveClass('is-active')

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('listbox', { name: '快捷功能选择' })).not.toBeInTheDocument()

    await user.click(within(toolbar).getByRole('button', { name: '快捷功能' }))

    expect(screen.queryByRole('button', { name: '--size' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '图片生成' })).toHaveClass('is-active')
  })

  it('closes the quick picker 0.5 seconds after mouse leaves the panel', () => {
    vi.useFakeTimers()
    try {
      renderComposer('json')

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '/', selectionStart: 1, selectionEnd: 1 },
      })

      const quickPicker = screen.getByRole('listbox', { name: '快捷功能选择' })
      fireEvent.mouseLeave(quickPicker)

      act(() => {
        vi.advanceTimersByTime(499)
      })
      expect(screen.getByRole('listbox', { name: '快捷功能选择' })).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.queryByRole('listbox', { name: '快捷功能选择' })).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the quick picker open when the mouse re-enters within 0.5 seconds', () => {
    vi.useFakeTimers()
    try {
      renderComposer('json')

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '/', selectionStart: 1, selectionEnd: 1 },
      })

      const quickPicker = screen.getByRole('listbox', { name: '快捷功能选择' })
      fireEvent.mouseLeave(quickPicker)

      act(() => {
        vi.advanceTimersByTime(300)
      })
      fireEvent.mouseEnter(screen.getByRole('listbox', { name: '快捷功能选择' }))

      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.getByRole('listbox', { name: '快捷功能选择' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders source image item and supports remove action', () => {
    const onSourceImageRemove = vi.fn()
    const file = new File(['abc'], 'ref.webp', { type: 'image/webp' })

    render(
      <Composer
        draft=""
        sourceImages={[{ id: 'img-1', file, previewUrl: 'blob:test' }]}
        sendError=""
        models={makeModels()}
        showAdvancedVariables
        dynamicPromptEnabled
        panelValueFormat="json"
        panelVariables={makeRows()}
        resolvedVariables={{}}
        finalPromptPreview=""
        missingKeys={[]}
        unusedVariableKeys={[]}
        isSending={false}
        isSendBlocked={false}
        panelBatchError=""
        panelMismatchRowIds={[]}
        sideMode="single"
        isSideConfigLocked={false}
        onDraftChange={vi.fn()}
        onSourceImagesAppend={vi.fn()}
        onSourceImageRemove={onSourceImageRemove}
        onSourceImagesClear={vi.fn()}
        onPanelValueFormatChange={vi.fn()}
        onPanelVariablesChange={vi.fn()}
        onAdvancedFeaturesEnabledChange={vi.fn()}
        onSideModeChange={vi.fn()}
        onOpenDynamicPromptDrawer={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /删除参考图 ref.webp/ }))
    expect(onSourceImageRemove).toHaveBeenCalledWith('img-1')
    expect(screen.queryByRole('button', { name: /清空/ })).not.toBeInTheDocument()
  })

  it('does not open quick picker when "/" is not at line start', () => {
    renderComposer('json')

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: 'abc/', selectionStart: 4, selectionEnd: 4 } })

    expect(screen.queryByRole('listbox', { name: '快捷功能选择' })).not.toBeInTheDocument()
  })

  it('opens quick picker when typing "、" at line start', () => {
    renderComposer('json')

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: '、', selectionStart: 1, selectionEnd: 1 } })

    expect(screen.getByRole('listbox', { name: '快捷功能选择' })).toBeInTheDocument()
  })

  it('opens command picker when typing "--" at line start', () => {
    renderComposer('json')

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: '--', selectionStart: 2, selectionEnd: 2 } })

    expect(screen.getByRole('listbox', { name: '快捷功能选择' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '--ar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '--size' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '--wh' })).toBeInTheDocument()
  })

  it('opens command picker when typing "--" in the middle of text', () => {
    const { onSend } = renderControlledComposer()
    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: 'draw a cat --', selectionStart: 13, selectionEnd: 13 } })

    expect(screen.getByRole('listbox', { name: '快捷功能选择' })).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })

    expect(onSend).not.toHaveBeenCalled()
    expect(textarea.value).toBe('draw a cat --ar ')
  })

  it('filters command picker options for "--s"', () => {
    renderComposer('json')

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: '--s', selectionStart: 3, selectionEnd: 3 } })

    expect(screen.getByRole('button', { name: '--size' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '--ar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '--wh' })).not.toBeInTheDocument()
  })

  it('shows empty state when command picker has no match', () => {
    renderComposer('json')

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: '--zzz', selectionStart: 5, selectionEnd: 5 } })

    expect(screen.getByText('未找到匹配命令')).toBeInTheDocument()
  })

  it('applies highlighted command on Enter when command picker is open instead of sending', () => {
    const { onSend } = renderControlledComposer()
    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: '--', selectionStart: 2, selectionEnd: 2 } })
    fireEvent.keyDown(textarea, { key: 'ArrowDown', code: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })

    expect(onSend).not.toHaveBeenCalled()
    expect(textarea.value).toBe('--size ')
  })

  it('applies command item click with separator when suffix text exists', () => {
    const onDraftChange = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', onDraftChange)

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: '--wfoo', selectionStart: 3, selectionEnd: 3 } })
    fireEvent.click(screen.getByRole('button', { name: '--wh' }))

    expect(onDraftChange).toHaveBeenLastCalledWith('--wh foo')
  })

  it('clicking quick picker item enables dynamic prompt and does not send', () => {
    const onDraftChange = vi.fn()
    const onSend = vi.fn()
    const onAdvancedFeaturesEnabledChange = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), onSend, false, '', onDraftChange, false, onAdvancedFeaturesEnabledChange)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '/', selectionStart: 1, selectionEnd: 1 } })
    const quickPicker = screen.getByRole('listbox', { name: '快捷功能选择' })
    fireEvent.click(within(quickPicker).getByRole('button', { name: '动态提示词' }))

    expect(onDraftChange).toHaveBeenLastCalledWith('')
    expect(onAdvancedFeaturesEnabledChange).toHaveBeenCalledWith(true)
    expect(onSend).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox', { name: '快捷功能选择' })).not.toBeInTheDocument()
  })

  it('supports fuzzy model query and applies selected match', () => {
    const onDraftChange = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', onDraftChange)

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, {
      target: { value: '@gemi', selectionStart: 5, selectionEnd: 5 },
    })

    expect(screen.getByRole('button', { name: /Gemini 2.5 Flash Image/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Gemini 2.5 Flash Image/ }))

    expect(onDraftChange).toHaveBeenLastCalledWith('@gemini-2.5-flash-image ')
  })

  it('applies highlighted model shortcut on Enter when model picker is open instead of sending', () => {
    const onSend = vi.fn()
    const onDraftChange = vi.fn()
    renderComposer(
      'json',
      vi.fn(),
      vi.fn(),
      onSend,
      false,
      '',
      onDraftChange,
      true,
      vi.fn(),
      'single',
      vi.fn(),
      false,
      makeRows(),
    )

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, {
      target: { value: '@gemini-2.5-flash-image', selectionStart: 23, selectionEnd: 23 },
    })
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })

    expect(onDraftChange).toHaveBeenLastCalledWith('@gemini-2.5-flash-image ')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('keeps selected model token in the input as plain text', () => {
    const { onSend, container } = renderControlledComposer()

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait') as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: '@gemi', selectionStart: 5, selectionEnd: 5 },
    })
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })

    expect(onSend).not.toHaveBeenCalled()
    expect(textarea.value).toBe('@gemini-2.5-flash-image ')
    expect(container.querySelector('.composer-model-token')).toBeNull()
  })

  it('preserves the selected model token when continuing to type prompt text', () => {
    renderControlledComposer()

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait') as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: '@gemi', selectionStart: 5, selectionEnd: 5 },
    })
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    fireEvent.change(textarea, {
      target: { value: '@gemini-2.5-flash-image portrait', selectionStart: 33, selectionEnd: 33 },
    })

    expect(textarea.value).toBe('@gemini-2.5-flash-image portrait')
  })

  it('deleting dynamic prompt chip disables dynamic prompt', () => {
    const onAdvancedFeaturesEnabledChange = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), true, onAdvancedFeaturesEnabledChange)

    const removeButton = screen.getByRole('button', { name: '移除 动态提示词' })
    fireEvent.click(removeButton)

    expect(onAdvancedFeaturesEnabledChange).toHaveBeenCalledWith(false)
  })

  it('does not render a local dynamic prompt button when merged advanced features are disabled', () => {
    renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), false, vi.fn(), 'single', vi.fn(), false, makeRows(), makeModels(), false)

    expect(screen.queryByRole('button', { name: /^动态提示词$/ })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')).not.toBeInTheDocument()
  })

  it('uses the template placeholder when merged advanced features are enabled externally without rendering a local button', () => {
    const { rerender } = renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), false, vi.fn(), 'single', vi.fn(), false, makeRows(), makeModels(), false)
    expect(screen.queryByRole('button', { name: /^动态提示词$/ })).not.toBeInTheDocument()

    rerender(
      <Composer
        draft=""
        sourceImages={[]}
        sendError=""
        models={makeModels()}
        showAdvancedVariables
        dynamicPromptEnabled
        panelValueFormat="json"
        panelVariables={makeRows()}
        resolvedVariables={{}}
        finalPromptPreview=""
        missingKeys={[]}
        unusedVariableKeys={[]}
        isSending={false}
        isSendBlocked={false}
        panelBatchError=""
        panelMismatchRowIds={[]}
        sideMode="single"
        isSideConfigLocked={false}
        onDraftChange={vi.fn()}
        onSourceImagesAppend={vi.fn()}
        onSourceImageRemove={vi.fn()}
        onSourceImagesClear={vi.fn()}
        onPanelValueFormatChange={vi.fn()}
        onPanelVariablesChange={vi.fn()}
        onAdvancedFeaturesEnabledChange={vi.fn()}
        onSideModeChange={vi.fn()}
        onOpenDynamicPromptDrawer={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /^动态提示词$/ })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')).toBeInTheDocument()
  })

  it('shows missing and unused variable feedback below the composer in a stable order', () => {
    render(
      <Composer
        draft="a {{subject}} portrait"
        sourceImages={[]}
        sendError=""
        models={makeModels()}
        showAdvancedVariables
        dynamicPromptEnabled
        panelValueFormat="json"
        panelVariables={makeRows()}
        resolvedVariables={{ style: 'cinematic' }}
        finalPromptPreview=""
        missingKeys={['subject']}
        unusedVariableKeys={['style']}
        isSending={false}
        isSendBlocked={false}
        panelBatchError=""
        panelMismatchRowIds={[]}
        sideMode="single"
        isSideConfigLocked={false}
        onDraftChange={vi.fn()}
        onSourceImagesAppend={vi.fn()}
        onSourceImageRemove={vi.fn()}
        onSourceImagesClear={vi.fn()}
        onPanelValueFormatChange={vi.fn()}
        onPanelVariablesChange={vi.fn()}
        onAdvancedFeaturesEnabledChange={vi.fn()}
        onSideModeChange={vi.fn()}
        onOpenDynamicPromptDrawer={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    const alerts = screen.getAllByRole('alert')
    expect(alerts[0]?.closest('.composer-feedback-stack')?.className).not.toContain('pb-2')
    expect(alerts[0]).toHaveTextContent('prompt 中存在未定义变量：subject')
    expect(alerts[1]).toHaveTextContent('已配置但当前 prompt 未使用的变量：style')
    expect(screen.getByRole('button', { name: 'style' })).toBeInTheDocument()
  })

  it('renders unused variables as clickable buttons', () => {
    render(
      <Composer
        draft="a cinematic portrait"
        sourceImages={[]}
        sendError=""
        models={makeModels()}
        showAdvancedVariables
        dynamicPromptEnabled
        panelValueFormat="json"
        panelVariables={makeRows()}
        resolvedVariables={{}}
        finalPromptPreview=""
        missingKeys={[]}
        unusedVariableKeys={['style_names', 'style_descriptions']}
        isSending={false}
        isSendBlocked={false}
        panelBatchError=""
        panelMismatchRowIds={[]}
        sideMode="single"
        isSideConfigLocked={false}
        onDraftChange={vi.fn()}
        onSourceImagesAppend={vi.fn()}
        onSourceImageRemove={vi.fn()}
        onSourceImagesClear={vi.fn()}
        onPanelValueFormatChange={vi.fn()}
        onPanelVariablesChange={vi.fn()}
        onAdvancedFeaturesEnabledChange={vi.fn()}
        onSideModeChange={vi.fn()}
        onOpenDynamicPromptDrawer={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'style_names' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'style_descriptions' })).toBeInTheDocument()
  })

  it('inserts unused variable token at the current cursor position', async () => {
    const user = userEvent.setup()
    renderControlledComposerWithUnused('hello world')

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange(6, 6)

    await user.click(screen.getByRole('button', { name: 'style' }))

    expect(textarea.value).toBe('hello {{style}}world')
    await waitFor(() => {
      expect(document.activeElement).toBe(textarea)
      expect(textarea.selectionStart).toBe('hello {{style}}'.length)
      expect(textarea.selectionEnd).toBe('hello {{style}}'.length)
    })
  })

  it('replaces the selected text when inserting an unused variable token', async () => {
    const user = userEvent.setup()
    renderControlledComposerWithUnused('hello world')

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange(6, 11)

    await user.click(screen.getByRole('button', { name: 'style' }))

    expect(textarea.value).toBe('hello {{style}}')
    await waitFor(() => {
      expect(document.activeElement).toBe(textarea)
      expect(textarea.selectionStart).toBe('hello {{style}}'.length)
    })
  })

  it('appends the unused variable token when the textarea has no active selection', async () => {
    const user = userEvent.setup()
    renderControlledComposerWithUnused('hello')

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    await user.click(screen.getByRole('button', { name: 'style' }))

    expect(textarea.value).toBe('hello{{style}}')
    await waitFor(() => {
      expect(textarea.selectionStart).toBe('hello{{style}}'.length)
      expect(textarea.selectionEnd).toBe('hello{{style}}'.length)
    })
  })

  it('keeps editing working after inserting an unused variable token', async () => {
    const user = userEvent.setup()
    renderControlledComposerWithUnused('hello ')

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange(6, 6)

    await user.click(screen.getByRole('button', { name: 'style' }))
    await user.type(textarea, ' now')

    expect(textarea.value).toBe('hello {{style}} now')
  })

  it('deletes a whole variable token with Backspace when the cursor is right after it', async () => {
    renderControlledComposer('hello {{style}} world')

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange('hello {{style}}'.length, 'hello {{style}}'.length)

    fireEvent.keyDown(textarea, { key: 'Backspace', code: 'Backspace' })

    await waitFor(() => {
      expect(textarea.value).toBe('hello  world')
      expect(document.activeElement).toBe(textarea)
      expect(textarea.selectionStart).toBe('hello '.length)
      expect(textarea.selectionEnd).toBe('hello '.length)
    })
  })

  it('deletes a whole variable token with Delete when the cursor is right before it', async () => {
    renderControlledComposer('hello {{style}} world')

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange('hello '.length, 'hello '.length)

    fireEvent.keyDown(textarea, { key: 'Delete', code: 'Delete' })

    await waitFor(() => {
      expect(textarea.value).toBe('hello  world')
      expect(document.activeElement).toBe(textarea)
      expect(textarea.selectionStart).toBe('hello '.length)
      expect(textarea.selectionEnd).toBe('hello '.length)
    })
  })

  it('keeps normal character deletion for plain text', async () => {
    const user = userEvent.setup()
    renderControlledComposer('hello world')

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    await user.click(textarea)
    textarea.setSelectionRange('hello '.length, 'hello '.length)

    await user.keyboard('{Backspace}')

    expect(textarea.value).toBe('helloworld')
  })

  it('opens the workspace dynamic prompt drawer from missing variable feedback action', async () => {
    const user = userEvent.setup()
    const onOpenDynamicPromptDrawer = vi.fn()

    render(
      <Composer
        draft="a {{subject}} portrait"
        sourceImages={[]}
        sendError=""
        models={makeModels()}
        showAdvancedVariables
        dynamicPromptEnabled
        panelValueFormat="json"
        panelVariables={makeRows()}
        resolvedVariables={{}}
        finalPromptPreview=""
        missingKeys={['subject']}
        unusedVariableKeys={[]}
        isSending={false}
        isSendBlocked={false}
        panelBatchError=""
        panelMismatchRowIds={[]}
        sideMode="single"
        isSideConfigLocked={false}
        onDraftChange={vi.fn()}
        onSourceImagesAppend={vi.fn()}
        onSourceImageRemove={vi.fn()}
        onSourceImagesClear={vi.fn()}
        onPanelValueFormatChange={vi.fn()}
        onPanelVariablesChange={vi.fn()}
        onAdvancedFeaturesEnabledChange={vi.fn()}
        onSideModeChange={vi.fn()}
        onOpenDynamicPromptDrawer={onOpenDynamicPromptDrawer}
        onSend={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '去配置变量' }))

    expect(onOpenDynamicPromptDrawer).toHaveBeenCalledWith('table')
  })

  it('does not show variable feedback when advanced features are disabled', () => {
    render(
      <Composer
        draft="a {{subject}} portrait"
        sourceImages={[]}
        sendError=""
        models={makeModels()}
        showAdvancedVariables={false}
        dynamicPromptEnabled={false}
        panelValueFormat="json"
        panelVariables={makeRows()}
        resolvedVariables={{ style: 'cinematic' }}
        finalPromptPreview=""
        missingKeys={['subject']}
        unusedVariableKeys={['style']}
        isSending={false}
        isSendBlocked={false}
        panelBatchError=""
        panelMismatchRowIds={[]}
        sideMode="single"
        isSideConfigLocked={false}
        onDraftChange={vi.fn()}
        onSourceImagesAppend={vi.fn()}
        onSourceImageRemove={vi.fn()}
        onSourceImagesClear={vi.fn()}
        onPanelValueFormatChange={vi.fn()}
        onPanelVariablesChange={vi.fn()}
        onAdvancedFeaturesEnabledChange={vi.fn()}
        onSideModeChange={vi.fn()}
        onOpenDynamicPromptDrawer={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    expect(screen.queryByText('prompt 中存在未定义变量：subject')).not.toBeInTheDocument()
    expect(screen.queryByText('已配置但当前 prompt 未使用的变量：style')).not.toBeInTheDocument()
  })

  it('still sends directly when only unused variables are present', () => {
    const onSend = vi.fn()

    render(
      <Composer
        draft="a cinematic portrait"
        sourceImages={[]}
        sendError=""
        models={makeModels()}
        showAdvancedVariables
        dynamicPromptEnabled
        panelValueFormat="json"
        panelVariables={makeRows()}
        resolvedVariables={{ style: 'cinematic' }}
        finalPromptPreview="a cinematic portrait"
        missingKeys={[]}
        unusedVariableKeys={['style']}
        isSending={false}
        isSendBlocked={false}
        panelBatchError=""
        panelMismatchRowIds={[]}
        sideMode="single"
        isSideConfigLocked={false}
        onDraftChange={vi.fn()}
        onSourceImagesAppend={vi.fn()}
        onSourceImageRemove={vi.fn()}
        onSourceImagesClear={vi.fn()}
        onPanelValueFormatChange={vi.fn()}
        onPanelVariablesChange={vi.fn()}
        onAdvancedFeaturesEnabledChange={vi.fn()}
        onSideModeChange={vi.fn()}
        onOpenDynamicPromptDrawer={vi.fn()}
        onSend={onSend}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /发送/ }))
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('reflects dynamic prompt chip from external setting state', () => {
    const { rerender } = renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), false)
    expect(screen.queryByRole('button', { name: '移除 动态提示词' })).not.toBeInTheDocument()

    rerender(
      <Composer
        draft=""
        sourceImages={[]}
        sendError=""
        models={makeModels()}
        showAdvancedVariables
        dynamicPromptEnabled
        panelValueFormat="json"
        panelVariables={makeRows()}
        resolvedVariables={{}}
        finalPromptPreview=""
        missingKeys={[]}
        unusedVariableKeys={[]}
        isSending={false}
        isSendBlocked={false}
        panelBatchError=""
        panelMismatchRowIds={[]}
        sideMode="single"
        isSideConfigLocked={false}
        onDraftChange={vi.fn()}
        onSourceImagesAppend={vi.fn()}
        onSourceImageRemove={vi.fn()}
        onSourceImagesClear={vi.fn()}
        onPanelValueFormatChange={vi.fn()}
        onPanelVariablesChange={vi.fn()}
        onAdvancedFeaturesEnabledChange={vi.fn()}
        onSideModeChange={vi.fn()}
        onOpenDynamicPromptDrawer={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '移除 动态提示词' })).toBeInTheDocument()
  })

  it('clicking quick picker comparison mode enables multi side mode', () => {
    const onSideModeChange = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), true, vi.fn(), 'single', onSideModeChange)

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: '/', selectionStart: 1, selectionEnd: 1 } })
    fireEvent.click(screen.getByRole('button', { name: '对照模式' }))

    expect(onSideModeChange).toHaveBeenCalledWith('multi')
  })

  it('deleting comparison mode chip disables multi side mode', () => {
    const onSideModeChange = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), true, vi.fn(), 'multi', onSideModeChange)

    const removeButton = screen.getByRole('button', { name: '移除 对照模式' })
    fireEvent.click(removeButton)
    expect(onSideModeChange).toHaveBeenCalledWith('single')
  })

  it('keeps the image generation chip in the toolbar flow after closing comparison mode', async () => {
    const user = userEvent.setup()
    const { container } = renderControlledComparisonModeComposer()

    const toolbar = container.querySelector('.composer-toolbar') as HTMLElement

    expect(within(toolbar).getByRole('button', { name: '移除 图片生成' })).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: '移除 对照模式' })).toBeInTheDocument()

    await user.click(within(toolbar).getByRole('button', { name: '移除 对照模式' }))

    expect(within(toolbar).getByRole('button', { name: '移除 图片生成' })).toBeInTheDocument()
    expect(within(toolbar).queryByRole('button', { name: '移除 对照模式' })).not.toBeInTheDocument()
    expect(container.querySelector('.composer-toolbar .composer-chip-row')).not.toBeNull()
  })

  it('locks comparison mode chip when side config is locked', () => {
    const onSideModeChange = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), true, vi.fn(), 'multi', onSideModeChange, true)

    const removeButton = screen.getByRole('button', { name: '移除 对照模式' })
    expect(removeButton).toBeDisabled()
    fireEvent.click(removeButton)
    expect(onSideModeChange).not.toHaveBeenCalled()
  })

  it('disables comparison quick picker item when side config is locked', () => {
    const onSideModeChange = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), true, vi.fn(), 'single', onSideModeChange, true)

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: '/', selectionStart: 1, selectionEnd: 1 } })

    const comparisonButton = screen.getByRole('button', { name: '对照模式' })
    expect(comparisonButton).toBeDisabled()
    fireEvent.click(comparisonButton)
    expect(onSideModeChange).not.toHaveBeenCalled()
  })

  it('reflects comparison mode chip from external setting state', () => {
    const { rerender } = renderComposer('json', vi.fn(), vi.fn(), vi.fn(), false, '', vi.fn(), true, vi.fn(), 'single')
    expect(screen.queryByText('对照模式')).not.toBeInTheDocument()

    rerender(
      <Composer
        draft=""
        sourceImages={[]}
        sendError=""
        models={makeModels()}
        showAdvancedVariables
        dynamicPromptEnabled
        panelValueFormat="json"
        panelVariables={makeRows()}
        resolvedVariables={{}}
        finalPromptPreview=""
        missingKeys={[]}
        unusedVariableKeys={[]}
        isSending={false}
        isSendBlocked={false}
        panelBatchError=""
        panelMismatchRowIds={[]}
        sideMode="multi"
        isSideConfigLocked={false}
        onDraftChange={vi.fn()}
        onSourceImagesAppend={vi.fn()}
        onSourceImageRemove={vi.fn()}
        onSourceImagesClear={vi.fn()}
        onPanelValueFormatChange={vi.fn()}
        onPanelVariablesChange={vi.fn()}
        onAdvancedFeaturesEnabledChange={vi.fn()}
        onSideModeChange={vi.fn()}
        onOpenDynamicPromptDrawer={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    expect(screen.getByText('对照模式')).toBeInTheDocument()
  })

  it('closes quick picker with Escape', () => {
    renderComposer('json')

    const textarea = screen.getByPlaceholderText('输入模板 prompt，如：{{subject}} portrait')
    fireEvent.change(textarea, { target: { value: '/', selectionStart: 1, selectionEnd: 1 } })
    fireEvent.keyDown(textarea, { key: 'Escape', code: 'Escape' })

    expect(screen.queryByRole('listbox', { name: '快捷功能选择' })).not.toBeInTheDocument()
  })

  it('asks to enable dynamic prompt before sending when template keys are present', async () => {
    const onSend = vi.fn()
    const onAdvancedFeaturesEnabledChange = vi.fn()
    const user = userEvent.setup()

    renderComposer('json', vi.fn(), vi.fn(), onSend, false, 'a {{subject}} portrait', vi.fn(), false, onAdvancedFeaturesEnabledChange)

    fireEvent.click(screen.getByRole('button', { name: /发送/ }))
    expect(await screen.findByRole('button', { name: '帮我开启' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '帮我开启' }))

    expect(onAdvancedFeaturesEnabledChange).toHaveBeenCalledWith(true)
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('does not enable dynamic prompt or send when first confirm is canceled', async () => {
    const onSend = vi.fn()
    const onAdvancedFeaturesEnabledChange = vi.fn()
    const user = userEvent.setup()

    renderComposer('json', vi.fn(), vi.fn(), onSend, false, 'a {{subject}} portrait', vi.fn(), false, onAdvancedFeaturesEnabledChange)

    fireEvent.click(screen.getByRole('button', { name: /发送/ }))
    expect(await screen.findByRole('button', { name: '帮我开启' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /取\s*消|取消/ }))

    expect(onAdvancedFeaturesEnabledChange).not.toHaveBeenCalled()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('asks to add variables when dynamic prompt is enabled but panel variables are empty', async () => {
    const onSend = vi.fn()
    const onPanelVariablesChange = vi.fn()
    const onOpenDynamicPromptDrawer = vi.fn()
    const user = userEvent.setup()
    const emptyRows: PanelVariableRow[] = [{ id: 'row-empty', key: '', valuesText: '', selectedValue: '' }]

    renderComposer(
      'json',
      vi.fn(),
      onPanelVariablesChange,
      onSend,
      false,
      'a {{subject}} portrait',
      vi.fn(),
      true,
      vi.fn(),
      'single',
      vi.fn(),
      false,
      emptyRows,
      makeModels(),
      true,
      '',
      onOpenDynamicPromptDrawer,
    )

    fireEvent.click(screen.getByRole('button', { name: /发送/ }))
    expect(await screen.findByRole('button', { name: '帮我添加' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '帮我添加' }))

    expect(onPanelVariablesChange).toHaveBeenCalledTimes(1)
    const rows = onPanelVariablesChange.mock.calls[0]?.[0] as PanelVariableRow[]
    expect(rows).toHaveLength(1)
    expect(rows[0].key).toBe('subject')
    expect(rows[0].valuesText).toBe('')
    expect(onOpenDynamicPromptDrawer).toHaveBeenCalledWith('table')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('chains first and second confirms when both dynamic prompt is off and panel variables are empty', async () => {
    const onSend = vi.fn()
    const onAdvancedFeaturesEnabledChange = vi.fn()
    const onPanelVariablesChange = vi.fn()
    const onOpenDynamicPromptDrawer = vi.fn()
    const user = userEvent.setup()
    const emptyRows: PanelVariableRow[] = [{ id: 'row-empty', key: '', valuesText: '', selectedValue: '' }]

    renderComposer(
      'json',
      vi.fn(),
      onPanelVariablesChange,
      onSend,
      false,
      'a {{style}} portrait of {{subject}}',
      vi.fn(),
      false,
      onAdvancedFeaturesEnabledChange,
      'single',
      vi.fn(),
      false,
      emptyRows,
      makeModels(),
      true,
      '',
      onOpenDynamicPromptDrawer,
    )

    fireEvent.click(screen.getByRole('button', { name: /发送/ }))
    expect(await screen.findByRole('button', { name: '帮我开启' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '帮我开启' }))

    expect(await screen.findByRole('button', { name: '帮我添加' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '帮我添加' }))

    expect(onAdvancedFeaturesEnabledChange).toHaveBeenCalledWith(true)
    expect(onPanelVariablesChange).toHaveBeenCalledTimes(1)
    const rows = onPanelVariablesChange.mock.calls[0]?.[0] as PanelVariableRow[]
    expect(rows.map((row) => row.key)).toEqual(['style', 'subject'])
    expect(onOpenDynamicPromptDrawer).toHaveBeenCalledWith('table')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('sends directly without confirms when draft has no template keys', () => {
    const onSend = vi.fn()
    renderComposer('json', vi.fn(), vi.fn(), onSend, false, 'a cinematic portrait')

    fireEvent.click(screen.getByRole('button', { name: /发送/ }))

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('检测到模板关键词')).not.toBeInTheDocument()
    expect(screen.queryByText('检测到未配置动态提示词')).not.toBeInTheDocument()
  })

  it('supports Enter path for the keyword guard', async () => {
    const onAdvancedFeaturesEnabledChange = vi.fn()
    const onSend = vi.fn()
    const user = userEvent.setup()
    renderComposer('json', vi.fn(), vi.fn(), onSend, false, 'a {{subject}} portrait', vi.fn(), false, onAdvancedFeaturesEnabledChange)

    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByRole('button', { name: '帮我开启' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '帮我开启' }))
    expect(onAdvancedFeaturesEnabledChange).toHaveBeenCalledWith(true)
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})
