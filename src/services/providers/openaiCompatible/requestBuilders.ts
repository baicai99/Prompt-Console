import type { SettingPrimitive } from '../../../types/conversation'
import type { NormalizedImageRequest } from '../../../types/provider'
import {
  getBooleanParam,
  getFluxOutputFormat,
  getNumberParam,
  getStringParam,
  isFluxModel,
  isKlingModel,
  resolveFluxSize,
  resolveKlingAspectRatio,
  resolveRequestedAspectRatio,
  toPixelSize,
} from './paramResolvers'

export function buildRequestBody(
  requestModelId: string,
  prompt: string,
  paramValues: Record<string, SettingPrimitive>,
): Record<string, unknown> {
  if (isKlingModel(requestModelId)) {
    const negativePrompt = getStringParam(
      paramValues,
      'negativePrompt',
      getStringParam(paramValues, 'negative_prompt', ''),
    )
    const referenceImage = getStringParam(paramValues, 'image', getStringParam(paramValues, 'referenceImage', ''))
    const imageFidelityRaw = getNumberParam(paramValues, ['imageFidelity', 'image_fidelity'])
    const imageFidelity =
      typeof imageFidelityRaw === 'number' ? Math.max(0, Math.min(1, imageFidelityRaw)) : undefined
    const callbackUrl = getStringParam(paramValues, 'callbackUrl', getStringParam(paramValues, 'callback_url', ''))
    const modelName = getStringParam(paramValues, 'modelName', getStringParam(paramValues, 'model_name', requestModelId))

    return {
      prompt,
      model_name: modelName || 'kling-v1',
      n: 1,
      aspect_ratio: resolveKlingAspectRatio(paramValues),
      ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
      ...(referenceImage ? { image: referenceImage } : {}),
      ...(typeof imageFidelity === 'number' ? { image_fidelity: imageFidelity } : {}),
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    }
  }

  if (isFluxModel(requestModelId)) {
    const seed = getNumberParam(paramValues, ['seed'])
    const promptUpsampling = getBooleanParam(paramValues, ['promptUpsampling', 'prompt_upsampling'])
    const safetyToleranceRaw = getNumberParam(paramValues, ['safetyTolerance', 'safety_tolerance'])
    const safetyTolerance =
      typeof safetyToleranceRaw === 'number'
        ? Math.max(0, Math.min(6, Math.floor(safetyToleranceRaw)))
        : undefined

    return {
      model: requestModelId,
      prompt,
      size: resolveFluxSize(paramValues),
      output_format: getFluxOutputFormat(paramValues),
      ...(typeof seed === 'number' ? { seed: Math.floor(seed) } : {}),
      ...(typeof promptUpsampling === 'boolean' ? { prompt_upsampling: promptUpsampling } : {}),
      ...(typeof safetyTolerance === 'number' ? { safety_tolerance: safetyTolerance } : {}),
    }
  }

  const responseFormat = getStringParam(paramValues, 'responseFormat', 'b64_json')
  const selectedSize = getStringParam(paramValues, 'size', '1024x1024')
  const selectedAspectRatio = getStringParam(paramValues, 'aspectRatio', '1:1')
  const resolvedSize = toPixelSize(selectedSize, selectedAspectRatio)

  return {
    model: requestModelId,
    prompt,
    response_format: responseFormat,
    size: resolvedSize,
  }
}

export function buildEditsFormData(
  requestModelId: string,
  prompt: string,
  paramValues: Record<string, SettingPrimitive>,
  sourceImages: NonNullable<NormalizedImageRequest['sourceImages']>,
): FormData {
  const responseFormat = getStringParam(paramValues, 'responseFormat', 'b64_json')
  const selectedSize = getStringParam(paramValues, 'size', '1024x1024')
  const selectedAspectRatio = resolveRequestedAspectRatio(paramValues)
  const resolvedSize = toPixelSize(selectedSize, selectedAspectRatio ?? '1:1')
  const formData = new FormData()

  formData.append('model', requestModelId)
  formData.append('prompt', prompt)
  formData.append('response_format', responseFormat)
  formData.append('size', resolvedSize)
  if (selectedAspectRatio && /^\d+:\d+$/.test(selectedAspectRatio)) {
    formData.append('aspect_ratio', selectedAspectRatio)
  }

  for (const sourceImage of sourceImages.slice(0, 6)) {
    const type = sourceImage.mimeType?.trim() || sourceImage.blob.type || 'application/octet-stream'
    const normalizedBlob =
      sourceImage.blob.type === type ? sourceImage.blob : sourceImage.blob.slice(0, sourceImage.blob.size, type)
    const fileName = sourceImage.fileName?.trim() || 'image.png'
    formData.append('image', normalizedBlob, fileName)
  }

  return formData
}
