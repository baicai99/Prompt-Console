import { memo } from 'react'
import { Card, Collapse, Descriptions, Divider, Empty, Flex, Modal, Space, Tabs, Tag, Typography } from 'antd'
import type { Run } from '../../../../types/conversation'
import { formatParamSnapshot, getRunRequestAddress } from './messageListUtils'

const { Paragraph, Text, Title } = Typography

interface AssistantParamsModalProps {
  open: boolean
  runs: Run[]
  onClose: () => void
}

function getRunSummaryTags(run: Run) {
  return [
    { key: 'resolution', label: `分辨率: ${run.settingsSnapshot.resolution}` },
    { key: 'ratio', label: `画幅: ${run.settingsSnapshot.aspectRatio}` },
    { key: 'count', label: `张数: ${run.settingsSnapshot.imageCount}` },
    { key: 'columns', label: `列数: ${run.settingsSnapshot.gridColumns}` },
    { key: 'sizeMode', label: `尺寸模式: ${run.settingsSnapshot.sizeMode}` },
    { key: 'autoSave', label: `自动保存: ${run.settingsSnapshot.autoSave ? '开' : '关'}` },
  ]
}

function getPromptText(value: string | undefined, fallback = '无') {
  return value?.trim() || fallback
}

function getTabPromptLabel(run: Run) {
  const text = getPromptText(run.finalPrompt)
  return text.length > 18 ? `${text.slice(0, 18)}...` : text
}

function renderRunCard(run: Run, index: number, defaultActiveKey: string[]) {
  const requestAddress = getRunRequestAddress(run)
  const variables = formatParamSnapshot(run.variablesSnapshot)
  const params = formatParamSnapshot(run.paramsSnapshot)
  const channel = run.channelName ?? run.channelId ?? '未记录'
  const model = run.modelName ?? run.modelId ?? '未记录'
  const customSize = `${run.settingsSnapshot.customWidth} x ${run.settingsSnapshot.customHeight}`

  return (
    <Card
      key={run.id}
      title={`Run #${index + 1}`}
      variant="outlined"
    >
      <Flex vertical gap={16}>
        <Space orientation="vertical" size={4}>
          <Title level={5}>概览</Title>
          <Descriptions
            bordered
            column={1}
            size="small"
            items={[
              {
                key: 'model',
                label: '模型',
                children: <Text strong>{model}</Text>,
              },
              {
                key: 'channel',
                label: '渠道',
                children: channel,
              },
              {
                key: 'requestAddress',
                label: '请求地址',
                children: <Text copyable={requestAddress !== '未记录'}>{requestAddress}</Text>,
              },
              {
                key: 'finalPrompt',
                label: '最终 prompt',
                children: <Paragraph>{getPromptText(run.finalPrompt)}</Paragraph>,
              },
              {
                key: 'batchId',
                label: 'Batch ID',
                children: run.batchId || '未记录',
              },
            ]}
          />
        </Space>

        <Space size={[8, 8]} wrap>
          {getRunSummaryTags(run).map((item) => (
            <Tag key={item.key} variant="filled" color="blue">
              {item.label}
            </Tag>
          ))}
        </Space>

        <Divider />

        <Collapse
          defaultActiveKey={defaultActiveKey}
          items={[
            {
              key: 'basic',
              label: '基础信息',
              children: (
                <Descriptions
                  bordered
                  column={1}
                  size="small"
                  items={[
                    {
                      key: 'basic-model',
                      label: '模型',
                      children: `模型: ${model}`,
                    },
                    {
                      key: 'basic-model-id',
                      label: '模型 ID',
                      children: `模型 ID: ${run.modelId || '未记录'}`,
                    },
                    {
                      key: 'basic-channel',
                      label: '渠道',
                      children: `渠道: ${channel}`,
                    },
                    {
                      key: 'basic-request',
                      label: '请求地址',
                      children: `请求地址: ${requestAddress}`,
                    },
                    {
                      key: 'basic-created-at',
                      label: '创建时间',
                      children: `创建时间: ${run.createdAt || '未记录'}`,
                    },
                  ]}
                />
              ),
            },
            {
              key: 'prompt',
              label: 'Prompt 信息',
              children: (
                <Descriptions
                  bordered
                  column={1}
                  size="small"
                  items={[
                    {
                      key: 'prompt-template',
                      label: '模板 prompt',
                      children: `模板 prompt: ${getPromptText(run.templatePrompt)}`,
                    },
                    {
                      key: 'prompt-final',
                      label: '最终 prompt',
                      children: `最终 prompt: ${getPromptText(run.finalPrompt)}`,
                    },
                    {
                      key: 'prompt-variables',
                      label: '变量',
                      children: `变量: ${variables}`,
                    },
                  ]}
                />
              ),
            },
            {
              key: 'settings',
              label: '生成设置',
              children: (
                <Descriptions
                  bordered
                  column={1}
                  size="small"
                  items={[
                    {
                      key: 'settings-ratio',
                      label: '画幅 / 分辨率 / 张数 / 列数',
                      children:
                        `画幅 / 分辨率 / 张数 / 列数: ${run.settingsSnapshot.aspectRatio} / ${run.settingsSnapshot.resolution} / ` +
                        `${run.settingsSnapshot.imageCount} / ${run.settingsSnapshot.gridColumns}`,
                    },
                    {
                      key: 'settings-size',
                      label: '尺寸模式 / 自定义尺寸',
                      children: `尺寸模式 / 自定义尺寸: ${run.settingsSnapshot.sizeMode} / ${customSize}`,
                    },
                    {
                      key: 'settings-auto-save',
                      label: '自动保存',
                      children: `自动保存: ${run.settingsSnapshot.autoSave ? '开' : '关'}`,
                    },
                  ]}
                />
              ),
            },
            {
              key: 'params',
              label: '参数快照',
              children: (
                <Descriptions
                  bordered
                  column={1}
                  size="small"
                  items={[
                    {
                      key: 'params-snapshot',
                      label: '参数',
                      children: `参数: ${params}`,
                    },
                  ]}
                />
              ),
            },
            {
              key: 'ids',
              label: '标识信息',
              children: (
                <Descriptions
                  bordered
                  column={1}
                  size="small"
                  items={[
                    {
                      key: 'ids-batch',
                      label: 'Batch ID',
                      children: `Batch ID: ${run.batchId || '未记录'}`,
                    },
                    {
                      key: 'ids-run',
                      label: 'Run ID',
                      children: `Run ID: ${run.id || '未记录'}`,
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Flex>
    </Card>
  )
}

function AssistantParamsModalComponent({ open, runs, onClose }: AssistantParamsModalProps) {
  const isSingleRun = runs.length === 1

  return (
    <Modal
      title="生成参数"
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnHidden
    >
      {runs.length === 0 ? (
        <Empty description="暂无可展示的参数。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : isSingleRun ? (
        renderRunCard(runs[0], 0, ['basic', 'prompt'])
      ) : (
        <Tabs
          defaultActiveKey={runs[0]?.id}
          items={runs.map((run, index) => ({
            key: run.id,
            label: (
              <Flex vertical gap={2}>
                <Text strong>{`Run #${index + 1}`}</Text>
                <Text type="secondary">{getTabPromptLabel(run)}</Text>
              </Flex>
            ),
            children: renderRunCard(run, index, ['prompt']),
          }))}
        />
      )}
    </Modal>
  )
}

export const AssistantParamsModal = memo(AssistantParamsModalComponent)
