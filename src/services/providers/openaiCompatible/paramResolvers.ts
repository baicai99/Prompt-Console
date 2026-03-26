import type { SettingPrimitive } from '../../../types/conversation'
import { getComputedPresetResolution, normalizeSizeTier } from '../../imageSizing'

export function getStringParam(
  paramValues: Record<string, SettingPrimitive>,
  key: string,
  fallback: string,
): string {
  const value = paramValues[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function isPixelSize(value: string): boolean {
  return /^\d+x\d+$/i.test(value)
}

export function toPixelSize(rawSize: string, aspectRatio: string): string {
  if (isPixelSize(rawSize)) {
    return rawSize
  }

  if (/^\d+:\d+$/.test(rawSize)) {
    const computedByAspect = getComputedPresetResolution(rawSize, '1K')
    return computedByAspect ?? '1024x1024'
  }

  const computedByTier = getComputedPresetResolution(aspectRatio, normalizeSizeTier(rawSize))
  return computedByTier ?? '1024x1024'
}

export function isFluxModel(modelId: string): boolean {
  const value = modelId.trim().toLowerCase()
  return value === 'flux' || value.startsWith('flux-') || value.startsWith('flux.')
}

export function isKlingModel(modelId: string): boolean {
  const value = modelId.trim().toLowerCase()
  return value.includes('kling')
}

export function isRatioSize(value: string): boolean {
  return /^\d+:\d+$/.test(value.trim())
}

export function getBooleanParam(
  paramValues: Record<string, SettingPrimitive>,
  keys: string[],
): boolean | undefined {
  for (const key of keys) {
    const value = paramValues[key]
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
  }
  return undefined
}

export function getNumberParam(
  paramValues: Record<string, SettingPrimitive>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = paramValues[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return undefined
}

export function getFluxOutputFormat(paramValues: Record<string, SettingPrimitive>): 'jpeg' | 'png' {
  const raw = getStringParam(paramValues, 'outputFormat', getStringParam(paramValues, 'output_format', 'png'))
  const normalized = raw.trim().toLowerCase()
  return normalized === 'jpeg' ? 'jpeg' : 'png'
}

export function normalizeRatioText(input: string): string | null {
  const matched = input.trim().match(/^(\d+)\s*:\s*(\d+)$/)
  if (!matched) {
    return null
  }
  const left = Number(matched[1])
  const right = Number(matched[2])
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
    return null
  }
  const gcd = (a: number, b: number): number => {
    let x = Math.abs(a)
    let y = Math.abs(b)
    while (y !== 0) {
      const temp = y
      y = x % y
      x = temp
    }
    return x || 1
  }
  const divisor = gcd(left, right)
  return `${Math.floor(left / divisor)}:${Math.floor(right / divisor)}`
}

export function pixelSizeToRatio(input: string): string | null {
  const matched = input.trim().match(/^(\d+)\s*x\s*(\d+)$/i)
  if (!matched) {
    return null
  }
  return normalizeRatioText(`${matched[1]}:${matched[2]}`)
}

export function resolveRequestedAspectRatio(paramValues: Record<string, SettingPrimitive>): string | null {
  const ratioByAspect = normalizeRatioText(getStringParam(paramValues, 'aspectRatio', ''))
  if (ratioByAspect) {
    return ratioByAspect
  }

  const size = getStringParam(paramValues, 'size', '')
  const ratioBySize = normalizeRatioText(size) ?? pixelSizeToRatio(size)
  if (ratioBySize) {
    return ratioBySize
  }
  return null
}

export function resolveKlingAspectRatio(paramValues: Record<string, SettingPrimitive>): string {
  const ratio = resolveRequestedAspectRatio(paramValues)
  if (ratio) {
    return ratio
  }
  return '1:1'
}

export function resolveFluxSize(paramValues: Record<string, SettingPrimitive>): string {
  const selectedSize = getStringParam(paramValues, 'size', '')
  const selectedAspectRatio = getStringParam(paramValues, 'aspectRatio', '1:1')

  if (selectedSize && (isPixelSize(selectedSize) || isRatioSize(selectedSize))) {
    return selectedSize
  }
  if (isRatioSize(selectedAspectRatio)) {
    return selectedAspectRatio
  }
  if (selectedSize) {
    return toPixelSize(selectedSize, selectedAspectRatio)
  }
  return '1:1'
}

export function getModelCandidates(modelId: string): string[] {
  const aliases: Record<string, string[]> = {
    'nano-banana': ['nano-banana', 'gemini-2.5-flash-image'],
    'gemini-2.5-flash-image': ['gemini-2.5-flash-image', 'nano-banana'],
    'nano-banana-pro': ['nano-banana-pro', 'gemini-3-pro-image-preview'],
    'gemini-3-pro-image-preview': ['gemini-3-pro-image-preview', 'nano-banana-pro'],
    'nano-banana-pro-2k': ['nano-banana-pro-2k', 'nano-banana-pro', 'gemini-3-pro-image-preview'],
    'nano-banana-pro-4k': ['nano-banana-pro-4k', 'nano-banana-pro', 'gemini-3-pro-image-preview'],
    'gemini-3.1-flash-image-preview-0.5k': [
      'gemini-3.1-flash-image-preview-0.5k',
      'gemini-3.1-flash-image-preview',
    ],
    'gemini-3.1-flash-image-preview-2k': [
      'gemini-3.1-flash-image-preview-2k',
      'gemini-3.1-flash-image-preview',
    ],
    'gemini-3.1-flash-image-preview-4k': [
      'gemini-3.1-flash-image-preview-4k',
      'gemini-3.1-flash-image-preview',
    ],
  }

  const candidates = aliases[modelId] ?? [modelId]
  return Array.from(new Set(candidates))
}
