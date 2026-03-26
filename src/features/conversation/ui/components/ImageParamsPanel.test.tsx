import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SingleSideSettings } from '../../../../types/conversation'
import { ImageParamsPanel } from './ImageParamsPanel'

function buildSingleSettings(overrides?: Partial<SingleSideSettings>): SingleSideSettings {
  return {
    resolution: '2K',
    modelId: 'gpt-image-1',
    aspectRatio: '1:1',
    imageCount: 1,
    gridColumns: 1,
    sizeMode: 'preset' as const,
    customWidth: 1024,
    customHeight: 1024,
    autoSave: false,
    channelId: 'channel-1',
    generationMode: 'image' as const,
    paramValues: {},
    ...overrides,
  }
}

describe('ImageParamsPanel', () => {
  it('renders the refactored sections for single-window mode', () => {
    render(
      <ImageParamsPanel
        sideMode="single"
        sideIds={[]}
        settingsBySide={{ single: buildSingleSettings() }}
        onSettingsChange={vi.fn()}
        onSettingsBatchChange={vi.fn()}
      />,
    )

    expect(screen.getByText('基础生成参数')).toBeInTheDocument()
    expect(screen.getByText('尺寸与构图')).toBeInTheDocument()
    expect(screen.getByText('结果排布')).toBeInTheDocument()
  })

  it('forwards size and count updates in current-scope editing', () => {
    const onSettingsChange = vi.fn()
    render(
      <ImageParamsPanel
        sideMode="single"
        sideIds={[]}
        settingsBySide={{ single: buildSingleSettings() }}
        onSettingsChange={onSettingsChange}
        onSettingsBatchChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: '自定义' }))
    const imageCountInput = screen.getAllByText('单次生成张数')
      .at(-1)
      ?.closest('.ant-form-item')
      ?.querySelector('input')
    expect(imageCountInput).not.toBeNull()
    fireEvent.change(imageCountInput as HTMLElement, { target: { value: '4' } })

    expect(onSettingsChange).toHaveBeenCalledWith('single', { sizeMode: 'custom' })
    expect(onSettingsChange).toHaveBeenCalledWith('single', { imageCount: 4 })
  })

  it('defaults to applying changes to all windows in multi-window mode', () => {
    const onSettingsChange = vi.fn()
    const onSettingsBatchChange = vi.fn()
    render(
      <ImageParamsPanel
        sideMode="multi"
        sideIds={['win-1', 'win-2']}
        settingsBySide={{
          single: buildSingleSettings(),
          'win-1': buildSingleSettings(),
          'win-2': buildSingleSettings({ imageCount: 2 }),
        }}
        onSettingsChange={onSettingsChange}
        onSettingsBatchChange={onSettingsBatchChange}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: '自定义' }))

    expect(onSettingsBatchChange).toHaveBeenCalledWith(['win-1', 'win-2'], { sizeMode: 'custom' })
    expect(onSettingsChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('tab', { name: '窗口 1' })).not.toBeInTheDocument()
  })

  it('shows tabs only in current-window scope and keeps per-window edits isolated', () => {
    const onSettingsChange = vi.fn()
    render(
      <ImageParamsPanel
        sideMode="multi"
        sideIds={['win-1', 'win-2']}
        settingsBySide={{
          single: buildSingleSettings(),
          'win-1': buildSingleSettings({ imageCount: 1 }),
          'win-2': buildSingleSettings({ imageCount: 3 }),
        }}
        onSettingsChange={onSettingsChange}
        onSettingsBatchChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: '仅当前窗口' }))

    expect(screen.getByRole('tab', { name: '窗口 1' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '窗口 2' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '窗口 2' }))

    const imageCountInput = screen.getAllByText('单次生成张数')
      .at(-1)
      ?.closest('.ant-form-item')
      ?.querySelector('input')
    expect(imageCountInput).not.toBeNull()
    expect(imageCountInput).toHaveValue('3')
    fireEvent.change(imageCountInput as HTMLElement, { target: { value: '5' } })

    expect(onSettingsChange).toHaveBeenCalledWith('win-2', { imageCount: 5 })
  })

  it('syncs the active window settings when switching back to all-window scope', () => {
    const onSettingsBatchChange = vi.fn()
    render(
      <ImageParamsPanel
        sideMode="multi"
        sideIds={['win-1', 'win-2']}
        settingsBySide={{
          single: buildSingleSettings({ imageCount: 2, aspectRatio: '3:2', resolution: '4K', gridColumns: 2 }),
          'win-1': buildSingleSettings({ imageCount: 1, aspectRatio: '1:1', resolution: '2K', gridColumns: 1 }),
          'win-2': buildSingleSettings({
            imageCount: 3,
            aspectRatio: '16:9',
            resolution: '4K',
            gridColumns: 4,
            sizeMode: 'custom',
            customWidth: 1536,
            customHeight: 864,
          }),
        }}
        onSettingsChange={vi.fn()}
        onSettingsBatchChange={onSettingsBatchChange}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: '仅当前窗口' }))
    fireEvent.click(screen.getByRole('tab', { name: '窗口 2' }))
    fireEvent.click(screen.getByRole('radio', { name: '应用于全部窗口' }))

    expect(onSettingsBatchChange).toHaveBeenCalledWith(['win-1', 'win-2'], {
      imageCount: 3,
      gridColumns: 4,
      sizeMode: 'custom',
      aspectRatio: '16:9',
      resolution: '4K',
      customWidth: 1536,
      customHeight: 864,
    })

    const imageCountInput = screen.getAllByText('单次生成张数')
      .at(-1)
      ?.closest('.ant-form-item')
      ?.querySelector('input')
    expect(imageCountInput).not.toBeNull()
    expect(imageCountInput).toHaveValue('3')
  })

  it('does not trigger a batch sync when the active window already matches all windows', () => {
    const onSettingsBatchChange = vi.fn()
    render(
      <ImageParamsPanel
        sideMode="multi"
        sideIds={['win-1', 'win-2']}
        settingsBySide={{
          single: buildSingleSettings(),
          'win-1': buildSingleSettings({ imageCount: 2, gridColumns: 2, resolution: '4K', aspectRatio: '16:9' }),
          'win-2': buildSingleSettings({ imageCount: 2, gridColumns: 2, resolution: '4K', aspectRatio: '16:9' }),
        }}
        onSettingsChange={vi.fn()}
        onSettingsBatchChange={onSettingsBatchChange}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: '仅当前窗口' }))
    fireEvent.click(screen.getByRole('tab', { name: '窗口 2' }))
    fireEvent.click(screen.getByRole('radio', { name: '应用于全部窗口' }))

    expect(onSettingsBatchChange).not.toHaveBeenCalled()
  })
})
