import { Card, Col, Collapse, Descriptions, Flex, Row, Space, Statistic, Tag, Typography } from 'antd'
import type { LoadedModelUsageSnapshot } from '../../application/modelUsageStatsService'
import {
  buildDetailSourceText,
  formatCount,
  formatCountText,
  formatDuration,
  formatRatioText,
  formatShare,
  getVisibleRankingStatuses,
  STATUS_META,
} from './modelUsageStatsShared'

export function ModelUsageRankingItem(props: {
  rank: number
  model: LoadedModelUsageSnapshot['models'][number]
}) {
  const { rank, model } = props
  const visibleStatuses = getVisibleRankingStatuses(model.statusCounts)
  const detailSourceText = buildDetailSourceText(model.channelLabel, model.detailSourceLabel)
  const failureRateText = formatRatioText(model.statusCounts.failed, model.count)

  return (
    <Card size="small" style={{ width: '100%' }}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Flex align="center" justify="space-between" gap={12} wrap>
          <Space orientation="vertical" size={2}>
            <Space size={8} wrap>
              <Tag variant="filled" color="blue">{`#${rank}`}</Tag>
              <Typography.Text strong title={model.modelName}>{model.modelName}</Typography.Text>
            </Space>
            <Space size={8} wrap>
              <Typography.Text type="secondary">来源</Typography.Text>
              {model.channelLabel ? <Tag>{model.channelLabel}</Tag> : <Typography.Text type="secondary">暂无来源信息</Typography.Text>}
            </Space>
          </Space>
          <Tag color="geekblue">{`${formatCountText(model.count)} / ${formatShare(model.share)}`}</Tag>
        </Flex>

        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="调用次数" value={formatCountText(model.count)} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="调用占比" value={formatShare(model.share)} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="总耗时" value={formatDuration(model.totalElapsedMs)} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="平均耗时" value={formatDuration(model.averageElapsedMs)} />
            </Card>
          </Col>
        </Row>

        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">状态</Typography.Text>
          <Flex gap={8} wrap>
            {visibleStatuses.length > 0 ? visibleStatuses.map((item) => (
              <Tag key={item.status} color={STATUS_META[item.status].color}>
                {`${item.label} ${formatCount(item.count)}`}
              </Tag>
            )) : (
              <Typography.Text type="secondary">暂无状态数据</Typography.Text>
            )}
            <Tag color="default">{`失败率 ${failureRateText}`}</Tag>
          </Flex>
        </Space>

        <Collapse
          ghost
          size="small"
          expandIconPlacement="end"
          items={[
            {
              key: 'detail',
              label: '详情',
              children: (
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    {
                      key: 'modelId',
                      label: '内部 ID',
                      children: (
                        <Typography.Text copyable={{ text: model.modelId }}>
                          {model.modelId}
                        </Typography.Text>
                      ),
                    },
                    {
                      key: 'source',
                      label: '来源',
                      children: (
                        <Typography.Text copyable={{ text: detailSourceText }}>
                          {detailSourceText}
                        </Typography.Text>
                      ),
                    },
                    {
                      key: 'totalElapsedMs',
                      label: '累计耗时',
                      children: formatDuration(model.totalElapsedMs),
                    },
                    {
                      key: 'averageElapsedMs',
                      label: '平均耗时',
                      children: formatDuration(model.averageElapsedMs),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Space>
    </Card>
  )
}
