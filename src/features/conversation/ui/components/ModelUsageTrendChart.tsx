import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { theme } from 'antd'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ModelUsageBucket } from '../../domain/modelUsageStats'
import type { ModelUsageChartDatum } from './modelUsageStatsShared'
import { shouldRenderAxisLabel } from './modelUsageStatsShared'

export function ModelUsageTrendChart(props: {
  buckets: ModelUsageBucket[]
  hoveredKey: string | null
  onHover: (bucket: ModelUsageBucket | null) => void
}) {
  const { buckets, hoveredKey, onHover } = props
  const { token } = theme.useToken()
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const gradientId = useId().replace(/[:]/g, '')
  const chartMinWidth = useMemo(() => Math.max(320, buckets.length * 56), [buckets.length])
  const [chartWidth, setChartWidth] = useState(chartMinWidth)
  const chartData = useMemo<ModelUsageChartDatum[]>(() => buckets.map((bucket, index) => ({
    key: bucket.key,
    label: bucket.label,
    totalCount: bucket.totalCount,
    isLabelVisible: shouldRenderAxisLabel(index, buckets.length),
  })), [buckets])

  const activeDatum = chartData.find((item) => item.key === hoveredKey) ?? null

  useEffect(() => {
    setChartWidth(chartMinWidth)
  }, [chartMinWidth])

  useEffect(() => {
    const container = chartContainerRef.current
    if (!container || typeof ResizeObserver === 'undefined') {
      return
    }

    const updateWidth = () => {
      const nextWidth = Math.max(container.clientWidth, chartMinWidth)
      setChartWidth(nextWidth)
    }

    updateWidth()

    const observer = new ResizeObserver(() => {
      updateWidth()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [chartMinWidth])

  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        role="img"
        aria-label="模型调用趋势图"
        style={{ minWidth: `${chartMinWidth}px`, paddingTop: 8 }}
      >
        <div ref={chartContainerRef}>
          <AreaChart
            width={chartWidth}
            height={196}
            data={chartData}
            margin={{ top: 18, right: 18, bottom: 20, left: 18 }}
            onMouseMove={(state: { activeTooltipIndex?: number | string | null | undefined }) => {
              const activeIndex = state.activeTooltipIndex
              if (activeIndex === undefined || activeIndex === null) {
                return
              }
              const index = typeof activeIndex === 'number' ? activeIndex : Number(activeIndex)
              if (Number.isNaN(index)) {
                return
              }
              const bucket = buckets[index] ?? null
              onHover(bucket)
            }}
            onMouseLeave={() => onHover(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(22, 119, 255, 0.28)" />
                <stop offset="100%" stopColor="rgba(22, 119, 255, 0.03)" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={token.colorBorderSecondary} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              height={44}
              interval={0}
              tickMargin={14}
              allowDataOverflow
              padding={{ left: 12, right: 12 }}
              tick={({ x, y, payload, index }) => {
                const datum = chartData[index]
                const isActive = datum?.key === activeDatum?.key
                return (
                  <g transform={`translate(${x},${y})`}>
                    <title>{payload.value}</title>
                    <text
                      x={0}
                      y={0}
                      dy={12}
                      textAnchor="middle"
                      fill={isActive ? token.colorPrimary : token.colorTextDescription}
                      fontSize={12}
                      fontWeight={isActive ? 600 : 400}
                    >
                      {datum?.isLabelVisible ? payload.value : ''}
                    </text>
                  </g>
                )
              }}
            />
            <YAxis hide domain={[0, 'dataMax + 1']} />
            <Tooltip
              cursor={{ stroke: token.colorPrimaryBorder, strokeWidth: 1 }}
              content={() => null}
            />
            <Area
              type="monotone"
              dataKey="totalCount"
              stroke={token.colorPrimary}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              activeDot={{ r: 5, fill: token.colorPrimaryActive, stroke: token.colorBgContainer, strokeWidth: 2 }}
              dot={({ cx, cy, payload }) => (
                <circle
                  key={payload.key}
                  cx={cx}
                  cy={cy}
                  r={payload.key === activeDatum?.key ? 5 : 3.5}
                  fill={payload.key === activeDatum?.key ? token.colorPrimaryActive : token.colorPrimary}
                  stroke={token.colorBgContainer}
                  strokeWidth={2}
                />
              )}
            />
          </AreaChart>
        </div>
      </div>
    </div>
  )
}
