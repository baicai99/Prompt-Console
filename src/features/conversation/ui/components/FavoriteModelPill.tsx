import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import type { UIEvent } from 'react'
import { StarFilled, StarOutlined } from '@ant-design/icons'
import { Button, Card, Col, Empty, Flex, Form, Input, Row, Select, Skeleton, Spin, Tag, Typography, theme } from 'antd'
import { collectModelCategoryTags } from '../../domain/modelCatalogDomain'
import type { ModelSpec } from '../../../../types/model'
import { resolveVisibleModelsForPicker, splitModelLabel } from './favoriteModelPanelHelpers'

interface FavoriteModelTriggerProps {
  currentModel: Pick<ModelSpec, 'name' | 'sourceName'> | null
  onClick: () => void
  className?: string
  buttonAriaLabel?: string
  fallbackLabel?: string
}

interface FavoriteModelPanelProps {
  isActive?: boolean
  currentModelId: string
  models: ModelSpec[]
  favoriteModelIds: string[]
  onSelectModel: (modelId: string) => void
  onFavoriteModelIdsChange: (modelIds: string[]) => void
  headerTitle?: string
  searchPlaceholder?: string
  emptyText?: string
}

const INITIAL_RENDER_BATCH = 80
const RENDER_BATCH_SIZE = 160
const MODEL_PREPARE_DELAY_MS = 140

export function FavoriteModelTrigger(props: FavoriteModelTriggerProps) {
  const {
    currentModel,
    onClick,
    className,
    buttonAriaLabel,
    fallbackLabel = '添加常用模型',
  } = props
  const triggerLabel = currentModel?.name ?? fallbackLabel
  const triggerLabelParts = splitModelLabel(currentModel)
  const isPlaceholderLabel = currentModel === null

  return (
    <button
      type="button"
      className={[
        'favorite-model-pill',
        'inline-flex',
        'min-h-[34px]',
        'max-w-[308px]',
        'cursor-pointer',
        'items-start',
        'gap-[7px]',
        'rounded-lg',
        'border',
        'border-[#d9d9d9]',
        'bg-[rgba(255,255,255,0.92)]',
        'px-[11px]',
        'pt-[6px]',
        'pb-[6px]',
        'pl-3',
        'text-[#1f1f1f]',
        'shadow-none',
        'transition-[border-color]',
        'duration-150',
        'ease-out',
        'hover:border-[#bfbfbf]',
        className ?? '',
      ].join(' ').trim()}
      aria-label={buttonAriaLabel ?? triggerLabel}
      title={triggerLabel}
      onClick={onClick}
    >
      <span className="favorite-model-pill-content flex min-w-0 flex-1 flex-col items-start gap-px">
        <span className={`favorite-model-pill-label max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-[1.2] ${isPlaceholderLabel ? 'is-placeholder text-[#8c8c8c]' : ''}`}>
          {triggerLabelParts.primary || triggerLabel}
        </span>
        {!isPlaceholderLabel && triggerLabelParts.secondary ? (
          <span className="favorite-model-pill-meta max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-[1.25] text-[#8c8c8c]" title={triggerLabelParts.secondary}>{triggerLabelParts.secondary}</span>
        ) : null}
      </span>
    </button>
  )
}

export function FavoriteModelPanel(props: FavoriteModelPanelProps) {
  const {
    isActive = true,
    currentModelId,
    models,
    favoriteModelIds,
    onSelectModel,
    onFavoriteModelIdsChange,
    headerTitle,
    searchPlaceholder = '搜索模型',
    emptyText = '当前渠道暂无可用模型',
  } = props
  const { token } = theme.useToken()
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState<string | undefined>(undefined)
  const [trainerTagFilter, setTrainerTagFilter] = useState<string | undefined>(undefined)
  const [renderLimit, setRenderLimit] = useState(0)
  const [isPreparingModels, setIsPreparingModels] = useState(true)
  const listRef = useRef<HTMLDivElement | null>(null)

  const favoriteIdsSet = useMemo(() => new Set(favoriteModelIds), [favoriteModelIds])
  const sortedModels = useMemo(() => {
    const favorites = models.filter((model) => favoriteIdsSet.has(model.id))
    const nonFavorites = models.filter((model) => !favoriteIdsSet.has(model.id))
    return [...favorites, ...nonFavorites]
  }, [favoriteIdsSet, models])
  const providerOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: Array<{ label: string; value: string }> = []
    for (const model of models) {
      const provider = getModelProviderLabel(model)
      if (!provider || seen.has(provider)) {
        continue
      }
      seen.add(provider)
      options.push({ label: provider, value: provider })
    }
    return options
  }, [models])
  const trainerTagOptions = useMemo(() => collectModelCategoryTags(models), [models])
  const trainerCategoryOptions = useMemo(
    () => trainerTagOptions.map((tag) => ({ label: tag, value: tag })),
    [trainerTagOptions],
  )
  const visibleModels = useMemo(() => {
    return resolveVisibleModelsForPicker({
      models: sortedModels,
      providerFilter,
      trainerTagFilter,
      search,
    })
  }, [providerFilter, search, sortedModels, trainerTagFilter])
  const visibleSections = useMemo(() => {
    const current = visibleModels.filter((model) => model.id === currentModelId)
    const favorites = visibleModels.filter((model) => model.id !== currentModelId && favoriteIdsSet.has(model.id))
    const others = visibleModels.filter((model) => model.id !== currentModelId && !favoriteIdsSet.has(model.id))

    return [
      { key: 'current', title: '当前模型', models: current },
      { key: 'favorites', title: '已收藏', models: favorites },
      { key: 'all', title: '全部模型', models: others },
    ].filter((section) => section.models.length > 0)
  }, [currentModelId, favoriteIdsSet, visibleModels])
  const totalVisibleModelCount = useMemo(
    () => visibleSections.reduce((sum, section) => sum + section.models.length, 0),
    [visibleSections],
  )
  const shouldDeferRendering = isActive && models.length > INITIAL_RENDER_BATCH
  const renderedSections = useMemo(
    () => resolveRenderedSections(visibleSections, renderLimit),
    [renderLimit, visibleSections],
  )
  const hasMoreModels = totalVisibleModelCount > renderLimit
  const summaryTitle = headerTitle ?? '模型列表'
  const providerColumnSpan = trainerCategoryOptions.length > 0 ? 12 : 24

  useEffect(() => {
    if (!isActive) {
      return
    }
    if (!shouldDeferRendering) {
      setIsPreparingModels(false)
      setRenderLimit(totalVisibleModelCount)
      return
    }
    setIsPreparingModels(true)
    setRenderLimit(0)

    const timerId = window.setTimeout(() => {
      startTransition(() => {
        setRenderLimit(INITIAL_RENDER_BATCH)
        setIsPreparingModels(false)
      })
    }, MODEL_PREPARE_DELAY_MS)

    return () => window.clearTimeout(timerId)
  }, [isActive, shouldDeferRendering, totalVisibleModelCount])

  useEffect(() => {
    if (isPreparingModels) {
      return
    }

    startTransition(() => {
      setRenderLimit((prev) => {
        const nextBase = Math.max(INITIAL_RENDER_BATCH, prev)
        return Math.min(nextBase, totalVisibleModelCount)
      })
    })
    listRef.current?.scrollTo?.({ top: 0 })
  }, [currentModelId, isPreparingModels, providerFilter, search, totalVisibleModelCount, trainerTagFilter])

  const toggleFavorite = (modelId: string) => {
    if (favoriteIdsSet.has(modelId)) {
      onFavoriteModelIdsChange(favoriteModelIds.filter((item) => item !== modelId))
      return
    }
    onFavoriteModelIdsChange([...favoriteModelIds, modelId])
  }

  const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMoreModels || isPreparingModels) {
      return
    }

    const container = event.currentTarget
    const remainingDistance = container.scrollHeight - container.scrollTop - container.clientHeight
    if (remainingDistance > 160) {
      return
    }

    startTransition(() => {
      setRenderLimit((prev) => Math.min(prev + RENDER_BATCH_SIZE, totalVisibleModelCount))
    })
  }

  return (
    <Flex className="favorite-model-panel" vertical gap={token.sizeSM} style={{ minHeight: 0, minWidth: 0, flex: 1 }}>
      <Card
        size="small"
        className="favorite-model-filter-card"
        styles={{ body: { padding: token.paddingSM } }}
      >
        <Flex vertical gap={token.sizeSM}>
          <Flex align="flex-start" justify="space-between" gap={token.sizeXS} wrap>
            <Flex vertical gap={2} style={{ minWidth: 0 }}>
              <Typography.Text strong style={{ fontSize: token.fontSize }}>
                {summaryTitle}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                按关键词、供应商和模型分类筛选，并维护常用模型列表。
              </Typography.Text>
            </Flex>
            <Flex align="center" gap={token.sizeXS} wrap>
              <Tag variant="filled" style={{ marginInlineEnd: 0 }}>
                {visibleModels.length} 个模型
              </Tag>
              {favoriteModelIds.length > 0 ? (
                <Tag variant="filled" color="gold" style={{ marginInlineEnd: 0 }}>
                  {favoriteModelIds.length} 个收藏
                </Tag>
              ) : null}
            </Flex>
          </Flex>

          <Form layout="vertical">
            <Row gutter={[token.sizeXS, 0]}>
              <Col span={24}>
                <Form.Item label="搜索关键词" style={{ marginBottom: token.marginXS }}>
                  <Input
                    size="small"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="favorite-model-search"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={providerColumnSpan}>
                <Form.Item label="供应商" style={{ marginBottom: 0 }}>
                  <Select
                    allowClear
                    size="small"
                    value={providerFilter}
                    options={providerOptions}
                    placeholder="筛选供应商"
                    className="favorite-model-provider-filter"
                    aria-label="筛选供应商"
                    onChange={(value) => setProviderFilter(value)}
                  />
                </Form.Item>
              </Col>
              {trainerCategoryOptions.length > 0 ? (
                <Col xs={24} md={12}>
                  <Form.Item label="模型分类" style={{ marginBottom: 0 }}>
                    <Select
                      allowClear
                      size="small"
                      value={trainerTagFilter}
                      options={trainerCategoryOptions}
                      placeholder="筛选模型分类"
                      className="favorite-model-category-filter"
                      aria-label="筛选模型分类"
                      onChange={(value) => setTrainerTagFilter(value)}
                    />
                  </Form.Item>
                </Col>
              ) : null}
            </Row>
          </Form>
        </Flex>
      </Card>

      <Card
        size="small"
        className="favorite-model-list-card"
        style={{ minHeight: 0, flex: 1 }}
        styles={{ body: { padding: token.paddingXS, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
      >
        {isPreparingModels ? (
          <div className="favorite-model-loading flex min-h-0 flex-1 flex-col gap-2 px-1 pt-1" role="status" aria-live="polite">
            <div className="favorite-model-loading-spinner inline-flex items-center gap-2 text-xs" style={{ color: token.colorTextSecondary, lineHeight: 1.4 }}>
              <Spin size="small" />
              <span>正在加载模型列表</span>
            </div>
            <Skeleton active title={false} paragraph={{ rows: 6 }} />
          </div>
        ) : (
          <div
            ref={listRef}
            className="favorite-model-manage-list flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1"
            onScroll={handleListScroll}
          >
            {renderedSections.length === 0 ? (
              <div className="favorite-model-empty flex min-h-0 flex-1 items-center justify-center px-3 py-4">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
              </div>
            ) : renderedSections.map((section) => (
              <section key={section.key} className="favorite-model-section flex flex-col gap-1.5">
                <div
                  className="favorite-model-section-title sticky top-0 flex items-center justify-between border-b px-2 py-1"
                  style={{
                    background: token.colorBgContainer,
                    borderColor: token.colorBorderSecondary,
                    zIndex: 1,
                  }}
                >
                  <div
                    role="heading"
                    aria-level={2}
                    style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 500, lineHeight: 1.5 }}
                  >
                    {section.title}
                  </div>
                  <Typography.Text type="secondary" aria-hidden="true">
                    {section.models.length} 项
                  </Typography.Text>
                </div>
                {section.models.map((model) => {
                  const isFavorite = favoriteIdsSet.has(model.id)
                  const isCurrent = model.id === currentModelId
                  const labelParts = splitModelLabel(model)
                  const itemBorderColor = isCurrent
                    ? token.colorPrimaryBorder
                    : isFavorite
                      ? token.colorWarningBorder
                      : token.colorBorderSecondary
                  const itemBackground = isCurrent
                    ? token.colorPrimaryBg
                    : isFavorite
                      ? token.colorWarningBg
                      : token.colorBgContainer

                  return (
                    <Card
                      key={model.id}
                      size="small"
                      hoverable
                      className="favorite-model-manage-item"
                      style={{ borderColor: itemBorderColor, background: itemBackground }}
                      styles={{ body: { padding: token.paddingXS } }}
                    >
                      <Flex align="center" justify="space-between" gap={token.sizeXS}>
                        <button
                          type="button"
                          className="favorite-model-manage-item-select flex min-w-0 flex-1 items-center border-none bg-transparent p-0 text-left text-inherit"
                          aria-label={model.name}
                          onClick={() => onSelectModel(model.id)}
                        >
                          <span className="favorite-model-manage-item-main flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="favorite-model-manage-item-header flex min-w-0 items-center gap-1.5">
                              <span
                                className="favorite-model-manage-item-primary min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium"
                                title={model.name}
                                style={{ lineHeight: 1.4, fontSize: token.fontSizeSM }}
                              >
                                {labelParts.primary}
                              </span>
                              {isCurrent ? (
                                <Tag color="blue" variant="filled" style={{ marginInlineEnd: 0 }}>
                                  当前
                                </Tag>
                              ) : null}
                            </span>
                            {labelParts.secondary ? (
                              <span
                                className="favorite-model-manage-item-secondary min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs"
                                title={labelParts.secondary}
                                style={{ color: token.colorTextSecondary, lineHeight: 1.4, fontSize: token.fontSizeSM }}
                              >
                                {labelParts.secondary}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <Button
                          type="text"
                          shape="circle"
                          size="small"
                          className="favorite-model-star-button"
                          icon={isFavorite ? <StarFilled /> : <StarOutlined />}
                          aria-label={isFavorite ? `取消收藏 ${model.name}` : `收藏 ${model.name}`}
                          onClick={() => toggleFavorite(model.id)}
                          style={{ color: isFavorite ? token.colorWarning : token.colorTextTertiary }}
                        />
                      </Flex>
                    </Card>
                  )
                })}
              </section>
            ))}
            {hasMoreModels ? (
              <div className="favorite-model-loading-more flex items-center justify-center gap-2 px-2.5 pt-2 pb-0.5 text-xs" style={{ color: token.colorTextSecondary, lineHeight: 1.5 }}>
                <Spin size="small" />
                <span>{`已显示 ${renderLimit} / ${totalVisibleModelCount} 个模型，继续滚动以加载更多`}</span>
              </div>
            ) : totalVisibleModelCount > 0 ? (
              <div className="favorite-model-loaded-summary flex items-center justify-center gap-2 px-2.5 pt-2 pb-0.5 text-xs" style={{ color: token.colorTextSecondary, lineHeight: 1.5 }}>
                {`已显示全部 ${totalVisibleModelCount} 个模型`}
              </div>
            ) : null}
          </div>
        )}
      </Card>
    </Flex>
  )
}

function getModelProviderLabel(model: Pick<ModelSpec, 'name' | 'sourceName'>): string {
  return splitModelLabel(model).secondary
}

function resolveRenderedSections(
  sections: Array<{ key: string; title: string; models: ModelSpec[] }>,
  limit: number,
) {
  let remaining = limit
  return sections.flatMap((section) => {
    if (remaining <= 0) {
      return []
    }

    const models = section.models.slice(0, remaining)
    remaining -= models.length
    return models.length > 0 ? [{ ...section, models }] : []
  })
}
