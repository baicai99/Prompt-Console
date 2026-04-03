import { Button, Card, Flex, Typography, theme } from 'antd'
import type { ApiChannel } from '../../../../../types/channel'

const { Text } = Typography

interface GlobalChannelSectionProps {
  onOpenDrawer: () => void
  channels: ApiChannel[]
  onChannelsChange: (channels: ApiChannel[]) => void
}

export function GlobalChannelSection(props: GlobalChannelSectionProps) {
  const { onOpenDrawer } = props
  const { token } = theme.useToken()

  return (
    <Card size="small" styles={{ body: { padding: token.paddingSM } }}>
      <Flex vertical gap={token.sizeXS} style={{ width: '100%' }}>
        <Text strong>渠道管理</Text>
        <Button block onClick={onOpenDrawer}>管理渠道</Button>
      </Flex>
    </Card>
  )
}
