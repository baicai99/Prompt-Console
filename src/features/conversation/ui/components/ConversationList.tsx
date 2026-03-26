import { DeleteOutlined, EditOutlined, EllipsisOutlined, HistoryOutlined, PushpinOutlined, MessageOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Dropdown, Input, Modal } from 'antd'
import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { PanelMode } from '../../../../hooks/usePersistentPanelMode'
import type { ConversationSummary } from '../../../../types/conversation'
import { globalAntdFeedback } from '../antdFeedback'
import { CompactNavRail } from './CompactNavRail'

interface ConversationListProps {
  summaries: ConversationSummary[]
  activeId: string | null
  isCollapsed?: boolean
  viewMode?: PanelMode
  shouldConfirmCreateConversation?: boolean
  onOpenDrawer: () => void
  onCreateConversation: () => void
  onClearAllConversations: () => void
  onDeleteConversation: (conversationId: string) => void
  onRenameConversation: (conversationId: string, nextTitle: string) => void
  onTogglePinConversation: (conversationId: string) => void
  onSwitchConversation: (conversationId: string) => void
}

interface ConversationAction {
  key: string
  title: string
  ariaLabel: string
  icon: ReactNode
  onClick: () => void
  withConfirm: boolean
  confirmTitle?: string
  confirmDescription?: string
  confirmOkText?: string
}

export function ConversationList(props: ConversationListProps) {
  const {
    summaries,
    activeId,
    isCollapsed,
    viewMode,
    shouldConfirmCreateConversation = false,
    onOpenDrawer,
    onCreateConversation,
    onClearAllConversations,
    onDeleteConversation,
    onRenameConversation,
    onTogglePinConversation,
    onSwitchConversation,
  } = props

  const mode: PanelMode = viewMode ?? (isCollapsed ? 'collapsed' : 'expanded')
  const isCollapsedMode = mode === 'collapsed'
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const skipNextBlurCommitRef = useRef<string | null>(null)
  const skipNextBlurCommit = (conversationId: string) => {
    skipNextBlurCommitRef.current = conversationId
  }

  const commitRename = (conversationId: string) => {
    const trimmedTitle = editingTitle.trim()
    if (trimmedTitle) {
      onRenameConversation(conversationId, trimmedTitle)
    }
    setEditingConversationId(null)
    setEditingTitle('')
  }

  const cancelRename = (conversationId: string) => {
    skipNextBlurCommit(conversationId)
    setEditingConversationId(null)
    setEditingTitle('')
  }

  const handleRenameInputKeyDown = (event: KeyboardEvent<HTMLInputElement>, conversationId: string) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancelRename(conversationId)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      skipNextBlurCommit(conversationId)
      commitRename(conversationId)
    }
  }

  const actions: ConversationAction[] = [
    ...(isCollapsedMode
      ? [{
          key: 'open',
          title: '打开导航抽屉',
          ariaLabel: 'open-left-sidebar-drawer',
          icon: <HistoryOutlined />,
          onClick: onOpenDrawer,
          withConfirm: false,
        }]
      : []),
    {
      key: 'create',
      title: '新建对话',
      ariaLabel: 'create-conversation',
      icon: <PlusOutlined />,
      onClick: () => {
        onCreateConversation()
        if (shouldConfirmCreateConversation) {
          globalAntdFeedback.info('旧会话仍在后台生成，可稍后返回查看结果。')
        }
      },
      withConfirm: false,
    },
    {
      key: 'clear',
      title: '清空记录',
      ariaLabel: 'clear-conversations',
      icon: <DeleteOutlined />,
      onClick: onClearAllConversations,
      withConfirm: true,
    },
  ]

  if (isCollapsedMode) {
    return (
      <CompactNavRail
        side="left"
        toolbarLabel="会话快捷导航"
        items={actions.map((action) => ({
          key: action.key,
          title: action.title,
          ariaLabel: action.ariaLabel,
          icon: action.icon,
          onClick: action.onClick,
          danger: action.key === 'clear',
          confirm: action.withConfirm
            ? {
                title: action.confirmTitle ?? '确认清空所有对话？',
                description: action.confirmDescription ?? '此操作不可恢复。',
                okText: action.confirmOkText ?? '清空',
                cancelText: '取消',
              }
            : undefined,
        }))}
      />
    )
  }

  return (
    <div className="flex h-full min-w-0 w-full flex-col overflow-hidden px-2 py-4">
      <div className="flex flex-col">
        {actions.map((action) => (
          <div key={action.key}>
            <Button
              icon={action.icon}
              aria-label={action.ariaLabel}
              className="mb-1.5 !flex !h-14 !w-full !items-center !justify-start !rounded-lg !border-none !bg-transparent !px-2.5 !shadow-none hover:!bg-[rgba(15,23,42,0.04)] active:!bg-[rgba(15,23,42,0.03)]"
              onClick={
                action.withConfirm
                  ? () => {
                      Modal.confirm({
                        title: action.confirmTitle ?? '确认清空所有对话？',
                        content: action.confirmDescription ?? '此操作不可恢复。',
                        okText: action.confirmOkText ?? '清空',
                        okButtonProps: { danger: true },
                        cancelText: '取消',
                        onOk: action.onClick,
                      })
                    }
                  : action.onClick
              }
            >
              <span className="inline-block max-w-[180px] overflow-hidden text-nowrap font-semibold text-[rgba(15,23,42,0.88)]">
                {action.title}
              </span>
            </Button>
          </div>
        ))}
      </div>

      {summaries.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            {summaries.map((item) => {
              const isEditing = editingConversationId === item.id
              const isActive = item.id === activeId

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'flex min-h-14 w-full items-center gap-2 rounded-lg px-2.5 py-0 text-left outline-none transition-colors',
                    isActive
                      ? 'bg-[rgba(22,119,255,0.12)]'
                      : 'hover:bg-[rgba(15,23,42,0.04)]',
                    'focus-visible:ring-2 focus-visible:ring-[rgba(22,119,255,0.2)]',
                  ].join(' ')}
                  onClick={() => onSwitchConversation(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSwitchConversation(item.id)
                    }
                  }}
                >
                  <MessageOutlined className="shrink-0 text-[rgba(15,23,42,0.55)]" />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden font-semibold text-[rgba(15,23,42,0.88)]" title={item.title}>
                      {item.pinnedAt ? <PushpinOutlined className="shrink-0 text-sm text-[var(--prompt-image-console-colorPrimary)]" /> : null}
                      {isEditing ? (
                        <Input
                          size="small"
                          value={editingTitle}
                          autoFocus
                          className="min-w-0 flex-1"
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onBlur={() => {
                            if (skipNextBlurCommitRef.current === item.id) {
                              skipNextBlurCommitRef.current = null
                              return
                            }
                            commitRename(item.id)
                          }}
                          onKeyDown={(event) => handleRenameInputKeyDown(event, item.id)}
                        />
                      ) : (
                        <span className="truncate">{item.title}</span>
                      )}
                    </div>
                    <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                      <Dropdown
                        trigger={['click']}
                        menu={{
                          selectable: false,
                          items: [
                            {
                              key: 'rename',
                              icon: <EditOutlined />,
                              label: '重命名',
                            },
                            {
                              key: 'pin',
                              icon: <PushpinOutlined />,
                              label: item.pinnedAt ? '取消置顶' : '置顶',
                            },
                            {
                              key: 'delete',
                              icon: <DeleteOutlined />,
                              danger: true,
                              label: '删除',
                            },
                          ],
                          onClick: ({ key, domEvent }) => {
                            domEvent.preventDefault()
                            domEvent.stopPropagation()
                            if (key === 'rename') {
                              setEditingConversationId(item.id)
                              setEditingTitle(item.title)
                            }
                            if (key === 'pin') {
                              onTogglePinConversation(item.id)
                            }
                            if (key === 'delete') {
                              Modal.confirm({
                                title: '确认删除此对话？',
                                content: '此操作不可恢复。',
                                okText: '删除',
                                okButtonProps: { danger: true },
                                cancelText: '取消',
                                onOk: () => onDeleteConversation(item.id),
                              })
                            }
                          },
                        }}
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={<EllipsisOutlined />}
                          className="!text-[rgba(15,23,42,0.88)]"
                          aria-label={`更多操作${item.title}`}
                          onClick={(event) => event.stopPropagation()}
                        />
                      </Dropdown>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-[rgba(15,23,42,0.14)] bg-[rgba(255,255,255,0.6)] px-4 text-sm text-[rgba(15,23,42,0.45)]">
          暂无对话，先新建一个
        </div>
      )}
    </div>
  )
}
