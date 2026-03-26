import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormInstance } from 'antd'
import type { ApiChannel, ImportAction } from '../../../../../types/channel'
import type { ChannelImportPreviewItem, SettingsPanelService } from '../../../application/settingsPanelService'
import { findOfficialChannelPresetById, matchOfficialChannelPreset, type ChannelSourceType } from './officialChannelPresets'

type ChannelFormValues = { name: string; baseUrl: string; apiKey: string }

interface UseChannelImportControllerInput {
  channelForm: FormInstance<ChannelFormValues>
  channels: ApiChannel[]
  isModalOpen: boolean
  setIsModalOpen: (open: boolean) => void
  setEditingChannelId: (value: string | null) => void
  onChannelsChange: (channels: ApiChannel[]) => void
  fetchChannelModels: SettingsPanelService['fetchChannelModels']
  resolveProviderId: SettingsPanelService['resolveProviderId']
  buildChannelImportPreview: SettingsPanelService['buildChannelImportPreview']
  parseApiChannelsFromText: SettingsPanelService['parseApiChannelsFromText']
  applyChannelImport: SettingsPanelService['applyChannelImport']
  messageApi: {
    info: (content: string) => void
    success: (content: string) => void
    warning: (content: string) => void
    error: (content: string) => void
  }
  debounceMs: number
}

export function useChannelImportController(input: UseChannelImportControllerInput) {
  const {
    channelForm,
    channels,
    isModalOpen,
    setIsModalOpen,
    setEditingChannelId,
    onChannelsChange,
    fetchChannelModels,
    resolveProviderId,
    buildChannelImportPreview,
    parseApiChannelsFromText,
    applyChannelImport,
    messageApi,
    debounceMs,
  } = input

  const [channelImportText, setChannelImportText] = useState('')
  const [channelImportItems, setChannelImportItems] = useState<ChannelImportPreviewItem[]>([])
  const [channelImportDetected, setChannelImportDetected] = useState(0)
  const [channelImportError, setChannelImportError] = useState('')
  const [isApplyingChannelImport, setIsApplyingChannelImport] = useState(false)
  const [channelSourceType, setChannelSourceType] = useState<ChannelSourceType>('third-party')
  const [selectedOfficialPresetId, setSelectedOfficialPresetId] = useState<string | undefined>(undefined)

  const parseChannelImportText = useCallback((text: string) => {
    const parsed = parseApiChannelsFromText(text)
    setChannelImportDetected(parsed.totalDetected)
    setChannelImportError('')
    const previewItems = buildChannelImportPreview(parsed.candidates, channels)
    setChannelImportItems(previewItems)
    const firstValid = previewItems.find((item) => !item.invalidReason)
    if (firstValid) {
      channelForm.setFieldsValue({
        name: firstValid.name,
        baseUrl: firstValid.baseUrl,
        apiKey: firstValid.apiKey,
      })
    }
  }, [buildChannelImportPreview, channelForm, channels, parseApiChannelsFromText])

  const clearChannelImportState = useCallback(() => {
    setChannelImportText('')
    setChannelImportItems([])
    setChannelImportDetected(0)
    setChannelImportError('')
  }, [])

  const applyOfficialPresetSelection = useCallback((presetId: string | undefined) => {
    setSelectedOfficialPresetId(presetId)
    const preset = findOfficialChannelPresetById(presetId)
    if (!preset) {
      return
    }

    const currentName = String(channelForm.getFieldValue('name') ?? '').trim()
    channelForm.setFieldsValue({
      baseUrl: preset.baseUrl,
      name: currentName ? currentName : preset.defaultName,
    })
  }, [channelForm])

  const openCreateChannelModal = useCallback(() => {
    setEditingChannelId(null)
    channelForm.resetFields()
    setChannelSourceType('third-party')
    setSelectedOfficialPresetId(undefined)
    clearChannelImportState()
    setIsModalOpen(true)
  }, [channelForm, clearChannelImportState, setEditingChannelId, setIsModalOpen])

  const openEditChannelModal = useCallback((channel: ApiChannel) => {
    const matchedPreset = matchOfficialChannelPreset(channel.baseUrl)
    setEditingChannelId(channel.id)
    setChannelSourceType(matchedPreset ? 'official' : 'third-party')
    setSelectedOfficialPresetId(matchedPreset?.id)
    channelForm.setFieldsValue({
      name: channel.name,
      baseUrl: channel.baseUrl,
      apiKey: channel.apiKey,
    })
    clearChannelImportState()
    setIsModalOpen(true)
  }, [channelForm, clearChannelImportState, setEditingChannelId, setIsModalOpen])

  useEffect(() => {
    if (!isModalOpen) {
      return
    }

    const timer = window.setTimeout(() => {
      if (!channelImportText.trim()) {
        setChannelImportItems([])
        setChannelImportDetected(0)
        setChannelImportError('')
        return
      }
      parseChannelImportText(channelImportText)
    }, debounceMs)

    return () => window.clearTimeout(timer)
  }, [channelImportText, debounceMs, isModalOpen, parseChannelImportText])

  const updateImportItem = useCallback((itemId: string, patch: Partial<ChannelImportPreviewItem>) => {
    setChannelImportItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)))
  }, [])

  const applyParsedChannels = useCallback(async () => {
    const selectedItems = channelImportItems.filter((item) => item.selected && !item.invalidReason && item.action !== 'skip')
    if (selectedItems.length === 0) {
      messageApi.info('请选择至少一条可导入渠道')
      return
    }

    setIsApplyingChannelImport(true)
    setChannelImportError('')
    try {
      const modelFetchResult = await Promise.all(
        selectedItems.map(async (item) => {
          try {
            const modelIds = await fetchChannelModels({
              baseUrl: item.baseUrl,
              apiKey: item.apiKey,
              providerId: resolveProviderId({ baseUrl: item.baseUrl, apiKey: item.apiKey }),
            })
            if (modelIds.length === 0) {
              throw new Error('上游返回空模型列表')
            }
            return { id: item.id, modelIds }
          } catch (error) {
            const reason = error instanceof Error ? error.message : '未知错误'
            return { id: item.id, modelIds: null, reason }
          }
        }),
      )

      const failedMap = new Map(
        modelFetchResult.filter((item) => !Array.isArray(item.modelIds)).map((item) => [item.id, item.reason ?? '未知错误']),
      )
      const modelsByCandidateId: Record<string, string[]> = {}
      for (const result of modelFetchResult) {
        if (Array.isArray(result.modelIds)) {
          modelsByCandidateId[result.id] = result.modelIds
        }
      }

      const effectiveItems = channelImportItems.map((item) => {
        if (failedMap.has(item.id)) {
          return { ...item, selected: false, action: 'skip' as ImportAction }
        }
        return item
      })

      const applied = applyChannelImport(channels, effectiveItems, modelsByCandidateId)
      onChannelsChange(applied.channels)

      const failedCount = failedMap.size
      const summary = `新增 ${applied.created} / 覆盖 ${applied.overwritten} / 跳过 ${applied.skipped} / 失败 ${failedCount}`
      if (failedCount > 0) {
        const failedNames = selectedItems
          .filter((item) => failedMap.has(item.id))
          .slice(0, 2)
          .map((item) => item.name)
          .join('、')
        const suffix = failedCount > 2 ? '等' : ''
        messageApi.warning(`渠道导入完成：${summary}（失败：${failedNames}${suffix}）`)
      } else {
        messageApi.success(`渠道导入完成：${summary}`)
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : '未知错误'
      setChannelImportError(reason)
      messageApi.error(reason)
    } finally {
      setIsApplyingChannelImport(false)
    }
  }, [
    applyChannelImport,
    channelImportItems,
    channels,
    fetchChannelModels,
    messageApi,
    onChannelsChange,
    resolveProviderId,
  ])

  const importSummary = useMemo(() => {
    const invalid = channelImportItems.filter((item) => item.status === 'invalid').length
    const duplicated = channelImportItems.filter((item) => item.status === 'duplicate').length
    const selected = channelImportItems.filter((item) => item.selected && item.action !== 'skip' && !item.invalidReason).length
    return { invalid, duplicated, selected, total: channelImportItems.length }
  }, [channelImportItems])

  return {
    channelImportText,
    setChannelImportText,
    channelImportItems,
    channelImportDetected,
    channelImportError,
    isApplyingChannelImport,
    channelSourceType,
    setChannelSourceType,
    selectedOfficialPresetId,
    setSelectedOfficialPresetId,
    parseChannelImportText,
    clearChannelImportState,
    applyOfficialPresetSelection,
    openCreateChannelModal,
    openEditChannelModal,
    updateImportItem,
    applyParsedChannels,
    importSummary,
  }
}
