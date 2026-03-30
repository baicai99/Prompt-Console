import type { ModelCatalog, ModelParamSpec, ModelSpec } from '../types/model'
import { buildScopedModelId } from '../utils/modelIdentity'

type JimengResolutionSize = {
  ratio_type?: number
  width?: number
  height?: number
}

type JimengResolutionConfig = {
  image_ratio_sizes?: JimengResolutionSize[]
  image_range_config?: {
    min_length?: number
    max_length?: number
    max_pixel_num?: number
  }
  resolution_name?: string
}

type JimengModel = {
  model_req_key?: string
  model_name?: string
  model_tip?: string
  generation_category_name?: string
  sample_steps?: {
    steps?: number
    min_steps?: number
    max_steps?: number
  }
  blend_enable?: Record<string, boolean>
  feat_config?: Record<string, { strength?: number }>
  feats?: string[]
  resolution_map?: Record<string, JimengResolutionConfig>
  extra?: {
    model_source?: string
    raw_model_source?: string
  }
}

type JimengImageConfigPayload = {
  data?: {
    model_list?: JimengModel[]
  }
}

const JIMENG_IMAGE_SOURCE_NAME = '即梦图片'
export const JIMENG_VIRTUAL_CHANNEL_ID = '__jimeng-proxy__'
export const JIMENG_MODEL_CATALOG_STORAGE_KEY = 'jimeng:model-catalog'

const RATIO_LABELS: Record<number, string> = {
  1: '1:1',
  2: '3:4',
  3: '16:9',
  4: '4:3',
  5: '9:16',
  6: '2:3',
  7: '3:2',
  8: '21:9',
}

function toUniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  )
}

function buildStepsParam(model: JimengModel): ModelParamSpec | null {
  const steps = model.sample_steps
  if (!steps || typeof steps.steps !== 'number') {
    return null
  }

  return {
    key: 'steps',
    label: '采样步数',
    type: 'number',
    default: steps.steps,
    min: typeof steps.min_steps === 'number' ? steps.min_steps : undefined,
    max: typeof steps.max_steps === 'number' ? steps.max_steps : undefined,
  }
}

function buildResolutionParam(model: JimengModel): ModelParamSpec | null {
  const resolutionKeys = Object.keys(model.resolution_map ?? {})
  if (resolutionKeys.length === 0) {
    return null
  }

  const defaultResolution = resolutionKeys.includes('2k')
    ? '2k'
    : resolutionKeys[0]

  return {
    key: 'resolution',
    label: '清晰度',
    type: 'enum',
    default: defaultResolution,
    options: resolutionKeys,
  }
}

function buildAspectRatioParam(model: JimengModel): ModelParamSpec | null {
  const labels = Object.values(model.resolution_map ?? {}).flatMap((resolution) =>
    (resolution.image_ratio_sizes ?? [])
      .map((item) => (typeof item.ratio_type === 'number' ? RATIO_LABELS[item.ratio_type] : null)),
  )
  const options = toUniqueStrings(labels)

  if (options.length === 0) {
    return null
  }

  const defaultOption = options.includes('1:1') ? '1:1' : options[0]
  return {
    key: 'aspectRatio',
    label: '宽高比',
    type: 'enum',
    default: defaultOption,
    options,
  }
}

function buildBlendCapabilityParams(model: JimengModel): ModelParamSpec[] {
  const blendEnable = model.blend_enable ?? {}
  const featConfig = model.feat_config ?? {}
  const params: ModelParamSpec[] = []

  const featureDefinitions: Array<{
    sourceKey: string
    paramKey: string
    label: string
  }> = [
    { sourceKey: 'face_swap', paramKey: 'enableFaceSwap', label: '参考人物长相' },
    { sourceKey: 'bg_paint', paramKey: 'enableBgPaint', label: '参考主体' },
    { sourceKey: 'canny', paramKey: 'enableCanny', label: '边缘轮廓' },
    { sourceKey: 'depth', paramKey: 'enableDepth', label: '景深控制' },
    { sourceKey: 'pose', paramKey: 'enablePose', label: '姿势控制' },
  ]

  for (const definition of featureDefinitions) {
    if (blendEnable[definition.sourceKey] !== true) {
      continue
    }
    params.push({
      key: definition.paramKey,
      label: definition.label,
      type: 'boolean',
      default: false,
    })

    const strength = featConfig[definition.sourceKey]?.strength
    if (typeof strength === 'number') {
      params.push({
        key: `${definition.paramKey}Strength`,
        label: `${definition.label}强度`,
        type: 'number',
        default: strength,
        min: 0,
        max: 1,
      })
    }
  }

  return params
}

function buildTags(model: JimengModel): string[] {
  return toUniqueStrings([
    'jimeng-proxy',
    'jimeng',
    '即梦',
    model.generation_category_name,
    model.extra?.model_source,
    model.extra?.raw_model_source,
    ...(Array.isArray(model.feats) ? model.feats : []),
  ])
}

export function mapJimengImageModelToModelSpec(model: JimengModel): ModelSpec | null {
  const rawId = typeof model.model_req_key === 'string' ? model.model_req_key.trim() : ''
  if (!rawId) {
    return null
  }

  const nameParts = toUniqueStrings([
    model.model_name,
    model.generation_category_name,
  ])
  const displayName = nameParts.length > 0 ? nameParts.join(' / ') : rawId

  const params = [
    buildResolutionParam(model),
    buildAspectRatioParam(model),
    buildStepsParam(model),
    ...buildBlendCapabilityParams(model),
  ].filter((param): param is ModelParamSpec => Boolean(param))

  return {
    id: buildScopedModelId(JIMENG_VIRTUAL_CHANNEL_ID, rawId),
    rawId,
    name: `${displayName}（${JIMENG_IMAGE_SOURCE_NAME}）`,
    channelId: JIMENG_VIRTUAL_CHANNEL_ID,
    sourceName: JIMENG_IMAGE_SOURCE_NAME,
    tags: buildTags(model),
    params,
  }
}

export function mapJimengImageConfigToModelCatalog(payload: unknown): ModelCatalog {
  const modelList = (payload as JimengImageConfigPayload | null)?.data?.model_list
  if (!Array.isArray(modelList)) {
    return { models: [] }
  }

  return {
    models: modelList
      .map((model) => mapJimengImageModelToModelSpec(model))
      .filter((model): model is ModelSpec => Boolean(model)),
  }
}

export function saveJimengModelCatalog(catalog: ModelCatalog): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(JIMENG_MODEL_CATALOG_STORAGE_KEY, JSON.stringify(catalog))
}

export function loadJimengModelCatalog(): ModelCatalog {
  if (typeof window === 'undefined') {
    return { models: [] }
  }
  try {
    const raw = window.localStorage.getItem(JIMENG_MODEL_CATALOG_STORAGE_KEY)
    if (!raw) {
      return { models: [] }
    }
    const parsed = JSON.parse(raw) as ModelCatalog
    return Array.isArray(parsed?.models) ? parsed : { models: [] }
  } catch {
    return { models: [] }
  }
}

export function clearJimengModelCatalog(): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(JIMENG_MODEL_CATALOG_STORAGE_KEY)
}
