import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationNotifier } from './conversationNotifier'
import { triggerZipDownload } from './conversationDownloadService'

const zipArchives: Array<Array<{ name: string; data: Blob }>> = []

vi.mock('jszip', () => {
  return {
    default: class MockJSZip {
      private files: Array<{ name: string; data: Blob }> = []

      file(name: string, data: Blob) {
        this.files.push({ name, data })
      }

      async generateAsync() {
        zipArchives.push([...this.files])
        return new Blob(['zip'], { type: 'application/zip' })
      }
    },
  }
})

function createNotifier() {
  const notifier: ConversationNotifier = {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    notify: vi.fn(),
  }

  return {
    notifier,
    info: notifier.info as ReturnType<typeof vi.fn>,
    warning: notifier.warning as ReturnType<typeof vi.fn>,
    error: notifier.error as ReturnType<typeof vi.fn>,
  }
}

describe('conversationDownloadService', () => {
  const clickedDownloads: Array<{ href: string; download: string }> = []
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    zipArchives.length = 0
    clickedDownloads.length = 0
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:generated-${zipArchives.length + clickedDownloads.length + 1}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownloads.push({
        href: this.href,
        download: this.download,
      })
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('packages readable images into a single zip archive', async () => {
    const { notifier, info, warning, error } = createNotifier()
    const sameOriginUrl = new URL('/assets/image-1.png', window.location.origin).toString()

    fetchMock.mockImplementation(async () => {
      return new Response(new Blob(['image'], { type: 'image/png' }), { status: 200 })
    })

    await triggerZipDownload({
      items: [
        { src: sameOriginUrl, filename: 'image-1.png', sourceKind: 'direct' },
        { src: 'blob:asset-1', filename: 'image-2.png', sourceKind: 'idb' },
      ],
      archivePrefix: 'run-images',
      notifier,
    })

    expect(zipArchives).toHaveLength(1)
    expect(zipArchives[0]?.map((item) => item.name)).toEqual(['image-1.png', 'image-2.png'])
    expect(clickedDownloads).toHaveLength(1)
    expect(clickedDownloads[0]?.download).toMatch(/^run-images-.*\.zip$/)
    expect(info).not.toHaveBeenCalled()
    expect(warning).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('mixes zip packaging with native downloads for cross-origin images', async () => {
    const { notifier, info, warning, error } = createNotifier()
    const sameOriginUrl = new URL('/assets/image-1.png', window.location.origin).toString()
    const crossOriginUrl = 'https://img.example/cross-origin.png'

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === sameOriginUrl) {
        return new Response(new Blob(['local'], { type: 'image/png' }), { status: 200 })
      }
      if (url === crossOriginUrl) {
        throw new TypeError('Failed to fetch')
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    await triggerZipDownload({
      items: [
        { src: sameOriginUrl, filename: 'image-1.png', sourceKind: 'direct' },
        { src: crossOriginUrl, filename: 'image-2.png', sourceKind: 'direct' },
      ],
      archivePrefix: 'run-images',
      notifier,
    })

    expect(zipArchives).toHaveLength(1)
    expect(zipArchives[0]?.map((item) => item.name)).toEqual(['image-1.png'])
    expect(clickedDownloads).toHaveLength(2)
    expect(clickedDownloads.some((item) => /^run-images-.*\.zip$/.test(item.download))).toBe(true)
    expect(clickedDownloads).toContainEqual({
      href: crossOriginUrl,
      download: 'image-2.png',
    })
    expect(warning).toHaveBeenCalledWith('部分图片已打包为 zip，另有 1 张因浏览器跨域限制改为逐张下载。')
    expect(info).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('falls back to native downloads when every image is cross-origin', async () => {
    const { notifier, info, warning, error } = createNotifier()
    const firstUrl = 'https://img.example/a.png'
    const secondUrl = 'https://img.example/b.png'

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await triggerZipDownload({
      items: [
        { src: firstUrl, filename: 'image-1.png', sourceKind: 'direct' },
        { src: secondUrl, filename: 'image-2.png', sourceKind: 'direct' },
      ],
      archivePrefix: 'run-images',
      notifier,
    })

    expect(zipArchives).toHaveLength(0)
    expect(clickedDownloads).toEqual([
      { href: firstUrl, download: 'image-1.png' },
      { href: secondUrl, download: 'image-2.png' },
    ])
    expect(info).toHaveBeenCalledWith('已开始逐张下载 2 张跨域图片。浏览器可能会提示允许多个下载。')
    expect(warning).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('warns about unreadable same-origin images without failing the whole batch', async () => {
    const { notifier, info, warning, error } = createNotifier()
    const firstUrl = new URL('/assets/good.png', window.location.origin).toString()
    const secondUrl = new URL('/assets/bad.png', window.location.origin).toString()

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === firstUrl) {
        return new Response(new Blob(['ok'], { type: 'image/png' }), { status: 200 })
      }
      if (url === secondUrl) {
        return new Response('nope', { status: 500 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    await triggerZipDownload({
      items: [
        { src: firstUrl, filename: 'good.png', sourceKind: 'direct' },
        { src: secondUrl, filename: 'bad.png', sourceKind: 'direct' },
      ],
      archivePrefix: 'run-images',
      notifier,
    })

    expect(zipArchives).toHaveLength(1)
    expect(zipArchives[0]?.map((item) => item.name)).toEqual(['good.png'])
    expect(clickedDownloads).toHaveLength(1)
    expect(clickedDownloads[0]?.download).toMatch(/^run-images-.*\.zip$/)
    expect(warning).toHaveBeenCalledWith('压缩包已下载，但有 1 张图片未能打包。')
    expect(info).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })
})
