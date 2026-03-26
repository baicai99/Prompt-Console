import { memo } from 'react'
import { Button, Tag, Typography } from 'antd'
import type { LiveFeedItem, Run } from '../../../../types/conversation'
import { getResumeTransportLabel, resolveImageDisplayState } from './imageTaskDisplayState'
import { RunImageStatusPlaceholder } from './RunImageStatusPlaceholder'
import { emitUiRenderDebug } from '../../../../services/imageTaskDebug'

const { Text } = Typography

interface AssistantLiveFeedProps {
  items: LiveFeedItem[]
  runsById: Map<string, Run>
  onOpenPreview: (run: Run, imageId: string) => void
  onDownloadSingleImage?: (runId: string, imageId: string) => void
}

function resolveStatusColor(status: LiveFeedItem['status']): string {
  if (status === 'succeeded') {
    return 'success'
  }
  if (status === 'timeout') {
    return 'warning'
  }
  return 'error'
}

function AssistantLiveFeedComponent({
  items,
  runsById,
  onOpenPreview,
  onDownloadSingleImage,
}: AssistantLiveFeedProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="assistant-live-feed">
      {items.map((item, index) => {
        const run = runsById.get(item.runId)
        const src = item.image.thumbRef ?? item.image.fileRef ?? item.image.fullRef ?? item.image.refKey
        const completedLabel = item.completedAt ? new Date(item.completedAt).toLocaleTimeString() : ''
        const transportLabel = getResumeTransportLabel(undefined, item.image)
        const placeholder = resolveImageDisplayState({
          run,
          image: item.image,
        })
        return (
          <div key={item.id} className="assistant-live-feed-item">
            <div className="assistant-live-feed-meta">
              <Text strong>{`#${index + 1}`}</Text>
              <Tag color={resolveStatusColor(item.status)}>{item.status}</Tag>
              {transportLabel ? <Tag>{transportLabel}</Tag> : null}
              <Text type="secondary">{`run=${item.runId} / seq=${item.seq}`}</Text>
              {completedLabel ? <Text type="secondary">{completedLabel}</Text> : null}
            </div>
            <Text className="assistant-live-feed-prompt">{item.finalPrompt}</Text>
            {item.image.status === 'success' && src && run ? (
              <div className="assistant-live-feed-image">
                <button className="image-button" type="button" onClick={() => onOpenPreview(run, item.image.id)}>
                  <img
                    className="run-image run-image-compact"
                    src={src}
                    alt={`feed-${item.seq}`}
                    loading="lazy"
                    decoding="async"
                    onLoad={() => {
                      emitUiRenderDebug({
                        cacheKey: `${item.runId}:${item.image.id}:livefeed-image-loaded`,
                        stage: 'ui_image_rendered',
                        label: '已完成',
                        runId: item.runId,
                        batchId: item.batchId,
                        taskId: item.taskId,
                        imageId: item.image.id,
                        seq: item.seq,
                        model: run?.modelId,
                        channelId: run?.channelId,
                        channelName: run?.channelName,
                        state: item.image.status,
                        detail: { liveFeed: true },
                      })
                    }}
                  />
                </button>
                {onDownloadSingleImage ? (
                  <Button size="small" type="primary" onClick={() => onDownloadSingleImage(item.runId, item.image.id)}>
                    下载
                  </Button>
                ) : null}
              </div>
            ) : (
              <RunImageStatusPlaceholder
                variant={placeholder.variant}
                label={placeholder.label}
                compact
                debugMeta={{
                  runId: item.runId,
                  batchId: item.batchId,
                  taskId: item.taskId,
                  imageId: item.image.id,
                  seq: item.seq,
                  model: run?.modelId,
                  channelId: run?.channelId,
                  channelName: run?.channelName,
                  state: item.image.status,
                  detail: { liveFeed: true },
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export const AssistantLiveFeed = memo(AssistantLiveFeedComponent)
