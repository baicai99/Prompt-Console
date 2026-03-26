import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConversationWorkspaceColumns } from './ConversationWorkspaceColumns'
import type { ConversationSourceImagePreviewService } from '../application/conversationSourceImagePreviewService'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS } from '../../../utils/imageRuntimeSettings'

vi.mock('./components/MessageList', () => ({
  MessageList: ({ sideView }: { sideView: string }) => <div data-testid={`message-list-${sideView}`}>{sideView}</div>,
}))

function makeProps() {
  return {
    activeConversation: null,
    imageTasksByRunId: {},
    onOpenPreview: vi.fn(),
    onUseUserPrompt: vi.fn(),
    onRetryRun: vi.fn(),
    onReplayRun: vi.fn(),
    onCancelMessageRuns: vi.fn(),
    onDownloadAllRun: vi.fn(),
    onDownloadMessageImages: vi.fn(),
    onDownloadSingleImage: vi.fn(),
    onDownloadBatchRun: vi.fn(),
    replayingRunIds: [],
    historyVisibleLimit: 20,
    historyPageSize: 20,
    isLoadingOlderMessages: false,
    conversationOpenScrollTrigger: 0,
    sendScrollTrigger: 0,
    sendScrollTargetMessageId: null,
    loadOlderMessages: vi.fn(),
    handleAssistantMessageAction: vi.fn(),
    sourceImagePreviewService: {
      acquirePreview: vi.fn(),
    } as unknown as ConversationSourceImagePreviewService,
    imageRuntimeSettings: DEFAULT_IMAGE_RUNTIME_SETTINGS,
    activeSideMode: 'single' as 'single' | 'multi',
    activeSides: ['single'] as string[],
    activeSideCount: 1,
    currentModelsForTrigger: {
      single: { id: 'model-a', name: 'Model A', params: [], tags: [] },
    } as Record<string, { id: string; name: string; params: never[]; tags: never[] } | null>,
    hasApiChannels: true,
    onOpenChannelManagement: vi.fn(),
    onOpenModelPicker: vi.fn(),
    multiRenderProfile: {
      runInitialLimit: 12,
      runPageSize: 12,
      imageInitialLimit: 16,
      imagePageSize: 16,
      messageWindowSize: 20,
      messageOverscan: 8,
    },
  }
}

describe('ConversationWorkspaceColumns', () => {
  it('renders the floating model trigger in single mode with the current model name', () => {
    const { container } = render(<ConversationWorkspaceColumns {...makeProps()} />)

    expect(screen.getByRole('button', { name: 'Model A' })).toBeInTheDocument()
    expect(screen.getByTestId('message-list-single')).toBeInTheDocument()
    expect(container.querySelectorAll('.ab-window-shell')).toHaveLength(0)
  })

  it('renders distinct multi-window shells and opens the shared picker', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    props.activeSideMode = 'multi'
    props.activeSides = ['left', 'right']
    props.activeSideCount = 2
    props.currentModelsForTrigger = {
      left: { id: 'model-left', name: 'Left Model', params: [], tags: [] },
      right: { id: 'model-right', name: 'Right Model', params: [], tags: [] },
    }

    const { container } = render(<ConversationWorkspaceColumns {...props} />)

    expect(screen.getByText('Left Model')).toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: '窗口 2 当前模型 Right Model' })
    expect(screen.getByTestId('message-list-left')).toBeInTheDocument()
    expect(screen.getByTestId('message-list-right')).toBeInTheDocument()
    expect(container.querySelectorAll('.ab-window-shell')).toHaveLength(2)
    expect(container.querySelector('.ab-window-shell-divider')).toBeNull()
    expect(container.querySelector('.ab-window-shell')).toHaveClass('rounded-lg')

    await user.click(trigger)

    expect(props.onOpenModelPicker).toHaveBeenCalledTimes(1)
    expect(props.onOpenModelPicker).toHaveBeenCalledWith({ kind: 'window', side: 'right' })
  })

  it('shows add api channel when no api channel exists and opens channel management', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    props.currentModelsForTrigger = { single: null }
    props.hasApiChannels = false

    render(<ConversationWorkspaceColumns {...props} />)

    const trigger = screen.getByRole('button', { name: '添加 API 渠道' })
    await user.click(trigger)

    expect(props.onOpenChannelManagement).toHaveBeenCalledTimes(1)
    expect(props.onOpenModelPicker).not.toHaveBeenCalled()
  })
})
