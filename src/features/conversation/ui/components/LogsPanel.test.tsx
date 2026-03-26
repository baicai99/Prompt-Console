import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogsPanel } from './LogsPanel'
import {
  clearLoggingEntries,
  emitImageTaskDebug,
  getLoggingEntries,
  setLoggingSettingsForRuntime,
} from '../../../../services/imageTaskDebug'
import { DEFAULT_LOGGING_SETTINGS } from '../../../../utils/loggingSettings'

describe('LogsPanel', () => {
  beforeEach(() => {
    clearLoggingEntries()
    setLoggingSettingsForRuntime(DEFAULT_LOGGING_SETTINGS)
  })

  it('renders logging controls even when logging is disabled', () => {
    render(<LogsPanel loggingSettings={DEFAULT_LOGGING_SETTINGS} onLoggingSettingsChange={vi.fn()} />)

    expect(screen.getByText('启用日志系统')).toBeInTheDocument()
    expect(screen.getByText('详情级别')).toBeInTheDocument()
    expect(screen.getByText('图片生成链路日志')).toBeInTheDocument()
    expect(screen.getByText('日志系统未开启')).toBeInTheDocument()
    expect(screen.getByText('日志系统关闭时不会记录日志')).toBeInTheDocument()

    const imageLoggingSwitch = screen.getAllByRole('switch').at(-1)
    expect(imageLoggingSwitch).toBeDisabled()
  })

  it('forwards logging config updates', () => {
    const onLoggingSettingsChange = vi.fn()
    render(
      <LogsPanel
        loggingSettings={{
          ...DEFAULT_LOGGING_SETTINGS,
          enabled: true,
        }}
        onLoggingSettingsChange={onLoggingSettingsChange}
      />,
    )

    const loggingSwitch = screen.getAllByRole('switch')[0]
    expect(loggingSwitch).not.toBeNull()
    fireEvent.click(loggingSwitch as HTMLElement)
    fireEvent.click(screen.getByText('详细'))

    const imageLoggingSwitch = screen.getAllByRole('switch').at(-1)
    expect(imageLoggingSwitch).not.toBeNull()
    fireEvent.click(imageLoggingSwitch as HTMLElement)

    expect(onLoggingSettingsChange).toHaveBeenCalledWith({ enabled: false })
    expect(onLoggingSettingsChange).toHaveBeenCalledWith({ detailLevel: 'verbose' })
    expect(onLoggingSettingsChange).toHaveBeenCalledWith({
      features: {
        ...DEFAULT_LOGGING_SETTINGS.features,
        imageGeneration: true,
      },
    })
  })

  it('renders ant design logging controls', () => {
    render(<LogsPanel loggingSettings={DEFAULT_LOGGING_SETTINGS} onLoggingSettingsChange={vi.fn()} />)

    expect(screen.getByText('详情级别')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'segmented control' })).toBeInTheDocument()
  })

  it('renders dedicated page layout when used as a standalone page', () => {
    render(
      <LogsPanel
        layout="page"
        loggingSettings={DEFAULT_LOGGING_SETTINGS}
        onLoggingSettingsChange={vi.fn()}
      />,
    )

    expect(screen.getByText('采集范围')).toBeInTheDocument()
    expect(screen.getByText('日志面板')).toBeInTheDocument()
    expect(screen.queryByText('当前日志面板记录内容')).not.toBeInTheDocument()
  })

  it('shows log entries in reverse chronological order and clears them', () => {
    setLoggingSettingsForRuntime({
      enabled: true,
      detailLevel: 'verbose',
      features: {
        ...DEFAULT_LOGGING_SETTINGS.features,
        imageGeneration: true,
      },
    })
    emitImageTaskDebug({
      stage: 'first_stage',
      timestamp: '2026-03-12T08:00:00.000Z',
      runId: 'run-1',
    })
    emitImageTaskDebug({
      stage: 'second_stage',
      timestamp: '2026-03-12T08:01:00.000Z',
      runId: 'run-2',
    })

    render(
      <LogsPanel
        loggingSettings={{
          enabled: true,
          detailLevel: 'verbose',
          features: {
            ...DEFAULT_LOGGING_SETTINGS.features,
            imageGeneration: true,
          },
        }}
      />,
    )

    expect(screen.getByText('图片生成日志已开启')).toBeInTheDocument()
    expect(screen.getByText('详情级别：verbose')).toBeInTheDocument()
    expect(screen.getByText('当前记录：2 条')).toBeInTheDocument()

    const titles = screen.getAllByText(/_stage/)
    expect(titles[0]?.textContent).toContain('second_stage')
    expect(titles[1]?.textContent).toContain('first_stage')

    fireEvent.click(screen.getByRole('button', { name: '清空日志' }))

    expect(getLoggingEntries()).toHaveLength(0)
    expect(screen.getByText('暂无日志记录')).toBeInTheDocument()
  })

  it('shows empty state when logging is enabled but no entries exist', () => {
    render(
      <LogsPanel
        loggingSettings={{
          ...DEFAULT_LOGGING_SETTINGS,
          enabled: true,
        }}
      />,
    )

    expect(screen.getByText('暂无日志记录')).toBeInTheDocument()
  })

  it('shows compact page empty state instead of stacked alerts when disabled', () => {
    render(<LogsPanel layout="page" loggingSettings={DEFAULT_LOGGING_SETTINGS} />)

    expect(screen.getByText('日志系统未开启')).toBeInTheDocument()
    expect(screen.queryByText('当前日志面板记录内容')).not.toBeInTheDocument()
    expect(screen.queryByText('日志系统关闭时不会记录日志')).not.toBeInTheDocument()
  })

  it('expands page rows on demand and keeps detailed payload hidden by default', () => {
    setLoggingSettingsForRuntime({
      enabled: true,
      detailLevel: 'verbose',
      features: {
        ...DEFAULT_LOGGING_SETTINGS.features,
        imageGeneration: true,
      },
    })
    emitImageTaskDebug({
      stage: 'payload_stage',
      timestamp: '2026-03-12T08:01:00.000Z',
      runId: 'run-2',
      state: 'queued',
      detail: { queue: 'alpha' },
    })

    render(
      <LogsPanel
        layout="page"
        loggingSettings={{
          enabled: true,
          detailLevel: 'verbose',
          features: {
            ...DEFAULT_LOGGING_SETTINGS.features,
            imageGeneration: true,
          },
        }}
      />,
    )

    expect(screen.getByText('payload_stage')).toBeInTheDocument()
    expect(screen.queryByText(/"queue": "alpha"/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '展开详情' }))

    expect(screen.getByText(/"queue": "alpha"/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收起详情' })).toBeInTheDocument()
  })
})
