import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdvancedFeaturesPanel } from './AdvancedFeaturesPanel'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../../../utils/imageRuntimeSettings'

function openSelectByIndex(index: number) {
  const selectInput = screen.getAllByRole('combobox')[index]
  expect(selectInput).toBeDefined()
  fireEvent.mouseDown(selectInput as Element)
}

function renderAdvancedFeaturesPanel(runtimeSettings = DEFAULT_IMAGE_RUNTIME_SETTINGS) {
  const onImageRuntimeSettingsChange = vi.fn()
  const onRunConcurrencyUnlimitedChange = vi.fn()
  const onRunConcurrencyChange = vi.fn()

  render(
    <AdvancedFeaturesPanel
      models={[{ id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', tags: ['openai'], params: [] }]}
      autoRenameConversationTitle={false}
      autoRenameConversationTitleModelId={null}
      runConcurrency={3}
      runConcurrencyUnlimited={true}
      imageRuntimeSettings={runtimeSettings}
      onAutoRenameConversationTitleChange={vi.fn()}
      onAutoRenameConversationTitleModelIdChange={vi.fn()}
      onRunConcurrencyChange={onRunConcurrencyChange}
      onRunConcurrencyUnlimitedChange={onRunConcurrencyUnlimitedChange}
      onImageRuntimeSettingsChange={onImageRuntimeSettingsChange}
    />,
  )

  return {
    onImageRuntimeSettingsChange,
    onRunConcurrencyUnlimitedChange,
    onRunConcurrencyChange,
  }
}

describe('AdvancedFeaturesPanel', () => {
  it('renders runtime controls with polling strategy instead of a fixed interval field', () => {
    renderAdvancedFeaturesPanel()

    expect(screen.getByText('轮询策略模式')).toBeInTheDocument()
    expect(screen.getAllByText('预设策略').length).toBeGreaterThan(0)
    expect(screen.getByText('轮询时间分段')).toBeInTheDocument()
    expect(screen.getAllByText('轮询间隔(秒)').length).toBe(3)
    expect(screen.getByText('生成超时(分钟)')).toBeInTheDocument()
    expect(screen.getByText('活跃预览上限')).toBeInTheDocument()
    expect(screen.getByText('离屏释放延迟(ms)')).toBeInTheDocument()
  })

  it('forwards advanced feature toggle updates', () => {
    const { onRunConcurrencyUnlimitedChange, onImageRuntimeSettingsChange } = renderAdvancedFeaturesPanel()

    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[0] as HTMLElement)
    fireEvent.click(switches[1] as HTMLElement)
    fireEvent.click(switches[2] as HTMLElement)

    expect(onRunConcurrencyUnlimitedChange.mock.calls[0]?.[0]).toBe(false)
    expect(onImageRuntimeSettingsChange).toHaveBeenCalledWith({ showRequestMethodBadge: true })
  })

  it('keeps dynamic prompt controls out of the advanced features card matrix', () => {
    renderAdvancedFeaturesPanel()

    expect(screen.queryByText('动态提示词')).not.toBeInTheDocument()
    expect(screen.getByText('自动标题')).toBeInTheDocument()
  })

  it('forwards preset strategy updates', () => {
    const { onImageRuntimeSettingsChange } = renderAdvancedFeaturesPanel()

    openSelectByIndex(2)
    fireEvent.click(screen.getByText('快速'))

    expect(onImageRuntimeSettingsChange).toHaveBeenCalledWith({ resumePollPreset: 'fast' })
  })

  it('switches to custom schedule mode and forwards schedule edits', () => {
    const { onImageRuntimeSettingsChange } = renderAdvancedFeaturesPanel({
      ...DEFAULT_IMAGE_RUNTIME_SETTINGS,
      resumePollStrategyMode: 'custom',
    })

    expect(screen.getByText('新增分段')).toBeInTheDocument()
    const elapsedInputs = [
      screen.getByTestId('resume-poll-elapsed-0'),
      screen.getByTestId('resume-poll-elapsed-1'),
    ]
    const intervalInputs = [
      screen.getByTestId('resume-poll-interval-0'),
      screen.getByTestId('resume-poll-interval-1'),
    ]
    fireEvent.change(elapsedInputs[1] as HTMLElement, { target: { value: '45' } })
    fireEvent.blur(elapsedInputs[1] as HTMLElement)
    fireEvent.change(intervalInputs[1] as HTMLElement, { target: { value: '2.2' } })
    fireEvent.blur(intervalInputs[1] as HTMLElement)

    expect(onImageRuntimeSettingsChange).toHaveBeenCalledWith({
      resumePollSchedule: [
        { elapsedSeconds: 0, intervalSeconds: 0.5 },
        { elapsedSeconds: 45, intervalSeconds: 1.5 },
        { elapsedSeconds: 60, intervalSeconds: 3 },
      ],
    })
    expect(onImageRuntimeSettingsChange).toHaveBeenCalledWith({
      resumePollSchedule: [
        { elapsedSeconds: 0, intervalSeconds: 0.5 },
        { elapsedSeconds: 30, intervalSeconds: 2.2 },
        { elapsedSeconds: 60, intervalSeconds: 3 },
      ],
    })
  })

  it('forwards generation timeout updates', () => {
    const { onImageRuntimeSettingsChange } = renderAdvancedFeaturesPanel()

    const timeoutInput = screen.getByText('生成超时(分钟)')
      .closest('.ant-form-item')
      ?.querySelector('[role="spinbutton"]')
    expect(timeoutInput).not.toBeNull()
    fireEvent.change(timeoutInput as HTMLElement, { target: { value: '12.5' } })
    fireEvent.blur(timeoutInput as HTMLElement)

    expect(onImageRuntimeSettingsChange).toHaveBeenCalledWith({ generationTimeoutMinutes: 12.5 })
  })

  it('disables manual concurrency input when unlimited mode is enabled', () => {
    renderAdvancedFeaturesPanel()

    const strategyCard = screen.getByText('标题与并发策略').closest('.ant-card')
    expect(strategyCard).not.toBeNull()
    const concurrencyInput = within(strategyCard as HTMLElement).getByRole('spinbutton')
    expect(concurrencyInput).toBeDisabled()
  })
})
