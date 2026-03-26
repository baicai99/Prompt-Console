import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StorageDebugPanel } from './StorageDebugPanel'

vi.mock('../../../../services/storageDebug', () => ({
  collectStorageDebugSnapshot: vi.fn().mockResolvedValue({
    refreshedAt: '2026-03-13T10:00:00.000Z',
    quota: {
      usageBytes: 4096,
      quotaBytes: 16384,
      availableBytes: 12288,
      usageRatio: 0.25,
      usageDetails: {},
    },
    indexedDbSummary: {
      usedBytes: 2048,
      availableBytes: 14336,
      quotaBytes: 16384,
      usageRatio: 0.125,
    },
    locations: [
      {
        id: 'indexeddb-conversations',
        label: '对话正文',
        storageArea: 'indexedDB',
        status: 'active',
        purpose: '会话正文与消息内容',
        location: 'm3-conversations-db/conversation-content',
        contentKinds: ['对话历史正文'],
        usedBytes: 1024,
        availableBytes: 15360,
        quotaBytes: 16384,
        usageRatio: 0.0625,
        pressure: 'low',
        warning: null,
        itemCount: 3,
        itemNames: ['conversation-a'],
        notes: ['测试数据'],
      },
    ],
  }),
}))

describe('StorageDebugPanel', () => {
  it('renders storage debug content inside a dedicated side tab panel shell', async () => {
    const { container } = render(<StorageDebugPanel />)

    expect(container.firstElementChild).toHaveClass('side-tab-panel-root')
    expect(await screen.findByText('本地存储调试信息')).toBeInTheDocument()
    expect(screen.getByText('当前已确认的业务落点')).toBeInTheDocument()
    expect(screen.getByText('对话正文')).toBeInTheDocument()
    expect(screen.getByText('当前位置')).toBeInTheDocument()
    expect(screen.getByText('当前占用')).toBeInTheDocument()
    expect(screen.getByText('条目数量')).toBeInTheDocument()
    expect(screen.getByText('测试数据')).toBeInTheDocument()
  })

  it('renders the page layout without the side tab shell', async () => {
    const { container } = render(<StorageDebugPanel layout="page" />)

    expect(container.firstElementChild).not.toHaveClass('side-tab-panel-root')
    expect(screen.getByText('本地存储调试信息')).toBeInTheDocument()
    expect(screen.getByText(/sessionStorage、Cache Storage 与 OPFS/)).toBeInTheDocument()
    expect(screen.getByText('IndexedDB 已用空间')).toBeInTheDocument()
    expect(screen.getByText('存储概览')).toBeInTheDocument()
    expect(screen.getByText('存储位置')).toBeInTheDocument()
    expect(await screen.findByText('对话正文')).toBeInTheDocument()
    expect(screen.getByText('m3-conversations-db/conversation-content')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
