import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Run } from '../../../../types/conversation'
import type { ImageItem } from '../../../../types/image'
import { ResolvedSuccessRunImage } from './ResolvedSuccessRunImage'

class IntersectionObserverMock {
  static instances: IntersectionObserverMock[] = []

  private readonly callback: IntersectionObserverCallback
  private target: Element | null = null

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    IntersectionObserverMock.instances.push(this)
  }

  observe(target: Element) {
    this.target = target
  }

  unobserve() {}

  disconnect() {}

  emit(entry: Partial<IntersectionObserverEntry>) {
    this.callback(
      [{
        isIntersecting: false,
        intersectionRatio: 0,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        target: this.target ?? document.createElement('div'),
        time: 0,
        ...entry,
      } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
}

function makeRun(image: ImageItem): Run {
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
    templatePrompt: 'template',
    finalPrompt: 'final prompt',
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
      autoSave: true,
    },
    retryAttempt: 0,
    images: [image],
  }
}

describe('ResolvedSuccessRunImage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    IntersectionObserverMock.instances = []
  })

  it('resolves previews only near the viewport and releases them after leaving it', async () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock as unknown as typeof IntersectionObserver)

    const image: ImageItem = {
      id: 'image-1',
      seq: 1,
      status: 'success',
      refKind: 'idb-blob',
      refKey: 'asset:image-1',
    }
    const cleanup = vi.fn()
    const resolveImagePreviewSource = vi.fn().mockResolvedValue({
      src: 'blob:generated-1',
      cleanup,
    })

    render(
      <div className="message-list-viewport">
        <ResolvedSuccessRunImage
          run={makeRun(image)}
          image={image}
          seq={1}
          linkedRun={undefined}
          placeholder={{ variant: 'missing', label: '缺少图片' }}
          compact={false}
          isHovering={false}
          onOpenPreview={vi.fn()}
          resolveImagePreviewSource={resolveImagePreviewSource}
        />
      </div>,
    )

    await waitFor(() => {
      expect(IntersectionObserverMock.instances).toHaveLength(1)
    })
    expect(resolveImagePreviewSource).not.toHaveBeenCalled()
    expect(screen.queryByAltText('image-1')).toBeNull()
    expect(screen.getByText('滚动到此处加载预览')).toBeInTheDocument()

    act(() => {
      IntersectionObserverMock.instances[0]?.emit({ isIntersecting: true, intersectionRatio: 1 })
    })

    await waitFor(() => {
      expect(screen.getByAltText('image-1')).toHaveAttribute('src', 'blob:generated-1')
    })
    expect(resolveImagePreviewSource).toHaveBeenCalledTimes(1)

    act(() => {
      IntersectionObserverMock.instances[0]?.emit({ isIntersecting: false, intersectionRatio: 0 })
    })

    await waitFor(() => {
      expect(screen.queryByAltText('image-1')).toBeNull()
    })
    expect(screen.getByText('滚动到此处加载预览')).toBeInTheDocument()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('keeps the same preview source when unrelated props change', async () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock as unknown as typeof IntersectionObserver)

    const image: ImageItem = {
      id: 'image-stable',
      seq: 1,
      status: 'success',
      refKind: 'idb-blob',
      refKey: 'asset:image-stable',
      queuedAt: '2026-01-01T00:00:00.000Z',
      startedAt: '2026-01-01T00:00:01.000Z',
      completedAt: '2026-01-01T00:00:03.000Z',
    }
    const cleanup = vi.fn()
    const resolveImagePreviewSource = vi.fn().mockResolvedValue({
      src: 'blob:generated-stable',
      cleanup,
    })
    const run = makeRun(image)
    const onOpenPreview = vi.fn()

    const { rerender } = render(
      <div className="message-list-viewport">
        <ResolvedSuccessRunImage
          run={run}
          image={image}
          seq={1}
          linkedRun={undefined}
          placeholder={{ variant: 'missing', label: '缺少图片' }}
          compact={false}
          isHovering={false}
          onOpenPreview={onOpenPreview}
          resolveImagePreviewSource={resolveImagePreviewSource}
        />
      </div>,
    )

    await waitFor(() => {
      expect(IntersectionObserverMock.instances).toHaveLength(1)
    })

    act(() => {
      IntersectionObserverMock.instances[0]?.emit({ isIntersecting: true, intersectionRatio: 1 })
    })

    await waitFor(() => {
      expect(screen.getByAltText('image-1')).toHaveAttribute('src', 'blob:generated-stable')
    })
    expect(resolveImagePreviewSource).toHaveBeenCalledTimes(1)

    rerender(
      <div className="message-list-viewport">
        <ResolvedSuccessRunImage
          run={run}
          image={image}
          seq={1}
          linkedRun={undefined}
          placeholder={{ variant: 'missing', label: '缺少图片' }}
          compact={false}
          isHovering={true}
          onOpenPreview={onOpenPreview}
          resolveImagePreviewSource={resolveImagePreviewSource}
          elapsedNow={Date.parse('2026-01-01T00:00:10.000Z')}
        />
      </div>,
    )

    act(() => {
      IntersectionObserverMock.instances.at(-1)?.emit({ isIntersecting: true, intersectionRatio: 1 })
    })

    await waitFor(() => {
      expect(screen.getByAltText('image-1')).toHaveAttribute('src', 'blob:generated-stable')
    })
  })
})
