import type { ReactNode } from 'react'
import type { Side } from '../../../../../types/conversation'
import { OverflowTabs } from '../OverflowTabs'

interface WindowSettingsTabsProps {
  sideMode: 'single' | 'multi'
  sideIds: Side[]
  activeSideTab: Side
  onSideTabChange: (value: Side) => void
  renderSettingForm: (side: Side) => ReactNode
  className?: string
}

export function WindowSettingsTabs(props: WindowSettingsTabsProps) {
  const { sideMode, sideIds, activeSideTab, onSideTabChange, renderSettingForm, className } = props

  if (sideMode !== 'multi') {
    return renderSettingForm('single')
  }

  return (
    <OverflowTabs
      className={className}
      activeKey={sideIds.includes(activeSideTab) ? activeSideTab : sideIds[0]}
      onChange={(value) => onSideTabChange(value)}
      tabBarGutter={16}
      items={sideIds.map((sideId, index) => ({
        key: sideId,
        label: `窗口 ${index + 1}`,
        children: renderSettingForm(sideId),
      }))}
    />
  )
}
