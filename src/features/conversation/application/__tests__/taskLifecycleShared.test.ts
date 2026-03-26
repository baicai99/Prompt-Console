import { describe, expect, it } from 'vitest'
import {
  buildCancelledRunImagePatch,
  buildFailedRunImagePatch,
  buildPendingRunImagePatch,
  buildSucceededRunImagePatch,
  patchRunImage,
  settleRunTaskState,
} from '../taskLifecycle/shared'
import type { Run } from '../../../../types/conversation'

function createRun(status: Run['images'][number]['status'] = 'pending'): Run {
  return {
    id: 'run-1',
    batchId: 'batch-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    sideMode: 'single',
    side: 'single',
    prompt: 'prompt',
    imageCount: 1,
    channelId: 'ch-1',
    channelName: 'main',
    modelId: 'model-a',
    modelName: 'Model A',
    templatePrompt: 'prompt',
    finalPrompt: 'prompt',
    variablesSnapshot: {},
    paramsSnapshot: {},
    settingsSnapshot: {
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount: 1,
      gridColumns: 1,
      sizeMode: 'preset',
      customWidth: 1024,
      customHeight: 1024,
      autoSave: false,
    },
    retryAttempt: 0,
    images: [
      {
        id: 'img-1',
        seq: 1,
        status,
      },
    ],
  }
}

describe('taskLifecycle shared helpers', () => {
  it('builds standard patches for run images', () => {
    expect(buildCancelledRunImagePatch()).toMatchObject({
      status: 'failed',
      threadState: 'settled',
      error: '任务已取消',
      errorCode: 'unknown',
    })
    expect(buildPendingRunImagePatch({ providerTaskStatus: 'queued' })).toMatchObject({
      status: 'pending',
      threadState: 'active',
      providerTaskStatus: 'queued',
    })
    expect(buildFailedRunImagePatch({ error: 'boom', errorCode: 'timeout' })).toMatchObject({
      status: 'failed',
      threadState: 'settled',
      error: 'boom',
      errorCode: 'timeout',
    })
    expect(buildSucceededRunImagePatch({ fileRef: '/ok.png', thumbRef: '/ok.png' })).toMatchObject({
      status: 'success',
      threadState: 'settled',
      fileRef: '/ok.png',
      thumbRef: '/ok.png',
    })
  })

  it('patches images and settles run task state', () => {
    const patched = patchRunImage(createRun(), 1, buildSucceededRunImagePatch({ fileRef: '/ok.png' }))
    expect(patched.images[0]).toMatchObject({
      status: 'success',
      fileRef: '/ok.png',
    })

    const settled = settleRunTaskState(patched)
    expect(settled.taskState?.status).toBe('completed')
  })
})
