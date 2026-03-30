import type { Dispatch, SetStateAction } from 'react'
import { Alert, Button, Card, Col, Flex, Form, Row, Select, Switch, Typography, theme } from 'antd'
import type { ApiChannel } from '../../../../../types/channel'
import type { ModelSpec } from '../../../../../types/model'
import type { SettingPrimitive } from '../../../../../types/primitives'
import type { Side, SingleSideSettings } from '../../../../../types/conversation'
import { buildJimengVirtualChannel, JIMENG_VIRTUAL_CHANNEL_ID } from '../../../../../services/jimengVirtualChannel'
import { settingsPanelService } from '../../../application/settingsPanelService'
import {
  isBatchDownloadBlockedForParamValues,
  URL_RESPONSE_FORMAT_BATCH_DOWNLOAD_HINT,
} from '../../../domain/batchDownload'
import {
  filterModelsByTag,
  inferModelSearchTokens,
  inferModelTags,
  isBlockedImageModel,
  isBlockedTextModel,
  isBlockedVideoModel,
} from '../../../domain/modelCatalogDomain'
import { buildChannelSelectionPatch } from './channelSelectionPatch'
import { renderParamInput } from './settingsPanelHelpers'

const { Text } = Typography
const ALL_MODEL_TAG = '__all__'
const {
  isSaveDirectoryReady,
  pickSaveDirectory,
} = settingsPanelService

interface SideSettingsFormProps {
  side: Side
  settingsBySide: Record<Side, SingleSideSettings>
  modelTagBySide: Record<Side, string>
  setModelTagBySide: Dispatch<SetStateAction<Record<Side, string>>>
  channels: ApiChannel[]
  models: ModelSpec[]
  availableModelTags: string[]
  onSettingsChange: (side: Side, patch: Partial<SingleSideSettings>) => void
  onModelChange: (side: Side, modelId: string) => void
  onModelParamChange: (side: Side, paramKey: string, value: SettingPrimitive) => void
  messageApi: {
    warning: (content: string) => void
    success: (content: string) => void
    error: (content: string) => void
  }
  onOpenChannelDrawer: () => void
  includeOutputSection?: boolean
  includeChannelSection?: boolean
  includeImageModelParamsSection?: boolean
}

export function SideSettingsForm(props: SideSettingsFormProps) {
  const {
    side,
    settingsBySide,
    modelTagBySide,
    setModelTagBySide,
    channels,
    models,
    availableModelTags,
    onSettingsChange,
    onModelChange,
    onModelParamChange,
    messageApi,
    onOpenChannelDrawer,
    includeOutputSection = true,
    includeChannelSection = true,
    includeImageModelParamsSection = true,
  } = props
  const { token } = theme.useToken()

  const settings = settingsBySide[side]
  if (!settings) {
    return <Text type="secondary">当前窗口配置不可用</Text>
  }

  const selectedTag = modelTagBySide[side] ?? ALL_MODEL_TAG
  const currentChannel = channels.find((item) => item.id === settings.channelId)
    ?? (settings.channelId === JIMENG_VIRTUAL_CHANNEL_ID ? buildJimengVirtualChannel() : null)
  const filteredModels = filterModelsByTag(models, selectedTag, ALL_MODEL_TAG)
  const imageModels = filteredModels.filter((item) => !isBlockedImageModel({ id: item.id, name: item.name }))
  const textModels = filteredModels.filter((item) => !isBlockedTextModel({ id: item.id, name: item.name }))
  const videoModels = filteredModels.filter((item) => !isBlockedVideoModel({ id: item.id, name: item.name }))
  const activeImageModel = imageModels.find((item) => item.id === settings.modelId)
  const activeTextModel =
    textModels.find((item) => item.id === (settings.textModelId ?? settings.modelId)) ?? textModels[0]
  const activeVideoModel =
    videoModels.find((item) => item.id === (settings.videoModelId ?? settings.modelId)) ?? videoModels[0]
  const hasSelectedDirectory = isSaveDirectoryReady(settings.saveDirectory)
  const isTextMode = settings.generationMode === 'text'
  const isBatchDownloadBlocked = isBatchDownloadBlockedForParamValues(settings.paramValues)
  const formItemStyle = { marginBottom: token.marginXS }

  const buildModelPatch = (modelId: string, field: 'modelId' | 'textModelId' | 'videoModelId') => {
    const selectedModel = models.find((item) => item.id === modelId)
    return {
      [field]: modelId,
      ...(selectedModel?.channelId ? { channelId: selectedModel.channelId } : {}),
      ...(field === 'modelId' ? { paramValues: {} } : {}),
    } as Partial<SingleSideSettings>
  }

  return (
    <Flex vertical gap={token.sizeSM} style={{ width: '100%' }}>
      {includeOutputSection ? (
        <Card size="small" styles={{ body: { padding: token.paddingSM } }}>
          <Flex vertical gap={token.sizeXS}>
            <Text strong>输出与保存</Text>
            <Flex align="center" justify="space-between" gap={token.sizeSM}>
              <Text strong>自动保存到本地</Text>
              <Switch
                checked={hasSelectedDirectory ? settings.autoSave : false}
                disabled={!hasSelectedDirectory || isTextMode}
                onChange={(checked) => onSettingsChange(side, { autoSave: checked })}
              />
            </Flex>
            <Row gutter={[token.sizeSM, token.sizeSM]} align="middle">
              <Col xs={24} lg={16}>
                <Text type="secondary">
                  {isTextMode
                    ? '文本模式不会输出图片文件，自动保存暂不可用。'
                    : hasSelectedDirectory
                      ? '保存路径已授权，可以直接开启自动保存。'
                      : '请先选择并授权保存路径，再开启自动保存。'}
                </Text>
              </Col>
              <Col xs={24} lg={8}>
                <Button
                  block
                  disabled={isTextMode}
                  onClick={async () => {
                    try {
                      const result = await pickSaveDirectory()
                      if (!result) {
                        messageApi.warning('当前环境不支持路径选择，无法开启自动保存')
                        return
                      }
                      onSettingsChange(side, { saveDirectory: result.saveDirectory })
                      messageApi.success(`已选择保存路径：${result.directoryName}`)
                    } catch (error) {
                      const reason = error instanceof Error ? error.message : '选择目录失败'
                      messageApi.error(reason)
                    }
                  }}
                >
                  选择保存路径
                </Button>
              </Col>
            </Row>

            {isTextMode ? (
              <Alert type="info" showIcon title="文本模式将调用 /v1/chat/completions 流式接口。" />
            ) : null}
          </Flex>
        </Card>
      ) : null}

      <Card
        size="small"
        styles={{ body: { padding: token.paddingSM } }}
        title={includeChannelSection ? '渠道与模型' : '模型与参数'}
        extra={
          includeChannelSection ? (
            <Button type="link" style={{ paddingInline: 0 }} onClick={onOpenChannelDrawer}>
              管理渠道
            </Button>
          ) : null
        }
      >
        <Form layout="vertical">
          <Row gutter={[token.sizeSM, 0]}>
            {includeChannelSection ? (
              <Col xs={24} md={12}>
                <Form.Item label="生成渠道" style={formItemStyle}>
                  <Select
                    className="w-full"
                    placeholder="选择生成渠道"
                    value={settings.channelId ?? undefined}
                    options={channels.map((item) => ({ label: item.name, value: item.id }))}
                    onChange={(value) => {
                      onSettingsChange(side, buildChannelSelectionPatch({ value, settings, channels, models }))
                    }}
                    allowClear
                  />
                </Form.Item>
              </Col>
            ) : null}

            <Col xs={24} md={12}>
              <Form.Item label="模型分类" style={formItemStyle}>
                <Select
                  value={selectedTag}
                  options={[
                    { label: '全部', value: ALL_MODEL_TAG },
                    ...availableModelTags.map((tag) => ({ label: tag, value: tag })),
                  ]}
                  onChange={(value) => {
                    setModelTagBySide((prev) => ({ ...prev, [side]: value }))

                    if (value === ALL_MODEL_TAG) {
                      return
                    }

                    const vendorModels = models.filter((item) => inferModelTags(item).includes(value))
                    const scopedVendorImageModels = vendorModels.filter(
                      (item) => !isBlockedImageModel({ id: item.id, name: item.name }),
                    )
                    const scopedVendorTextModels = vendorModels.filter(
                      (item) => !isBlockedTextModel({ id: item.id, name: item.name }),
                    )
                    const scopedVendorVideoModels = vendorModels.filter(
                      (item) => !isBlockedVideoModel({ id: item.id, name: item.name }),
                    )
                    const currentMatches = scopedVendorImageModels.some((item) => item.id === settings.modelId)
                    const currentTextMatches = scopedVendorTextModels.some(
                      (item) => item.id === (settings.textModelId ?? settings.modelId),
                    )
                    const currentVideoMatches = scopedVendorVideoModels.some(
                      (item) => item.id === (settings.videoModelId ?? settings.modelId),
                    )
                    if (!currentMatches && scopedVendorImageModels[0]) {
                      onModelChange(side, scopedVendorImageModels[0].id)
                    }
                    if (!currentTextMatches && scopedVendorTextModels[0]) {
                      onSettingsChange(side, buildModelPatch(scopedVendorTextModels[0].id, 'textModelId'))
                    }
                    if (!currentVideoMatches && scopedVendorVideoModels[0]) {
                      onSettingsChange(side, buildModelPatch(scopedVendorVideoModels[0].id, 'videoModelId'))
                    }
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="图片模型" style={formItemStyle}>
                <Select
                  showSearch
                  value={activeImageModel?.id}
                  options={imageModels.map((item) => ({ label: item.name, value: item.id }))}
                  optionFilterProp="label"
                  filterOption={(input, option) => {
                    const keyword = input.trim().toLowerCase()
                    const value = String(option?.value ?? '')
                    const model = imageModels.find((item) => item.id === value)
                    const label = String(option?.label ?? '').toLowerCase()
                    const id = value.toLowerCase()
                    const aliases = model ? inferModelSearchTokens(model) : ''
                    const haystack = `${label} ${id} ${aliases}`
                    return haystack.includes(keyword)
                  }}
                  onChange={(value) => onModelChange(side, value)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="文本模型" style={formItemStyle}>
                <Select
                  showSearch
                  value={activeTextModel?.id}
                  options={textModels.map((item) => ({ label: item.name, value: item.id }))}
                  optionFilterProp="label"
                  filterOption={(input, option) => {
                    const keyword = input.trim().toLowerCase()
                    const value = String(option?.value ?? '')
                    const model = textModels.find((item) => item.id === value)
                    const label = String(option?.label ?? '').toLowerCase()
                    const id = value.toLowerCase()
                    const aliases = model ? inferModelSearchTokens(model) : ''
                    const haystack = `${label} ${id} ${aliases}`
                    return haystack.includes(keyword)
                  }}
                  onChange={(value) => onSettingsChange(side, buildModelPatch(value, 'textModelId'))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="视频模型" style={{ marginBottom: 0 }}>
                <Select
                  showSearch
                  value={activeVideoModel?.id}
                  options={videoModels.map((item) => ({ label: item.name, value: item.id }))}
                  optionFilterProp="label"
                  filterOption={(input, option) => {
                    const keyword = input.trim().toLowerCase()
                    const value = String(option?.value ?? '')
                    const model = videoModels.find((item) => item.id === value)
                    const label = String(option?.label ?? '').toLowerCase()
                    const id = value.toLowerCase()
                    const aliases = model ? inferModelSearchTokens(model) : ''
                    const haystack = `${label} ${id} ${aliases}`
                    return haystack.includes(keyword)
                  }}
                  onChange={(value) => onSettingsChange(side, buildModelPatch(value, 'videoModelId'))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {includeImageModelParamsSection ? (
        <Card size="small" styles={{ body: { padding: token.paddingSM } }}>
          <Flex vertical gap={token.sizeXS}>
            <Text strong>当前图片模型参数</Text>
            {activeImageModel ? (
              <>
                {isBatchDownloadBlocked ? (
                  <Alert
                    type="warning"
                    showIcon
                    title={URL_RESPONSE_FORMAT_BATCH_DOWNLOAD_HINT}
                    description="启用 URL 返回格式后，“下载全部”和“下载这一批次”会被禁用。"
                  />
                ) : null}
                <Row gutter={[token.sizeSM, token.sizeXS]}>
                  {activeImageModel.params.map((param) => (
                    <Col key={param.key} xs={24} md={12}>
                      <Text>{param.label}</Text>
                      <div style={{ marginTop: 4 }}>
                        {renderParamInput(param, settings.paramValues[param.key], (next) =>
                          onModelParamChange(side, param.key, next),
                        )}
                      </div>
                    </Col>
                  ))}
                </Row>
              </>
            ) : (
              <Text type="secondary">
                {currentChannel ? '当前没有可用的图片模型，请检查已配置供应商并刷新模型列表。' : '请先新增并选择一个渠道。'}
              </Text>
            )}
          </Flex>
        </Card>
      ) : null}
    </Flex>
  )
}
