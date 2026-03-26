import { VerticalAlignBottomOutlined, VerticalAlignTopOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import { Layout } from 'antd'
import { CompactNavRail } from '../../components/CompactNavRail'
import type { RightPanelTab } from './workspaceSettingsSidebarShared'

const { Sider } = Layout

interface WorkspaceSettingsNavRailProps {
  collapsedWidth: number
  items: ReadonlyArray<{
    key: RightPanelTab
    title: string
    ariaLabel: string
    icon: ReactNode
  }>
  rightPanelTab: RightPanelTab
  isModelPickerNavItemActive: boolean
  onPanelEntryClick: (tab: RightPanelTab) => void
  composerPanelMode: 'expanded' | 'collapsed'
  onCollapseComposer: () => void
  onExpandComposer: () => void
}

export function WorkspaceSettingsNavRail(props: WorkspaceSettingsNavRailProps) {
  return (
    <Sider
      width={props.collapsedWidth}
      collapsedWidth={props.collapsedWidth}
      trigger={null}
      collapsible={false}
      theme="light"
      className="overflow-hidden bg-[var(--prompt-image-console-colorBgContainer)] transition-[width,min-width,max-width] duration-150 ease-in"
      style={{
        minWidth: props.collapsedWidth,
        maxWidth: props.collapsedWidth,
        flex: `0 0 ${props.collapsedWidth}px`,
      }}
    >
      <CompactNavRail
        side="right"
        toolbarLabel="工作区快捷侧栏"
        items={props.items.map((item) => ({
          key: item.key,
          title: item.title,
          ariaLabel: item.ariaLabel,
          icon: item.icon,
          onClick: () => props.onPanelEntryClick(item.key),
          isActive: item.key === 'modelPicker' ? props.isModelPickerNavItemActive : item.key === props.rightPanelTab,
        }))}
        footerItems={[
          {
            key: 'toggle-composer',
            title: props.composerPanelMode === 'collapsed' ? '展开输入框' : '收起输入框',
            ariaLabel: props.composerPanelMode === 'collapsed' ? '展开输入框' : '收起输入框',
            icon: props.composerPanelMode === 'collapsed' ? <VerticalAlignTopOutlined /> : <VerticalAlignBottomOutlined />,
            onClick: props.composerPanelMode === 'collapsed' ? props.onExpandComposer : props.onCollapseComposer,
          },
        ]}
      />
    </Sider>
  )
}
