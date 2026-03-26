import { Button, Modal, Space, Typography } from 'antd'
import type { Side, SingleSideSettings } from '../../../../../types/conversation'

const { Text } = Typography

interface PendingWindowSyncChoice {
  side: Side
  patch: Partial<SingleSideSettings>
  sectionLabel: string
}

interface SyncWindowSettingsModalProps {
  pendingWindowSyncChoice: PendingWindowSyncChoice | null
  sideIds: Side[]
  getSideTabLabel: (sideIds: Side[], side: Side) => string
  onApplyCurrent: () => void
  onApplyAll: () => void
}

export function SyncWindowSettingsModal(props: SyncWindowSettingsModalProps) {
  const {
    pendingWindowSyncChoice,
    sideIds,
    getSideTabLabel,
    onApplyCurrent,
    onApplyAll,
  } = props

  return (
    <Modal
      title="同步到所有窗口"
      open={Boolean(pendingWindowSyncChoice)}
      centered
      closable={false}
      keyboard={false}
      mask={{ closable: false }}
      footer={[
        <Button key="current" onClick={onApplyCurrent}>
          仅当前窗口
        </Button>,
        <Button key="all" type="primary" onClick={onApplyAll}>
          同步到全部窗口
        </Button>,
      ]}
    >
      <Space orientation="vertical" className="w-full" size={8}>
        <Text>
          {pendingWindowSyncChoice
            ? `你刚修改了 ${getSideTabLabel(sideIds, pendingWindowSyncChoice.side)} 的「${pendingWindowSyncChoice.sectionLabel}」参数。`
            : ''}
        </Text>
        <Text type="secondary">
          {pendingWindowSyncChoice ? `是否将这次修改同步应用到全部 ${sideIds.length} 个窗口？` : ''}
        </Text>
      </Space>
    </Modal>
  )
}
