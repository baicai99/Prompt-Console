import { Collapse, Descriptions, Empty, Flex, Modal, Tabs, Typography } from 'antd'
import type { ImageItem } from '../../../../types/image'
import type { Run } from '../../../../types/conversation'
import { getRunRequestAddress } from './messageListUtils'

const { Paragraph, Text } = Typography

interface PreviewImageDetailsModalProps {
  open: boolean
  run?: Run | null
  image?: ImageItem | null
  onClose: () => void
}

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

export function PreviewImageDetailsModal({ open, run, image, onClose }: PreviewImageDetailsModalProps) {
  const requestAddress = run ? getRunRequestAddress(run) : '未记录'

  return (
    <Modal
      title="图片详情"
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
      destroyOnHidden
    >
      {!run || !image ? (
        <Empty description="当前图片暂无可展示详情。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Tabs
          defaultActiveKey="overview"
          items={[
            {
              key: 'overview',
              label: '概览',
              children: (
                <Flex vertical gap={16}>
                  <Descriptions
                    bordered
                    column={1}
                    size="small"
                    items={[
                      { key: 'run-id', label: 'Run ID', children: run.id },
                      { key: 'image-id', label: '图片 ID', children: image.id },
                      { key: 'batch-id', label: 'Batch ID', children: run.batchId || '未记录' },
                      { key: 'seq', label: '序号', children: image.seq },
                      { key: 'status', label: '状态', children: image.status },
                      { key: 'model', label: '模型', children: run.modelName || run.modelId || '未记录' },
                      { key: 'channel', label: '渠道', children: run.channelName ?? run.channelId ?? '未记录' },
                      { key: 'request', label: '请求地址', children: <Text copyable={requestAddress !== '未记录'}>{requestAddress}</Text> },
                      { key: 'prompt', label: '最终 Prompt', children: <Paragraph>{run.finalPrompt || '未记录'}</Paragraph> },
                    ]}
                  />

                  <Collapse
                    defaultActiveKey={['run', 'image']}
                    items={[
                      {
                        key: 'run',
                        label: 'Run 信息',
                        children: (
                          <Descriptions
                            bordered
                            column={1}
                            size="small"
                            items={[
                              { key: 'run-created-at', label: '创建时间', children: formatValue(run.createdAt) },
                              { key: 'run-template-prompt', label: '模板 Prompt', children: formatValue(run.templatePrompt, '无') },
                              { key: 'run-variables', label: '变量快照', children: <Paragraph copyable>{formatJson(run.variablesSnapshot)}</Paragraph> },
                              { key: 'run-params', label: '参数快照', children: <Paragraph copyable>{formatJson(run.paramsSnapshot)}</Paragraph> },
                              { key: 'run-settings', label: '生成设置', children: <Paragraph copyable>{formatJson(run.settingsSnapshot)}</Paragraph> },
                              { key: 'run-source-images', label: '参考图', children: <Paragraph copyable>{formatJson(run.sourceImages ?? [])}</Paragraph> },
                              { key: 'run-attempts', label: '尝试记录', children: <Paragraph copyable>{formatJson(run.attempts ?? [])}</Paragraph> },
                              { key: 'run-task-ids', label: '任务 ID 列表', children: <Paragraph copyable>{formatJson(run.taskIds ?? [])}</Paragraph> },
                            ]}
                          />
                        ),
                      },
                      {
                        key: 'image',
                        label: '图片信息',
                        children: (
                          <Descriptions
                            bordered
                            column={1}
                            size="small"
                            items={[
                              { key: 'image-width', label: '宽度', children: formatValue(image.width) },
                              { key: 'image-height', label: '高度', children: formatValue(image.height) },
                              { key: 'image-bytes', label: '大小(bytes)', children: formatValue(image.bytes) },
                              { key: 'image-ref-kind', label: '引用类型', children: formatValue(image.refKind) },
                              { key: 'image-ref-key', label: '引用 Key', children: formatValue(image.refKey) },
                              { key: 'image-file-ref', label: 'fileRef', children: formatValue(image.fileRef) },
                              { key: 'image-thumb-ref', label: 'thumbRef', children: formatValue(image.thumbRef) },
                              { key: 'image-full-ref', label: 'fullRef', children: formatValue(image.fullRef) },
                              { key: 'image-request-url', label: 'requestUrl', children: formatValue(image.requestUrl) },
                              { key: 'image-provider-status', label: 'providerTaskStatus', children: formatValue(image.providerTaskStatus) },
                              { key: 'image-thread-state', label: 'threadState', children: formatValue(image.threadState) },
                              { key: 'image-resume-transport', label: 'resumeTransport', children: formatValue(image.resumeTransport) },
                              { key: 'image-server-task-id', label: 'serverTaskId', children: formatValue(image.serverTaskId) },
                              { key: 'image-server-task-meta', label: 'serverTaskMeta', children: <Paragraph copyable>{formatJson(image.serverTaskMeta ?? {})}</Paragraph> },
                              { key: 'image-error-code', label: 'errorCode', children: formatValue(image.errorCode) },
                              { key: 'image-error', label: '错误信息', children: <Paragraph copyable>{formatValue(image.error)}</Paragraph> },
                              { key: 'image-pending-started-at', label: 'pendingStartedAt', children: formatValue(image.pendingStartedAt) },
                              { key: 'image-detached-at', label: 'detachedAt', children: formatValue(image.detachedAt) },
                              { key: 'image-last-resume-at', label: 'lastResumeAttemptAt', children: formatValue(image.lastResumeAttemptAt) },
                            ]}
                          />
                        ),
                      },
                    ]}
                  />
                </Flex>
              ),
            },
            {
              key: 'raw',
              label: '原始 JSON',
              children: (
                <Flex vertical gap={16}>
                  <div>
                    <Text strong>Run JSON</Text>
                    <Paragraph copyable={{ text: formatJson(run) }}>
                      <pre>{formatJson(run)}</pre>
                    </Paragraph>
                  </div>
                  <div>
                    <Text strong>Image JSON</Text>
                    <Paragraph copyable={{ text: formatJson(image) }}>
                      <pre>{formatJson(image)}</pre>
                    </Paragraph>
                  </div>
                </Flex>
              ),
            },
          ]}
        />
      )}
    </Modal>
  )
}
