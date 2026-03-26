import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Conversation } from '../../../../types/conversation'
import { MessageList } from './MessageList'

function makeConversation(messageCount: number): Conversation {
  return {
    id: 'conv-window',
    title: 'Window',
    titleMode: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sideMode: 'single',
    sideCount: 2,
    settingsBySide: {
      single: {
        resolution: '1K',
        aspectRatio: '1:1',
        imageCount: 1,
        gridColumns: 1,
        sizeMode: 'preset',
        customWidth: 1024,
        customHeight: 1024,
        autoSave: false,
        channelId: null,
        modelId: 'model-a',
        textModelId: 'text-a',
        videoModelId: 'video-a',
        paramValues: {},
      },
    },
    messages: Array.from({ length: messageCount }, (_, index) => ({
      id: `msg-${index}`,
      createdAt: `2026-01-01T00:00:0${index}.000Z`,
      role: 'user' as const,
      content: `message-${index}`,
    })),
  }
}

describe('MessageList windowSize', () => {
  it('renders only the tail render window when windowSize is provided', () => {
    render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation(6)}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          initialMessageLimit={6}
          windowSize={3}
        />
      </div>,
    )

    expect(screen.queryByText('message-0')).toBeNull()
    expect(screen.queryByText('message-1')).toBeNull()
    expect(screen.queryByText('message-2')).toBeNull()
    expect(screen.getByText('message-3')).toBeInTheDocument()
    expect(screen.getByText('message-4')).toBeInTheDocument()
    expect(screen.getByText('message-5')).toBeInTheDocument()
  })

  it('keeps vertical row spacing on every virtualized message shell', () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <MessageList
          activeConversation={makeConversation(3)}
          sideView="single"
          onOpenPreview={() => {}}
          onRetryRun={() => {}}
          onReplayRun={() => {}}
          initialMessageLimit={3}
        />
      </div>,
    )

    const rowShell = container.querySelector('.message-row-shell') as HTMLDivElement
    const style = window.getComputedStyle(rowShell)

    expect(style.boxSizing).toBe('border-box')
    expect(style.paddingTop).toBe('6px')
    expect(style.paddingBottom).toBe('6px')
  })
})
