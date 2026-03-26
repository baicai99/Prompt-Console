import { useMemo } from 'react'
import { ArrowLeftOutlined, AreaChartOutlined } from '@ant-design/icons'
import { Button, Card, Layout, Space, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useConversationController } from './useConversationController'
import { createConversationRepository } from '../infra/conversationRepository'
import { ModelUsageStatsDashboard } from './components/ModelUsageStatsPanel'
import { APP_ROUTES } from '../../../routes'

const { Text, Title } = Typography

const pageContentStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  width: '100%',
  maxWidth: 1440,
  marginInline: 'auto',
}

export function ModelUsageDashboardPage() {
  const navigate = useNavigate()
  const controller = useConversationController()
  const repository = useMemo(() => createConversationRepository(), [])

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Layout.Content style={{ padding: 24 }}>
        <Space orientation="vertical" size={24} style={pageContentStyle}>
          <Card>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Space size={[12, 12]} wrap>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate(APP_ROUTES.home)}
                >
                  返回对话区
                </Button>
                <Tag color="blue" icon={<AreaChartOutlined />}>运行分析仪表盘</Tag>
              </Space>
              <div>
                <Title level={2} style={{ marginBottom: 8 }}>模型分析</Title>
                <Text type="secondary">
                  聚焦调用规模、健康度、主导模型与时间趋势。
                </Text>
              </div>
            </Space>
          </Card>

          <ModelUsageStatsDashboard
            isActive
            repository={repository}
            summaries={controller.read.summaries}
            modelCatalog={controller.read.modelCatalog}
            layout="page"
          />
        </Space>
      </Layout.Content>
    </Layout>
  )
}
