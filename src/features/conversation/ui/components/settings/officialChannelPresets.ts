import type { ProviderId } from '../../../../../types/provider'

export type ChannelSourceType = 'third-party' | 'official'

export type OfficialChannelPreset = {
  id: string
  label: string
  defaultName: string
  baseUrl: string
  providerId: ProviderId
  supported: boolean
  description: string
}

export const OFFICIAL_CHANNEL_PRESETS: OfficialChannelPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    defaultName: 'OpenAI 官方',
    baseUrl: 'https://api.openai.com/v1',
    providerId: 'openai-compatible',
    supported: true,
    description: 'OpenAI 官方接口',
  },
  {
    id: 'google-gemini',
    label: 'Google Gemini',
    defaultName: 'Google Gemini 官方',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    providerId: 'gemini-api',
    supported: true,
    description: 'Google 官方 Gemini API',
  },
  {
    id: 'byteplus-ark',
    label: 'BytePlus Ark',
    defaultName: 'BytePlus Ark 官方',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    providerId: 'byteplus-ark',
    supported: true,
    description: '火山方舟 / 豆包官方接口',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultName: 'DeepSeek 官方',
    baseUrl: 'https://api.deepseek.com/v1',
    providerId: 'openai-compatible',
    supported: true,
    description: 'DeepSeek 官方兼容接口',
  },
  {
    id: 'moonshot',
    label: 'Moonshot Kimi',
    defaultName: 'Moonshot Kimi 官方',
    baseUrl: 'https://api.moonshot.cn/v1',
    providerId: 'openai-compatible',
    supported: true,
    description: 'Moonshot 官方兼容接口',
  },
  {
    id: 'groq',
    label: 'Groq',
    defaultName: 'Groq 官方',
    baseUrl: 'https://api.groq.com/openai/v1',
    providerId: 'openai-compatible',
    supported: true,
    description: 'Groq 官方 OpenAI 兼容接口',
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    defaultName: 'xAI Grok 官方',
    baseUrl: 'https://api.x.ai/v1',
    providerId: 'openai-compatible',
    supported: true,
    description: 'xAI 官方兼容接口',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    defaultName: 'Anthropic Claude 官方',
    baseUrl: 'https://api.anthropic.com',
    providerId: 'custom',
    supported: false,
    description: '当前客户端暂未接入 Anthropic 官方协议',
  },
]

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase()
}

export function findOfficialChannelPresetById(presetId: string | null | undefined): OfficialChannelPreset | null {
  if (!presetId) {
    return null
  }
  return OFFICIAL_CHANNEL_PRESETS.find((item) => item.id === presetId) ?? null
}

export function matchOfficialChannelPreset(baseUrl: string): OfficialChannelPreset | null {
  const normalized = normalizeBaseUrl(baseUrl)
  if (!normalized) {
    return null
  }
  return OFFICIAL_CHANNEL_PRESETS.find((item) => normalizeBaseUrl(item.baseUrl) === normalized) ?? null
}
