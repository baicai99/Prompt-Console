import type { ReactNode } from 'react'
import { Button, Popconfirm, Tooltip } from 'antd'

type CompactNavRailSide = 'left' | 'right'

interface CompactNavRailItem {
  key: string
  title: string
  ariaLabel: string
  icon: ReactNode
  onClick: () => void
  isActive?: boolean
  danger?: boolean
  confirm?: {
    title: string
    description?: string
    okText?: string
    cancelText?: string
  }
}

interface CompactNavRailProps {
  side: CompactNavRailSide
  toolbarLabel: string
  items: CompactNavRailItem[]
  footerItems?: CompactNavRailItem[]
  className?: string
}

export function CompactNavRail(props: CompactNavRailProps) {
  const { side, toolbarLabel, items, footerItems = [], className } = props
  const tooltipPlacement = side === 'left' ? 'right' : 'left'
  const actionClassName = [
    '!flex',
    '!h-10',
    '!w-10',
    '!min-w-10',
    '!items-center',
    '!justify-center',
    '!rounded-lg',
    '!border-none',
    '!bg-transparent',
    '!p-0',
    '!shadow-none',
    side === 'left' ? 'text-[rgba(15,23,42,0.72)]' : 'text-[rgba(15,23,42,0.68)]',
    'hover:!bg-[rgba(15,23,42,0.04)]',
    'hover:!text-[rgba(15,23,42,0.92)]',
    'focus-visible:!outline-none',
    'focus-visible:!ring-2',
    'focus-visible:!ring-[rgba(22,119,255,0.2)]',
    'active:!bg-[rgba(15,23,42,0.06)]',
  ].join(' ')

  const renderAction = (item: CompactNavRailItem) => {
    const button = (
      <Button
        type="text"
        className={[
          actionClassName,
          item.isActive ? '!bg-[rgba(22,119,255,0.12)] !text-[var(--prompt-image-console-colorPrimary)]' : '',
          item.danger ? 'hover:!bg-[rgba(255,77,79,0.08)] hover:!text-[var(--ant-color-error)]' : '',
        ].join(' ').trim()}
        icon={item.icon}
        aria-label={item.ariaLabel}
        aria-pressed={item.isActive ?? false}
        onClick={item.confirm ? undefined : item.onClick}
      />
    )

    const wrappedButton = (
      <Tooltip placement={tooltipPlacement} title={item.title}>
        {button}
      </Tooltip>
    )

    if (!item.confirm) {
      return wrappedButton
    }

    return (
      <Popconfirm
        placement={tooltipPlacement}
        title={item.confirm.title}
        description={item.confirm.description}
        okText={item.confirm.okText ?? '确认'}
        cancelText={item.confirm.cancelText ?? '取消'}
        okButtonProps={item.danger ? { danger: true } : undefined}
        onConfirm={item.onClick}
      >
        {wrappedButton}
      </Popconfirm>
    )
  }

  return (
    <div className={['flex h-full flex-col overflow-hidden px-2 py-3', className ?? ''].join(' ').trim()}>
      <div className="flex min-h-0 flex-1 flex-col" role="toolbar" aria-label={toolbarLabel}>
        <div className="flex min-h-0 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden">
          {items.map((item) => (
            <div key={item.key} className="flex w-full justify-center">
              {renderAction(item)}
            </div>
          ))}
        </div>
        {footerItems.length > 0 ? (
          <div className="mt-auto flex flex-col items-center gap-1 border-t border-[rgba(214,220,229,0.88)] pt-3">
            {footerItems.map((item) => (
              <div key={item.key} className="flex w-full justify-center">
                {renderAction(item)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
