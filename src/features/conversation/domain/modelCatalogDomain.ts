import type { SettingPrimitive } from '../../../types/conversation'
import type { ModelCatalog, ModelSpec } from '../../../types/model'

const IMAGE_MODEL_BLOCKLIST_KEYWORDS = [
  'chat',
  'o1',
  'o2',
  'o3',
  'o4',
  'o5',
  'claude',
  'deepseek',
  'codex',
  'llama',
  'coder',
  'audio',
  'tts',
  'embedding',
]
const DOUBAO_FAMILY_KEYWORDS = ['doubao', 'seeddance', 'seedance', 'seedream']
const DOUBAO_VIDEO_MODEL_ALLOWLIST_KEYWORDS = ['seeddance', 'seedance']
const DOUBAO_TEXT_MODEL_BLOCKLIST_KEYWORDS = ['seedream', 'seeddance', 'seedance']
const KLING_KEYWORD = 'kling'
const KLING_VENDOR_TAG = '可灵'
export const DEFAULT_MODEL_CATEGORY_TAGS = [
  '字节跳动/火山引擎（豆包）',
  '阿里云（通义千问 / Qwen）',
  '百度（文心 / ERNIE）',
  '腾讯（混元）',
  '智谱（GLM）',
  '月之暗面（Kimi）',
  'MiniMax',
  'DeepSeek',
  '商汤（日日新 SenseNova）',
  '阶跃星辰（Step 系列）',
  '百川智能',
  '零一万物（Yi）',
  '快手（可灵）',
  '昆仑万维（天工 / Skywork）',
  'OpenAI（GPT）',
  'Anthropic（Claude）',
  'Google / Google DeepMind（Gemini、Gemma）',
  'Meta（Llama）',
  'xAI（Grok）',
  'Mistral AI',
  'Cohere',
  'Amazon（Nova）',
  'Microsoft（Phi）',
  'AI21（Jamba）',
  'Runway',
  'Pika',
  'Luma AI',
  'Stability AI',
  'Adobe Firefly',
  'Midjourney',
  'Ideogram',
  'Lightricks / LTX',
] as const
type ModelCategoryTag = (typeof DEFAULT_MODEL_CATEGORY_TAGS)[number]

const MODEL_CATEGORY_MATCHERS: Record<ModelCategoryTag, string[]> = {
  '字节跳动/火山引擎（豆包）': ['豆包', 'doubao', 'seedream', 'seedance', 'seeddance', 'volcengine'],
  '阿里云（通义千问 / Qwen）': ['qwen', '通义千问', '阿里云'],
  '百度（文心 / ERNIE）': ['ernie', '文心', '百度'],
  '腾讯（混元）': ['混元', 'hunyuan', '腾讯'],
  '智谱（GLM）': ['glm', '智谱'],
  '月之暗面（Kimi）': ['kimi', '月之暗面'],
  MiniMax: ['minimax'],
  DeepSeek: ['deepseek'],
  '商汤（日日新 SenseNova）': ['sensenova', '日日新', '商汤'],
  '阶跃星辰（Step 系列）': ['step', '阶跃星辰'],
  '百川智能': ['百川', 'baichuan'],
  '零一万物（Yi）': ['零一万物', 'yi-'],
  '快手（可灵）': ['可灵', 'kling', '快手'],
  '昆仑万维（天工 / Skywork）': ['天工', 'skywork', '昆仑万维'],
  'OpenAI（GPT）': ['openai', 'gpt', 'chatgpt', 'dall-e', 'dalle', 'gpt-image', 'sora'],
  'Anthropic（Claude）': ['anthropic', 'claude'],
  'Google / Google DeepMind（Gemini、Gemma）': ['google', 'gemini', 'gemma', 'google-ai', 'googleai', 'banana'],
  'Meta（Llama）': ['meta', 'llama'],
  'xAI（Grok）': ['xai', 'grok'],
  'Mistral AI': ['mistral'],
  Cohere: ['cohere'],
  'Amazon（Nova）': ['amazon', 'nova'],
  'Microsoft（Phi）': ['microsoft', 'phi'],
  'AI21（Jamba）': ['ai21', 'jamba'],
  Runway: ['runway'],
  Pika: ['pika'],
  'Luma AI': ['luma'],
  'Stability AI': ['stability'],
  'Adobe Firefly': ['firefly', 'adobe'],
  Midjourney: ['midjourney', 'mj_'],
  Ideogram: ['ideogram'],
  'Lightricks / LTX': ['lightricks', 'ltx'],
}

type ModelIdentity = Pick<ModelSpec, 'id' | 'name' | 'tags'>

function buildModelHaystack(input: Pick<ModelSpec, 'id' | 'name'>): string {
  return `${input.id} ${input.name}`.toLowerCase()
}

export function getModelById(catalog: ModelCatalog, modelId: string): ModelSpec | undefined {
  return catalog.models.find((item) => item.id === modelId)
}

export function getModelProviderId(modelId: string, catalog: ModelCatalog): string {
  const model = getModelById(catalog, modelId)
  return model?.rawId?.trim() || modelId
}

export function getModelChannelId(modelId: string, catalog: ModelCatalog): string | null {
  const model = getModelById(catalog, modelId)
  const channelId = model?.channelId?.trim()
  return channelId || null
}

export function getDefaultModel(catalog: ModelCatalog): ModelSpec | undefined {
  return catalog.models[0]
}

export function getDefaultParamValues(model?: ModelSpec): Record<string, SettingPrimitive> {
  if (!model) {
    return {}
  }

  const values: Record<string, SettingPrimitive> = {}
  for (const param of model.params) {
    values[param.key] = param.default
  }
  return values
}

export function normalizeParamValues(
  model: ModelSpec | undefined,
  values: Record<string, SettingPrimitive>,
): Record<string, SettingPrimitive> {
  if (!model) {
    return {}
  }

  const next: Record<string, SettingPrimitive> = {}

  for (const param of model.params) {
    const value = values[param.key]

    if (param.type === 'number') {
      const defaultValue = typeof param.default === 'number' ? param.default : 0
      const rawNumber = typeof value === 'number' ? value : defaultValue
      const min = typeof param.min === 'number' ? param.min : Number.NEGATIVE_INFINITY
      const max = typeof param.max === 'number' ? param.max : Number.POSITIVE_INFINITY
      next[param.key] = Math.min(Math.max(rawNumber, min), max)
      continue
    }

    if (param.type === 'boolean') {
      next[param.key] = typeof value === 'boolean' ? value : Boolean(param.default)
      continue
    }

    const options = param.options ?? []
    if (typeof value === 'string' && (options.length === 0 || options.includes(value))) {
      next[param.key] = value
    } else if (typeof param.default === 'string') {
      next[param.key] = param.default
    }
  }

  return next
}

export function inferModelTags(model: ModelIdentity): string[] {
  const tags = new Set<string>()

  const normalizeTag = (raw: string): string => {
    const value = raw.trim().toLowerCase()
    if (value === 'gemini' || value === 'banana' || value === 'google-ai' || value === 'googleai') {
      return 'google'
    }
    if (value.includes(KLING_KEYWORD) || value === KLING_VENDOR_TAG) {
      return KLING_VENDOR_TAG
    }
    if (DOUBAO_FAMILY_KEYWORDS.includes(value)) {
      return '豆包'
    }
    return value
  }

  if (Array.isArray(model.tags) && model.tags.length > 0) {
    for (const tag of model.tags) {
      if (!tag) {
        continue
      }
      tags.add(normalizeTag(tag))
    }
  }

  const normalizedName = buildModelHaystack(model)
  if (normalizedName.includes(KLING_KEYWORD)) {
    tags.add(KLING_VENDOR_TAG)
  }
  if (DOUBAO_FAMILY_KEYWORDS.some((keyword) => normalizedName.includes(keyword))) {
    tags.add('豆包')
  }

  return Array.from(tags)
}

export function inferModelSearchTokens(model: ModelIdentity): string {
  const value = buildModelHaystack(model)
  const tokens = new Set<string>()
  for (const tag of inferModelTags(model)) {
    tokens.add(tag)
  }

  if (value.includes('gemini')) {
    tokens.add('google')
    tokens.add('banana')
  }
  if (value.includes('banana')) {
    tokens.add('google')
    tokens.add('gemini')
  }
  if (value.includes('doubao')) {
    tokens.add('seeddance')
    tokens.add('seedream')
    tokens.add('豆包')
  }
  if (value.includes('seeddance')) {
    tokens.add('doubao')
    tokens.add('seedream')
    tokens.add('豆包')
  }
  if (value.includes('seedream')) {
    tokens.add('doubao')
    tokens.add('seeddance')
    tokens.add('豆包')
  }
  if (value.includes(KLING_KEYWORD) || value.includes(KLING_VENDOR_TAG)) {
    tokens.add(KLING_VENDOR_TAG)
    tokens.add(KLING_KEYWORD)
  }
  if (value.includes('mj')) {
    tokens.add('midjourney')
  }
  if (value.includes('midjourney')) {
    tokens.add('mj')
  }
  if (
    value.includes('gpt-image') ||
    value.includes('gpt-4o') ||
    value.includes('gpt-4-all') ||
    value.includes('sora_image') ||
    value.includes('dall-e') ||
    value.includes('dalle') ||
    value.includes('kolors')
  ) {
    tokens.add('openai')
  }

  return Array.from(tokens).join(' ')
}

export function isBlockedImageModel(input: Pick<ModelSpec, 'id' | 'name'>): boolean {
  const haystack = buildModelHaystack(input)
  const isDoubaoFamily = DOUBAO_FAMILY_KEYWORDS.some((keyword) => haystack.includes(keyword))
  if (isDoubaoFamily && !haystack.includes('seedream')) {
    return true
  }
  return IMAGE_MODEL_BLOCKLIST_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

export function isBlockedVideoModel(input: Pick<ModelSpec, 'id' | 'name'>): boolean {
  const haystack = buildModelHaystack(input)
  const isDoubaoFamily = DOUBAO_FAMILY_KEYWORDS.some((keyword) => haystack.includes(keyword))
  if (!isDoubaoFamily) {
    return false
  }
  return !DOUBAO_VIDEO_MODEL_ALLOWLIST_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

export function isBlockedTextModel(input: Pick<ModelSpec, 'id' | 'name'>): boolean {
  const haystack = buildModelHaystack(input)
  const isDoubaoFamily = DOUBAO_FAMILY_KEYWORDS.some((keyword) => haystack.includes(keyword))
  if (!isDoubaoFamily) {
    return false
  }
  return DOUBAO_TEXT_MODEL_BLOCKLIST_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

export function collectAvailableModelTags(models: ModelIdentity[], fixedTags: string[] = []): string[] {
  const tags = new Set<string>(fixedTags)
  for (const model of models) {
    for (const tag of inferModelTags(model)) {
      tags.add(tag)
    }
  }
  return Array.from(tags).sort()
}

export function collectModelCategoryTags(
  models: ModelIdentity[],
  fixedTags: readonly ModelCategoryTag[] = DEFAULT_MODEL_CATEGORY_TAGS,
): string[] {
  return fixedTags.filter((tag) => models.some((model) => matchesModelCategory(model, tag)))
}

export function filterModelsByTag(models: ModelSpec[], selectedTag: string, allTag: string): ModelSpec[] {
  if (selectedTag === allTag) {
    return models
  }
  if (selectedTag in MODEL_CATEGORY_MATCHERS) {
    return models.filter((model) => matchesModelCategory(model, selectedTag as ModelCategoryTag))
  }
  return models.filter((model) => inferModelTags(model).includes(selectedTag))
}

function matchesModelCategory(model: ModelIdentity, category: ModelCategoryTag): boolean {
  const haystack = `${model.id} ${model.name} ${Array.isArray(model.tags) ? model.tags.join(' ') : ''}`.toLowerCase()
  return MODEL_CATEGORY_MATCHERS[category].some((keyword) => haystack.includes(keyword.toLowerCase()))
}
