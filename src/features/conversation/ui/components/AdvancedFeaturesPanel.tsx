import { useMemo } from 'react'
import { Button, Card, Col, Flex, Form, InputNumber, Row, Select, Space, Switch, Typography, theme } from 'antd'
import type { ImageRuntimeSettings } from '../../../../types/conversation'
import type { ModelSpec } from '../../../../types/model'
import { DEFAULT_IMAGE_RUNTIME_SETTINGS, RESUME_POLL_PRESET_SCHEDULES } from '../../../../utils/imageRuntimeSettings'
import { inferModelSearchTokens, isBlockedTextModel } from '../../domain/modelCatalogDomain'

const { Text } = Typography

interface AdvancedFeaturesPanelProps {
  models: ModelSpec[]
  autoRenameConversationTitle: boolean
  autoRenameConversationTitleModelId: string | null
  runConcurrency: number
  runConcurrencyUnlimited: boolean
  imageRuntimeSettings?: ImageRuntimeSettings
  onAutoRenameConversationTitleChange: (enabled: boolean) => void
  onAutoRenameConversationTitleModelIdChange: (value: string | null) => void
  onRunConcurrencyChange: (value: number) => void
  onRunConcurrencyUnlimitedChange: (value: boolean) => void
  onImageRuntimeSettingsChange?: (value: Partial<ImageRuntimeSettings>) => void
}

export function AdvancedFeaturesPanel(props: AdvancedFeaturesPanelProps) {
  const {
    models,
    autoRenameConversationTitle,
    autoRenameConversationTitleModelId,
    runConcurrency,
    runConcurrencyUnlimited,
    imageRuntimeSettings,
    onAutoRenameConversationTitleChange,
    onAutoRenameConversationTitleModelIdChange,
    onRunConcurrencyChange,
    onRunConcurrencyUnlimitedChange,
    onImageRuntimeSettingsChange,
  } = props

  const autoRenameTitleModels = useMemo(
    () => models.filter((item) => !isBlockedTextModel({ id: item.id, name: item.name })),
    [models],
  )
  const { token } = theme.useToken()
  const runtimeSettings = imageRuntimeSettings ?? DEFAULT_IMAGE_RUNTIME_SETTINGS
  const isCustomResumePollSchedule = runtimeSettings.resumePollStrategyMode === 'custom'
  const effectiveSchedule = isCustomResumePollSchedule
    ? runtimeSettings.resumePollSchedule
    : RESUME_POLL_PRESET_SCHEDULES[runtimeSettings.resumePollPreset]

  const updateResumePollSchedule = (nextSchedule: ImageRuntimeSettings['resumePollSchedule']) => {
    onImageRuntimeSettingsChange?.({
      resumePollSchedule: nextSchedule,
    })
  }

  const appendResumePollStep = () => {
    const lastStep = effectiveSchedule[effectiveSchedule.length - 1] ?? DEFAULT_IMAGE_RUNTIME_SETTINGS.resumePollSchedule[0]
    updateResumePollSchedule([
      ...effectiveSchedule,
      {
        elapsedSeconds: lastStep.elapsedSeconds + 30,
        intervalSeconds: lastStep.intervalSeconds,
      },
    ])
  }

  const removeResumePollStep = (index: number) => {
    updateResumePollSchedule(effectiveSchedule.filter((_, stepIndex) => stepIndex !== index))
  }

  const updateResumePollStep = (
    index: number,
    key: 'elapsedSeconds' | 'intervalSeconds',
    rawValue: number | null,
  ) => {
    const fallbackStep = effectiveSchedule[index] ?? DEFAULT_IMAGE_RUNTIME_SETTINGS.resumePollSchedule[0]
    updateResumePollSchedule(
      effectiveSchedule.map((step, stepIndex) =>
        stepIndex === index
          ? {
              ...step,
              [key]: typeof rawValue === 'number' ? rawValue : fallbackStep[key],
            }
          : step,
      ),
    )
  }

  const featureCards = [
    {
      key: 'autoRename',
      title: '自动标题',
      checked: autoRenameConversationTitle,
      onChange: onAutoRenameConversationTitleChange,
    },
    {
      key: 'unlimitedConcurrency',
      title: '不限并发',
      checked: runConcurrencyUnlimited,
      onChange: onRunConcurrencyUnlimitedChange,
    },
    {
      key: 'requestMethodBadge',
      title: '请求角标',
      checked: runtimeSettings.showRequestMethodBadge,
      onChange: (checked: boolean) =>
        onImageRuntimeSettingsChange?.({
          showRequestMethodBadge: checked,
        }),
    },
  ]
  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: token.paddingLG,
      }}
    >
      <Flex vertical gap={token.sizeLG} style={{ width: '100%' }}>
        <Row gutter={[token.sizeMD, token.sizeMD]} align="stretch">
          <Col xs={24} xl={13}>
            <Card size="small" title="功能开关矩阵" style={{ height: '100%' }}>
              <Row gutter={[token.sizeMD, token.sizeMD]}>
                {featureCards.map((item) => (
                  <Col key={item.key} xs={24} md={12}>
                    <Card size="small" styles={{ body: { padding: token.paddingMD } }}>
                      <Flex align="center" justify="space-between" gap={token.sizeSM}>
                        <Text strong style={{ minWidth: 0 }}>{item.title}</Text>
                        <Switch checked={item.checked} onChange={item.onChange} />
                      </Flex>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          <Col xs={24} xl={11}>
            <Card size="small" title="标题与并发策略" style={{ height: '100%' }}>
              <Form layout="vertical">
                <Row gutter={[token.sizeMD, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item label="标题生成模型">
                      <Select
                        showSearch
                        allowClear
                        style={{ width: '100%' }}
                        value={autoRenameConversationTitleModelId ?? undefined}
                        disabled={!autoRenameConversationTitle || autoRenameTitleModels.length === 0}
                        placeholder="选择用于生成对话标题的模型"
                        options={autoRenameTitleModels.map((item) => ({ label: item.name, value: item.id }))}
                        optionFilterProp="label"
                        filterOption={(input, option) => {
                          const keyword = input.trim().toLowerCase()
                          const value = String(option?.value ?? '')
                          const model = autoRenameTitleModels.find((item) => item.id === value)
                          const label = String(option?.label ?? '').toLowerCase()
                          const id = value.toLowerCase()
                          const aliases = model ? inferModelSearchTokens(model) : ''
                          const haystack = `${label} ${id} ${aliases}`
                          return haystack.includes(keyword)
                        }}
                        notFoundContent="暂无可用文本模型"
                        onChange={(value) => onAutoRenameConversationTitleModelIdChange(value ?? null)}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="图片并发">
                      <InputNumber
                        style={{ width: '100%' }}
                        min={1}
                        value={runConcurrency}
                        disabled={runConcurrencyUnlimited}
                        onChange={(value) => onRunConcurrencyChange(typeof value === 'number' ? value : 1)}
                      />
                    </Form.Item>
                  </Col>
                </Row>

              </Form>
            </Card>
          </Col>
        </Row>

        <Card size="small" title="图片运行时">
          <Form layout="vertical">
            <Row gutter={[token.sizeMD, 0]}>
              <Col xs={24} md={12}>
                <Form.Item label="轮询策略模式">
                  <Select
                    data-testid="resume-poll-strategy-mode"
                    value={runtimeSettings.resumePollStrategyMode}
                    options={[
                      { label: '预设策略', value: 'preset' },
                      { label: '自定义分段', value: 'custom' },
                    ]}
                    onChange={(value) =>
                      onImageRuntimeSettingsChange?.({
                        resumePollStrategyMode: value,
                      })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                {isCustomResumePollSchedule ? (
                  <Form.Item label="自定义分段说明">
                    <Text type="secondary">第一段固定从 0 秒开始，后续时间段按开始时间递增。</Text>
                  </Form.Item>
                ) : (
                  <Form.Item label="预设策略">
                    <Select
                      data-testid="resume-poll-preset"
                      value={runtimeSettings.resumePollPreset}
                      options={[
                        { label: '快速', value: 'fast' },
                        { label: '平衡', value: 'balanced' },
                        { label: '省请求', value: 'low_request' },
                      ]}
                      onChange={(value) =>
                        onImageRuntimeSettingsChange?.({
                          resumePollPreset: value,
                        })}
                    />
                  </Form.Item>
                )}
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="生成超时(分钟)">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0.1}
                    max={24 * 60}
                    step={0.1}
                    precision={1}
                    value={runtimeSettings.generationTimeoutMinutes}
                    onChange={(value) =>
                      onImageRuntimeSettingsChange?.({
                        generationTimeoutMinutes:
                          typeof value === 'number' ? value : DEFAULT_IMAGE_RUNTIME_SETTINGS.generationTimeoutMinutes,
                      })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="活跃预览上限">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={4}
                    max={120}
                    precision={0}
                    value={runtimeSettings.maxActivePreviewHandles}
                    onChange={(value) =>
                      onImageRuntimeSettingsChange?.({
                        maxActivePreviewHandles:
                          typeof value === 'number' ? value : DEFAULT_IMAGE_RUNTIME_SETTINGS.maxActivePreviewHandles,
                      })}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={[token.sizeMD, 0]}>
              <Col xs={24} md={12}>
                <Form.Item label="离屏释放延迟(ms)">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={5000}
                    precision={0}
                    value={runtimeSettings.offscreenPreviewReleaseDelayMs}
                    onChange={(value) =>
                      onImageRuntimeSettingsChange?.({
                        offscreenPreviewReleaseDelayMs:
                          typeof value === 'number' ? value : DEFAULT_IMAGE_RUNTIME_SETTINGS.offscreenPreviewReleaseDelayMs,
                      })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="常态保留消息数">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={4}
                    max={200}
                    precision={0}
                    value={runtimeSettings.recentMessageRetentionCount}
                    onChange={(value) =>
                      onImageRuntimeSettingsChange?.({
                        recentMessageRetentionCount:
                          typeof value === 'number' ? value : DEFAULT_IMAGE_RUNTIME_SETTINGS.recentMessageRetentionCount,
                      })}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={[token.sizeMD, 0]}>
              <Col xs={24} md={12}>
                <Form.Item label="高压保留消息数">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={2}
                    max={100}
                    precision={0}
                    value={runtimeSettings.highPressureMessageRetentionCount}
                    onChange={(value) =>
                      onImageRuntimeSettingsChange?.({
                        highPressureMessageRetentionCount:
                          typeof value === 'number' ? value : DEFAULT_IMAGE_RUNTIME_SETTINGS.highPressureMessageRetentionCount,
                      })}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Card size="small" styles={{ body: { padding: token.paddingMD } }}>
              <Flex vertical gap={token.sizeMD}>
                <Flex align="center" justify="space-between" gap={token.sizeMD} wrap>
                  <Text strong>轮询时间分段</Text>
                  {isCustomResumePollSchedule ? (
                    <Button onClick={appendResumePollStep}>新增分段</Button>
                  ) : (
                    <Text type="secondary">预设模式下按策略自动生成时间分段。</Text>
                  )}
                </Flex>
                <Space orientation="vertical" size={token.sizeSM} style={{ width: '100%' }}>
                  {effectiveSchedule.map((step, index) => (
                    <Card
                      key={`${step.elapsedSeconds}-${step.intervalSeconds}-${index}`}
                      size="small"
                      styles={{ body: { padding: token.paddingSM } }}
                    >
                      <Row gutter={[token.sizeSM, token.sizeSM]} align="middle">
                        <Col xs={24} md={9}>
                          <Form.Item label="起始时间(秒)" style={{ marginBottom: 0 }}>
                            <InputNumber
                              data-testid={`resume-poll-elapsed-${index}`}
                              aria-label={`起始时间(秒)-${index}`}
                              style={{ width: '100%' }}
                              min={0}
                              max={24 * 60 * 60}
                              precision={0}
                              disabled={!isCustomResumePollSchedule || index === 0}
                              value={step.elapsedSeconds}
                              onChange={(value) => updateResumePollStep(index, 'elapsedSeconds', value)}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={9}>
                          <Form.Item label="轮询间隔(秒)" style={{ marginBottom: 0 }}>
                            <InputNumber
                              data-testid={`resume-poll-interval-${index}`}
                              aria-label={`轮询间隔(秒)-${index}`}
                              style={{ width: '100%' }}
                              min={0.1}
                              max={300}
                              step={0.1}
                              precision={1}
                              disabled={!isCustomResumePollSchedule}
                              value={step.intervalSeconds}
                              onChange={(value) => updateResumePollStep(index, 'intervalSeconds', value)}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Flex align="end" justify="flex-end" style={{ height: '100%' }}>
                            <Button
                              danger
                              disabled={!isCustomResumePollSchedule || index === 0}
                              onClick={() => removeResumePollStep(index)}
                            >
                              删除
                            </Button>
                          </Flex>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                </Space>
              </Flex>
            </Card>
            <Card size="small" styles={{ body: { padding: token.paddingMD } }}>
              <Flex align="center" justify="space-between" gap={token.sizeLG} wrap>
                <Text strong>显示请求方法角标</Text>
                <Switch
                  checked={runtimeSettings.showRequestMethodBadge}
                  onChange={(checked) =>
                    onImageRuntimeSettingsChange?.({
                      showRequestMethodBadge: checked,
                    })}
                />
              </Flex>
            </Card>
          </Form>
        </Card>
      </Flex>
    </div>
  )
}
