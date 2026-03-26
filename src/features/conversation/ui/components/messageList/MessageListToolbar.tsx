import { UnorderedListOutlined } from '@ant-design/icons'
import { Button, Popover, Typography, theme } from 'antd'
import type { HistoryNavigatorItem } from './useMessageHistoryNavigator'

const { Text } = Typography

interface MessageListToolbarProps {
  hasOlderMessages: boolean
  isLoadingOlderMessages: boolean
  messagePageSize: number
  historyStartIndex: number
  onLoadOlderMessages: () => void
  historyNavigatorItems: HistoryNavigatorItem[]
  isHistoryNavigatorOpen: boolean
  historyNavigationAnchorMessageId: string | null
  hasHistoryNavigatorEntries: boolean
  onHistoryNavigatorOpenChange: (open: boolean) => void
  onNavigateToHistoryMessage: (messageId: string) => void
}

export function MessageListToolbar(props: MessageListToolbarProps) {
  const { token } = theme.useToken()

  const historyNavigatorContent = (
    <div
      className="message-history-nav-panel flex w-[min(340px,calc(100vw-48px))] max-h-[min(420px,calc(100vh-120px))] flex-col bg-white"
      style={{ borderRadius: token.borderRadiusLG }}
    >
      <div className="message-history-nav-header flex items-baseline justify-between gap-3 border-b border-[rgba(214,224,236,0.88)] px-4 pt-[14px] pb-3">
        <Text strong className="message-history-nav-title !mb-0">聊天记录导航</Text>
        <Text type="secondary" className="message-history-nav-count !mb-0">{`共 ${props.historyNavigatorItems.length} 条输入`}</Text>
      </div>
      {props.hasHistoryNavigatorEntries ? (
        <div className="message-history-nav-list flex flex-col gap-1.5 overflow-y-auto p-2.5" role="list">
          {props.historyNavigatorItems.map((item) => (
            <button
              key={item.messageId}
              type="button"
              className={`message-history-nav-item flex w-full flex-col items-start gap-1.5 border px-3 pt-3 pb-[11px] text-left text-[rgba(15,23,42,0.94)] transition-[background] duration-150 ease-out ${props.historyNavigationAnchorMessageId === item.messageId ? 'is-active border-[rgba(91,147,219,0.68)] bg-white shadow-[0_12px_24px_rgba(91,147,219,0.14)]' : 'border-[rgba(217,227,239,0.92)] bg-white hover:bg-[#f5f5f5]'} focus-visible:bg-[#f5f5f5] focus-visible:outline-none`}
              style={{ borderRadius: token.borderRadiusLG }}
              onClick={() => props.onNavigateToHistoryMessage(item.messageId)}
            >
              <span className="message-history-nav-item-sequence text-xs leading-none text-[rgba(69,85,113,0.78)]">{`输入 ${item.sequence}`}</span>
              <span className="message-history-nav-item-snippet line-clamp-2 text-[13px] leading-[1.5] text-[rgba(22,31,49,0.94)]">{item.snippet}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="message-history-nav-empty px-[18px] pt-6 pb-7">
          <Text type="secondary">当前会话还没有可导航的用户输入</Text>
        </div>
      )}
    </div>
  )

  return (
    <>
      {props.hasOlderMessages ? (
        <div className="message-history-more flex justify-center">
          <Button size="small" loading={props.isLoadingOlderMessages} onClick={props.onLoadOlderMessages}>
            {`Load ${Math.min(props.messagePageSize, props.historyStartIndex)} older messages`}
          </Button>
        </div>
      ) : null}

      <div className="message-history-nav-layer absolute top-5 right-5 z-[19]">
        <Popover
          trigger="click"
          placement="leftTop"
          open={props.isHistoryNavigatorOpen}
          onOpenChange={props.onHistoryNavigatorOpenChange}
          content={historyNavigatorContent}
          classNames={{
            root: 'message-history-nav-popover max-w-[min(360px,calc(100vw-32px))]',
          }}
          styles={{
            container: {
              padding: 0,
              borderRadius: token.borderRadiusLG,
              overflow: 'hidden',
              boxShadow: '0 20px 44px rgba(15, 23, 42, 0.18)',
            },
          }}
        >
          <Button
            type="default"
            shape="circle"
            aria-label="聊天记录导航"
            className={`message-history-nav-btn !flex !h-[38px] !w-[38px] !min-w-[38px] !items-center !justify-center !rounded-full !border-[rgba(201,214,232,0.95)] !bg-[rgba(255,255,255,0.92)] !shadow-none backdrop-blur-md ${props.isHistoryNavigatorOpen ? 'is-open !border-[rgba(91,147,219,0.8)] !bg-[rgba(248,251,255,0.98)] !text-[rgba(25,64,121,0.96)]' : 'hover:!border-[rgba(91,147,219,0.8)] hover:!bg-[rgba(248,251,255,0.98)] hover:!text-[rgba(25,64,121,0.96)] focus-visible:!border-[rgba(91,147,219,0.8)] focus-visible:!bg-[rgba(248,251,255,0.98)] focus-visible:!text-[rgba(25,64,121,0.96)]'} disabled:!opacity-70 disabled:!shadow-none`}
            icon={<UnorderedListOutlined />}
            disabled={!props.hasHistoryNavigatorEntries}
          />
        </Popover>
      </div>
    </>
  )
}
