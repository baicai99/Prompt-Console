import type { FormInstance } from 'antd'
import type { ApiChannel } from '../../../../../types/channel'

type ChannelFormValues = { name: string; baseUrl: string; apiKey: string }

interface CreateChannelModalSubmitHandlerInput {
  channelForm: FormInstance<ChannelFormValues>
  channelSourceType: 'third-party' | 'official'
  selectedOfficialPresetId?: string
  editingChannelId: string | null
  channels: ApiChannel[]
  setIsSavingChannel: (value: boolean) => void
  onChannelsChange: (channels: ApiChannel[]) => void
  closeChannelEditorModal: () => void
  messageApi: {
    success: (content: string) => void
    error: (content: string) => void
  }
  findOfficialChannelPresetById: (id?: string) => { providerId: ApiChannel['providerId'] } | null
  resolveProviderId: (input: {
    providerId?: string
    baseUrl: string
    apiKey: string
  }) => NonNullable<ApiChannel['providerId']>
  fetchChannelModels: (input: {
    baseUrl: string
    apiKey: string
    providerId: NonNullable<ApiChannel['providerId']>
  }) => Promise<string[]>
  makeId: () => string
}

export function createChannelModalSubmitHandler(input: CreateChannelModalSubmitHandlerInput) {
  return async () => {
    input.setIsSavingChannel(true)
    try {
      const values = await input.channelForm.validateFields()
      const nextBaseUrl = values.baseUrl.trim()
      const nextApiKey = values.apiKey.trim()
      const selectedOfficialPreset = input.channelSourceType === 'official'
        ? input.findOfficialChannelPresetById(input.selectedOfficialPresetId)
        : null
      const existingProviderId = input.editingChannelId
        ? input.channels.find((item) => item.id === input.editingChannelId)?.providerId
        : undefined
      const nextProviderId = selectedOfficialPreset?.providerId ?? input.resolveProviderId({
        providerId: existingProviderId === 'openai-compatible' ? undefined : existingProviderId,
        baseUrl: nextBaseUrl,
        apiKey: nextApiKey,
      })
      const modelIds = await input.fetchChannelModels({
        baseUrl: nextBaseUrl,
        apiKey: nextApiKey,
        providerId: nextProviderId,
      })

      if (modelIds.length === 0) {
        throw new Error('上游返回了空模型列表，请检查渠道权限。')
      }

      const nextChannel: ApiChannel = {
        id: input.editingChannelId ?? input.makeId(),
        name: values.name.trim(),
        baseUrl: nextBaseUrl,
        apiKey: nextApiKey,
        providerId: nextProviderId,
        models: modelIds,
      }

      if (input.editingChannelId) {
        input.onChannelsChange(input.channels.map((item) => (item.id === input.editingChannelId ? nextChannel : item)))
        input.messageApi.success(`渠道已更新，读取到 ${modelIds.length} 个模型`)
      } else {
        input.onChannelsChange([nextChannel, ...input.channels])
        input.messageApi.success(`渠道已添加，读取到 ${modelIds.length} 个模型`)
      }

      input.closeChannelEditorModal()
    } catch (error) {
      const reason = error instanceof Error ? error.message : '未知错误'
      input.messageApi.error(reason)
    } finally {
      input.setIsSavingChannel(false)
    }
  }
}
