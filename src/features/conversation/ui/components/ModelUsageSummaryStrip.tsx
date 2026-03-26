import { Card, Col, Row, Statistic, Typography } from 'antd'
import type { LoadedModelUsageSnapshot } from '../../application/modelUsageStatsService'
import { formatCount, getTopModelSummary, formatRatioText, formatShare } from './modelUsageStatsShared'

export function ModelUsageSummaryStrip(props: {
  snapshot: LoadedModelUsageSnapshot
  failureRate: number
}) {
  const { snapshot, failureRate } = props
  const topModel = getTopModelSummary(snapshot)

  const summaryItems = [
    { label: '总调用', value: formatCount(snapshot.totalCount), hint: snapshot.range.label },
    { label: '成功率', value: formatRatioText(snapshot.statusCounts.completed, snapshot.totalCount), hint: `${formatCount(snapshot.statusCounts.completed)} 次成功` },
    { label: '失败率', value: formatShare(failureRate), hint: `${formatCount(snapshot.statusCounts.failed)} 次失败` },
    { label: '活跃模型', value: formatCount(snapshot.activeModelCount), hint: topModel ? `Top 1 ${topModel.name}` : '暂无模型数据' },
  ]

  return (
    <div aria-label="统计摘要">
      <Row gutter={[12, 12]}>
        {summaryItems.map((item) => (
          <Col key={item.label} xs={24} sm={12} xl={6}>
            <Card size="small" style={{ height: '100%' }}>
              <Statistic title={item.label} value={item.value} />
              <Typography.Text type="secondary">{item.hint}</Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
