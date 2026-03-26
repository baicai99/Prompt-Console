import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ImagePreviewSource } from '../../../../types/image'
import { useResolvedImagePreview } from './useResolvedImagePreview'

function buildSource(refKey: string): ImagePreviewSource {
  return {
    refKind: 'idb-blob',
    refKey,
  }
}

describe('useResolvedImagePreview', () => {
  it('resolves idb-blob previews from loading to ready', async () => {
    const resolveImagePreviewSource = vi.fn().mockImplementation(async () => ({
      src: '/resolved-asset-1.png',
      kind: 'idb-blob' as const,
      release: () => {},
      cleanup: () => {},
    }))

    const { result } = renderHook(() => useResolvedImagePreview({
      source: buildSource('asset-1'),
      resolveImagePreviewSource,
      request: { priority: 'modal' },
    }))

    expect(result.current.status).toBe('loading')

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.src).toBe('/resolved-asset-1.png')
  })

  it('ignores stale async results after switching sources', async () => {
    const staleCleanup = vi.fn()
    const pendingResolvers = new Map<string, (value: {
      src: string
      kind: 'idb-blob'
      release: () => void
      cleanup: () => void
    }) => void>()
    const resolveImagePreviewSource = vi.fn().mockImplementation((source: ImagePreviewSource) => (
      new Promise((resolve) => {
        pendingResolvers.set(source.refKey ?? '', resolve)
      })
    ))

    const { result, rerender } = renderHook(({ source }: { source: ImagePreviewSource }) => useResolvedImagePreview({
      source,
      resolveImagePreviewSource,
      request: { priority: 'modal' },
    }), {
      initialProps: { source: buildSource('asset-a') },
    })

    rerender({ source: buildSource('asset-b') })

    act(() => {
      pendingResolvers.get('asset-b')?.({
        src: '/resolved-asset-b.png',
        kind: 'idb-blob',
        release: () => {},
        cleanup: () => {},
      })
    })

    await waitFor(() => {
      expect(result.current.src).toBe('/resolved-asset-b.png')
    })

    act(() => {
      pendingResolvers.get('asset-a')?.({
        src: '/resolved-asset-a.png',
        kind: 'idb-blob',
        release: () => {},
        cleanup: staleCleanup,
      })
    })

    await waitFor(() => {
      expect(result.current.src).toBe('/resolved-asset-b.png')
    })

    expect(staleCleanup).toHaveBeenCalledTimes(1)
  })
})
