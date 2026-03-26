import {
  INDEXED_DB_NAME,
  INDEXED_DB_STORE,
  INDEXED_DB_VERSION,
} from './constants'

export interface ConversationContentRecord {
  id: string
  payload: string
  updatedAt: string
}

let indexedDbPromise: Promise<IDBDatabase | null> | null = null

export function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

export function openConversationDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) {
    return Promise.resolve(null)
  }

  if (!indexedDbPromise) {
    indexedDbPromise = new Promise((resolve) => {
      const request = indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(INDEXED_DB_STORE)) {
          db.createObjectStore(INDEXED_DB_STORE, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    })
  }

  return indexedDbPromise
}

export async function idbGetConversationRecord(conversationId: string): Promise<ConversationContentRecord | null> {
  const db = await openConversationDb()
  if (!db) {
    return null
  }

  return new Promise((resolve) => {
    const transaction = db.transaction(INDEXED_DB_STORE, 'readonly')
    const store = transaction.objectStore(INDEXED_DB_STORE)
    const request = store.get(conversationId)
    request.onsuccess = () => {
      const value = request.result as ConversationContentRecord | undefined
      resolve(value ?? null)
    }
    request.onerror = () => resolve(null)
  })
}

export async function idbSetConversationRecord(record: ConversationContentRecord): Promise<void> {
  const db = await openConversationDb()
  if (!db) {
    return
  }

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(INDEXED_DB_STORE, 'readwrite')
    const store = transaction.objectStore(INDEXED_DB_STORE)
    store.put(record)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => resolve()
    transaction.onabort = () => resolve()
  })
}

export async function idbDeleteConversationRecord(conversationId: string): Promise<void> {
  const db = await openConversationDb()
  if (!db) {
    return
  }

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(INDEXED_DB_STORE, 'readwrite')
    const store = transaction.objectStore(INDEXED_DB_STORE)
    store.delete(conversationId)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => resolve()
    transaction.onabort = () => resolve()
  })
}

export async function idbClearConversationRecords(): Promise<void> {
  const db = await openConversationDb()
  if (!db) {
    return
  }

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(INDEXED_DB_STORE, 'readwrite')
    const store = transaction.objectStore(INDEXED_DB_STORE)
    store.clear()
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => resolve()
    transaction.onabort = () => resolve()
  })
}
