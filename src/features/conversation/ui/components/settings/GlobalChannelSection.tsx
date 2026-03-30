import { LoginOutlined } from '@ant-design/icons'
import { Button, Card, Flex, Typography, theme } from 'antd'
import { useState } from 'react'
import type { ApiChannel } from '../../../../../types/channel'
import { JimengProxyModal } from './JimengProxyModal'

const { Text } = Typography

interface GlobalChannelSectionProps {
  onOpenDrawer: () => void
  channels: ApiChannel[]
  onChannelsChange: (channels: ApiChannel[]) => void
}

export function GlobalChannelSection(props: GlobalChannelSectionProps) {
  const { onOpenDrawer, channels, onChannelsChange } = props
  const { token } = theme.useToken()
  const [isJimengProxyOpen, setIsJimengProxyOpen] = useState(false)

  return (
    <>
      <Card size="small" styles={{ body: { padding: token.paddingSM } }}>
        <Flex vertical gap={token.sizeXS} style={{ width: '100%' }}>
          <Text strong>渠道管理</Text>
          <Button block onClick={onOpenDrawer}>管理渠道</Button>
          <Button
            block
            icon={<LoginOutlined />}
            onClick={() => setIsJimengProxyOpen(true)}
          >
            即梦扫码登录
          </Button>
        </Flex>
      </Card>
      <JimengProxyModal
        open={isJimengProxyOpen}
        onClose={() => setIsJimengProxyOpen(false)}
        channels={channels}
        onChannelsChange={onChannelsChange}
      />
    </>
  )
}
