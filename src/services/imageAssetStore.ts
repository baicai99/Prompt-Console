import {
  emitImageChainTrace,
  emitStorageEstimateTrace,
  summarizeBlob,
  summarizeString,
} from './imageChainTrace'

const IMAGE_DB_NAME = 'm3-image-assets-db'
const IMAGE_DB_VERSION = 1
const IMAGE_STORE = 'image-assets'

interface ImageAssetRecord {
  id: string
  blob: Blob
  createdAt: number
  updatedAt: number
  size: number
}

let dbPromise: Promise<IDBDatabase | null> | null = null
const TRACE_FILE = 'src/services/imageAssetStore.ts'
const TRACE_MODULE = 'imageAssetStore'

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) {
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'openDb',
      stage: 'idb_unavailable',
      level: 'warn',
      detail: {
        hasIndexedDb: false,
      },
    })
    return Promise.resolve(null)
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'openDb',
        stage: 'idb_open_started',
        detail: {
          dbName: IMAGE_DB_NAME,
          dbVersion: IMAGE_DB_VERSION,
          store: IMAGE_STORE,
        },
      })
      const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          db.createObjectStore(IMAGE_STORE, { keyPath: 'id' })
        }
        emitImageChainTrace({
          file: TRACE_FILE,
          module: TRACE_MODULE,
          fn: 'openDb',
          stage: 'idb_upgrade_needed',
          detail: {
            dbName: IMAGE_DB_NAME,
            objectStoreNames: Array.from(db.objectStoreNames),
          },
        })
      }
      request.onsuccess = () => {
        emitImageChainTrace({
          file: TRACE_FILE,
          module: TRACE_MODULE,
          fn: 'openDb',
          stage: 'idb_open_succeeded',
          detail: {
            dbName: request.result.name,
            objectStoreNames: Array.from(request.result.objectStoreNames),
          },
        })
        resolve(request.result)
      }
      request.onerror = () => {
        emitImageChainTrace({
          file: TRACE_FILE,
          module: TRACE_MODULE,
          fn: 'openDb',
          stage: 'idb_open_failed',
          level: 'error',
          error: request.error,
          detail: {
            dbName: IMAGE_DB_NAME,
          },
        })
        resolve(null)
      }
    })
  }

  return dbPromise
}

export async function putImageBlob(id: string, blob: Blob): Promise<void> {
  emitImageChainTrace({
    file: TRACE_FILE,
    module: TRACE_MODULE,
    fn: 'putImageBlob',
    stage: 'idb_put_started',
    traceId: id,
    detail: {
      assetKey: summarizeString(id),
      blob: summarizeBlob(blob),
    },
  })
  const db = await openDb()
  if (!db) {
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'putImageBlob',
      stage: 'idb_put_skipped_no_db',
      level: 'warn',
      traceId: id,
      detail: {
        assetKey: summarizeString(id),
      },
    })
    return
  }

  const now = Date.now()
  const record: ImageAssetRecord = {
    id,
    blob,
    createdAt: now,
    updatedAt: now,
    size: blob.size,
  }

  await new Promise<void>((resolve) => {
    const tx = db.transaction(IMAGE_STORE, 'readwrite')
    const store = tx.objectStore(IMAGE_STORE)
    store.put(record)
    tx.oncomplete = () => {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'putImageBlob',
        stage: 'idb_put_completed',
        traceId: id,
        detail: {
          assetKey: summarizeString(id),
          blob: summarizeBlob(blob),
        },
      })
      emitStorageEstimateTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'putImageBlob',
        stage: 'idb_put_storage_estimate',
        traceId: id,
        detail: {
          assetKey: summarizeString(id),
        },
      })
      resolve()
    }
    tx.onerror = () => {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'putImageBlob',
        stage: 'idb_put_failed',
        level: 'error',
        traceId: id,
        error: tx.error ?? store.transaction.error,
        detail: {
          assetKey: summarizeString(id),
          blob: summarizeBlob(blob),
        },
      })
      resolve()
    }
    tx.onabort = () => {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'putImageBlob',
        stage: 'idb_put_aborted',
        level: 'warn',
        traceId: id,
        error: tx.error ?? store.transaction.error,
        detail: {
          assetKey: summarizeString(id),
        },
      })
      resolve()
    }
  })
}

export async function getImageBlob(id: string): Promise<Blob | null> {
  emitImageChainTrace({
    file: TRACE_FILE,
    module: TRACE_MODULE,
    fn: 'getImageBlob',
    stage: 'idb_get_started',
    traceId: id,
    detail: {
      assetKey: summarizeString(id),
    },
  })
  const db = await openDb()
  if (!db) {
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'getImageBlob',
      stage: 'idb_get_skipped_no_db',
      level: 'warn',
      traceId: id,
      detail: {
        assetKey: summarizeString(id),
      },
    })
    return null
  }

  return new Promise((resolve) => {
    const tx = db.transaction(IMAGE_STORE, 'readonly')
    const store = tx.objectStore(IMAGE_STORE)
    const request = store.get(id)
    request.onsuccess = () => {
      const value = request.result as ImageAssetRecord | undefined
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'getImageBlob',
        stage: value?.blob ? 'idb_get_hit' : 'idb_get_miss',
        level: value?.blob ? 'log' : 'warn',
        traceId: id,
        detail: {
          assetKey: summarizeString(id),
          blob: summarizeBlob(value?.blob ?? null),
          recordSize: value?.size ?? null,
        },
      })
      emitStorageEstimateTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'getImageBlob',
        stage: 'idb_get_storage_estimate',
        traceId: id,
        detail: {
          assetKey: summarizeString(id),
        },
      })
      resolve(value?.blob ?? null)
    }
    request.onerror = () => {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'getImageBlob',
        stage: 'idb_get_failed',
        level: 'error',
        traceId: id,
        error: request.error,
        detail: {
          assetKey: summarizeString(id),
        },
      })
      resolve(null)
    }
  })
}

export async function deleteImageBlob(id: string): Promise<void> {
  const db = await openDb()
  if (!db) {
    return
  }

  await new Promise<void>((resolve) => {
    const tx = db.transaction(IMAGE_STORE, 'readwrite')
    const store = tx.objectStore(IMAGE_STORE)
    store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'deleteImageBlob',
        stage: 'idb_delete_failed',
        level: 'warn',
        traceId: id,
        error: tx.error ?? store.transaction.error,
        detail: {
          assetKey: summarizeString(id),
        },
      })
      resolve()
    }
    tx.onabort = () => resolve()
  })
}

export async function clearImageBlobs(): Promise<void> {
  const db = await openDb()
  if (!db) {
    return
  }

  await new Promise<void>((resolve) => {
    const tx = db.transaction(IMAGE_STORE, 'readwrite')
    const store = tx.objectStore(IMAGE_STORE)
    store.clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => {
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'clearImageBlobs',
        stage: 'idb_clear_failed',
        level: 'warn',
        error: tx.error ?? store.transaction.error,
      })
      resolve()
    }
    tx.onabort = () => resolve()
  })
}
