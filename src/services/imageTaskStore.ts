import { safeReadStorage, safeRemoveStorage, safeWriteStorage } from '../utils/safeStorage'

export interface PersistedImageTask {
  id: string
  conversationId: string
  runId: string
  imageId: string
  seq: number
  channelId: string | null
  serverTaskId?: string
  serverTaskMeta?: Record<string, string>
  createdAt: string
  updatedAt: string
}

const LEGACY_REGISTRY_KEY = 'm3:image-task-registry'
const INDEX_KEY = 'm3:image-task-registry-index'
const TASK_KEY_PREFIX = 'm3:image-task-registry:'

export const IMAGE_TASK_REGISTRY_LEGACY_KEY = LEGACY_REGISTRY_KEY
export const IMAGE_TASK_REGISTRY_INDEX_KEY = INDEX_KEY
export const IMAGE_TASK_REGISTRY_KEY_PREFIX = TASK_KEY_PREFIX

function buildTaskKey(conversationId: string): string {
  return `${TASK_KEY_PREFIX}${conversationId}`
}

function readIndex(): string[] {
  const raw = safeReadStorage(INDEX_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeIndex(entries: string[]): void {
  safeWriteStorage(INDEX_KEY, JSON.stringify(entries))
}

function addToIndex(conversationId: string): void {
  const index = readIndex()
  if (index.includes(conversationId)) {
    return
  }
  writeIndex([...index, conversationId])
}

function removeFromIndex(conversationId: string): void {
  const index = readIndex()
  const next = index.filter((item) => item !== conversationId)
  if (next.length === index.length) {
    return
  }
  if (next.length === 0) {
    safeRemoveStorage(INDEX_KEY)
    return
  }
  writeIndex(next)
}

function loadConversationTasks(conversationId: string): PersistedImageTask[] {
  const raw = safeReadStorage(buildTaskKey(conversationId))
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is PersistedImageTask => {
      if (!item || typeof item !== 'object') {
        return false
      }
      return typeof (item as PersistedImageTask).id === 'string'
    })
  } catch {
    return []
  }
}

function writeConversationTasks(conversationId: string, tasks: PersistedImageTask[]): void {
  if (tasks.length === 0) {
    safeRemoveStorage(buildTaskKey(conversationId))
    removeFromIndex(conversationId)
    return
  }
  safeWriteStorage(buildTaskKey(conversationId), JSON.stringify(tasks))
  addToIndex(conversationId)
}

function migrateLegacyRegistry(): void {
  const legacy = safeReadStorage(LEGACY_REGISTRY_KEY)
  if (!legacy) {
    return
  }
  try {
    const parsed = JSON.parse(legacy)
    if (!Array.isArray(parsed)) {
      safeRemoveStorage(LEGACY_REGISTRY_KEY)
      return
    }
    const buckets: Record<string, PersistedImageTask[]> = {}
    for (const task of parsed) {
      if (!task || typeof task !== 'object') {
        continue
      }
      const candidate = task as PersistedImageTask
      if (typeof candidate.conversationId !== 'string') {
        continue
      }
      buckets[candidate.conversationId] = buckets[candidate.conversationId] ?? []
      buckets[candidate.conversationId].push(candidate)
    }
    Object.entries(buckets).forEach(([conversationId, tasks]) => {
      writeConversationTasks(conversationId, tasks)
    })
  } catch {
    // ignore; fall through to cleanup
  }
  safeRemoveStorage(LEGACY_REGISTRY_KEY)
}

export function makeImageTaskId(conversationId: string, runId: string, imageId: string): string {
  return `${conversationId}:${runId}:${imageId}`
}

export function loadImageTasks(): PersistedImageTask[] {
  migrateLegacyRegistry()
  const index = readIndex()
  return index.flatMap((conversationId) => loadConversationTasks(conversationId))
}

export function upsertImageTask(task: PersistedImageTask): void {
  const tasks = loadConversationTasks(task.conversationId)
  const next = tasks.filter((candidate) => candidate.id !== task.id)
  next.push(task)
  writeConversationTasks(task.conversationId, next)
}

export function removeImageTask(taskId: string): void {
  const index = readIndex()
  for (const conversationId of index) {
    const tasks = loadConversationTasks(conversationId)
    const next = tasks.filter((task) => task.id !== taskId)
    if (next.length === tasks.length) {
      continue
    }
    writeConversationTasks(conversationId, next)
    break
  }
}

export function removeImageTasksForConversation(conversationId: string): void {
  safeRemoveStorage(buildTaskKey(conversationId))
  removeFromIndex(conversationId)
}

export function replaceImageTasksForConversation(conversationId: string, nextTasks: PersistedImageTask[]): void {
  writeConversationTasks(conversationId, nextTasks)
}

export function clearImageTasks(): void {
  const index = readIndex()
  index.forEach((conversationId) => {
    safeRemoveStorage(buildTaskKey(conversationId))
  })
  safeRemoveStorage(INDEX_KEY)
  safeRemoveStorage(LEGACY_REGISTRY_KEY)
}
