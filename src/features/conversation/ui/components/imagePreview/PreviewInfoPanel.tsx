import { Alert, Button, Card, Descriptions, Empty, Flex, Tabs, Tag, Typography } from 'antd'
import type { SettingPrimitive } from '../../../../../types/conversation'
import { isRemovedProviderRun } from '../../../../../utils/legacyRemovedProviderCompat'
import { getRunRequestAddress } from '../messageListUtils'
import type { PreviewCompareMode } from '../../../../../hooks/useImagePreview'
import type { PreviewABDetail, PreviewDetail, PreviewDetailEntry } from './previewTypes'

const { Paragraph, Text } = Typography

function formatJson(value: unknown): string {
  if (value == null) {
    return 'null'
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}

function formatValue(value: unknown, fallback = '未记录'): string {
  if (value == null) {
    return fallback
  }

  if (typeof value === 'string') {
    return value.trim() || fallback
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function compareModeLabel(mode: PreviewCompareMode): string {
  if (mode === 'swipe') {
    return '滑块对比'
  }
  if (mode === 'overlay') {
    return '叠加对比'
  }
  if (mode === 'difference') {
    return '差异对比'
  }
  return '并排对比'
}

function buildEntrySummary(entry: PreviewDetailEntry) {
  const requestAddress = getRunRequestAddress(entry.run)
  return {
    model: entry.run.modelName || entry.run.modelId || '未记录',
    channel: entry.run.channelName ?? entry.run.channelId ?? '未记录',
    prompt: entry.run.finalPrompt || '未记录',
    requestAddress,
    size: entry.image.width && entry.image.height ? `${entry.image.width} x ${entry.image.height}` : '未记录',
    sourceType: entry.image.refKind ?? '未记录',
    params: formatJson(entry.run.paramsSnapshot as Record<string, SettingPrimitive>),
    settings: formatJson(entry.run.settingsSnapshot),
    status: entry.image.status,
    bytes: formatValue(entry.image.bytes),
    createdAt: entry.run.createdAt || '未记录',
  }
}

function buildABWarnings(detail: PreviewABDetail): string[] {
  const warnings: string[] = []
  if (!detail.left || !detail.right) {
    warnings.push('当前序号存在缺图，部分对比能力会降级。')
  }

  if (detail.left && detail.right) {
    const leftSize = `${detail.left.image.width ?? '-'}x${detail.left.image.height ?? '-'}`
    const rightSize = `${detail.right.image.width ?? '-'}x${detail.right.image.height ?? '-'}`
    if (leftSize !== rightSize) {
      warnings.push(`两侧尺寸不同：A ${leftSize} / B ${rightSize}`)
    }
    if ((detail.left.image.refKind ?? '') !== (detail.right.image.refKind ?? '')) {
      warnings.push(`两侧来源类型不同：A ${detail.left.image.refKind ?? '未记录'} / B ${detail.right.image.refKind ?? '未记录'}`)
    }
  }

  return warnings
}

function DiffRow(input: { label: string; left: string; right: string }) {
  const changed = input.left !== input.right

  return (
    <div className="preview-info-diff-row rounded-[14px] border border-[#e8eef6] bg-white p-3">
      <div className="preview-info-diff-label mb-2.5 flex items-center justify-between gap-2">
        <Text strong>{input.label}</Text>
        {changed ? <Tag color="gold">不同</Tag> : <Tag>一致</Tag>}
      </div>
      <div className="preview-info-diff-columns grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="preview-info-diff-cell min-w-0">
          <Text type="secondary">A</Text>
          <Paragraph>{input.left}</Paragraph>
        </div>
        <div className="preview-info-diff-cell min-w-0">
          <Text type="secondary">B</Text>
          <Paragraph>{input.right}</Paragraph>
        </div>
      </div>
    </div>
  )
}

function EntryActions(input: {
  entry: PreviewDetailEntry
  onCopyPrompt?: (entry: PreviewDetailEntry) => void
  onCopyParams?: (entry: PreviewDetailEntry) => void
  onReusePrompt?: (entry: PreviewDetailEntry) => void
  onReplayRun?: (entry: PreviewDetailEntry) => void
}) {
  const canReplayRun = !isRemovedProviderRun(input.entry.run)

  return (
    <Flex wrap gap={8}>
      {input.onCopyPrompt ? (
        <Button size="small" onClick={() => input.onCopyPrompt?.(input.entry)}>
          复制 Prompt
        </Button>
      ) : null}
      {input.onCopyParams ? (
        <Button size="small" onClick={() => input.onCopyParams?.(input.entry)}>
          复制参数
        </Button>
      ) : null}
      {input.onReusePrompt ? (
        <Button size="small" type="primary" onClick={() => input.onReusePrompt?.(input.entry)}>
          回填到草稿
        </Button>
      ) : null}
      {input.onReplayRun && canReplayRun ? (
        <Button size="small" onClick={() => input.onReplayRun?.(input.entry)}>
          再来一次
        </Button>
      ) : null}
    </Flex>
  )
}

function EntryCard(input: {
  title: string
  entry?: PreviewDetailEntry
  onCopyPrompt?: (entry: PreviewDetailEntry) => void
  onCopyParams?: (entry: PreviewDetailEntry) => void
  onReusePrompt?: (entry: PreviewDetailEntry) => void
  onReplayRun?: (entry: PreviewDetailEntry) => void
}) {
  if (!input.entry) {
    return (
      <Card size="small" title={input.title}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前侧缺图" />
      </Card>
    )
  }

  const summary = buildEntrySummary(input.entry)

  return (
    <Card
      size="small"
      title={input.title}
      extra={summary.status === 'success' ? <Tag color="green">success</Tag> : <Tag>{summary.status}</Tag>}
    >
      <Flex vertical gap={12}>
        <Descriptions
          size="small"
          column={1}
          items={[
            { key: 'run-id', label: 'Run ID', children: input.entry.run.id },
            { key: 'image-id', label: '图片 ID', children: input.entry.image.id },
            { key: 'model', label: '模型', children: summary.model },
            { key: 'channel', label: '渠道', children: summary.channel },
            { key: 'size', label: '尺寸', children: summary.size },
            { key: 'bytes', label: '大小(bytes)', children: summary.bytes },
            { key: 'source', label: '来源', children: summary.sourceType },
            { key: 'request', label: '请求地址', children: <Text copyable={summary.requestAddress !== '未记录'}>{summary.requestAddress}</Text> },
          ]}
        />
        <div>
          <Text strong>最终 Prompt</Text>
          <Paragraph>{summary.prompt}</Paragraph>
        </div>
        <EntryActions
          entry={input.entry}
          onCopyPrompt={input.onCopyPrompt}
          onCopyParams={input.onCopyParams}
          onReusePrompt={input.onReusePrompt}
          onReplayRun={input.onReplayRun}
        />
      </Flex>
    </Card>
  )
}

function PreviewJsonPanel({ detail }: { detail: PreviewDetail }) {
  if (detail.mode === 'single') {
    return (
      <Flex vertical gap={12}>
        <div>
          <Text strong>Run JSON</Text>
          <Paragraph copyable={{ text: formatJson(detail.single.run) }}>
            <pre>{formatJson(detail.single.run)}</pre>
          </Paragraph>
        </div>
        <div>
          <Text strong>Image JSON</Text>
          <Paragraph copyable={{ text: formatJson(detail.single.image) }}>
            <pre>{formatJson(detail.single.image)}</pre>
          </Paragraph>
        </div>
      </Flex>
    )
  }

  return (
    <Flex vertical gap={12}>
      <div>
        <Text strong>A JSON</Text>
        <Paragraph copyable={{ text: formatJson(detail.left ? { run: detail.left.run, image: detail.left.image } : null) }}>
          <pre>{formatJson(detail.left ? { run: detail.left.run, image: detail.left.image } : null)}</pre>
        </Paragraph>
      </div>
      <div>
        <Text strong>B JSON</Text>
        <Paragraph copyable={{ text: formatJson(detail.right ? { run: detail.right.run, image: detail.right.image } : null) }}>
          <pre>{formatJson(detail.right ? { run: detail.right.run, image: detail.right.image } : null)}</pre>
        </Paragraph>
      </div>
    </Flex>
  )
}

export function PreviewInfoPanel(input: {
  detail?: PreviewDetail | null
  compareMode: PreviewCompareMode
  onCopyPrompt?: (entry: PreviewDetailEntry) => void
  onCopyParams?: (entry: PreviewDetailEntry) => void
  onReusePrompt?: (entry: PreviewDetailEntry) => void
  onReplayRun?: (entry: PreviewDetailEntry) => void
}) {
  const { detail } = input

  if (!detail) {
    return (
      <div className="preview-info-panel min-h-0 min-w-0 overflow-auto rounded-2xl border border-[#e3eaf4] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-3 py-2">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前图片暂无可展示详情。" />
      </div>
    )
  }

  const items = [
    {
      key: 'overview',
      label: '概览',
      children: detail.mode === 'single' ? (
        <EntryCard
          title={`当前图片 #${detail.seq}`}
          entry={detail.single}
          onCopyPrompt={input.onCopyPrompt}
          onCopyParams={input.onCopyParams}
          onReusePrompt={input.onReusePrompt}
          onReplayRun={input.onReplayRun}
        />
      ) : (
        <Flex vertical gap={12}>
          <Alert
            type="info"
            showIcon
            message={`A/B 对比 · ${compareModeLabel(input.compareMode)} · 序号 #${detail.seq}`}
          />
          {buildABWarnings(detail).map((warning) => (
            <Alert key={warning} type="warning" showIcon message={warning} />
          ))}
          <div className="preview-info-columns grid grid-cols-1 gap-3 xl:grid-cols-2">
            <EntryCard
              title="A 侧"
              entry={detail.left}
              onCopyPrompt={input.onCopyPrompt}
              onCopyParams={input.onCopyParams}
              onReusePrompt={input.onReusePrompt}
              onReplayRun={input.onReplayRun}
            />
            <EntryCard
              title="B 侧"
              entry={detail.right}
              onCopyPrompt={input.onCopyPrompt}
              onCopyParams={input.onCopyParams}
              onReusePrompt={input.onReusePrompt}
              onReplayRun={input.onReplayRun}
            />
          </div>
        </Flex>
      ),
    },
  ]

  if (detail.mode === 'ab') {
    const leftSummary = detail.left ? buildEntrySummary(detail.left) : null
    const rightSummary = detail.right ? buildEntrySummary(detail.right) : null
    items.push({
      key: 'diff',
      label: '差异',
      children: (
        <Flex vertical gap={12}>
          <DiffRow label="模型" left={leftSummary?.model ?? '缺图'} right={rightSummary?.model ?? '缺图'} />
          <DiffRow label="渠道" left={leftSummary?.channel ?? '缺图'} right={rightSummary?.channel ?? '缺图'} />
          <DiffRow label="Prompt" left={leftSummary?.prompt ?? '缺图'} right={rightSummary?.prompt ?? '缺图'} />
          <DiffRow label="尺寸" left={leftSummary?.size ?? '缺图'} right={rightSummary?.size ?? '缺图'} />
          <DiffRow label="请求地址" left={leftSummary?.requestAddress ?? '缺图'} right={rightSummary?.requestAddress ?? '缺图'} />
          <DiffRow label="参数快照(JSON)" left={leftSummary?.params ?? '缺图'} right={rightSummary?.params ?? '缺图'} />
          <DiffRow label="生成设置(JSON)" left={leftSummary?.settings ?? '缺图'} right={rightSummary?.settings ?? '缺图'} />
        </Flex>
      ),
    })
  }

  items.push({
    key: 'raw',
    label: '原始 JSON',
    children: <PreviewJsonPanel detail={detail} />,
  })

  return (
    <div className="preview-info-panel min-h-0 min-w-0 overflow-auto rounded-2xl border border-[#e3eaf4] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-3 py-2">
      <Tabs items={items} />
    </div>
  )
}
