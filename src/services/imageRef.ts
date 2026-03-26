import type { ImageItem, ImagePreviewSource } from '../types/image'
import { getImageBlob } from './imageAssetStore'

export interface ResolvedImageSource {
  src: string
  sourceKind: 'idb' | 'direct'
  revoke?: () => void
}

type ImageDisplaySource = Pick<ImageItem, 'thumbRef' | 'fileRef' | 'fullRef' | 'refKind' | 'refKey'>

export function getImageDisplaySrc(image: ImageDisplaySource): string | null {
  if (image.thumbRef?.trim()) {
    return image.thumbRef
  }
  if (image.fileRef?.trim()) {
    return image.fileRef
  }
  if (image.fullRef?.trim()) {
    return image.fullRef
  }
  if (image.refKind === 'url' && image.refKey?.trim()) {
    return image.refKey
  }
  return null
}

export function toImagePreviewSource(image: ImageDisplaySource): ImagePreviewSource {
  return {
    src: getImageDisplaySrc(image) ?? undefined,
    refKind: image.refKind,
    refKey: image.refKey,
  }
}

export function isDownloadableImageRef(image: ImageItem): boolean {
  if (image.status !== 'success') {
    return false
  }
  if (getImageDisplaySrc(image)) {
    return true
  }
  return image.refKind === 'idb-blob' && Boolean(image.refKey)
}

export async function resolveImageSourceForDownload(image: ImageItem): Promise<ResolvedImageSource | null> {
  if (image.status !== 'success') {
    return null
  }

  if (image.refKind === 'idb-blob' && image.refKey) {
    const blob = await getImageBlob(image.refKey)
    if (blob) {
      const src = URL.createObjectURL(blob)
      return {
        src,
        sourceKind: 'idb',
        revoke: () => URL.revokeObjectURL(src),
      }
    }
  }

  const preferred = image.fullRef ?? image.fileRef ?? image.thumbRef
  if (preferred?.trim()) {
    return { src: preferred, sourceKind: 'direct' }
  }

  if (image.refKind === 'url' && image.refKey?.trim()) {
    return { src: image.refKey, sourceKind: 'direct' }
  }

  return null
}
