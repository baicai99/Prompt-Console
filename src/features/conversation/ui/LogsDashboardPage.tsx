import { useMemo } from 'react'
import { ArrowLeftOutlined, FileSearchOutlined } from '@ant-design/icons'
import { Button, Card, Flex, Layout, Space, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { createConversationCommandGroups } from './controller/conversationControllerBindings'
import { useConversationController } from './useConversationController'
import { LogsPanel } from './components/LogsPanel'
import { getLoggingEntries } from '../../../services/imageTaskDebug'
import { APP_ROUTES } from '../../../routes'

const { Text, Title } = Typography

const pageContentStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  width: '100%',
  maxWidth: 1440,
  marginInline: 'auto',
}

export function LogsDashboardPage() {
  const navigate = useNavigate()
  const controller = useConversationController()
  const actions = useMemo(() => createConversationCommandGroups(controller.dispatch), [controller.dispatch])
  const loggingSettings = controller.read.loggingSettings
  const totalEntries = getLoggingEntries().length

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Layout.Content style={{ padding: 24 }}>
        <Space orientation="vertical" size={24} style={pageContentStyle}>
          <Card>
            <Space orientation="vertical" size={20} style={{ width: '100%' }}>
              <Flex align="center" justify="space-between" wrap gap={12}>
                <Space size={[12, 12]} wrap>
                  <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate(APP_ROUTES.home)}
                  >
                    返回对话区
                  </Button>
                  <Tag color="blue" icon={<FileSearchOutlined />}>运行日志仪表盘</Tag>
                </Space>
                <Space wrap size={[8, 8]}>
                  <Tag color={loggingSettings.enabled ? 'processing' : 'default'}>
                    {loggingSettings.enabled ? '系统开启' : '系统关闭'}
                  </Tag>
                  <Tag color={loggingSettings.features.imageGeneration ? 'success' : 'default'}>
                    {loggingSettings.features.imageGeneration ? '图片链路采集中' : '图片链路未采集'}
                  </Tag>
                  <Tag>{`${totalEntries} 条记录`}</Tag>
                </Space>
              </Flex>
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                  <Title level={2} style={{ margin: 0 }}>结构化运行日志</Title>
                </Space>
                <Text type="secondary">
                  面向桌面排障场景，按“配置、概览、记录”组织信息，优先保证状态可读性和日志检索效率。
                </Text>
              </Space>
            </Space>
          </Card>

          <LogsPanel
            layout="page"
            loggingSettings={loggingSettings}
            onLoggingSettingsChange={actions.settings.setLoggingSettings}
          />
        </Space>
      </Layout.Content>
    </Layout>
  )
}
