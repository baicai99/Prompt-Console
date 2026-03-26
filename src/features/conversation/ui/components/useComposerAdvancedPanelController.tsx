import { useMemo, useState } from 'react'
import { Button, Input } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  buildSyncPreview,
  parseBulkVariables,
  reformatRowsForPanelFormat,
  serializeBulkVariables,
} from '../../domain/panelVariableParsing'
import type { BulkDetectedFormat } from '../../domain/panelVariableParsing'
import type { PanelValueFormat, PanelVariableRow } from '../../domain/types'
import { ensureEditableRows } from './composerHelpers'

export type AdvancedTabKey = 'table' | 'bulk'
type SyncDirection = 'bulk-to-table' | 'table-to-bulk'

export interface SyncPreviewState {
  direction: SyncDirection
  title: string
  nextRows: PanelVariableRow[]
  nextBulkText?: string
  nextDetectedFormat?: BulkDetectedFormat
  preview: ReturnType<typeof buildSyncPreview>
}

interface UseComposerAdvancedPanelControllerInput {
  onFocusComposer: () => void
  onPanelValueFormatChange: (value: PanelValueFormat) => void
  onPanelVariablesChange: (rows: PanelVariableRow[]) => void
  panelMismatchRowIds: string[]
  panelValueFormat: PanelValueFormat
  panelVariables: PanelVariableRow[]
}

export function useComposerAdvancedPanelController(input: UseComposerAdvancedPanelControllerInput) {
  const {
    onFocusComposer,
    onPanelValueFormatChange,
    onPanelVariablesChange,
    panelMismatchRowIds,
    panelValueFormat,
    panelVariables,
  } = input

  const [advancedTab, setAdvancedTab] = useState<AdvancedTabKey>('table')
  const [bulkText, setBulkText] = useState('')
  const [bulkDetectedFormat, setBulkDetectedFormat] = useState<BulkDetectedFormat | ''>('')
  const [bulkParseError, setBulkParseError] = useState('')
  const [bulkDraftRows, setBulkDraftRows] = useState<PanelVariableRow[]>([])
  const [bulkExportFormat, setBulkExportFormat] = useState<BulkDetectedFormat>('json')
  const [syncPreview, setSyncPreview] = useState<SyncPreviewState | null>(null)
  const [syncError, setSyncError] = useState('')
  const mismatchSet = useMemo(() => new Set(panelMismatchRowIds), [panelMismatchRowIds])

  const panelValueFormatOptions: Array<{ label: string; value: PanelValueFormat }> = [
    { label: 'JSON', value: 'json' },
    { label: 'YAML', value: 'yaml' },
    { label: '逐行', value: 'line' },
    { label: 'CSV', value: 'csv' },
    { label: '自动兼容', value: 'auto' },
  ]

  const valuePlaceholderByFormat: Record<PanelValueFormat, string> = {
    json: '["long hair, wavy", "short hair", "black hair"]',
    yaml: '- long hair, wavy\n- short hair\n- black hair',
    line: 'long hair, wavy\nshort hair\nblack hair',
    csv: '"long hair, wavy",short hair,black hair',
    auto: '兼容模式：可输入 JSON/YAML/CSV 或旧格式 a,b,c',
  }

  const valueHintByFormat: Record<PanelValueFormat, string> = {
    json: 'JSON 数组：每项必须是字符串。',
    yaml: 'YAML 列表：每行用 - 开头。',
    line: '逐行模式：仅按换行分项，逗号会保留在项内。',
    csv: 'CSV 模式：包含逗号的项请用双引号包裹。',
    auto: '自动兼容：优先 JSON/YAML/CSV，最后回退旧分隔规则。',
  }

  const updateBulkFromText = (nextText: string) => {
    setBulkText(nextText)
    const parsed = parseBulkVariables(nextText)
    if (!parsed.ok) {
      setBulkParseError(parsed.error)
      setBulkDetectedFormat('')
      setBulkDraftRows([])
      return
    }
    setBulkParseError('')
    setBulkDetectedFormat(parsed.detectedFormat)
    setBulkDraftRows(parsed.rows)
  }

  const openPreviewBulkToTable = () => {
    setSyncError('')
    if (bulkParseError) {
      setSyncError('批量文本解析失败，请先修复后再同步。')
      return
    }
    const nextRows = ensureEditableRows(bulkDraftRows)
    setSyncPreview({
      direction: 'bulk-to-table',
      title: '预览：批量导入同步到表格',
      nextRows,
      nextDetectedFormat: bulkDetectedFormat || 'line',
      preview: buildSyncPreview(nextRows, panelVariables),
    })
  }

  const openPreviewTableToBulk = () => {
    setSyncError('')
    const serialized = serializeBulkVariables(panelVariables, bulkExportFormat, panelValueFormat)
    if (!serialized.ok) {
      setSyncError(serialized.error)
      return
    }

    const parsed = parseBulkVariables(serialized.text)
    if (!parsed.ok) {
      setSyncError(parsed.error)
      return
    }

    setSyncPreview({
      direction: 'table-to-bulk',
      title: '预览：表格生成到批量导入',
      nextRows: parsed.rows,
      nextBulkText: serialized.text,
      nextDetectedFormat: parsed.detectedFormat,
      preview: buildSyncPreview(parsed.rows, bulkDraftRows),
    })
  }

  const applySyncPreview = () => {
    if (!syncPreview) {
      return
    }

    if (syncPreview.direction === 'bulk-to-table') {
      const targetPanelFormat = panelValueFormat === 'auto'
        ? (syncPreview.nextDetectedFormat ?? 'json')
        : panelValueFormat
      const normalized = reformatRowsForPanelFormat(syncPreview.nextRows, targetPanelFormat)
      if (!normalized.ok) {
        setSyncError(normalized.error)
        return
      }
      if (panelValueFormat === 'auto') {
        onPanelValueFormatChange(targetPanelFormat)
      }
      onPanelVariablesChange(normalized.rows)
      setAdvancedTab('table')
      setSyncPreview(null)
      onFocusComposer()
      return
    }

    setBulkText(syncPreview.nextBulkText ?? '')
    setBulkDraftRows(syncPreview.nextRows)
    setBulkDetectedFormat(syncPreview.nextDetectedFormat ?? 'json')
    setBulkParseError('')
    setAdvancedTab('bulk')
    setSyncPreview(null)
    onFocusComposer()
  }

  const closeSyncPreview = () => {
    setSyncPreview(null)
    onFocusComposer()
  }

  const panelColumns: ColumnsType<PanelVariableRow> = [
    {
      title: 'key',
      dataIndex: 'key',
      render: (_: unknown, row) => (
        <Input
          value={row.key}
          placeholder="如 hair"
          status={mismatchSet.has(row.id) ? 'error' : undefined}
          onChange={(event) => {
            onPanelVariablesChange(panelVariables.map((item) => (item.id === row.id ? { ...item, key: event.target.value } : item)))
          }}
        />
      ),
    },
    {
      title: 'value 列表',
      dataIndex: 'valuesText',
      render: (_: unknown, row) => (
        <Input.TextArea
          value={row.valuesText}
          status={mismatchSet.has(row.id) ? 'error' : undefined}
          placeholder={valuePlaceholderByFormat[panelValueFormat]}
          autoSize={{ minRows: 1, maxRows: 4 }}
          onChange={(event) => {
            onPanelVariablesChange(
              panelVariables.map((item) => (item.id === row.id ? { ...item, valuesText: event.target.value } : item)),
            )
          }}
        />
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, row) => (
        <Button
          size="small"
          danger
          onClick={() => {
            const next = panelVariables.filter((item) => item.id !== row.id)
            onPanelVariablesChange(ensureEditableRows(next))
          }}
        >
          删除
        </Button>
      ),
    },
  ]

  return {
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
  }
}
