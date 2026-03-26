import type { ConversationNotifier } from './conversationNotifier'

export interface BulkDownloadItem {
  src: string
  filename: string
  sourceKind: 'idb' | 'direct'
  cleanup?: () => void
}

export interface ConversationDownloadService {
  inferImageExtension: (src: string) => string
  downloadSingleImage: (input: {
    src: string
    filename: string
    cleanup?: () => void
  }) => Promise<void>
  downloadZipArchive: (input: {
    items: BulkDownloadItem[]
    archivePrefix: string
  }) => Promise<void>
}

const DOWNLOAD_RELEASE_DELAY_MS = 60_000

type ZipReadResult =
  | { kind: 'zip'; blob: Blob }
  | { kind: 'native-fallback' }
  | { kind: 'failed' }

async function toDownloadHref(src: string): Promise<{ href: string; revoke?: () => void }> {
  if (typeof window === 'undefined') {
    return { href: src }
  }

  if (/^https?:\/\//i.test(src)) {
    try {
      const response = await fetch(src)
      if (response.ok) {
        const blob = await response.blob()
        const href = URL.createObjectURL(blob)
        return {
          href,
          revoke: () => URL.revokeObjectURL(href),
        }
      }
    } catch {
      // Fall back to original source if fetch is blocked by CORS or network errors.
    }
  }

  return { href: src }
}

function triggerAnchorDownload(href: string, filename: string): void {
  if (typeof document === 'undefined') {
    return
  }
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function inferImageExtension(src: string): string {
  if (src.startsWith('data:image/')) {
    const match = src.match(/^data:image\/([a-zA-Z0-9+.-]+);/i)
    const ext = match?.[1]?.toLowerCase() ?? 'png'
    return ext === 'jpeg' ? 'jpg' : ext
  }

  try {
    const parsed = new URL(src)
    const value = parsed.pathname.toLowerCase()
    if (value.endsWith('.png')) return 'png'
    if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'jpg'
    if (value.endsWith('.webp')) return 'webp'
  } catch {
    // Ignore URL parsing errors and fallback to png.
  }

  return 'png'
}

export async function triggerSingleImageDownload(input: {
  src: string
  filename: string
  cleanup?: () => void
}): Promise<void> {
  const target = await toDownloadHref(input.src)
  triggerAnchorDownload(target.href, input.filename)

  if (target.revoke) {
    window.setTimeout(() => target.revoke?.(), DOWNLOAD_RELEASE_DELAY_MS)
  }
  const cleanup = input.cleanup
  if (cleanup) {
    window.setTimeout(() => cleanup(), DOWNLOAD_RELEASE_DELAY_MS)
  }
}

function isRemoteHttpUrl(src: string): boolean {
  return /^https?:\/\//i.test(src)
}

function isCrossOriginRemoteUrl(src: string): boolean {
  if (!isRemoteHttpUrl(src)) {
    return false
  }
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const parsed = new URL(src)
    return parsed.origin !== window.location.origin
  } catch {
    return false
  }
}

function scheduleCleanup(cleanup?: () => void): void {
  if (!cleanup || typeof window === 'undefined') {
    return
  }
  window.setTimeout(() => cleanup(), DOWNLOAD_RELEASE_DELAY_MS)
}

async function readItemForZip(item: BulkDownloadItem): Promise<ZipReadResult> {
  try {
    const response = await fetch(item.src)
    if (!response.ok) {
      return isCrossOriginRemoteUrl(item.src)
        ? { kind: 'native-fallback' }
        : { kind: 'failed' }
    }

    return {
      kind: 'zip',
      blob: await response.blob(),
    }
  } catch {
    return isCrossOriginRemoteUrl(item.src)
      ? { kind: 'native-fallback' }
      : { kind: 'failed' }
  }
}

export async function triggerZipDownload(input: {
  items: BulkDownloadItem[]
  archivePrefix: string
  notifier: ConversationNotifier
}): Promise<void> {
  if (typeof document === 'undefined' || input.items.length === 0) {
    return
  }

  const zipItems: Array<{ item: BulkDownloadItem; blob: Blob }> = []
  const nativeFallbackItems: BulkDownloadItem[] = []
  let failedCount = 0

  for (const item of input.items) {
    const result = await readItemForZip(item)
    if (result.kind === 'zip') {
      zipItems.push({ item, blob: result.blob })
      continue
    }
    if (result.kind === 'native-fallback') {
      nativeFallbackItems.push(item)
      continue
    }

    failedCount += 1
    scheduleCleanup(item.cleanup)
  }

  if (zipItems.length > 0) {
    let JSZipCtor: new () => {
      file: (name: string, data: Blob) => void
      generateAsync: (options: {
        type: 'blob'
        compression: 'DEFLATE'
        compressionOptions: { level: number }
      }) => Promise<Blob>
    }

    try {
      const imported = await import('jszip')
      JSZipCtor = imported.default as unknown as typeof JSZipCtor
    } catch {
      zipItems.forEach(({ item }) => scheduleCleanup(item.cleanup))
      input.notifier.error('压缩包模块加载失败，请重试。')
      return
    }

    const zip = new JSZipCtor()
    for (const { item, blob } of zipItems) {
      zip.file(item.filename, blob)
      scheduleCleanup(item.cleanup)
    }

    const archiveBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const downloadName = `${input.archivePrefix}-${timestamp}.zip`
    const href = URL.createObjectURL(archiveBlob)
    triggerAnchorDownload(href, downloadName)
    window.setTimeout(() => URL.revokeObjectURL(href), DOWNLOAD_RELEASE_DELAY_MS)
  }

  let nativeStartedCount = 0
  for (const item of nativeFallbackItems) {
    try {
      await triggerSingleImageDownload({
        src: item.src,
        filename: item.filename,
        cleanup: item.cleanup,
      })
      nativeStartedCount += 1
    } catch {
      failedCount += 1
      scheduleCleanup(item.cleanup)
    }
  }

  if (zipItems.length > 0 && nativeStartedCount > 0) {
    if (failedCount > 0) {
      input.notifier.warning(`部分图片已打包为 zip，另有 ${nativeStartedCount} 张因浏览器跨域限制改为逐张下载；还有 ${failedCount} 张未能下载。`)
      return
    }
    input.notifier.warning(`部分图片已打包为 zip，另有 ${nativeStartedCount} 张因浏览器跨域限制改为逐张下载。`)
    return
  }

  if (zipItems.length > 0) {
    if (failedCount > 0) {
      input.notifier.warning(`压缩包已下载，但有 ${failedCount} 张图片未能打包。`)
    }
    return
  }

  if (nativeStartedCount > 0) {
    if (failedCount > 0) {
      input.notifier.warning(`已开始逐张下载 ${nativeStartedCount} 张跨域图片，但有 ${failedCount} 张未能开始下载。`)
      return
    }
    input.notifier.info(`已开始逐张下载 ${nativeStartedCount} 张跨域图片。浏览器可能会提示允许多个下载。`)
    return
  }

  if (failedCount > 0) {
    input.notifier.error(`下载失败：有 ${failedCount} 张图片未能读取或触发下载。请稍后重试。`)
  }
}

export function createConversationDownloadService(notifier: ConversationNotifier): ConversationDownloadService {
  return {
    inferImageExtension,
    downloadSingleImage(input) {
      return triggerSingleImageDownload(input)
    },
    downloadZipArchive(input) {
      return triggerZipDownload({
        items: input.items,
        archivePrefix: input.archivePrefix,
        notifier,
      })
    },
  }
}
