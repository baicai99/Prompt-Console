import { useEffect } from 'react'
import { Button, Card, Drawer, Flex, Space, Switch, Table, Typography } from 'antd'
import type { PanelValueFormat, PanelVariableRow } from '../../domain/types'
import { ComposerAdvancedPanel } from './ComposerAdvancedPanel'
import {
  useComposerAdvancedPanelController,
  type AdvancedTabKey,
} from './useComposerAdvancedPanelController'

const { Text } = Typography

interface DynamicPromptPanelProps {
  showAdvancedVariables: boolean
  dynamicPromptEnabled: boolean
  requestedTab?: AdvancedTabKey | null
  openRequestToken?: number
  panelValueFormat: PanelValueFormat
  panelVariables: PanelVariableRow[]
  resolvedVariables: Record<string, string>
  finalPromptPreview: string
  missingKeys: string[]
  unusedVariableKeys: string[]
  panelBatchError: string
  panelMismatchRowIds: string[]
  onPanelValueFormatChange: (value: PanelValueFormat) => void
  onPanelVariablesChange: (rows: PanelVariableRow[]) => void
  onAdvancedFeaturesEnabledChange: (value: boolean) => void
  requestComposerFocus: () => void
}

export function DynamicPromptPanel(props: DynamicPromptPanelProps) {
  const {
    showAdvancedVariables,
    dynamicPromptEnabled,
    requestedTab,
    openRequestToken,
    panelValueFormat,
    panelVariables,
    resolvedVariables,
    finalPromptPreview,
    missingKeys,
    unusedVariableKeys,
    panelBatchError,
    panelMismatchRowIds,
    onPanelValueFormatChange,
    onPanelVariablesChange,
    onAdvancedFeaturesEnabledChange,
    requestComposerFocus,
  } = props

  const {
    advancedTab,
    applySyncPreview,
    bulkDetectedFormat,
    bulkDraftRows,
    bulkExportFormat,
    bulkParseError,
    bulkText,
    closeSyncPreview,
    openPreviewBulkToTable,
    openPreviewTableToBulk,
    panelColumns,
    panelValueFormatOptions,
    setAdvancedTab,
    setBulkExportFormat,
    syncError,
    syncPreview,
    updateBulkFromText,
    valueHintByFormat,
  } = useComposerAdvancedPanelController({
    onFocusComposer: requestComposerFocus,
    onPanelValueFormatChange,
    onPanelVariablesChange,
    panelMismatchRowIds,
    panelValueFormat,
    panelVariables,
  })

  useEffect(() => {
    if (!requestedTab) {
      return
    }
    setAdvancedTab(requestedTab)
  }, [openRequestToken, requestedTab, setAdvancedTab])

  const isDynamicPromptEnabled = showAdvancedVariables || dynamicPromptEnabled

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <Space orientation="vertical" size={12} className="w-full">
          <Card size="small">
            <Flex align="center" justify="space-between" gap={16}>
              <Space orientation="vertical" size={2} style={{ minWidth: 0 }}>
                <Text strong>启用动态提示词</Text>
                <Text type="secondary">使用模板变量生成最终 prompt，编辑器内容保存在当前工作区设置中。</Text>
              </Space>
              <Switch checked={isDynamicPromptEnabled} onChange={onAdvancedFeaturesEnabledChange} />
            </Flex>
          </Card>

          <ComposerAdvancedPanel
            advancedTab={advancedTab}
            setAdvancedTab={setAdvancedTab}
            panelValueFormatOptions={panelValueFormatOptions}
            panelValueFormat={panelValueFormat}
            onPanelValueFormatChange={onPanelValueFormatChange}
            valueHintByFormat={valueHintByFormat}
            onPanelVariablesChange={onPanelVariablesChange}
            panelVariables={panelVariables}
            bulkExportFormat={bulkExportFormat}
            setBulkExportFormat={setBulkExportFormat}
            openPreviewTableToBulk={openPreviewTableToBulk}
            panelColumns={panelColumns}
            bulkText={bulkText}
            updateBulkFromText={updateBulkFromText}
            bulkDetectedFormat={bulkDetectedFormat}
            bulkDraftRows={bulkDraftRows}
            openPreviewBulkToTable={openPreviewBulkToTable}
            bulkParseError={bulkParseError}
            syncError={syncError}
            panelBatchError={panelBatchError}
            resolvedVariables={resolvedVariables}
            finalPromptPreview={finalPromptPreview}
            missingKeys={missingKeys}
            unusedVariableKeys={unusedVariableKeys}
          />
        </Space>
      </div>

      <Drawer
        title={syncPreview?.title}
        placement="right"
        open={Boolean(syncPreview)}
        size={560}
        zIndex={1300}
        styles={{ body: { padding: 0, overflow: 'hidden' } }}
        onClose={closeSyncPreview}
        footer={(
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={closeSyncPreview}>取消</Button>
            <Button type="primary" onClick={applySyncPreview}>
              确认同步
            </Button>
          </Space>
        )}
      >
        {syncPreview ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pt-2.5 pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <Space orientation="vertical" className="w-full" size={8}>
                <Text>
                  变更摘要：新增 {syncPreview.preview.added}，更新 {syncPreview.preview.updated}，删除 {syncPreview.preview.removed}
                </Text>
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  dataSource={syncPreview.preview.details}
                  columns={[
                    { title: 'key', dataIndex: 'key' },
                    { title: '变更', dataIndex: 'type' },
                    {
                      title: '前 -> 后',
                      render: (_: unknown, row: { before?: string[]; after?: string[] }) =>
                        `${(row.before ?? []).join(' | ')} -> ${(row.after ?? []).join(' | ')}`,
                    },
                  ]}
                />
              </Space>
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  )
}
