import { EllipsisOutlined } from '@ant-design/icons'
import { Tabs } from 'antd'
import type { TabsProps } from 'antd'

const DEFAULT_MORE_ICON = <EllipsisOutlined aria-hidden="true" />

export function OverflowTabs(props: TabsProps) {
  const { more, ...rest } = props

  return (
    <Tabs
      {...rest}
      more={{
        icon: DEFAULT_MORE_ICON,
        ...more,
      }}
    />
  )
}
