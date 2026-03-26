import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearImageTasks,
  IMAGE_TASK_REGISTRY_INDEX_KEY,
  IMAGE_TASK_REGISTRY_KEY_PREFIX,
  IMAGE_TASK_REGISTRY_LEGACY_KEY,
  loadImageTasks,
  removeImageTask,
  removeImageTasksForConversation,
  replaceImageTasksForConversation,
  upsertImageTask,
} from './imageTaskStore'
import type { PersistedImageTask } from './imageTaskStore'

function makeTask(input: { id: string; conversationId: string }) {
  return {
    id: input.id,
    conversationId: input.conversationId,
    runId: `${input.id}-run`,
    imageId: `${input.id}-image`,
    seq: 1,
    channelId: 'ch-1',
    serverTaskId: `${input.id}-task`,
    createdAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:00:00.000Z',
  }
}

describe('imageTaskStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores tasks per conversation and preserves unrelated payloads', () => {
    replaceImageTasksForConversation('c1', [makeTask({ id: 't1', conversationId: 'c1' })])
    replaceImageTasksForConversation('c2', [makeTask({ id: 't2', conversationId: 'c2' })])
    const payloadBefore = localStorage.getItem(`${IMAGE_TASK_REGISTRY_KEY_PREFIX}c1`)

    replaceImageTasksForConversation('c1', [makeTask({ id: 't1b', conversationId: 'c1' })])

    expect(localStorage.getItem(`${IMAGE_TASK_REGISTRY_KEY_PREFIX}c1`)).not.toBe(payloadBefore)
    const parsedIndex = JSON.parse(localStorage.getItem(IMAGE_TASK_REGISTRY_INDEX_KEY) ?? '[]')
    expect(parsedIndex).toContain('c1')
    expect(parsedIndex).toContain('c2')
    expect((JSON.parse(localStorage.getItem(`${IMAGE_TASK_REGISTRY_KEY_PREFIX}c1`) ?? '[]') as PersistedImageTask[]).map((task) => task.id)).toEqual(['t1b'])
    expect((JSON.parse(localStorage.getItem(`${IMAGE_TASK_REGISTRY_KEY_PREFIX}c2`) ?? '[]') as PersistedImageTask[]).map((task) => task.id)).toEqual(['t2'])
    expect(loadImageTasks().map((task) => task.id).sort()).toEqual(['t1b', 't2'])
  })

  it('loads legacy registry payload from the shared storage key', () => {
    localStorage.setItem(
      IMAGE_TASK_REGISTRY_LEGACY_KEY,
      JSON.stringify([
        makeTask({ id: 't1', conversationId: 'c1' }),
        makeTask({ id: 't2', conversationId: 'c2' }),
      ]),
    )

    expect(loadImageTasks().map((task) => task.id).sort()).toEqual(['t1', 't2'])
    expect(localStorage.getItem(IMAGE_TASK_REGISTRY_LEGACY_KEY)).toBeNull()
    const parsedIndex = JSON.parse(localStorage.getItem(IMAGE_TASK_REGISTRY_INDEX_KEY) ?? '[]')
    expect(parsedIndex).toContain('c1')
    expect(parsedIndex).toContain('c2')
    expect((JSON.parse(localStorage.getItem(`${IMAGE_TASK_REGISTRY_KEY_PREFIX}c1`) ?? '[]') as PersistedImageTask[]).some((task) => task.id === 't1')).toBe(true)
    expect((JSON.parse(localStorage.getItem(`${IMAGE_TASK_REGISTRY_KEY_PREFIX}c2`) ?? '[]') as PersistedImageTask[]).some((task) => task.id === 't2')).toBe(true)
  })

  it('removes tasks for one conversation cleanly', () => {
    replaceImageTasksForConversation('c1', [makeTask({ id: 't1', conversationId: 'c1' })])
    replaceImageTasksForConversation('c2', [makeTask({ id: 't2', conversationId: 'c2' })])

    removeImageTasksForConversation('c1')

    expect(loadImageTasks().map((task) => task.id)).toEqual(['t2'])

    clearImageTasks()
    expect(loadImageTasks()).toEqual([])
  })

  it('supports upsert and remove while keeping buckets isolated', () => {
    replaceImageTasksForConversation('c1', [makeTask({ id: 't1', conversationId: 'c1' })])
    replaceImageTasksForConversation('c2', [makeTask({ id: 't2', conversationId: 'c2' })])

    upsertImageTask(makeTask({ id: 't1', conversationId: 'c1' }))
    upsertImageTask(makeTask({ id: 't3', conversationId: 'c1' }))

    removeImageTask('t1')

    expect(loadImageTasks().map((task) => task.id).sort()).toEqual(['t2', 't3'])
  })
})
