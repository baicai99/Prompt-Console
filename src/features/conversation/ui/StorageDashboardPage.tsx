import { ArrowLeftOutlined, DatabaseOutlined } from '@ant-design/icons'
import { Button, Card, Flex, Layout, Space, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { StorageDebugPanel } from './components/StorageDebugPanel'
import { APP_ROUTES } from '../../../routes'

const { Text, Title } = Typography

const pageContentStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  width: '100%',
  maxWidth: 1440,
  marginInline: 'auto',
}

export function StorageDashboardPage() {
  const navigate = useNavigate()

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
                  <Tag color="blue" icon={<DatabaseOutlined />}>本地存储仪表盘</Tag>
                </Space>
              </Flex>

              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <Title level={2} style={{ margin: 0 }}>浏览器本地存储</Title>
                <Text type="secondary">
                  聚焦会话历史、图片资产和配置缓存的实际落点、容量占用与存储压力，按概览和存储位置分层展示。
                </Text>
              </Space>
            </Space>
          </Card>

          <StorageDebugPanel layout="page" />
        </Space>
      </Layout.Content>
    </Layout>
  )
}
