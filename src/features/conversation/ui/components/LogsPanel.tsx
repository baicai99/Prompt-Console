import { useMemo, useState, useSyncExternalStore } from 'react'
import { Space } from 'antd'
import type { LoggingSettings } from '../../../../types/conversation'
import {
  getLoggingEntries,
  subscribeLoggingEntries,
} from '../../../../services/imageTaskDebug'
import { DEFAULT_LOGGING_SETTINGS } from '../../../../utils/loggingSettings'
import {
  LogsPageContent,
  LogsPageToolbar,
  LogsSidebarContent,
} from './logsPanelShared'

interface LogsPanelProps {
  layout?: 'sidebar' | 'page'
  loggingSettings?: LoggingSettings
  onLoggingSettingsChange?: (value: Partial<LoggingSettings>) => void
}

export function LogsPanel({ layout = 'sidebar', loggingSettings, onLoggingSettingsChange }: LogsPanelProps) {
  const entries = useSyncExternalStore(subscribeLoggingEntries, getLoggingEntries, getLoggingEntries)
  const orderedEntries = useMemo(() => [...entries].reverse(), [entries])
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const runtimeLoggingSettings = loggingSettings ?? DEFAULT_LOGGING_SETTINGS

  if (layout === 'page') {
    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <LogsPageToolbar
          settings={runtimeLoggingSettings}
          onChange={onLoggingSettingsChange}
          entryCount={entries.length}
        />
        <LogsPageContent
          settings={runtimeLoggingSettings}
          entries={orderedEntries}
          expandedEntryId={expandedEntryId}
          setExpandedEntryId={setExpandedEntryId}
        />
      </Space>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <LogsSidebarContent
        settings={runtimeLoggingSettings}
        onChange={onLoggingSettingsChange}
        entries={orderedEntries}
      />
    </div>
  )
}
