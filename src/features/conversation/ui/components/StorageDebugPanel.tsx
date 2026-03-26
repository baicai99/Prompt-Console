import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import {
  collectStorageDebugSnapshot,
  type StorageDebugSnapshot,
  type StorageLocationSnapshot,
  type StoragePressureLevel,
} from '../../../../services/storageDebug'

const { Text } = Typography
const REFRESH_INTERVAL_MS = 4000

type StorageDebugPanelLayout = 'panel' | 'page'

function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '不可用'
  }

  if (value === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const size = value / (1024 ** exponent)
  return `${size.toFixed(size >= 100 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '不可用'
  }
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`
}

function pressureTagColor(pressure: StoragePressureLevel): string {
  if (pressure === 'critical') {
    return 'error'
  }
  if (pressure === 'high') {
    return 'warning'
  }
  if (pressure === 'medium') {
    return 'processing'
  }
  if (pressure === 'low') {
    return 'success'
  }
  return 'default'
}

function pressureStatus(pressure: StoragePressureLevel): 'success' | 'processing' | 'warning' | 'error' | 'default' {
  if (pressure === 'critical') {
    return 'error'
  }
  if (pressure === 'high') {
    return 'warning'
  }
  if (pressure === 'medium') {
    return 'processing'
  }
  if (pressure === 'low') {
    return 'success'
  }
  return 'default'
}

function pressureLabel(pressure: StoragePressureLevel): string {
  if (pressure === 'critical') {
    return '高压'
  }
  if (pressure === 'high') {
    return '偏高'
  }
  if (pressure === 'medium') {
    return '观察中'
  }
  if (pressure === 'low') {
    return '稳定'
  }
  return '未知'
}

function pressureFromRatio(ratio: number | null): StoragePressureLevel {
  if (ratio === null || !Number.isFinite(ratio)) {
    return 'unknown'
  }
  if (ratio >= 0.9) {
    return 'critical'
  }
  if (ratio >= 0.75) {
    return 'high'
  }
  if (ratio >= 0.5) {
    return 'medium'
  }
  return 'low'
}

function locationStatusLabel(status: StorageLocationSnapshot['status']): string {
  if (status === 'active') {
    return '活跃'
  }
  if (status === 'idle') {
    return '空闲'
  }
  return '不支持'
}

function locationStatusColor(status: StorageLocationSnapshot['status']): string {
  if (status === 'active') {
    return 'processing'
  }
  if (status === 'idle') {
    return 'default'
  }
  return 'default'
}

function StorageLocationCard(props: { location: StorageLocationSnapshot }) {
  const { location } = props

  return (
    <Card
      title={location.label}
      extra={(
        <Space wrap size={[8, 8]}>
          <Tag>{location.storageArea}</Tag>
          <Tag color={pressureTagColor(location.pressure)}>{pressureLabel(location.pressure)}</Tag>
          <Tag color={locationStatusColor(location.status)}>{locationStatusLabel(location.status)}</Tag>
        </Space>
      )}
      style={{ height: '100%' }}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          <Text type="secondary">{location.purpose}</Text>
        </Space>

        <Descriptions
          bordered
          size="small"
          column={1}
          items={[
            {
              key: 'location',
              label: '当前位置',
              children: location.location,
            },
            {
              key: 'usedBytes',
              label: '当前占用',
              children: formatBytes(location.usedBytes),
            },
            {
              key: 'itemCount',
              label: '条目数量',
              children: location.itemCount ?? '不可用',
            },
            {
              key: 'contentKinds',
              label: '内容类型',
              children: location.contentKinds.join(' / '),
            },
            {
              key: 'availableBytes',
              label: '剩余可用',
              children: formatBytes(location.availableBytes),
            },
            {
              key: 'usageRatio',
              label: '占总配额',
              children: formatRatio(location.usageRatio),
            },
          ]}
        />

        {location.itemNames.length > 0 ? (
          <Space wrap size={[8, 8]}>
            {location.itemNames.slice(0, 4).map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
            {location.itemNames.length > 4 ? <Tag>{`+${location.itemNames.length - 4}`}</Tag> : null}
          </Space>
        ) : null}

        {location.notes.length > 0 || location.warning ? (
          <Alert
            type={location.warning ? 'warning' : 'info'}
            showIcon
            title={location.warning ? '注意事项' : '补充说明'}
            description={(
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                {location.notes.map((note) => (
                  <Text key={note} type="secondary">{note}</Text>
                ))}
                {location.warning ? <Text type="warning">{location.warning}</Text> : null}
              </Space>
            )}
          />
        ) : null}
      </Space>
    </Card>
  )
}

interface StorageDebugPanelProps {
  layout?: StorageDebugPanelLayout
}

export function StorageDebugPanel(props: StorageDebugPanelProps) {
  const { layout = 'panel' } = props
  const [snapshot, setSnapshot] = useState<StorageDebugSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  const refreshSnapshot = async (background = false) => {
    if (background) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const nextSnapshot = await collectStorageDebugSnapshot()
      setSnapshot(nextSnapshot)
      setError('')
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : '读取本地存储调试信息失败')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    let disposed = false

    const guardedRefresh = async (background = false) => {
      if (disposed) {
        return
      }
      await refreshSnapshot(background)
    }

    void guardedRefresh()

    const timer = window.setInterval(() => {
      void guardedRefresh(true)
    }, REFRESH_INTERVAL_MS)

    const handleStorage = () => {
      void guardedRefresh(true)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void guardedRefresh(true)
      }
    }

    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      disposed = true
      window.clearInterval(timer)
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const indexedDbPressure = pressureFromRatio(snapshot?.indexedDbSummary.usageRatio ?? null)
  const content = (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="存储概览" style={{ height: '100%' }}>
            <Space orientation="vertical" size={20} style={{ width: '100%' }}>
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Text strong>本地存储调试信息</Text>
                <Text type="secondary">
                  集中查看 IndexedDB、localStorage、sessionStorage、Cache Storage 与 OPFS 的实际落点、占用情况和压力状态。
                </Text>
              </Space>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                  <Card size="small">
                    <Statistic title="IndexedDB 已用空间" value={formatBytes(snapshot?.indexedDbSummary.usedBytes ?? null)} />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card size="small">
                    <Statistic title="IndexedDB 可用空间" value={formatBytes(snapshot?.indexedDbSummary.availableBytes ?? null)} />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card size="small">
                    <Statistic title="浏览器总配额" value={formatBytes(snapshot?.indexedDbSummary.quotaBytes ?? null)} />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card size="small">
                    <Statistic
                      title="IndexedDB 压力"
                      value={pressureLabel(indexedDbPressure)}
                      prefix={<Badge status={pressureStatus(indexedDbPressure)} />}
                    />
                  </Card>
                </Col>
              </Row>

              <Flex align="center" justify="space-between" gap={16} wrap>
                <Space wrap size={[8, 8]}>
                  <Tag color={pressureTagColor(indexedDbPressure)}>{`IndexedDB 压力：${pressureLabel(indexedDbPressure)}`}</Tag>
                  <Tag>{`IndexedDB 占总配额：${formatRatio(snapshot?.indexedDbSummary.usageRatio ?? null)}`}</Tag>
                  <Tag>{`浏览器总占用：${formatBytes(snapshot?.quota.usageBytes ?? null)}`}</Tag>
                  {snapshot ? <Tag>{`刷新时间：${new Date(snapshot.refreshedAt).toLocaleTimeString()}`}</Tag> : null}
                </Space>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={isRefreshing && !isLoading}
                  onClick={() => {
                    void refreshSnapshot(true)
                  }}
                >
                  刷新
                </Button>
              </Flex>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              title="当前已确认的业务落点"
              description="对话历史正文主要写入 IndexedDB 的 m3-conversations-db/conversation-content，图片 Blob 主要写入 IndexedDB 的 m3-image-assets-db/image-assets，图片任务元数据与设置类信息位于 localStorage。"
            />
            {error ? <Alert type="error" showIcon title="读取失败" description={error} /> : null}
            <Card title="关键指标" size="small">
              <Descriptions
                size="small"
                column={1}
                items={[
                  {
                    key: 'quotaUsage',
                    label: '总配额占比',
                    children: formatRatio(snapshot?.quota.usageRatio ?? null),
                  },
                  {
                    key: 'locations',
                    label: '存储位置数',
                    children: snapshot?.locations.length ?? 0,
                  },
                ]}
              />
            </Card>
          </Space>
        </Col>
      </Row>

      {!isLoading && snapshot?.locations.length === 0 ? (
        <Card>
          <Empty description="未读取到存储位置数据" />
        </Card>
      ) : (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Text strong>存储位置</Text>
          <Row gutter={[16, 16]}>
            {snapshot?.locations.map((location) => (
              <Col key={location.id} xs={24} xl={12}>
                <StorageLocationCard location={location} />
              </Col>
            ))}
          </Row>
        </Space>
      )}
    </Space>
  )

  if (layout === 'page') {
    return <div>{content}</div>
  }

  return (
    <div className="side-tab-panel-root flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {content}
      </div>
    </div>
  )
}
