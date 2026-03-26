import { describe, expect, it } from 'vitest'
import type { ImageTask, Run } from '../../../../types/conversation'
import type { ImageItem } from '../../../../types/image'
import {
  getResumeTransportLabel,
  getRunProgressSummary,
  resolveImageDisplayState,
  resolveImageLifecycleStatus,
} from './imageTaskDisplayState'

function makeRun(overrides?: Partial<Run>): Run {
  return {
    id: 'run-1',
    batchId: 'batch-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    sideMode: 'single',
    side: 'single',
    prompt: 'prompt',
    imageCount: 1,
    channelId: null,
    channelName: null,
    modelId: 'model-1',
    modelName: 'Model 1',
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
    images: [{
      id: 'img-1',
      seq: 1,
      status: 'pending',
      threadState: 'active',
    }],
    ...overrides,
  }
}

function makeTask(status: ImageTask['status'], seq = 1, overrides?: Partial<ImageTask>): ImageTask {
  return {
    taskId: `task-${seq}`,
    runId: 'run-1',
    batchId: 'batch-1',
    side: 'single',
    seq,
    finalPrompt: 'prompt',
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    queuedAt: '2026-01-01T00:00:00.000Z',
    threadState: 'active',
    ...overrides,
  }
}

describe('imageTaskDisplayState', () => {
  it('shows local scheduler wait as waiting', () => {
    const run = makeRun({
      taskState: { status: 'waiting', updatedAt: '2026-01-01T00:00:00.000Z' },
    })

    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
      task: makeTask('queued'),
    })

    expect(result.variant).toBe('pending-waiting')
    expect(result.label).toBe('等待中')
  })

  it('shows request sending only before server acceptance', () => {
    const run = makeRun()
    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
      task: makeTask('submitting'),
    })

    expect(result.label).toBe('请求发送中')
    expect(resolveImageLifecycleStatus({ run, image: run.images[0] as ImageItem, task: makeTask('submitting') })).toBe('request_sending')
  })

  it('shows queued after task handle is returned', () => {
    const run = makeRun({
      images: [{
        id: 'img-1',
        seq: 1,
        status: 'pending',
        threadState: 'active',
        serverTaskId: 'task-1',
      }],
    })
    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
      task: makeTask('polling', 1, { serverTaskId: 'task-1' }),
    })

    expect(result.label).toBe('排队中')
  })

  it('uses provider processing status to show generating', () => {
    const run = makeRun()
    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
      task: makeTask('running', 1, { providerTaskStatus: 'processing' }),
    })

    expect(result.label).toBe('生成中')
  })

  it('treats detached queued work as background queueing', () => {
    const run = makeRun({
      images: [{
        id: 'img-1',
        seq: 1,
        status: 'pending',
        threadState: 'detached',
        serverTaskId: 'task-1',
      }],
    })
    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
      task: makeTask('polling', 1, {
        serverTaskId: 'task-1',
        threadState: 'detached',
      }),
    })

    expect(result.label).toBe('后台排队中')
    expect(result.isBackground).toBe(true)
  })

  it('maps failure categories to distinct user-facing labels', () => {
    const failures: Array<{ code: NonNullable<ImageItem['errorCode']>; expected: string }> = [
      { code: 'request_failed', expected: '请求失败' },
      { code: 'queue_failed', expected: '排队失败' },
      { code: 'generation_failed', expected: '生成失败' },
      { code: 'timeout', expected: '已超时' },
      { code: 'cancelled', expected: '已取消' },
      { code: 'rejected', expected: '敏感词已拦截' },
      { code: 'unsupported_param', expected: '参数错误' },
      { code: 'insufficient_balance', expected: '余额不足' },
      { code: 'auth', expected: '认证失败' },
      { code: 'rate_limit', expected: '服务繁忙' },
      { code: 'result_invalid', expected: '结果异常' },
    ]

    failures.forEach(({ code, expected }) => {
      const run = makeRun({
        images: [{
          id: `img-${code}`,
          seq: 1,
          status: 'failed',
          threadState: 'settled',
          error: expected,
          errorCode: code,
        }],
      })
      const result = resolveImageDisplayState({
        run,
        image: run.images[0] as ImageItem,
        task: makeTask('failed', 1, { errorCode: code, error: expected }),
      })

      expect(result.label).toBe(expected)
    })
  })

  it('shows short request failure reason inside failed placeholder label', () => {
    const run = makeRun({
      images: [{
        id: 'img-request-failed',
        seq: 1,
        status: 'failed',
        threadState: 'settled',
        error: 'failed to fetch https://api.example.com/v1/jobs/123',
        errorCode: 'request_failed',
      }],
    })

    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
      task: makeTask('failed', 1, {
        errorCode: 'request_failed',
        error: 'failed to fetch https://api.example.com/v1/jobs/123',
      }),
    })

    expect(result.label).toBe('请求失败：网络异常')
  })

  it('shows short service busy reason extracted from provider message', () => {
    const run = makeRun({
      images: [{
        id: 'img-busy',
        seq: 1,
        status: 'failed',
        threadState: 'settled',
        error: 'HTTP 500: {"message":"当前分组上游负载已饱和，请稍后再试"}',
        errorCode: 'unknown',
      }],
    })

    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
      task: makeTask('failed', 1, {
        error: 'HTTP 500: {"message":"当前分组上游负载已饱和，请稍后再试"}',
      }),
    })

    expect(result.label).toBe('服务繁忙：上游繁忙')
  })

  it('classifies balance exhaustion messages into the insufficient balance state', () => {
    const run = makeRun({
      images: [{
        id: 'img-balance',
        seq: 1,
        status: 'failed',
        threadState: 'settled',
        error: 'HTTP 402: {"message":"insufficient_quota, please recharge"}',
        errorCode: 'unknown',
      }],
    })

    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
      task: makeTask('failed', 1, {
        error: 'HTTP 402: {"message":"insufficient_quota, please recharge"}',
        errorCode: 'unknown',
      }),
    })

    expect(result.label).toBe('余额不足')
    expect(getRunProgressSummary(run, {
      1: makeTask('failed', 1, {
        error: 'HTTP 402: {"message":"insufficient_quota, please recharge"}',
        errorCode: 'unknown',
      }),
    })).toBe('余额不足')
  })

  it('falls back to category label when no short reason can be extracted', () => {
    const run = makeRun({
      images: [{
        id: 'img-generic',
        seq: 1,
        status: 'failed',
        threadState: 'settled',
        error: '',
        errorCode: 'request_failed',
      }],
    })

    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
      task: makeTask('failed', 1, { errorCode: 'request_failed', error: '' }),
    })

    expect(result.label).toBe('请求失败')
  })

  it('cleans and truncates long invalid-result failures into a short reason', () => {
    const longError = 'HTTP 502: {"message":"invalid base64 payload returned from upstream image worker after multiple retries and validation checks"}'
    const run = makeRun({
      images: [{
        id: 'img-invalid',
        seq: 1,
        status: 'failed',
        threadState: 'settled',
        error: longError,
        errorCode: 'result_invalid',
      }],
    })

    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
      task: makeTask('failed', 1, { errorCode: 'result_invalid', error: longError }),
    })

    expect(result.label).toBe('结果异常：返回结果无效')
  })

  it('maps machine-oriented upstream status codes to a human-friendly reason', () => {
    const machineError = 'HTTP 502 {"type":"bad_response_status_code","message":"openai_error"}'
    const run = makeRun({
      images: [{
        id: 'img-upstream-status',
        seq: 1,
        status: 'failed',
        threadState: 'settled',
        error: machineError,
        errorCode: 'request_failed',
      }],
    })

    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
      task: makeTask('failed', 1, { errorCode: 'request_failed', error: machineError }),
    })

    expect(result.label).toBe('请求失败：上游服务器异常状态')
  })

  it('marks success without renderable refs as result invalid', () => {
    const run = makeRun({
      images: [{
        id: 'img-1',
        seq: 1,
        status: 'success',
        threadState: 'settled',
      }],
    })
    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
    })

    expect(result.label).toBe('结果异常')
  })

  it('returns completed summary when all images are done', () => {
    const run = makeRun({
      images: [{
        id: 'img-1',
        seq: 1,
        status: 'success',
        threadState: 'settled',
        fileRef: 'https://img.example/1.png',
      }],
    })

    expect(getRunProgressSummary(run, {
      1: makeTask('succeeded', 1, { fileRef: 'https://img.example/1.png' }),
    })).toBe('已完成')
  })

  it('builds mixed progress summary from lifecycle states', () => {
    const run = makeRun({
      imageCount: 4,
      images: [
        { id: 'img-1', seq: 1, status: 'pending', threadState: 'active' },
        { id: 'img-2', seq: 2, status: 'pending', threadState: 'active' },
        { id: 'img-3', seq: 3, status: 'pending', threadState: 'active', serverTaskId: 'task-3' },
        { id: 'img-4', seq: 4, status: 'pending', threadState: 'active' },
      ],
    })

    const summary = getRunProgressSummary(run, {
      1: makeTask('queued', 1),
      2: makeTask('submitting', 2),
      3: makeTask('polling', 3, { serverTaskId: 'task-3' }),
      4: makeTask('running', 4, { providerTaskStatus: 'processing' }),
    })

    expect(summary).toBe('1 张等待中，1 张处理中，1 张排队中，1 张生成中')
  })

  it('preserves stream transport overlay while showing generating state', () => {
    expect(getResumeTransportLabel({ ...makeTask('running'), resumeTransport: 'stream' })).toBe('链式传输')
    const run = makeRun()
    const result = resolveImageDisplayState({
      run,
      image: run.images[0] as ImageItem,
      task: { ...makeTask('running'), resumeTransport: 'stream', providerTaskStatus: 'processing' },
    })
    expect(result.label).toBe('生成中')
  })

  it('shows direct method when image returns without resume transport', () => {
    expect(getResumeTransportLabel(undefined, {
      id: 'img-direct',
      seq: 1,
      status: 'success',
      threadState: 'settled',
      fileRef: 'https://img.example/direct.png',
    })).toBe('直连')
  })
})
