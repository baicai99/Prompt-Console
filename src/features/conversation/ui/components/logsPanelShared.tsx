import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  Flex,
  Row,
  Segmented,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { LoggingSettings } from '../../../../types/conversation'
import { clearLoggingEntries, type LoggingEntry } from '../../../../services/imageTaskDebug'
import { LOGGING_FEATURE_OPTIONS } from '../../../../utils/loggingSettings'

const { Paragraph, Text } = Typography

export function formatEntryTitle(entry: LoggingEntry): string {
  return `${entry.stage}${entry.seq ? ` · #${entry.seq}` : ''}`
}

export function formatEntryMeta(entry: LoggingEntry): string {
  return [
    entry.runId ? `run=${entry.runId}` : '',
    entry.taskId ? `task=${entry.taskId}` : '',
    entry.imageId ? `image=${entry.imageId}` : '',
    entry.provider ? `provider=${entry.provider}` : '',
    entry.model ? `model=${entry.model}` : '',
  ].filter(Boolean).join(' | ')
}

export function formatEntryTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function formatStateSummary(entry: LoggingEntry): string {
  if (entry.previousState && entry.nextState) {
    return `${entry.previousState} -> ${entry.nextState}`
  }
  if (entry.nextState) {
    return `next ${entry.nextState}`
  }
  if (entry.state) {
    return entry.state
  }
  if (entry.branch) {
    return `branch ${entry.branch}`
  }
  if (entry.label) {
    return entry.label
  }
  return '无状态变化'
}

export function getEntryDetailPayload(entry: LoggingEntry): Record<string, unknown> {
  return {
    state: entry.state,
    previousState: entry.previousState,
    nextState: entry.nextState,
    branch: entry.branch,
    label: entry.label,
    uiUpdated: entry.uiUpdated,
    pollTriggered: entry.pollTriggered,
    responseSummary: entry.responseSummary,
    parsed: entry.parsed,
    error: entry.error,
    detail: entry.detail,
  }
}

export function hasExpandablePayload(entry: LoggingEntry): boolean {
  const payload = getEntryDetailPayload(entry)
  return Object.values(payload).some((value) => typeof value !== 'undefined' && value !== null && value !== '')
}

export function stringifyPayload(value: unknown): string {
  if (typeof value === 'undefined') {
    return ''
  }
  return JSON.stringify(value, null, 2)
}

export function DetailLevelControl(props: {
  settings: LoggingSettings
  onChange?: (value: Partial<LoggingSettings>) => void
  block?: boolean
}) {
  const { settings, onChange, block = false } = props

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      <Text type="secondary">详情级别</Text>
      <Segmented
        block={block}
        value={settings.detailLevel}
        disabled={!settings.enabled}
        onChange={(value) => onChange?.({ detailLevel: value as LoggingSettings['detailLevel'] })}
        options={[
          { label: '简略', value: 'brief' },
          { label: '标准', value: 'standard' },
          { label: '详细', value: 'verbose' },
        ]}
      />
    </Space>
  )
}

export function FeatureControls(props: {
  settings: LoggingSettings
  onChange?: (value: Partial<LoggingSettings>) => void
}) {
  const { settings, onChange } = props

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {LOGGING_FEATURE_OPTIONS.map((item) => (
        <Card key={item.key} size="small">
          <Flex align="center" justify="space-between" gap={16}>
            <Space orientation="vertical" size={2} style={{ flex: 1 }}>
              <Text strong>{item.label}</Text>
              <Text type="secondary">{item.description}</Text>
            </Space>
            <Switch
              checked={settings.features[item.key]}
              disabled={!settings.enabled}
              onChange={(checked) =>
                onChange?.({
                  features: {
                    ...settings.features,
                    [item.key]: checked,
                  },
                })}
            />
          </Flex>
        </Card>
      ))}
    </Space>
  )
}

export function StatusStrip(props: {
  settings: LoggingSettings
  entryCount: number
}) {
  const { settings, entryCount } = props

  return (
    <Space wrap size={[8, 8]} role="status" aria-label="日志运行状态">
      <Tag color={settings.enabled ? 'processing' : 'default'}>
        {settings.enabled ? '日志系统运行中' : '日志系统已关闭'}
      </Tag>
      <Tag color={settings.features.imageGeneration ? 'success' : 'default'}>
        {settings.features.imageGeneration ? '图片生成日志已开启' : '图片生成日志已关闭'}
      </Tag>
      <Tag>{`详情级别：${settings.detailLevel}`}</Tag>
      <Tag>{`当前记录：${entryCount} 条`}</Tag>
    </Space>
  )
}

export function LogEntryDetail(props: {
  entry: LoggingEntry
}) {
  const { entry } = props
  const labelStyle = { width: 96, whiteSpace: 'nowrap' as const }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={8}>
        <Card size="small" title="关键字段" style={{ height: '100%' }}>
          <Descriptions
            size="small"
            bordered
            column={1}
            styles={{ label: labelStyle }}
            items={[
              { key: 'runId', label: 'runId', children: entry.runId ?? '-' },
              { key: 'taskId', label: 'taskId', children: entry.taskId ?? '-' },
              { key: 'imageId', label: 'imageId', children: entry.imageId ?? '-' },
              { key: 'provider', label: 'provider', children: entry.provider ?? '-' },
              { key: 'model', label: 'model', children: entry.model ?? '-' },
            ]}
          />
        </Card>
      </Col>
      <Col xs={24} xl={16}>
        <Card size="small" title="详细负载" style={{ height: '100%' }}>
          <pre
            style={{
              margin: 0,
              padding: 12,
              overflowX: 'auto',
              borderRadius: 8,
              background: 'var(--ant-color-fill-tertiary)',
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {stringifyPayload(getEntryDetailPayload(entry))}
          </pre>
        </Card>
      </Col>
    </Row>
  )
}

export function LogsPageToolbar(props: {
  settings: LoggingSettings
  onChange?: (value: Partial<LoggingSettings>) => void
  entryCount: number
}) {
  const { settings, onChange, entryCount } = props

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={8}>
        <Card title="日志配置" style={{ height: '100%' }}>
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <Text strong>日志面板</Text>
              <Text type="secondary">统一管理采集开关、详情级别和链路范围。</Text>
            </Space>

            <Flex align="start" justify="space-between" gap={16}>
              <Space orientation="vertical" size={4} style={{ flex: 1 }}>
                <Text strong>启用日志系统</Text>
                <Text type="secondary">控制当前页面是否写入和展示结构化运行日志。</Text>
              </Space>
              <Switch
                checked={settings.enabled}
                onChange={(checked) => onChange?.({ enabled: checked })}
              />
            </Flex>

            <DetailLevelControl settings={settings} onChange={onChange} block />

            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Text strong>采集范围</Text>
              <FeatureControls settings={settings} onChange={onChange} />
            </Space>
          </Space>
        </Card>
      </Col>
      <Col xs={24} xl={16}>
        <Card title="运行概览" style={{ height: '100%' }}>
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="系统状态"
                    value={settings.enabled ? '运行中' : '未开启'}
                    prefix={<Badge status={settings.enabled ? 'processing' : 'default'} />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="图片链路"
                    value={settings.features.imageGeneration ? '采集中' : '未采集'}
                    prefix={<Badge status={settings.features.imageGeneration ? 'success' : 'default'} />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic title="当前记录" value={entryCount} suffix="条" />
                </Card>
              </Col>
            </Row>

            <Alert
              type="info"
              showIcon
              title="记录范围说明"
              description="当前接入图片生成链路日志，覆盖请求创建、响应解析、状态切换、轮询以及图片渲染过程。"
            />

            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: 'detailLevel',
                  label: '详情级别',
                  children: settings.detailLevel,
                },
                {
                  key: 'feature',
                  label: '采集特性',
                  children: settings.features.imageGeneration ? '图片生成链路日志' : '未开启任何采集特性',
                },
              ]}
            />

            <Flex align="center" justify="space-between" gap={16} wrap>
              <StatusStrip settings={settings} entryCount={entryCount} />
              <Button size="small" onClick={() => clearLoggingEntries()} disabled={entryCount === 0}>
                清空日志
              </Button>
            </Flex>
          </Space>
        </Card>
      </Col>
    </Row>
  )
}

export function LogsPageContent(props: {
  settings: LoggingSettings
  entries: LoggingEntry[]
  expandedEntryId: string | null
  setExpandedEntryId: (value: string | null) => void
}) {
  const { settings, entries, expandedEntryId, setExpandedEntryId } = props

  const columns: ColumnsType<LoggingEntry> = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 120,
      render: (value: string) => <Text strong>{formatEntryTime(value)}</Text>,
    },
    {
      title: '阶段',
      key: 'stage',
      width: 260,
      render: (_, entry) => (
        <Space orientation="vertical" size={6}>
          <Space wrap size={[6, 6]}>
            <Tag color="blue">{entry.feature}</Tag>
            <Tag>{entry.level}</Tag>
          </Space>
          <Text strong>{formatEntryTitle(entry)}</Text>
        </Space>
      ),
    },
    {
      title: '状态摘要',
      key: 'state',
      width: 220,
      render: (_, entry) => <Text>{formatStateSummary(entry)}</Text>,
    },
    {
      title: '运行元信息',
      key: 'meta',
      render: (_, entry) => <Text type="secondary">{formatEntryMeta(entry) || '无额外元信息'}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, entry) => {
        const canExpand = hasExpandablePayload(entry)
        const isExpanded = expandedEntryId === entry.id

        return (
          <Button
            size="small"
            type={isExpanded ? 'default' : 'text'}
            disabled={!canExpand}
            onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
          >
            {isExpanded ? '收起详情' : '展开详情'}
          </Button>
        )
      },
    },
  ]

  if (!settings.enabled) {
    return (
      <Card title="运行记录">
        <Empty
          description={(
            <Space orientation="vertical" size={4}>
              <Text strong>日志系统未开启</Text>
              <Text type="secondary">打开日志系统后，这里会以高密度表格展示最新结构化记录。</Text>
            </Space>
          )}
        />
      </Card>
    )
  }

  if (entries.length === 0) {
    return (
      <Card title="运行记录">
        <Empty
          description={(
            <Space orientation="vertical" size={4}>
              <Text strong>暂无日志记录</Text>
              <Text type="secondary">当前已开启采集，但还没有新的图片生成链路日志写入。</Text>
            </Space>
          )}
        />
      </Card>
    )
  }

  return (
    <Card title="运行记录">
      <Table<LoggingEntry>
        rowKey="id"
        columns={columns}
        dataSource={entries}
        pagination={false}
        scroll={{ x: 960 }}
        expandable={{
          expandedRowKeys: expandedEntryId ? [expandedEntryId] : [],
          rowExpandable: hasExpandablePayload,
          expandedRowRender: (entry) => <LogEntryDetail entry={entry} />,
          expandIcon: () => null,
        }}
      />
    </Card>
  )
}

export function LogsSidebarContent(props: {
  settings: LoggingSettings
  onChange?: (value: Partial<LoggingSettings>) => void
  entries: LoggingEntry[]
}) {
  const { settings, onChange, entries } = props

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Card size="small">
        <Space orientation="vertical" size={4}>
          <Text type="secondary">日志面板</Text>
          <Text>管理日志采集开关、记录范围和详情级别，并查看已采集的结构化日志记录。</Text>
        </Space>
      </Card>

      {!settings.enabled ? (
        <Alert
          type="info"
          showIcon
          title="日志系统未开启"
          description="开启后即可按当前配置采集日志，并在下方查看记录。"
        />
      ) : null}

      <Alert
        type="info"
        showIcon
        title="当前日志面板记录内容"
        description="第一期只接入图片生成链路日志，覆盖请求创建、本地排队、请求发出、首次响应、taskId/url/base64 判断、轮询、状态切换、UI 文案更新、图片渲染完成，以及异常/超时/失败。"
      />

      <Card size="small">
        <Flex align="center" justify="space-between" gap={16}>
          <Space orientation="vertical" size={2} style={{ flex: 1 }}>
            <Text strong>启用日志系统</Text>
            <Text type="secondary">开启后按当前详情级别和功能开关采集日志，并在下方查看记录。</Text>
          </Space>
          <Switch
            checked={settings.enabled}
            onChange={(checked) => onChange?.({ enabled: checked })}
          />
        </Flex>
      </Card>

      <Card size="small">
        <DetailLevelControl settings={settings} onChange={onChange} block />
      </Card>

      <FeatureControls settings={settings} onChange={onChange} />

      <Card size="small">
        <Flex align="center" justify="space-between" gap={16} wrap>
          <StatusStrip settings={settings} entryCount={entries.length} />
          <Button size="small" onClick={() => clearLoggingEntries()} disabled={entries.length === 0}>
            清空日志
          </Button>
        </Flex>
      </Card>

      {entries.length === 0 ? (
        <Card size="small">
          <Empty description={settings.enabled ? '暂无日志记录' : '日志系统关闭时不会记录日志'} />
        </Card>
      ) : (
        <Collapse
          items={entries.map((entry) => ({
            key: entry.id,
            label: (
              <Space wrap size={[8, 4]}>
                <Tag color="blue">{entry.feature}</Tag>
                <Tag>{entry.level}</Tag>
                <Text strong>{formatEntryTitle(entry)}</Text>
                <Text type="secondary">{new Date(entry.timestamp).toLocaleTimeString()}</Text>
              </Space>
            ),
            children: (
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {formatEntryMeta(entry) || '无额外元信息'}
                </Paragraph>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    overflowX: 'auto',
                    borderRadius: 8,
                    background: 'var(--ant-color-fill-tertiary)',
                    fontSize: 12,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {stringifyPayload(getEntryDetailPayload(entry))}
                </pre>
              </Space>
            ),
          }))}
        />
      )}
    </Space>
  )
}
