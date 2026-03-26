import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConversationSourceImagePreviewService } from './conversationSourceImagePreviewService'

describe('conversationSourceImagePreviewService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes through direct preview sources without allocating object urls', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:unused')
    const service = createConversationSourceImagePreviewService({
      getImageBlobFn: vi.fn(),
    })

    const preview = await service.acquirePreview({
      src: 'https://img.example/result.png',
      refKind: 'url',
      refKey: 'https://img.example/result.png',
    })

    expect(preview?.src).toBe('https://img.example/result.png')
    expect(preview?.kind).toBe('direct')
    expect(createObjectUrlSpy).not.toHaveBeenCalled()
  })

  it('shares and releases idb-backed preview urls by reference count', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:asset-1')
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const getImageBlobFn = vi.fn().mockResolvedValue(new Blob(['hello'], { type: 'image/png' }))
    const service = createConversationSourceImagePreviewService({ getImageBlobFn })

    const first = await service.acquirePreview({
      refKind: 'idb-blob',
      refKey: 'asset:1',
    })
    const second = await service.acquirePreview({
      refKind: 'idb-blob',
      refKey: 'asset:1',
    })

    expect(first?.src).toBe('blob:asset-1')
    expect(second?.src).toBe('blob:asset-1')
    expect(getImageBlobFn).toHaveBeenCalledTimes(1)
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)
    expect(service.peekPreviewStats()).toEqual({
      cacheSize: 1,
      cacheCount: 1,
      totalRefs: 2,
      inflightCount: 0,
      createdObjectUrls: 1,
      revokedObjectUrls: 0,
      activeObjectUrls: 1,
      activeCount: 1,
      blockedByBudgetCount: 0,
      maxActivePreviews: 24,
    })

    first?.release()
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled()
    expect(service.peekPreviewStats()).toEqual({
      cacheSize: 1,
      cacheCount: 1,
      totalRefs: 1,
      inflightCount: 0,
      createdObjectUrls: 1,
      revokedObjectUrls: 0,
      activeObjectUrls: 1,
      activeCount: 1,
      blockedByBudgetCount: 0,
      maxActivePreviews: 24,
    })

    second?.release()
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:asset-1')
    expect(service.peekPreviewStats()).toEqual({
      cacheSize: 0,
      cacheCount: 0,
      totalRefs: 0,
      inflightCount: 0,
      createdObjectUrls: 1,
      revokedObjectUrls: 1,
      activeObjectUrls: 0,
      activeCount: 0,
      blockedByBudgetCount: 0,
      maxActivePreviews: 24,
    })
  })

  it('blocks visible preview allocation when the budget is exhausted but lets modal previews bypass it', async () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:asset-1')
      .mockReturnValueOnce('blob:asset-2')
    const getImageBlobFn = vi.fn().mockResolvedValue(new Blob(['hello'], { type: 'image/png' }))
    const service = createConversationSourceImagePreviewService({
      getImageBlobFn,
      maxActivePreviews: 1,
    })

    const first = await service.acquirePreview({
      refKind: 'idb-blob',
      refKey: 'asset:1',
    })
    const blocked = await service.acquirePreview({
      refKind: 'idb-blob',
      refKey: 'asset:2',
    })
    const modal = await service.acquirePreview(
      {
        refKind: 'idb-blob',
        refKey: 'asset:2',
      },
      { priority: 'modal' },
    )

    expect(first?.src).toBe('blob:asset-1')
    expect(blocked).toBeNull()
    expect(modal?.src).toBe('blob:asset-2')
    expect(service.peekPreviewStats().blockedByBudgetCount).toBe(1)

    first?.release()
    modal?.release()
  })

  it('exposes a lightweight prefetch handle that reuses the shared preview cache', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:asset-3')
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const getImageBlobFn = vi.fn().mockResolvedValue(new Blob(['prefetch'], { type: 'image/png' }))
    const service = createConversationSourceImagePreviewService({ getImageBlobFn })

    const prefetch = await service.prefetchPreview({
      refKind: 'idb-blob',
      refKey: 'asset:3',
    }, { priority: 'modal' })

    expect(prefetch).not.toBeNull()
    expect(service.peekPreviewStats().totalRefs).toBe(1)

    const acquired = await service.acquirePreview({
      refKind: 'idb-blob',
      refKey: 'asset:3',
    })

    expect(acquired?.src).toBe('blob:asset-3')
    expect(getImageBlobFn).toHaveBeenCalledTimes(1)
    expect(service.peekPreviewStats().totalRefs).toBe(2)

    prefetch?.cleanup()
    expect(service.peekPreviewStats().totalRefs).toBe(1)

    acquired?.release()
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:asset-3')
  })
})
