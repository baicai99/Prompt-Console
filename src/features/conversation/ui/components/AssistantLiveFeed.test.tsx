import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LiveFeedItem, Run } from '../../../../types/conversation'
import { AssistantLiveFeed } from './AssistantLiveFeed'

function makeRun(): Run {
  return {
    id: 'run-1',
    batchId: 'batch-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    sideMode: 'single',
    side: 'single',
    prompt: 'prompt',
    imageCount: 1,
    channelId: null,
    channelName: null,
    modelId: 'model-1',
    modelName: 'Model 1',
    templatePrompt: 'prompt',
    finalPrompt: 'prompt',
    variablesSnapshot: {},
    paramsSnapshot: {},
    settingsSnapshot: {
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount: 1,
      gridColumns: 1,
      sizeMode: 'preset',
      customWidth: 1024,
      customHeight: 1024,
      autoSave: false,
    },
    retryAttempt: 0,
    images: [
      {
        id: 'img-1',
        seq: 1,
        status: 'failed',
        error: 'request timeout',
        errorCode: 'timeout',
      },
    ],
  }
}

function makeItem(): LiveFeedItem {
  return {
    id: 'feed-1',
    taskId: 'task-1',
    runId: 'run-1',
    batchId: 'batch-1',
    side: 'single',
    seq: 1,
    finalPrompt: 'prompt',
    status: 'timeout',
    completedAt: '2026-01-01T00:00:00.000Z',
    image: {
      id: 'img-1',
      seq: 1,
      status: 'failed',
      error: 'request timeout',
      errorCode: 'timeout',
    },
  }
}

describe('AssistantLiveFeed', () => {
  it('reuses the shared placeholder for failed items', () => {
    render(
      <AssistantLiveFeed
        items={[makeItem()]}
        runsById={new Map<string, Run>([['run-1', makeRun()]])}
        onOpenPreview={() => {}}
      />,
    )

    expect(screen.getByText('已超时')).toBeInTheDocument()
    expect(document.querySelector('.run-image-placeholder.is-timeout')).not.toBeNull()
    expect(document.querySelector('.run-image-placeholder-label')).not.toBeNull()
  })

  it('shows waiting-to-retry state when the image is queued for another timeout round', () => {
    const item = makeItem()
    item.image.error = '第1轮超时，图片已标记超时，正在等待第2轮（60s）'

    render(
      <AssistantLiveFeed
        items={[item]}
        runsById={new Map<string, Run>([['run-1', makeRun()]])}
        onOpenPreview={() => {}}
      />,
    )

    expect(screen.getByText('等待重试')).toBeInTheDocument()
    expect(document.querySelector('.run-image-placeholder.is-retry-waiting')).not.toBeNull()
  })
})
