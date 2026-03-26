const CONVERSATION_DB_NAME = 'm3-conversations-db'
const CONVERSATION_DB_VERSION = 1
const CONVERSATION_STORE_NAME = 'conversation-content'
const IMAGE_DB_NAME = 'm3-image-assets-db'
const IMAGE_DB_VERSION = 1
const IMAGE_STORE_NAME = 'image-assets'

const LOCAL_STORAGE_GROUPS = [
  {
    id: 'conversation-index',
    label: '对话索引',
    purpose: '会话摘要索引与当前激活会话',
    keyPrefixes: ['m1:conversation-index', 'm1:active-conversation-id'],
    storageArea: 'localStorage',
    contentKinds: ['对话索引', '当前激活会话'],
  },
  {
    id: 'conversation-legacy',
    label: '遗留会话正文',
    purpose: 'IndexedDB 不可用或迁移未完成时的旧版会话正文',
    keyPrefixes: ['m1:conversation:'],
    storageArea: 'localStorage',
    contentKinds: ['对话历史正文（遗留）'],
  },
  {
    id: 'channels',
    label: '渠道配置',
    purpose: 'API 渠道与模型列表缓存',
    keyPrefixes: ['m3:channels'],
    storageArea: 'localStorage',
    contentKinds: ['渠道配置'],
  },
  {
    id: 'staged-settings',
    label: '暂存设置',
    purpose: '右侧面板设置与运行偏好',
    keyPrefixes: ['m3:staged-settings', 'm3:settings-panel-collapse'],
    storageArea: 'localStorage',
    contentKinds: ['界面设置', '运行偏好'],
  },
  {
    id: 'image-task-registry',
    label: '图片任务注册表',
    purpose: '图片任务元数据与会话关联关系',
    keyPrefixes: ['m3:image-task-registry'],
    storageArea: 'localStorage',
    contentKinds: ['图片任务元数据'],
  },
  {
    id: 'other',
    label: '其他 localStorage',
    purpose: '未归类的本地键值存储',
    keyPrefixes: [],
    storageArea: 'localStorage',
    contentKinds: ['其他'],
  },
] as const

export type StorageAreaKind =
  | 'indexedDB'
  | 'localStorage'
  | 'sessionStorage'
  | 'cacheStorage'
  | 'opfs'

export type StoragePressureLevel = 'low' | 'medium' | 'high' | 'critical' | 'unknown'
export type StorageLocationStatus = 'active' | 'idle' | 'unsupported'

export interface StorageQuotaSnapshot {
  usageBytes: number | null
  quotaBytes: number | null
  availableBytes: number | null
  usageRatio: number | null
  usageDetails: Record<string, number>
}

export interface StorageLocationSnapshot {
  id: string
  label: string
  storageArea: StorageAreaKind
  status: StorageLocationStatus
  purpose: string
  location: string
  contentKinds: string[]
  usedBytes: number | null
  availableBytes: number | null
  quotaBytes: number | null
  usageRatio: number | null
  pressure: StoragePressureLevel
  warning: string | null
  itemCount: number | null
  itemNames: string[]
  notes: string[]
}

export interface StorageDebugSnapshot {
  refreshedAt: string
  quota: StorageQuotaSnapshot
  indexedDbSummary: {
    usedBytes: number | null
    availableBytes: number | null
    quotaBytes: number | null
    usageRatio: number | null
  }
  locations: StorageLocationSnapshot[]
}

interface LocalStorageEntry {
  key: string
  value: string
  bytes: number
}

interface IndexedDbStoreMetrics {
  usedBytes: number
  itemCount: number
}

type UsageDetailsWithIndexedDb = Partial<Record<'indexedDB' | 'caches' | 'serviceWorkerRegistrations', number>>
type StorageEstimateWithUsageDetails = StorageEstimate & {
  usageDetails?: UsageDetailsWithIndexedDb
}

function measureStringBytes(value: string): number {
  return new Blob([value]).size
}

function measureJsonBytes(value: unknown): number {
  return measureStringBytes(JSON.stringify(value))
}

function calculatePressure(usageRatio: number | null): StoragePressureLevel {
  if (usageRatio === null || Number.isNaN(usageRatio)) {
    return 'unknown'
  }
  if (usageRatio >= 0.9) {
    return 'critical'
  }
  if (usageRatio >= 0.75) {
    return 'high'
  }
  if (usageRatio >= 0.5) {
    return 'medium'
  }
  return 'low'
}

function buildWarning(pressure: StoragePressureLevel): string | null {
  if (pressure === 'critical') {
    return '已非常接近浏览器配额上限，可能出现写入失败或明显性能波动。'
  }
  if (pressure === 'high') {
    return '存储压力较高，建议重点关注大图片与长会话带来的增长。'
  }
  if (pressure === 'medium') {
    return '存储占用已进入观察区间，适合持续跟踪增长趋势。'
  }
  return null
}

function buildLocationSnapshot(input: Omit<StorageLocationSnapshot, 'pressure' | 'warning' | 'usageRatio'> & {
  usageRatio?: number | null
}): StorageLocationSnapshot {
  const normalizedRatio = typeof input.usageRatio === 'number' && Number.isFinite(input.usageRatio)
    ? Math.min(Math.max(input.usageRatio, 0), 1)
    : null
  const pressure = calculatePressure(normalizedRatio)

  return {
    ...input,
    usageRatio: normalizedRatio,
    pressure,
    warning: buildWarning(pressure),
  }
}

function openIndexedDb(name: string, version: number, storeName: string): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(name, version)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

function readConversationStoreMetrics(): Promise<IndexedDbStoreMetrics | null> {
  return openIndexedDb(CONVERSATION_DB_NAME, CONVERSATION_DB_VERSION, CONVERSATION_STORE_NAME)
    .then((db) => {
      if (!db) {
        return null
      }

      return new Promise<IndexedDbStoreMetrics | null>((resolve) => {
        const transaction = db.transaction(CONVERSATION_STORE_NAME, 'readonly')
        const store = transaction.objectStore(CONVERSATION_STORE_NAME)
        const request = store.openCursor()
        let usedBytes = 0
        let itemCount = 0

        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) {
            resolve({ usedBytes, itemCount })
            return
          }

          const value = cursor.value as {
            id?: string
            payload?: string
            updatedAt?: string
          }
          usedBytes += measureJsonBytes({
            id: value.id ?? '',
            payload: value.payload ?? '',
            updatedAt: value.updatedAt ?? '',
          })
          itemCount += 1
          cursor.continue()
        }
        request.onerror = () => resolve(null)
        transaction.onerror = () => resolve(null)
        transaction.onabort = () => resolve(null)
      }).finally(() => {
        db.close()
      })
    })
}

function readImageStoreMetrics(): Promise<IndexedDbStoreMetrics | null> {
  return openIndexedDb(IMAGE_DB_NAME, IMAGE_DB_VERSION, IMAGE_STORE_NAME)
    .then((db) => {
      if (!db) {
        return null
      }

      return new Promise<IndexedDbStoreMetrics | null>((resolve) => {
        const transaction = db.transaction(IMAGE_STORE_NAME, 'readonly')
        const store = transaction.objectStore(IMAGE_STORE_NAME)
        const request = store.openCursor()
        let usedBytes = 0
        let itemCount = 0

        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) {
            resolve({ usedBytes, itemCount })
            return
          }

          const value = cursor.value as {
            id?: string
            size?: number
            blob?: Blob
            createdAt?: number
            updatedAt?: number
          }
          usedBytes += (typeof value.size === 'number' ? value.size : value.blob?.size ?? 0)
          usedBytes += measureJsonBytes({
            id: value.id ?? '',
            createdAt: value.createdAt ?? null,
            updatedAt: value.updatedAt ?? null,
          })
          itemCount += 1
          cursor.continue()
        }
        request.onerror = () => resolve(null)
        transaction.onerror = () => resolve(null)
        transaction.onabort = () => resolve(null)
      }).finally(() => {
        db.close()
      })
    })
}

async function readQuotaSnapshot(): Promise<StorageQuotaSnapshot> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return {
      usageBytes: null,
      quotaBytes: null,
      availableBytes: null,
      usageRatio: null,
      usageDetails: {},
    }
  }

  try {
    const estimate = await navigator.storage.estimate() as StorageEstimateWithUsageDetails
    const usageBytes = typeof estimate.usage === 'number' ? estimate.usage : null
    const quotaBytes = typeof estimate.quota === 'number' ? estimate.quota : null
    const usageRatio = usageBytes !== null && quotaBytes ? usageBytes / quotaBytes : null
    const usageDetails = estimate.usageDetails && typeof estimate.usageDetails === 'object'
      ? Object.entries(estimate.usageDetails as UsageDetailsWithIndexedDb)
          .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
          .reduce<Record<string, number>>((result, [key, value]) => {
            result[key] = value
            return result
          }, {})
      : {}

    return {
      usageBytes,
      quotaBytes,
      availableBytes: usageBytes !== null && quotaBytes !== null ? Math.max(quotaBytes - usageBytes, 0) : null,
      usageRatio,
      usageDetails,
    }
  } catch {
    return {
      usageBytes: null,
      quotaBytes: null,
      availableBytes: null,
      usageRatio: null,
      usageDetails: {},
    }
  }
}

function readStorageEntries(storage: Storage | undefined): LocalStorageEntry[] {
  if (!storage) {
    return []
  }

  const entries: LocalStorageEntry[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key) {
      continue
    }
    const value = storage.getItem(key)
    if (value === null) {
      continue
    }
    entries.push({
      key,
      value,
      bytes: measureStringBytes(key) + measureStringBytes(value),
    })
  }
  return entries
}

function summarizeLocalStorageGroups(
  entries: LocalStorageEntry[],
  quotaBytes: number | null,
): StorageLocationSnapshot[] {
  const matchedKeys = new Set<string>()

  const snapshots = LOCAL_STORAGE_GROUPS.map((group) => {
    const groupEntries = group.id === 'other'
      ? entries.filter((entry) => !matchedKeys.has(entry.key))
      : entries.filter((entry) =>
          group.keyPrefixes.some((prefix) => entry.key === prefix || entry.key.startsWith(prefix)),
        )

    for (const entry of groupEntries) {
      matchedKeys.add(entry.key)
    }

    const usedBytes = groupEntries.reduce((sum, entry) => sum + entry.bytes, 0)
    return buildLocationSnapshot({
      id: `local-storage:${group.id}`,
      label: group.label,
      storageArea: 'localStorage',
      status: groupEntries.length > 0 ? 'active' : 'idle',
      purpose: group.purpose,
      location: groupEntries.length > 0 ? groupEntries.map((entry) => entry.key).join(', ') : '无匹配 key',
      contentKinds: [...group.contentKinds],
      usedBytes,
      availableBytes: quotaBytes !== null ? Math.max(quotaBytes - usedBytes, 0) : null,
      quotaBytes,
      usageRatio: quotaBytes ? usedBytes / quotaBytes : null,
      itemCount: groupEntries.length,
      itemNames: groupEntries.map((entry) => entry.key),
      notes: groupEntries.length > 0
        ? ['以浏览器 key-value 形式持久化，适合索引与轻量元数据。']
        : ['当前未检测到该类 key。'],
    })
  })

  return snapshots.filter((snapshot) => snapshot.itemCount !== 0 || snapshot.id !== 'local-storage:other')
}

async function summarizeCacheStorage(quotaBytes: number | null): Promise<StorageLocationSnapshot> {
  if (typeof caches === 'undefined') {
    return buildLocationSnapshot({
      id: 'cache-storage',
      label: 'Cache Storage',
      storageArea: 'cacheStorage',
      status: 'unsupported',
      purpose: 'HTTP 响应缓存或显式缓存桶',
      location: 'Cache Storage',
      contentKinds: ['缓存桶'],
      usedBytes: null,
      availableBytes: quotaBytes,
      quotaBytes,
      usageRatio: null,
      itemCount: null,
      itemNames: [],
      notes: ['当前环境不支持 Cache Storage API。'],
    })
  }

  const cacheNames = await caches.keys()
  return buildLocationSnapshot({
    id: 'cache-storage',
    label: 'Cache Storage',
    storageArea: 'cacheStorage',
    status: cacheNames.length > 0 ? 'active' : 'idle',
    purpose: 'HTTP 响应缓存或显式缓存桶',
    location: cacheNames.length > 0 ? cacheNames.join(', ') : '无 cache 名称',
    contentKinds: ['缓存桶'],
    usedBytes: null,
    availableBytes: quotaBytes,
    quotaBytes,
    usageRatio: null,
    itemCount: cacheNames.length,
    itemNames: cacheNames,
    notes: cacheNames.length > 0
      ? ['当前仓库源码未发现对 Cache Storage 的业务写入，若出现名称通常来自运行时或其他库。']
      : ['当前仓库源码未发现对 Cache Storage 的业务写入。'],
  })
}

function summarizeSessionStorage(quotaBytes: number | null): StorageLocationSnapshot {
  if (typeof sessionStorage === 'undefined') {
    return buildLocationSnapshot({
      id: 'session-storage',
      label: 'sessionStorage',
      storageArea: 'sessionStorage',
      status: 'unsupported',
      purpose: '标签页会话级短期键值存储',
      location: 'sessionStorage',
      contentKinds: ['会话级临时数据'],
      usedBytes: null,
      availableBytes: quotaBytes,
      quotaBytes,
      usageRatio: null,
      itemCount: null,
      itemNames: [],
      notes: ['当前环境不支持 sessionStorage。'],
    })
  }

  const entries = readStorageEntries(sessionStorage)
  const usedBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0)
  return buildLocationSnapshot({
    id: 'session-storage',
    label: 'sessionStorage',
    storageArea: 'sessionStorage',
    status: entries.length > 0 ? 'active' : 'idle',
    purpose: '标签页会话级短期键值存储',
    location: entries.length > 0 ? entries.map((entry) => entry.key).join(', ') : '无 key',
    contentKinds: ['会话级临时数据'],
    usedBytes,
    availableBytes: quotaBytes !== null ? Math.max(quotaBytes - usedBytes, 0) : null,
    quotaBytes,
    usageRatio: quotaBytes ? usedBytes / quotaBytes : null,
    itemCount: entries.length,
    itemNames: entries.map((entry) => entry.key),
    notes: ['当前仓库源码未发现业务层对 sessionStorage 的持久化使用。'],
  })
}

function summarizeOpfs(quotaBytes: number | null): StorageLocationSnapshot {
  const supported = typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'
  return buildLocationSnapshot({
    id: 'opfs',
    label: 'OPFS',
    storageArea: 'opfs',
    status: supported ? 'idle' : 'unsupported',
    purpose: 'Origin Private File System',
    location: 'navigator.storage.getDirectory()',
    contentKinds: ['文件系统对象'],
    usedBytes: null,
    availableBytes: quotaBytes,
    quotaBytes,
    usageRatio: null,
    itemCount: null,
    itemNames: [],
    notes: supported
      ? ['当前仓库源码未发现对 OPFS 的业务写入。']
      : ['当前环境不支持 OPFS 或未暴露相关 API。'],
  })
}

export async function collectStorageDebugSnapshot(): Promise<StorageDebugSnapshot> {
  const quota = await readQuotaSnapshot()
  const localStorageEntries = typeof localStorage === 'undefined' ? [] : readStorageEntries(localStorage)
  const [conversationMetrics, imageMetrics, cacheSnapshot] = await Promise.all([
    readConversationStoreMetrics(),
    readImageStoreMetrics(),
    summarizeCacheStorage(quota.quotaBytes),
  ])

  const locations: StorageLocationSnapshot[] = []

  locations.push(
    buildLocationSnapshot({
      id: 'indexeddb:conversation-content',
      label: '会话正文仓',
      storageArea: 'indexedDB',
      status: conversationMetrics ? (conversationMetrics.itemCount > 0 ? 'active' : 'idle') : 'unsupported',
      purpose: '保存当前对话历史正文、消息列表、run 历史等主体内容',
      location: `${CONVERSATION_DB_NAME} / ${CONVERSATION_STORE_NAME}`,
      contentKinds: ['对话历史正文', '消息列表', 'run 历史'],
      usedBytes: conversationMetrics?.usedBytes ?? null,
      availableBytes: quota.availableBytes,
      quotaBytes: quota.quotaBytes,
      usageRatio: quota.quotaBytes && conversationMetrics ? conversationMetrics.usedBytes / quota.quotaBytes : null,
      itemCount: conversationMetrics?.itemCount ?? null,
      itemNames: conversationMetrics ? [CONVERSATION_STORE_NAME] : [],
      notes: ['正文已优先写入 IndexedDB，localStorage 中的 `m1:conversation:*` 仅作为降级/迁移残留。'],
    }),
    buildLocationSnapshot({
      id: 'indexeddb:image-assets',
      label: '图片资产仓',
      storageArea: 'indexedDB',
      status: imageMetrics ? (imageMetrics.itemCount > 0 ? 'active' : 'idle') : 'unsupported',
      purpose: '保存上传图片与运行中引用的 Blob 资产',
      location: `${IMAGE_DB_NAME} / ${IMAGE_STORE_NAME}`,
      contentKinds: ['图片 Blob', '源图缓存', '预览资源'],
      usedBytes: imageMetrics?.usedBytes ?? null,
      availableBytes: quota.availableBytes,
      quotaBytes: quota.quotaBytes,
      usageRatio: quota.quotaBytes && imageMetrics ? imageMetrics.usedBytes / quota.quotaBytes : null,
      itemCount: imageMetrics?.itemCount ?? null,
      itemNames: imageMetrics ? [IMAGE_STORE_NAME] : [],
      notes: ['大图片与多轮编辑通常优先放大这里的体积，是排查容量压力的重点。'],
    }),
  )

  locations.push(...summarizeLocalStorageGroups(localStorageEntries, quota.quotaBytes))
  locations.push(summarizeSessionStorage(quota.quotaBytes))
  locations.push(cacheSnapshot)
  locations.push(summarizeOpfs(quota.quotaBytes))

  const indexedDbUsageDetails = quota.usageDetails.indexedDB
  const indexedDbUsedBytes = (conversationMetrics?.usedBytes ?? 0) + (imageMetrics?.usedBytes ?? 0)
  const resolvedIndexedDbUsedBytes = indexedDbUsageDetails ?? (conversationMetrics || imageMetrics ? indexedDbUsedBytes : null)

  return {
    refreshedAt: new Date().toISOString(),
    quota,
    indexedDbSummary: {
      usedBytes: resolvedIndexedDbUsedBytes,
      availableBytes: quota.quotaBytes !== null && resolvedIndexedDbUsedBytes !== null
        ? Math.max(quota.quotaBytes - resolvedIndexedDbUsedBytes, 0)
        : quota.availableBytes,
      quotaBytes: quota.quotaBytes,
      usageRatio: quota.quotaBytes && resolvedIndexedDbUsedBytes !== null
        ? resolvedIndexedDbUsedBytes / quota.quotaBytes
        : null,
    },
    locations,
  }
}
