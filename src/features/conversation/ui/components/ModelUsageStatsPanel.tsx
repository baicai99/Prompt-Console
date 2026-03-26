import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Flex,
  Segmented,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ConversationSummary } from '../../../../types/conversation'
import type { ModelCatalog } from '../../../../types/model'
import type { ConversationRepository } from '../../infra/conversationRepository'
import type { LoadedModelUsageSnapshot } from '../../application/modelUsageStatsService'
import {
  MODEL_USAGE_GRANULARITY_LABELS,
  type ModelUsageBucket,
  type ModelUsagePresetRange,
  type ModelUsageRunStatus,
} from '../../domain/modelUsageStats'
import { ModelUsageRankingItem } from './ModelUsageRankingItem'
import { ModelUsageSummaryStrip } from './ModelUsageSummaryStrip'
import { ModelUsageTrendChart } from './ModelUsageTrendChart'
import {
  ALL_SOURCES_VALUE,
  formatCount,
  formatRangeSummary,
  formatRatioText,
  formatShare,
  getRangeHint,
  getTodayDateValue,
  getTopModelSummary,
  renderStatusSummary,
  STATUS_META,
  toPickerValue,
  VISIBLE_RANGE_OPTIONS,
} from './modelUsageStatsShared'
import { useModelUsageStats } from './settings/useModelUsageStats'

const { Text, Title } = Typography

interface ModelUsageStatsPanelProps {
  isActive: boolean
  repository: ConversationRepository
  summaries: ConversationSummary[]
  modelCatalog: ModelCatalog
}

type ModelUsageDashboardLayout = 'panel' | 'page'

interface ModelUsageStatsDashboardProps extends ModelUsageStatsPanelProps {
  layout?: ModelUsageDashboardLayout
}

type ModelUsageStatsState = ReturnType<typeof useModelUsageStats>

function renderLoadingState(layout: ModelUsageDashboardLayout) {
  const padding = layout === 'page' ? 0 : 16

  return (
    <div style={{ padding }}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {layout === 'panel' ? (
          <Card size="small">
            <Space orientation="vertical" size={4}>
              <Text type="secondary">模型分析</Text>
              <Text>读取本地历史会话中的图片生成记录，按时间和模型查看调用分布。</Text>
            </Space>
          </Card>
        ) : null}
        <Card><Skeleton active paragraph={{ rows: 4 }} /></Card>
        <Card><Skeleton active paragraph={{ rows: 10 }} /></Card>
      </Space>
    </div>
  )
}

function ModelUsageDashboardBody(props: {
  stats: ModelUsageStatsState
  layout: ModelUsageDashboardLayout
}) {
  const { stats, layout } = props
  const [hoveredBucketKey, setHoveredBucketKey] = useState<string | null>(null)
  const snapshot = stats.snapshot

  const hoveredBucket = useMemo(
    () => snapshot?.buckets.find((bucket) => bucket.key === hoveredBucketKey) ?? snapshot?.buckets.at(-1) ?? null,
    [hoveredBucketKey, snapshot],
  )
  const failureRate = snapshot && snapshot.totalCount > 0 ? snapshot.statusCounts.failed / snapshot.totalCount : 0
  const successRate = snapshot && snapshot.totalCount > 0 ? snapshot.statusCounts.completed / snapshot.totalCount : 0
  const topModel = getTopModelSummary(snapshot ?? null)
  const padding = layout === 'page' ? 0 : 16

  return (
    <div style={{ padding }}>
      <Space orientation="vertical" size={layout === 'page' ? 20 : 16} style={{ width: '100%' }}>
        {layout === 'panel' ? (
          <Card size="small">
            <Space orientation="vertical" size={4}>
              <Text type="secondary">模型分析</Text>
              <Text>基于当前浏览器中的全部历史图片生成记录，查看调用规模、状态分布和时间趋势。</Text>
            </Space>
          </Card>
        ) : null}

        <FiltersCard layout={layout} stats={stats} snapshot={snapshot} failureRate={failureRate} />

        {stats.granularityNotice ? (
          <Alert type="info" showIcon title="粒度已自动调整" description={stats.granularityNotice} />
        ) : null}
        {snapshot?.loadIssues ? (
          <Alert
            type="warning"
            showIcon
            title="统计结果可能不完整"
            description={`共 ${snapshot.loadIssues.totalConversationCount} 条历史会话中，有 ${snapshot.loadIssues.failedConversationCount} 条读取失败，本次统计已忽略这些会话。`}
          />
        ) : null}
        {stats.staleDataNotice ? (
          <Alert type="warning" showIcon title="当前展示的是旧数据" description={stats.staleDataNotice} />
        ) : null}
        {stats.error ? (
          <Alert
            type="error"
            showIcon
            title="统计读取失败"
            description={stats.error}
            action={(
              <Button size="small" onClick={stats.retry}>
                重试
              </Button>
            )}
          />
        ) : null}

        {snapshot && snapshot.totalCount === 0 ? (
          <Card>
            <Empty description="当前时间范围和来源筛选下暂无模型调用数据" />
          </Card>
        ) : null}

        {snapshot && snapshot.totalCount > 0 ? (
          <>
            <OverviewCards snapshot={snapshot} successRate={successRate} failureRate={failureRate} topModel={topModel} />
            <ContextAndStatusSection snapshot={snapshot} />
            <TrendAndRankingSection
              snapshot={snapshot}
              hoveredBucket={hoveredBucket}
              onHoverBucket={(bucket) => setHoveredBucketKey(bucket?.key ?? null)}
            />
          </>
        ) : null}
      </Space>
    </div>
  )
}

function FiltersCard(props: {
  layout: ModelUsageDashboardLayout
  stats: ModelUsageStatsState
  snapshot: LoadedModelUsageSnapshot | null
  failureRate: number
}) {
  const { layout, stats, snapshot, failureRate } = props

  return (
    <Card>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Flex justify="space-between" align="start" gap={16} wrap>
          <Title level={layout === 'page' ? 4 : 5} style={{ margin: 0 }}>
            模型调用总览
          </Title>
          <Space size={[8, 8]} wrap>
            <Tag color="blue">本地历史会话统计</Tag>
            <Button
              size={layout === 'page' ? 'middle' : 'small'}
              type={layout === 'page' ? 'primary' : 'default'}
              icon={<ReloadOutlined />}
              loading={stats.isRefreshing}
              onClick={stats.retry}
            >
              刷新数据
            </Button>
          </Space>
        </Flex>

            <Row gutter={[16, 16]}>
          <Col xs={24} md={12} lg={6}>
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Text type="secondary">时间范围</Text>
              <Segmented
                block
                value={stats.selectedRange}
                onChange={(value) => stats.setSelectedRange(value as ModelUsagePresetRange)}
                options={VISIBLE_RANGE_OPTIONS}
              />
            </Space>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Text type="secondary">选择日期</Text>
              <DatePicker
                aria-label="选择统计日期"
                value={toPickerValue(stats.selectedDate)}
                format="YYYY/MM/DD"
                allowClear={false}
                style={{ width: '100%' }}
                maxDate={toPickerValue(getTodayDateValue())}
                onChange={(value) => {
                  if (!value) {
                    return
                  }
                  stats.setSelectedDate(value.format('YYYY-MM-DD'))
                }}
              />
            </Space>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Text type="secondary">统计粒度</Text>
              <Segmented
                block
                value={stats.selectedGranularity}
                onChange={(value) => stats.setSelectedGranularity(value as typeof stats.selectedGranularity)}
                options={stats.allowedGranularities.map((value) => ({
                  value,
                  label: MODEL_USAGE_GRANULARITY_LABELS[value],
                }))}
              />
            </Space>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Text type="secondary">来源</Text>
              <Select
                value={stats.selectedSource}
                onChange={stats.setSelectedSource}
                style={{ width: '100%' }}
                options={[
                  { value: ALL_SOURCES_VALUE, label: '全部来源' },
                  ...stats.availableSources.map((source) => ({ value: source, label: source })),
                ]}
              />
            </Space>
          </Col>
        </Row>

        {snapshot && snapshot.totalCount > 0 ? <ModelUsageSummaryStrip snapshot={snapshot} failureRate={failureRate} /> : null}
      </Space>
    </Card>
  )
}

function OverviewCards(props: {
  snapshot: LoadedModelUsageSnapshot
  successRate: number
  failureRate: number
  topModel: ReturnType<typeof getTopModelSummary>
}) {
  const { snapshot, successRate, failureRate, topModel } = props

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={8}>
        <Card style={{ height: '100%' }}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">总调用次数</Text>
              <Title level={2} style={{ margin: '8px 0 4px' }}>{formatCount(snapshot.totalCount)}</Title>
              <Text type="secondary">当前筛选范围内的全部图片生成调用（包含重试）</Text>
            </div>
            <Row gutter={[12, 12]}>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="成功率" value={formatShare(successRate)} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="失败" value={formatCount(snapshot.statusCounts.failed)} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="进行中" value={formatCount(snapshot.statusCounts.inProgress)} />
                </Card>
              </Col>
            </Row>
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Row gutter={[16, 16]} style={{ height: '100%' }}>
          <Col xs={24} sm={12} lg={8}>
            <Card style={{ height: '100%' }}>
              <Statistic title="活跃模型数" value={formatCount(snapshot.activeModelCount)} />
              <Text type="secondary">有实际调用记录的模型</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card style={{ height: '100%' }}>
              <Statistic title="失败率" value={formatShare(failureRate)} />
              <Text type="secondary">{`失败 ${formatCount(snapshot.statusCounts.failed)} 次`}</Text>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card style={{ height: '100%' }}>
              <Statistic title="Top 1 模型" value={topModel?.name ?? '暂无模型数据'} />
              <Text type="secondary">
                {topModel ? `${topModel.count} 次 · ${topModel.share}` : '暂无调用占比'}
              </Text>
            </Card>
          </Col>
        </Row>
      </Col>
    </Row>
  )
}

function ContextAndStatusSection(props: {
  snapshot: LoadedModelUsageSnapshot
}) {
  const { snapshot } = props
  const descriptionLabelStyle = { width: 108, whiteSpace: 'nowrap' as const }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={14}>
        <Card title="统计口径" extra={<Text type="secondary">当前展示范围与聚合方式</Text>}>
          <Descriptions
            bordered
            column={1}
            styles={{ label: descriptionLabelStyle }}
            items={[
              {
                key: 'range',
                label: <span style={{ whiteSpace: 'nowrap' }}>当前范围</span>,
                children: (
                  <Space orientation="vertical" size={4}>
                    <Text strong>{snapshot.range.label}</Text>
                    <Text type="secondary">{formatRangeSummary(snapshot.range, snapshot.timeZone)}</Text>
                  </Space>
                ),
              },
              {
                key: 'granularity',
                label: <span style={{ whiteSpace: 'nowrap' }}>统计粒度</span>,
                children: (
                  <Space orientation="vertical" size={4}>
                    <Text strong>{MODEL_USAGE_GRANULARITY_LABELS[snapshot.granularity]}</Text>
                    <Text type="secondary">{getRangeHint(snapshot.range, MODEL_USAGE_GRANULARITY_LABELS[snapshot.granularity])}</Text>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Col>
      <Col xs={24} xl={10}>
        <Card title="状态分布" extra={<Text type="secondary">按调用尝试状态汇总当前范围内的调用数量，包含重试</Text>}>
          <Row gutter={[12, 12]}>
            {(Object.keys(STATUS_META) as ModelUsageRunStatus[]).map((status) => (
              <Col key={status} xs={12} md={6}>
                <Card size="small">
                  <Statistic title={STATUS_META[status].label} value={formatCount(snapshot.statusCounts[status])} />
                  <Text type="secondary">{formatRatioText(snapshot.statusCounts[status], snapshot.totalCount)}</Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color={STATUS_META[status].color}>{STATUS_META[status].label}</Tag>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      </Col>
    </Row>
  )
}

function TrendAndRankingSection(props: {
  snapshot: LoadedModelUsageSnapshot
  hoveredBucket: ModelUsageBucket | null
  onHoverBucket: (bucket: ModelUsageBucket | null) => void
}) {
  const { snapshot, hoveredBucket, onHoverBucket } = props
  const trendDetailLabelStyle = { width: 96, whiteSpace: 'nowrap' as const }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={14}>
        <Card
          title="调用趋势"
          extra={hoveredBucket ? (
            <Space size={8} wrap>
              <Tag color="blue">{hoveredBucket.label}</Tag>
              <Text strong>{`${formatCount(hoveredBucket.totalCount)} 次`}</Text>
            </Space>
          ) : undefined}
        >
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Text type="secondary">横轴为时间桶，纵轴为调用次数。</Text>
            <ModelUsageTrendChart
              buckets={snapshot.buckets}
              hoveredKey={hoveredBucket?.key ?? null}
              onHover={onHoverBucket}
            />
            {hoveredBucket ? (
              <Descriptions
                bordered
                size="small"
                column={1}
                styles={{ label: trendDetailLabelStyle }}
                items={[
                  {
                    key: 'bucket',
                    label: '时间桶',
                    children: hoveredBucket.label,
                  },
                  {
                    key: 'summary',
                    label: '关键指标',
                    children: `${formatCount(hoveredBucket.totalCount)} 次 / ${renderStatusSummary(hoveredBucket.statusCounts) || '暂无'}`,
                  },
                  {
                    key: 'topModels',
                    label: 'Top 3 模型',
                    children: hoveredBucket.topModels.length > 0 ? (
                      <Flex gap={8} wrap>
                        {hoveredBucket.topModels.map((item) => (
                          <Tag key={`${hoveredBucket.key}-${item.modelName}`} color="blue">
                            {`${item.modelName} ${item.count}`}
                          </Tag>
                        ))}
                      </Flex>
                    ) : '暂无',
                  },
                ]}
              />
            ) : null}
          </Space>
        </Card>
      </Col>
      <Col xs={24} xl={10}>
        <Card title="模型调用排行榜" extra={<Text type="secondary">按调用次数降序，包含占比与状态拆分。</Text>}>
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            {snapshot.models.map((model, index) => (
              <ModelUsageRankingItem key={model.modelId} model={model} rank={index + 1} />
            ))}
          </Space>
        </Card>
      </Col>
    </Row>
  )
}

export function ModelUsageStatsDashboard(props: ModelUsageStatsDashboardProps) {
  const { layout = 'panel' } = props
  const stats = useModelUsageStats({
    enabled: props.isActive,
    repository: props.repository,
    summaries: props.summaries,
    modelCatalog: props.modelCatalog,
  })

  if (stats.isLoading && !stats.snapshot) {
    return renderLoadingState(layout)
  }

  return <ModelUsageDashboardBody stats={stats} layout={layout} />
}

export function ModelUsageStatsPanel(props: ModelUsageStatsPanelProps) {
  return <ModelUsageStatsDashboard {...props} layout="panel" />
}
