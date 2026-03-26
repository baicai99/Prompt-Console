import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRunExecutor } from '../runExecutor'
import * as imageAssetStore from '../../../../services/imageAssetStore'

const baseSettings = {
  resolution: '1K',
  aspectRatio: '1:1',
  imageCount: 2,
  gridColumns: 2,
  sizeMode: 'preset' as const,
  customWidth: 1024,
  customHeight: 1024,
  autoSave: true,
  saveDirectory: 'picked:test',
  channelId: null,
  modelId: 'model-a',
  paramValues: {},
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runExecutor', () => {
  it('returns auth failures when channel is missing', async () => {
    const executor = createRunExecutor()
    const run = await executor.createRun({
      batchId: 'batch',
      sideMode: 'single',
      side: 'single',
      settings: baseSettings,
      templatePrompt: 'x',
      finalPrompt: 'x',
      variablesSnapshot: {},
      modelId: 'model-a',
      modelName: 'Model A',
      paramsSnapshot: {},
      channel: undefined,
    })

    expect(run.images).toHaveLength(2)
    expect(run.images.every((item) => item.status === 'failed' && item.errorCode === 'auth')).toBe(true)
  })

  it('creates successful runs when provider returns images', async () => {
    const mockGenerateImages = vi.fn().mockResolvedValue({
      items: [
        { seq: 1, src: 'u1' },
        { seq: 2, src: 'u2' },
      ],
    })
    const mockAutoSaveImage = vi.fn().mockResolvedValue(true)
    const executor = createRunExecutor({ generateImagesFn: mockGenerateImages, autoSaveImageFn: mockAutoSaveImage })
    const run = await executor.createRun({
      batchId: 'batch',
      sideMode: 'single',
      side: 'single',
      settings: { ...baseSettings, channelId: 'ch' },
      templatePrompt: 'x',
      finalPrompt: 'x',
      variablesSnapshot: {},
      modelId: 'model-a',
      modelName: 'Model A',
      paramsSnapshot: {},
      channel: { id: 'ch', name: 'n', baseUrl: 'https://example.com', apiKey: 'key' },
    })

    expect(mockGenerateImages).toHaveBeenCalledTimes(1)
    expect(mockAutoSaveImage).toHaveBeenCalledTimes(0)
    expect(run.images.map((item) => item.status)).toEqual(['success', 'success'])
  })

  it('publishes per-image progress while preserving partial failures', async () => {
    const mockGenerateImages = vi.fn().mockImplementation(async (input: {
      onImageCompleted?: (item: { seq: number; src?: string; error?: string }) => void
    }) => {
      input.onImageCompleted?.({ seq: 1, src: 'u1' })
      input.onImageCompleted?.({ seq: 2, error: 'boom' })
      return {
        items: [
          { seq: 1, src: 'u1' },
          { seq: 2, error: 'boom' },
        ],
      }
    })
    const onImageProgress = vi.fn()
    const executor = createRunExecutor({ generateImagesFn: mockGenerateImages })
    const run = await executor.createRun({
      batchId: 'batch',
      sideMode: 'single',
      side: 'single',
      settings: { ...baseSettings, channelId: 'ch' },
      templatePrompt: 'x',
      finalPrompt: 'x',
      variablesSnapshot: {},
      modelId: 'model-a',
      modelName: 'Model A',
      paramsSnapshot: {},
      channel: { id: 'ch', name: 'n', baseUrl: 'https://example.com', apiKey: 'key' },
      onImageProgress,
    })

    expect(onImageProgress).toHaveBeenCalledTimes(2)
    expect(run.images.map((item) => item.status)).toEqual(['success', 'failed'])
  })

  it('does not throw when base64 data url is invalid', async () => {
    const invalidDataUrl = 'data:image/png;base64,not-a-valid-base64-@@@'
    const mockGenerateImages = vi.fn().mockResolvedValue({
      items: [{ seq: 1, src: invalidDataUrl }],
    })
    const executor = createRunExecutor({ generateImagesFn: mockGenerateImages })

    const run = await executor.createRun({
      batchId: 'batch',
      sideMode: 'single',
      side: 'single',
      settings: { ...baseSettings, imageCount: 1, channelId: 'ch' },
      templatePrompt: 'x',
      finalPrompt: 'x',
      variablesSnapshot: {},
      modelId: 'model-a',
      modelName: 'Model A',
      paramsSnapshot: {},
      channel: { id: 'ch', name: 'n', baseUrl: 'https://example.com', apiKey: 'key' },
    })

    expect(run.images).toHaveLength(1)
    expect(run.images[0]?.status).toBe('success')
  })

  it('stores local successful images as asset references instead of inline previews', async () => {
    const dataUrl = 'data:image/png;base64,aGVsbG8='
    const putImageBlobFn = vi.fn().mockResolvedValue(undefined)
    const mockGenerateImages = vi.fn().mockResolvedValue({
      items: [{ seq: 1, src: dataUrl }],
    })
    const executor = createRunExecutor({ generateImagesFn: mockGenerateImages, putImageBlobFn })

    const run = await executor.createRun({
      batchId: 'batch',
      sideMode: 'single',
      side: 'single',
      settings: { ...baseSettings, imageCount: 1, channelId: 'ch' },
      templatePrompt: 'x',
      finalPrompt: 'x',
      variablesSnapshot: {},
      modelId: 'model-a',
      modelName: 'Model A',
      paramsSnapshot: {},
      channel: { id: 'ch', name: 'n', baseUrl: 'https://example.com', apiKey: 'key' },
    })

    expect(putImageBlobFn).toHaveBeenCalledTimes(1)
    expect(run.images[0]).toMatchObject({
      status: 'success',
      refKind: 'idb-blob',
    })
    expect(run.images[0]?.refKey).toMatch(/^asset:/)
    expect(run.images[0]?.thumbRef).toBeUndefined()
    expect(run.images[0]?.fileRef).toBeUndefined()
    expect(run.images[0]?.fullRef).toBeUndefined()
  })

  it('stores readable remote images as local assets without retaining direct preview urls', async () => {
    const remoteUrl = 'https://img.example/result.png'
    const remoteBlob = new Blob(['remote-image'], { type: 'image/png' })
    const putImageBlobFn = vi.fn().mockResolvedValue(undefined)
    const fetchFn = vi.fn().mockResolvedValue(new Response(remoteBlob, { status: 200 }))
    const mockGenerateImages = vi.fn().mockResolvedValue({
      items: [{ seq: 1, src: remoteUrl }],
    })
    const executor = createRunExecutor({
      generateImagesFn: mockGenerateImages,
      putImageBlobFn,
      fetchFn,
    })

    const run = await executor.createRun({
      batchId: 'batch',
      sideMode: 'single',
      side: 'single',
      settings: { ...baseSettings, imageCount: 1, channelId: 'ch' },
      templatePrompt: 'x',
      finalPrompt: 'x',
      variablesSnapshot: {},
      modelId: 'model-a',
      modelName: 'Model A',
      paramsSnapshot: {},
      channel: { id: 'ch', name: 'n', baseUrl: 'https://example.com', apiKey: 'key' },
    })

    expect(fetchFn).toHaveBeenCalledWith(remoteUrl)
    expect(putImageBlobFn).toHaveBeenCalledTimes(1)
    expect(run.images[0]).toMatchObject({
      status: 'success',
      refKind: 'idb-blob',
      bytes: expect.any(Number),
    })
    expect(run.images[0]?.refKey).toMatch(/^asset:/)
    expect(run.images[0]?.bytes).toBeGreaterThan(0)
    expect(run.images[0]?.thumbRef).toBeUndefined()
    expect(run.images[0]?.fileRef).toBeUndefined()
    expect(run.images[0]?.fullRef).toBeUndefined()
  })

  it('keeps remote urls when browser cannot read them as blobs', async () => {
    const remoteUrl = 'https://img.example/result.png'
    const putImageBlobFn = vi.fn().mockResolvedValue(undefined)
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const mockGenerateImages = vi.fn().mockResolvedValue({
      items: [{ seq: 1, src: remoteUrl }],
    })
    const executor = createRunExecutor({
      generateImagesFn: mockGenerateImages,
      putImageBlobFn,
      fetchFn,
    })

    const run = await executor.createRun({
      batchId: 'batch',
      sideMode: 'single',
      side: 'single',
      settings: { ...baseSettings, imageCount: 1, channelId: 'ch' },
      templatePrompt: 'x',
      finalPrompt: 'x',
      variablesSnapshot: {},
      modelId: 'model-a',
      modelName: 'Model A',
      paramsSnapshot: {},
      channel: { id: 'ch', name: 'n', baseUrl: 'https://example.com', apiKey: 'key' },
    })

    expect(fetchFn).toHaveBeenCalledWith(remoteUrl)
    expect(putImageBlobFn).not.toHaveBeenCalled()
    expect(run.images[0]).toMatchObject({
      status: 'success',
      thumbRef: remoteUrl,
      fileRef: remoteUrl,
      refKind: 'url',
      refKey: remoteUrl,
    })
    expect(run.images[0]?.fullRef).toBeUndefined()
  })

  it('keeps pending images and task handles when provider returns async task registration', async () => {
    const mockGenerateImages = vi.fn().mockImplementation(async (input: {
      onTaskRegistered?: (item: { seq: number; serverTaskId?: string; serverTaskMeta?: Record<string, string> }) => void
    }) => {
      input.onTaskRegistered?.({ seq: 1, serverTaskId: 'task-1', serverTaskMeta: { resumeUrl: 'https://example.com/tasks/task-1' } })
      return {
        items: [{ seq: 1, serverTaskId: 'task-1', serverTaskMeta: { resumeUrl: 'https://example.com/tasks/task-1' } }],
      }
    })
    const onImageProgress = vi.fn()
    const executor = createRunExecutor({ generateImagesFn: mockGenerateImages })

    const run = await executor.createRun({
      batchId: 'batch',
      sideMode: 'single',
      side: 'single',
      settings: { ...baseSettings, imageCount: 1, channelId: 'ch' },
      templatePrompt: 'x',
      finalPrompt: 'x',
      variablesSnapshot: {},
      modelId: 'model-a',
      modelName: 'Model A',
      paramsSnapshot: {},
      channel: { id: 'ch', name: 'n', baseUrl: 'https://example.com', apiKey: 'key' },
      onImageProgress,
    })

    expect(onImageProgress).toHaveBeenCalledWith(expect.objectContaining({
      seq: 1,
      status: 'pending',
      threadState: 'active',
      serverTaskId: 'task-1',
    }))
    expect(run.images[0]).toMatchObject({
      status: 'pending',
      threadState: 'active',
      serverTaskId: 'task-1',
      serverTaskMeta: { resumeUrl: 'https://example.com/tasks/task-1' },
    })
  })

  it('passes persisted source images to provider request', async () => {
    const sourceBlob = new Blob(['image'], { type: 'image/png' })
    vi.spyOn(imageAssetStore, 'getImageBlob').mockResolvedValue(sourceBlob)
    const mockGenerateImages = vi.fn().mockResolvedValue({
      items: [{ seq: 1, src: 'u1' }],
    })
    const executor = createRunExecutor({ generateImagesFn: mockGenerateImages })

    await executor.createRun({
      batchId: 'batch',
      sideMode: 'single',
      side: 'single',
      settings: { ...baseSettings, imageCount: 1, channelId: 'ch' },
      templatePrompt: 'x',
      finalPrompt: 'x',
      variablesSnapshot: {},
      modelId: 'model-a',
      modelName: 'Model A',
      paramsSnapshot: {},
      sourceImages: [{
        id: 'img-1',
        assetKey: 'asset:key:1',
        fileName: 'ref.png',
        mimeType: 'image/png',
        size: 5,
      }],
      channel: { id: 'ch', name: 'n', baseUrl: 'https://example.com', apiKey: 'key' },
    })

    expect(mockGenerateImages).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({
        sourceImages: [
          expect.objectContaining({
            fileName: 'ref.png',
            mimeType: 'image/png',
          }),
        ],
      }),
    }))
  })

  it('returns readable failures when all source image blobs are missing', async () => {
    vi.spyOn(imageAssetStore, 'getImageBlob').mockResolvedValue(null)
    const mockGenerateImages = vi.fn()
    const executor = createRunExecutor({ generateImagesFn: mockGenerateImages })

    const run = await executor.createRun({
      batchId: 'batch',
      sideMode: 'single',
      side: 'single',
      settings: { ...baseSettings, imageCount: 1, channelId: 'ch' },
      templatePrompt: 'x',
      finalPrompt: 'x',
      variablesSnapshot: {},
      modelId: 'model-a',
      modelName: 'Model A',
      paramsSnapshot: {},
      sourceImages: [{
        id: 'img-1',
        assetKey: 'asset:key:1',
        fileName: 'ref.png',
        mimeType: 'image/png',
        size: 5,
      }],
      channel: { id: 'ch', name: 'n', baseUrl: 'https://example.com', apiKey: 'key' },
    })

    expect(mockGenerateImages).not.toHaveBeenCalled()
    expect(run.images[0]?.status).toBe('failed')
    expect(run.images[0]?.error).toContain('参考图已失效')
  })

  it('bounds local successful image post-processing concurrency', async () => {
    let activeWrites = 0
    let maxActiveWrites = 0
    const dataUrl = 'data:image/png;base64,aGVsbG8='
    const mockGenerateImages = vi.fn().mockImplementation(async (input: {
      onImageCompleted?: (item: { seq: number; src?: string; error?: string }) => void
    }) => {
      for (let seq = 1; seq <= 4; seq += 1) {
        input.onImageCompleted?.({ seq, src: dataUrl })
      }
      return {
        items: Array.from({ length: 4 }, (_, index) => ({
          seq: index + 1,
          src: dataUrl,
        })),
      }
    })
    const putImageBlobFn = vi.fn().mockImplementation(async () => {
      activeWrites += 1
      maxActiveWrites = Math.max(maxActiveWrites, activeWrites)
      await new Promise((resolve) => setTimeout(resolve, 10))
      activeWrites -= 1
    })

    const executor = createRunExecutor({
      generateImagesFn: mockGenerateImages,
      putImageBlobFn,
    })

    const run = await executor.createRun({
      batchId: 'batch',
      sideMode: 'single',
      side: 'single',
      settings: { ...baseSettings, imageCount: 4, channelId: 'ch', autoSave: false },
      templatePrompt: 'x',
      finalPrompt: 'x',
      variablesSnapshot: {},
      modelId: 'model-a',
      modelName: 'Model A',
      paramsSnapshot: {},
      channel: { id: 'ch', name: 'n', baseUrl: 'https://example.com', apiKey: 'key' },
    })

    expect(run.images).toHaveLength(4)
    expect(run.images.every((item) => item.status === 'success')).toBe(true)
    expect(putImageBlobFn).toHaveBeenCalledTimes(4)
    expect(maxActiveWrites).toBeLessThanOrEqual(2)
  })
})
