import { Button, Checkbox, Input, Popconfirm, Select, Space, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ApiChannel, ImportAction } from '../../../../../types/channel'
import type { ChannelImportPreviewItem } from '../../../application/settingsPanelService'
import { maskApiKey } from './settingsPanelHelpers'

const { Text } = Typography

interface BuildChannelColumnsInput {
  channels: ApiChannel[]
  clearChannelImportState: () => void
  onChannelsChange: (channels: ApiChannel[]) => void
  openModelListDrawer: (channelId?: string) => void
  onEditChannel: (channel: ApiChannel) => void
}

export function buildChannelImportColumns(
  updateImportItem: (itemId: string, patch: Partial<ChannelImportPreviewItem>) => void,
): ColumnsType<ChannelImportPreviewItem> {
  return [
    {
      title: '选择',
      key: 'selected',
      width: 76,
      render: (_: unknown, row: ChannelImportPreviewItem) => (
        <Checkbox
          checked={row.selected}
          disabled={row.status === 'invalid'}
          onChange={(event) => updateImportItem(row.id, { selected: event.target.checked })}
        />
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (value: string, row: ChannelImportPreviewItem) => (
        <Input
          size="small"
          disabled={row.status === 'invalid'}
          value={value}
          onChange={(event) => updateImportItem(row.id, { name: event.target.value })}
        />
      ),
    },
    {
      title: 'Base URL',
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      ellipsis: true,
    },
    {
      title: 'API Key',
      dataIndex: 'apiKey',
      key: 'apiKey',
      render: (value: string) => maskApiKey(value),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: unknown, row: ChannelImportPreviewItem) => {
        if (row.status === 'invalid') {
          return <Text type="danger">无效：{row.invalidReason}</Text>
        }
        return <Text>{row.status === 'duplicate' ? '重复（可覆盖）' : '新增'}</Text>
      },
    },
    {
      title: '处理策略',
      key: 'action',
      width: 190,
      render: (_: unknown, row: ChannelImportPreviewItem) => (
        <Select<ImportAction>
          size="small"
          value={row.action}
          disabled={row.status === 'invalid'}
          options={[
            { label: '新增', value: 'create' },
            { label: '覆盖', value: 'overwrite', disabled: row.status !== 'duplicate' },
            { label: '跳过', value: 'skip' },
          ]}
          onChange={(value) => updateImportItem(row.id, { action: value })}
        />
      ),
    },
  ]
}

export function buildChannelColumns(input: BuildChannelColumnsInput): ColumnsType<ApiChannel> {
  const {
    channels,
    clearChannelImportState,
    onChannelsChange,
    openModelListDrawer,
    onEditChannel,
  } = input

  return [
    {
      title: '供应商名称',
      dataIndex: 'name',
      key: 'name',
      render: (value: string) => <span style={{ whiteSpace: 'nowrap' }}>{value}</span>,
    },
    {
      title: 'Base URL',
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      render: (value: string) => <span style={{ whiteSpace: 'nowrap' }}>{value}</span>,
    },
    {
      title: 'API Key',
      dataIndex: 'apiKey',
      key: 'apiKey',
      render: (value: string) => maskApiKey(value),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, row: ApiChannel) => (
        <Space size={8} style={{ whiteSpace: 'nowrap' }}>
          <Button
            size="small"
            onClick={() => {
              openModelListDrawer(row.id)
            }}
          >
            模型列表
          </Button>
          <Button
            size="small"
            onClick={() => {
              clearChannelImportState()
              onEditChannel(row)
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该渠道？"
            onConfirm={() => {
              onChannelsChange(channels.filter((item) => item.id !== row.id))
            }}
          >
            <Button danger size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]
}
