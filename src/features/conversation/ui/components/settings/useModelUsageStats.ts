import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConversationSummary } from '../../../../../types/conversation'
import type { ModelCatalog } from '../../../../../types/model'
import type { ConversationRepository } from '../../../infra/conversationRepository'
import { loadModelUsageStats, type LoadedModelUsageSnapshot } from '../../../application/modelUsageStatsService'
import {
  MODEL_USAGE_GRANULARITY_LABELS,
  MODEL_USAGE_PRESET_GRANULARITIES,
  type ModelUsageGranularity,
  type ModelUsagePresetRange,
} from '../../../domain/modelUsageStats'

const DEFAULT_RANGE: ModelUsagePresetRange = 'week'
const DEFAULT_GRANULARITY: ModelUsageGranularity = 'day'
const ALL_SOURCES_VALUE = 'all'

function getTodayDateValue(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface UseModelUsageStatsInput {
  enabled: boolean
  repository: ConversationRepository
  summaries: ConversationSummary[]
  modelCatalog: ModelCatalog
}

export function useModelUsageStats(input: UseModelUsageStatsInput) {
  const [selectedRange, setSelectedRange] = useState<ModelUsagePresetRange>(DEFAULT_RANGE)
  const [selectedGranularity, setSelectedGranularity] = useState<ModelUsageGranularity>(DEFAULT_GRANULARITY)
  const [selectedSource, setSelectedSource] = useState<string>(ALL_SOURCES_VALUE)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateValue)
  const [snapshot, setSnapshot] = useState<LoadedModelUsageSnapshot | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [granularityNotice, setGranularityNotice] = useState('')
  const [staleDataNotice, setStaleDataNotice] = useState('')
  const requestIdRef = useRef(0)
  const selectedRangeRef = useRef<ModelUsagePresetRange>(DEFAULT_RANGE)
  const selectedGranularityRef = useRef<ModelUsageGranularity>(DEFAULT_GRANULARITY)
  const selectedSourceRef = useRef<string>(ALL_SOURCES_VALUE)
  const selectedDateRef = useRef<string>(getTodayDateValue())
  const snapshotRef = useRef<LoadedModelUsageSnapshot | null>(null)

  const allowedGranularities = useMemo(
    () => MODEL_USAGE_PRESET_GRANULARITIES[selectedRange],
    [selectedRange],
  )

  useEffect(() => {
    selectedRangeRef.current = selectedRange
  }, [selectedRange])

  useEffect(() => {
    selectedGranularityRef.current = selectedGranularity
  }, [selectedGranularity])

  useEffect(() => {
    selectedSourceRef.current = selectedSource
  }, [selectedSource])

  useEffect(() => {
    selectedDateRef.current = selectedDate
  }, [selectedDate])

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  const refresh = useCallback(async (options?: {
    background?: boolean
    overrideRange?: ModelUsagePresetRange
    overrideGranularity?: ModelUsageGranularity
    overrideSource?: string
    overrideDate?: string
  }) => {
    const nextRange = options?.overrideRange ?? selectedRangeRef.current
    const allowed = MODEL_USAGE_PRESET_GRANULARITIES[nextRange]
    const requestedGranularity = options?.overrideGranularity ?? selectedGranularityRef.current
    const effectiveGranularity = allowed.includes(requestedGranularity) ? requestedGranularity : allowed[0]
    const nextSource = options?.overrideSource ?? selectedSourceRef.current
    const nextDate = options?.overrideDate ?? selectedDateRef.current
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    if (effectiveGranularity !== requestedGranularity) {
      setSelectedGranularity(effectiveGranularity)
      setGranularityNotice(
        `当前范围不支持“${MODEL_USAGE_GRANULARITY_LABELS[requestedGranularity]}”粒度，已自动切换为“${MODEL_USAGE_GRANULARITY_LABELS[effectiveGranularity]}”。`,
      )
    } else if (options?.overrideRange || options?.overrideGranularity) {
      setGranularityNotice('')
    }

    if (options?.background) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const nextSnapshot = await loadModelUsageStats({
        repository: input.repository,
        summaries: input.summaries,
        modelCatalog: input.modelCatalog,
        range: nextRange,
        granularity: effectiveGranularity,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        sourceFilter: nextSource === ALL_SOURCES_VALUE ? null : nextSource,
        anchorDate: nextDate,
      })
      if (requestIdRef.current !== requestId) {
        return
      }
      setSnapshot(nextSnapshot)
      setError('')
      setStaleDataNotice('')
    } catch (refreshError) {
      if (requestIdRef.current !== requestId) {
        return
      }
      setError(refreshError instanceof Error ? refreshError.message : '读取模型调用统计失败')
      if (snapshotRef.current) {
        setStaleDataNotice('最新一次刷新失败，当前展示的是上一次成功加载的统计结果。')
      } else {
        setSnapshot(null)
        setStaleDataNotice('')
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [input.modelCatalog, input.repository, input.summaries])

  useEffect(() => {
    if (!input.enabled) {
      return
    }
    void refresh()
  }, [input.enabled, refresh])

  useEffect(() => {
    if (!input.enabled || !snapshot || selectedSource === ALL_SOURCES_VALUE) {
      return
    }
    if (snapshot.sources.includes(selectedSource)) {
      return
    }

    setSelectedSource(ALL_SOURCES_VALUE)
    void refresh({ background: true, overrideSource: ALL_SOURCES_VALUE })
  }, [input.enabled, refresh, selectedSource, snapshot])

  useEffect(() => {
    if (!input.enabled) {
      return
    }

    const handleStorage = () => {
      if (document.visibilityState === 'visible') {
        void refresh({ background: true })
      }
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refresh({ background: true })
      }
    }

    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [input.enabled, refresh])

  const handleRangeChange = useCallback((nextRange: ModelUsagePresetRange) => {
    setSelectedRange(nextRange)
    void refresh({ overrideRange: nextRange })
  }, [refresh])

  const handleGranularityChange = useCallback((nextGranularity: ModelUsageGranularity) => {
    setSelectedGranularity(nextGranularity)
    void refresh({ overrideGranularity: nextGranularity })
  }, [refresh])

  const handleSourceChange = useCallback((nextSource: string) => {
    setSelectedSource(nextSource)
    void refresh({ overrideSource: nextSource })
  }, [refresh])

  const handleDateChange = useCallback((nextDate: string) => {
    const effectiveDate = nextDate || getTodayDateValue()
    setSelectedDate(effectiveDate)
    void refresh({ overrideDate: effectiveDate })
  }, [refresh])

  const retry = useCallback(() => {
    void refresh()
  }, [refresh])

  return {
    selectedRange,
    selectedGranularity,
    selectedSource,
    selectedDate,
    allowedGranularities,
    availableSources: snapshot?.sources ?? [],
    snapshot,
    error,
    isLoading,
    isRefreshing,
    granularityNotice,
    staleDataNotice,
    setSelectedRange: handleRangeChange,
    setSelectedGranularity: handleGranularityChange,
    setSelectedSource: handleSourceChange,
    setSelectedDate: handleDateChange,
    retry,
  }
}
