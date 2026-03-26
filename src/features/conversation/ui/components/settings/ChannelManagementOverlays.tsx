import { ReloadOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  type TableColumnsType,
  Typography,
} from 'antd'
import type { FormInstance } from 'antd'
import type { RefObject } from 'react'
import type {
  ApiChannel,
} from '../../../../../types/channel'
import type { ChannelImportPreviewItem, ChannelModelEntry } from '../../../application/settingsPanelService'
import {
  OFFICIAL_CHANNEL_PRESETS,
  type ChannelSourceType,
} from './officialChannelPresets'

type ChannelFormValues = {
  name: string
  baseUrl: string
  apiKey: string
}

const { Text } = Typography
const MODEL_LIST_DRAWER_SIZE = 'min(820px, calc(100vw - 32px))'

interface ChannelManagementOverlaysProps {
  isDrawerOpen: boolean
  closeChannelManagementDrawer: () => void
  channelDrawerWidth: number | string
  channelTableContainerRef: RefObject<HTMLDivElement | null>
  channelColumns: TableColumnsType<ApiChannel>
  channels: ApiChannel[]
  isRefreshingChannels: boolean
  refreshChannelModels: () => Promise<void>
  openModelListDrawer: (channelId?: string) => void
  openCreateChannelModal: () => void
  isModelListDrawerOpen: boolean
  closeModelListDrawer: () => void
  selectedModelListChannelId: string | null
  setSelectedModelListChannelId: (value: string) => void
  modelSearchInput: string
  setModelSearchInput: (value: string) => void
  setModelSearchKeyword: (value: string) => void
  modelListViewMode: 'normal' | 'metadata'
  setModelListViewMode: (value: 'normal' | 'metadata') => void
  isModelListLoading: boolean
  selectedModelListChannel: ApiChannel | null
  loadModelListForChannel: (channel: ApiChannel) => Promise<void>
  modelListError: string
  filteredModelListItems: ChannelModelEntry[]
  isModalOpen: boolean
  editingChannelId: string | null
  closeChannelEditorModal: () => void
  setChannelSourceType: (value: ChannelSourceType) => void
  channelSourceType: ChannelSourceType
  selectedOfficialPresetId: string | undefined
  setSelectedOfficialPresetId: (value: string | undefined) => void
  applyOfficialPresetSelection: (presetId: string | undefined) => void
  channelForm: FormInstance<ChannelFormValues>
  isSavingChannel: boolean
  onConfirmChannelModal: () => Promise<void>
  clearChannelImportState: () => void
  channelImportText: string
  setChannelImportText: (value: string) => void
  parseChannelImportText: (text: string) => void
  isApplyingChannelImport: boolean
  applyParsedChannels: () => Promise<void>
  importSummary: {
    total: number
    duplicated: number
    invalid: number
    selected: number
  }
  channelImportDetected: number
  channelImportError: string
  channelImportItems: ChannelImportPreviewItem[]
  channelImportColumns: TableColumnsType<ChannelImportPreviewItem>
}

export function ChannelManagementOverlays(props: ChannelManagementOverlaysProps) {
  const {
    isDrawerOpen,
    closeChannelManagementDrawer,
    channelDrawerWidth,
    channelTableContainerRef,
    channelColumns,
    channels,
    isRefreshingChannels,
    refreshChannelModels,
    openModelListDrawer,
    openCreateChannelModal,
    isModelListDrawerOpen,
    closeModelListDrawer,
    selectedModelListChannelId,
    setSelectedModelListChannelId,
    modelSearchInput,
    setModelSearchInput,
    setModelSearchKeyword,
    modelListViewMode,
    setModelListViewMode,
    isModelListLoading,
    selectedModelListChannel,
    loadModelListForChannel,
    modelListError,
    filteredModelListItems,
    isModalOpen,
    editingChannelId,
    closeChannelEditorModal,
    setChannelSourceType,
    channelSourceType,
    selectedOfficialPresetId,
    setSelectedOfficialPresetId,
    applyOfficialPresetSelection,
    channelForm,
    isSavingChannel,
    onConfirmChannelModal,
    clearChannelImportState,
    channelImportText,
    setChannelImportText,
    parseChannelImportText,
    isApplyingChannelImport,
    applyParsedChannels,
    importSummary,
    channelImportDetected,
    channelImportError,
    channelImportItems,
    channelImportColumns,
  } = props

  return (
    <>
      <Drawer
        title="API 渠道管理"
        open={isDrawerOpen}
        onClose={closeChannelManagementDrawer}
        size={channelDrawerWidth}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              loading={isRefreshingChannels}
              title="Refresh model list"
              onClick={() => {
                void refreshChannelModels()
              }}
            />
            <Button onClick={() => openModelListDrawer()}>查看模型</Button>
            <Button
              type="primary"
              onClick={openCreateChannelModal}
            >
              新增渠道
            </Button>
          </Space>
        }
      >
        <div ref={channelTableContainerRef}>
          <Table<ApiChannel>
            className="channel-management-table"
            rowKey="id"
            columns={channelColumns}
            dataSource={channels}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: '暂无渠道，先新增一个' }}
          />
        </div>
        <Drawer
          title="模型列表"
          placement="right"
          open={isModelListDrawerOpen}
          size={MODEL_LIST_DRAWER_SIZE}
          styles={{ body: { paddingBottom: 16, overflowY: 'auto' } }}
          onClose={closeModelListDrawer}
        >
          <Space orientation="vertical" className="w-full" size={12}>
            <Space wrap>
              <Select
                style={{ minWidth: 320 }}
                value={selectedModelListChannelId ?? undefined}
                options={channels.map((item) => ({ label: item.name, value: item.id }))}
                onChange={(value) => setSelectedModelListChannelId(value)}
              />
              <Input
                style={{ width: 220 }}
                value={modelSearchInput}
                placeholder="搜索模型（支持模糊）"
                allowClear
                onChange={(event) => setModelSearchInput(event.target.value)}
                onPressEnter={() => setModelSearchKeyword(modelSearchInput)}
              />
              <Button onClick={() => setModelSearchKeyword(modelSearchInput)}>搜索</Button>
              <Segmented<'normal' | 'metadata'>
                value={modelListViewMode}
                options={[
                  { label: '普通模式', value: 'normal' },
                  { label: '元数据模式', value: 'metadata' },
                ]}
                onChange={(value) => setModelListViewMode(value)}
              />
              <Button
                icon={<ReloadOutlined />}
                loading={isModelListLoading}
                disabled={!selectedModelListChannel}
                onClick={() => {
                  if (!selectedModelListChannel) {
                    return
                  }
                  void loadModelListForChannel(selectedModelListChannel)
                }}
              >
                刷新
              </Button>
            </Space>
            {modelListError ? <Alert type="error" title={modelListError} /> : null}
            <Table<ChannelModelEntry>
              size="small"
              rowKey={(row) => row.id}
              loading={isModelListLoading}
              dataSource={filteredModelListItems}
              pagination={{ pageSize: 8, showSizeChanger: false, placement: ['bottomCenter'] }}
              locale={{ emptyText: modelListError ? '读取失败' : '没有匹配的模型' }}
              scroll={{ x: 700, y: 360 }}
              columns={
                modelListViewMode === 'normal'
                  ? [
                      {
                        title: '模型 ID',
                        dataIndex: 'id',
                        key: 'id',
                      },
                    ]
                  : [
                      {
                        title: '模型 ID',
                        dataIndex: 'id',
                        key: 'id',
                        width: 260,
                      },
                      {
                        title: '元数据',
                        key: 'metadata',
                        render: (_: unknown, row: ChannelModelEntry) => (
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontSize: 12,
                              lineHeight: 1.45,
                            }}
                          >
                            {JSON.stringify(row.metadata ?? { id: row.id }, null, 2)}
                          </pre>
                        ),
                      },
                  ]
              }
            />
          </Space>
        </Drawer>
      </Drawer>

      <Modal
        title={editingChannelId ? '编辑渠道' : '新增渠道'}
        open={isModalOpen}
        centered
        width={760}
        zIndex={1200}
        cancelText="取消"
        okText="确定"
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
        confirmLoading={isSavingChannel}
        onCancel={() => {
          closeChannelEditorModal()
        }}
        onOk={() => {
          void onConfirmChannelModal()
        }}
      >
        <Space orientation="vertical" className="w-full" size={12}>
          <Form layout="vertical">
            <Form.Item label="批量文本导入" style={{ marginBottom: 8 }}>
              <Input.TextArea
                value={channelImportText}
                autoSize={{ minRows: 6, maxRows: 10 }}
                placeholder="粘贴包含 Base URL 与 API Key 的复杂文本，系统会自动提取可导入渠道。"
                onChange={(event) => setChannelImportText(event.target.value)}
              />
            </Form.Item>
          </Form>
          <Space>
            <Button
              size="small"
              onClick={() => {
                if (!channelImportText.trim()) {
                  clearChannelImportState()
                  return
                }
                parseChannelImportText(channelImportText)
              }}
            >
              自动提取
            </Button>
            <Button size="small" onClick={clearChannelImportState}>
              清空
            </Button>
            <Button
              size="small"
              type="primary"
              loading={isApplyingChannelImport}
              disabled={channelImportItems.length === 0}
              onClick={() => {
                void applyParsedChannels()
              }}
            >
              应用导入
            </Button>
          </Space>
          <Text type="secondary">
            已识别条目 {importSummary.total}，事件 {channelImportDetected}，重复 {importSummary.duplicated}，无效 {importSummary.invalid}，待导入{' '}
            {importSummary.selected}
          </Text>
          {channelImportError ? <Alert type="error" title={channelImportError} /> : null}
          {channelImportItems.length > 0 ? (
            <Table<ChannelImportPreviewItem>
              size="small"
              rowKey="id"
              columns={channelImportColumns}
              dataSource={channelImportItems}
              pagination={false}
              scroll={{ x: 760 }}
            />
          ) : null}

          <Form form={channelForm} layout="vertical" autoComplete="off">
            <Form.Item label="渠道类型" style={{ marginBottom: 12 }}>
              <Segmented<ChannelSourceType>
                value={channelSourceType}
                options={[
                  { label: '第三方', value: 'third-party' },
                  { label: '官方', value: 'official' },
                ]}
                onChange={(nextType) => {
                  setChannelSourceType(nextType)
                  if (nextType === 'third-party') {
                    setSelectedOfficialPresetId(undefined)
                    return
                  }
                  const defaultPreset = OFFICIAL_CHANNEL_PRESETS.find((item) => item.supported)
                  applyOfficialPresetSelection(selectedOfficialPresetId ?? defaultPreset?.id)
                }}
              />
            </Form.Item>
            {channelSourceType === 'official' ? (
              <>
                <Form.Item label="官方供应商" style={{ marginBottom: 12 }}>
                  <Select
                    value={selectedOfficialPresetId}
                    placeholder="选择官方 API 供应商"
                    options={OFFICIAL_CHANNEL_PRESETS.map((item) => ({
                      label: item.supported ? item.label : `${item.label}（暂不支持）`,
                      value: item.id,
                      disabled: !item.supported,
                    }))}
                    onChange={(value) => applyOfficialPresetSelection(value)}
                  />
                </Form.Item>
                <Alert
                  type="info"
                  showIcon
                  title="官方渠道会自动填充推荐 Base URL，并保留你当前填写的名称。"
                />
              </>
            ) : null}
            <Form.Item
              name="name"
              label="名称"
              rules={[{ required: true, message: '请输入渠道名称' }]}
            >
              <Input placeholder="例如：OpenAI / Gemini / 自建代理" />
            </Form.Item>
            <Form.Item
              name="baseUrl"
              label="Base URL"
              rules={[{ required: true, message: '请输入 Base URL' }]}
            >
              <Input placeholder="https://api.example.com/v1" />
            </Form.Item>
            <Form.Item
              name="apiKey"
              label="API Key"
              rules={[{ required: true, message: '请输入 API Key' }]}
            >
              <Input.Password placeholder="sk-..." autoComplete="new-password" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </>
  )
}
