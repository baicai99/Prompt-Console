import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Button, Empty, Flex, Spin, Tag, Typography } from 'antd'
import type {
  PreviewCompareMode,
  PreviewPane,
  PreviewPair,
  TransformState,
} from '../../../../../hooks/useImagePreview'
import type { PreviewImage } from '../../../../../types/image'
import type { ResolveImagePreviewSource } from '../useResolvedImagePreview'
import { useResolvedImagePreview } from '../useResolvedImagePreview'

const { Text } = Typography

function getPreviewImageIdentity(image?: PreviewImage): string {
  if (!image) {
    return 'empty'
  }

  return `${image.id}:${image.refKind ?? ''}:${image.refKey ?? image.src ?? ''}`
}

function PreviewStatusCard(input: {
  variant: 'loading' | 'missing' | 'error'
  text: string
  onRetry?: () => void
}) {
  if (input.variant === 'loading') {
    return (
      <Flex className="preview-status-card min-h-[180px] w-full max-w-[320px] rounded-2xl border border-dashed border-[rgba(125,140,163,0.45)] bg-[rgba(255,255,255,0.75)] p-5 backdrop-blur" vertical align="center" justify="center" gap={12}>
        <Spin size="large" />
        <Text type="secondary">{input.text}</Text>
      </Flex>
    )
  }

  return (
    <Flex className="preview-status-card min-h-[180px] w-full max-w-[320px] rounded-2xl border border-dashed border-[rgba(125,140,163,0.45)] bg-[rgba(255,255,255,0.75)] p-5 backdrop-blur" vertical align="center" justify="center" gap={12}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={input.text} />
      {input.variant === 'error' && input.onRetry ? (
        <Button onClick={input.onRetry}>重试</Button>
      ) : null}
    </Flex>
  )
}

function buildTransformStyle(transform: TransformState, imageStyle?: CSSProperties): CSSProperties {
  return {
    ...imageStyle,
    transform: `translate(${transform.offset.x}px, ${transform.offset.y}px) scale(${transform.zoom})`,
  }
}

function PreviewAssetImage(input: {
  image?: PreviewImage
  seq?: number
  transform: TransformState
  emptyText: string
  imageClassName?: string
  imageStyle?: CSSProperties
  onLoad?: () => void
  resolveImagePreviewSource?: ResolveImagePreviewSource
  wrapperClassName?: string
}) {
  const { src, status, retry } = useResolvedImagePreview({
    source: input.image,
    resolveImagePreviewSource: input.resolveImagePreviewSource,
    request: { priority: 'modal' },
  })
  const sourceIdentity = getPreviewImageIdentity(input.image)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasRenderError, setHasRenderError] = useState(false)

  useEffect(() => {
    setIsLoaded(false)
    setHasRenderError(false)
  }, [sourceIdentity])

  if (status === 'loading') {
    return <PreviewStatusCard variant="loading" text="加载预览中" />
  }

  if (!src || status === 'missing') {
    return <PreviewStatusCard variant="missing" text={input.emptyText} />
  }

  if (status === 'error' || hasRenderError) {
    return <PreviewStatusCard variant="error" text="图片解析失败" onRetry={retry} />
  }

  return (
    <div className={`${input.wrapperClassName ?? 'preview-stage-image-shell'} grid h-full w-full place-items-center overflow-hidden`}>
      {!isLoaded ? (
        <div className="preview-stage-image-overlay pointer-events-none absolute inset-0 z-[1] grid place-items-center">
          <Spin />
        </div>
      ) : null}
      <img
        key={sourceIdentity}
        className={`${input.imageClassName ?? 'preview-image'} block max-h-full max-w-full object-contain [transform-origin:center_center] transition-transform duration-75 linear will-change-transform`}
        src={src}
        alt={`preview-${input.seq ?? '-'}`}
        draggable={false}
        onLoad={() => {
          setIsLoaded(true)
          input.onLoad?.()
        }}
        onError={() => {
          setHasRenderError(true)
        }}
        style={{
          ...buildTransformStyle(input.transform, input.imageStyle),
          opacity: isLoaded ? 1 : 0,
        }}
      />
    </div>
  )
}

export function SinglePreviewStage(input: {
  currentPreviewImage?: PreviewImage
  transform: TransformState
  singleImageStyle?: CSSProperties
  recalcSingleFitScale: () => void
  onStageImageLoad?: () => void
  resolveImagePreviewSource?: ResolveImagePreviewSource
}) {
  return (
    <div className="preview-image-wrap grid h-full w-full place-items-center overflow-hidden">
      <PreviewAssetImage
        image={input.currentPreviewImage}
        seq={input.currentPreviewImage?.seq}
        transform={input.transform}
        emptyText="无可预览图片"
        imageClassName={input.singleImageStyle ? 'preview-image preview-image-single' : 'preview-image'}
        imageStyle={input.singleImageStyle}
        onLoad={() => {
          input.recalcSingleFitScale()
          input.onStageImageLoad?.()
        }}
        resolveImagePreviewSource={input.resolveImagePreviewSource}
      />
    </div>
  )
}

function ComparePane(input: {
  label: 'A' | 'B'
  image?: PreviewImage
  seq?: number
  transform: TransformState
  isActive: boolean
  emptyText: string
  resolveImagePreviewSource?: ResolveImagePreviewSource
  onActivate?: () => void
  onImageLoad?: () => void
}) {
  return (
    <div
      className={`preview-ab-pane flex min-h-0 flex-col gap-1.5 rounded-[14px] border bg-[rgba(255,255,255,0.88)] p-2.5 ${input.isActive ? 'is-active border-[#3578e5] shadow-[0_0_0_2px_rgba(53,120,229,0.12)]' : 'border-[rgba(125,140,163,0.24)]'}`}
      data-preview-pane={input.label === 'A' ? 'left' : 'right'}
      onPointerDown={() => input.onActivate?.()}
    >
      <Flex align="center" justify="space-between">
        <Text strong>{input.label}</Text>
        {input.isActive ? <Tag color="blue">当前</Tag> : null}
      </Flex>
      <div className="preview-ab-image-wrap grid min-h-0 flex-1 place-items-center">
        <PreviewAssetImage
          image={input.image}
          seq={input.seq}
          transform={input.transform}
          emptyText={input.emptyText}
          onLoad={input.onImageLoad}
          resolveImagePreviewSource={input.resolveImagePreviewSource}
        />
      </div>
    </div>
  )
}

function OverlayControls(input: {
  compareMode: PreviewCompareMode
  value: number
  onChange: (value: number) => void
}) {
  const label = input.compareMode === 'swipe' ? '滑块位置' : '叠加透明度'

  return (
    <div className="preview-compare-slider inline-flex items-center gap-3 rounded-full border border-[rgba(125,140,163,0.2)] bg-[rgba(255,255,255,0.88)] px-[14px] py-2">
      <Text type="secondary">{label}</Text>
      <input
        className="preview-compare-range w-[min(240px,40vw)]"
        aria-label={label}
        type="range"
        min={0}
        max={100}
        value={Math.round(input.value * 100)}
        onChange={(event) => {
          input.onChange(Number(event.target.value) / 100)
        }}
      />
      <Text>{Math.round(input.value * 100)}%</Text>
    </div>
  )
}

function CompareOverlayStage(input: {
  pair?: PreviewPair
  transform: TransformState
  compareMode: PreviewCompareMode
  resolveImagePreviewSource?: ResolveImagePreviewSource
  onImageLoad?: () => void
}) {
  const [ratio, setRatio] = useState(0.5)
  const baseImage = input.pair?.left
  const overlayImage = input.pair?.right

  useEffect(() => {
    setRatio(0.5)
  }, [input.compareMode, input.pair?.seq])

  const overlayStyle = useMemo<CSSProperties>(() => {
    if (input.compareMode === 'swipe') {
      return {
        clipPath: `inset(0 ${Math.max(0, (1 - ratio) * 100)}% 0 0)`,
      }
    }

    if (input.compareMode === 'overlay') {
      return {
        opacity: ratio,
      }
    }

    return {
      mixBlendMode: 'difference',
      opacity: 1,
    }
  }, [input.compareMode, ratio])

  if (!baseImage && !overlayImage) {
    return <PreviewStatusCard variant="missing" text="当前序号暂无可对比图片" />
  }

  return (
    <div className="preview-compare-overlay-shell flex h-full w-full flex-col gap-3 p-2.5">
      <div className="preview-compare-overlay-canvas relative min-h-0 flex-1 overflow-hidden rounded-[14px] border border-[rgba(125,140,163,0.24)] bg-[rgba(255,255,255,0.86)]">
        {baseImage ? (
          <PreviewAssetImage
            image={baseImage}
            seq={input.pair?.seq}
            transform={input.transform}
            emptyText="A 侧该序号无图"
            onLoad={input.onImageLoad}
            resolveImagePreviewSource={input.resolveImagePreviewSource}
            wrapperClassName="preview-overlay-image-layer"
          />
        ) : (
          <div className="preview-overlay-image-layer grid h-full w-full place-items-center overflow-hidden">
            <PreviewStatusCard variant="missing" text="A 侧该序号无图" />
          </div>
        )}
        {overlayImage ? (
          <div className="preview-overlay-top-layer absolute inset-0" style={overlayStyle}>
            <PreviewAssetImage
              image={overlayImage}
              seq={input.pair?.seq}
              transform={input.transform}
              emptyText="B 侧该序号无图"
              onLoad={input.onImageLoad}
              resolveImagePreviewSource={input.resolveImagePreviewSource}
              wrapperClassName="preview-overlay-image-layer"
            />
          </div>
        ) : (
          <div className="preview-overlay-top-layer absolute inset-0">
            <PreviewStatusCard variant="missing" text="B 侧该序号无图" />
          </div>
        )}
        <div className="preview-compare-badges absolute top-3 left-3 z-[2] inline-flex gap-1.5">
          <Tag color="blue">A</Tag>
          <Tag color="purple">B</Tag>
          {input.compareMode === 'difference' ? <Tag color="red">difference</Tag> : null}
        </div>
      </div>
      {input.compareMode === 'difference' ? null : (
        <OverlayControls
          compareMode={input.compareMode}
          value={ratio}
          onChange={setRatio}
        />
      )}
    </div>
  )
}

export function ABPreviewStage(input: {
  currentPreviewPair?: PreviewPair
  compareMode: PreviewCompareMode
  sharedTransform: TransformState
  leftTransform: TransformState
  rightTransform: TransformState
  isSyncLocked: boolean
  activePane: PreviewPane
  setActivePane: (pane: PreviewPane) => void
  resolveImagePreviewSource?: ResolveImagePreviewSource
  onStageImageLoad?: () => void
}) {
  if (input.compareMode !== 'split') {
    return (
      <CompareOverlayStage
        pair={input.currentPreviewPair}
        transform={input.sharedTransform}
        compareMode={input.compareMode}
        resolveImagePreviewSource={input.resolveImagePreviewSource}
        onImageLoad={input.onStageImageLoad}
      />
    )
  }

  const leftTransform = input.isSyncLocked ? input.sharedTransform : input.leftTransform
  const rightTransform = input.isSyncLocked ? input.sharedTransform : input.rightTransform

  return (
    <div className="preview-ab-grid grid h-full w-full grid-cols-2 gap-3">
      <ComparePane
        label="A"
        image={input.currentPreviewPair?.left}
        seq={input.currentPreviewPair?.seq}
        transform={leftTransform}
        isActive={input.activePane === 'left'}
        emptyText="A 侧该序号无图"
        resolveImagePreviewSource={input.resolveImagePreviewSource}
        onActivate={() => input.setActivePane('left')}
        onImageLoad={input.onStageImageLoad}
      />
      <ComparePane
        label="B"
        image={input.currentPreviewPair?.right}
        seq={input.currentPreviewPair?.seq}
        transform={rightTransform}
        isActive={input.activePane === 'right'}
        emptyText="B 侧该序号无图"
        resolveImagePreviewSource={input.resolveImagePreviewSource}
        onActivate={() => input.setActivePane('right')}
        onImageLoad={input.onStageImageLoad}
      />
    </div>
  )
}
