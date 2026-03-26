function getStorage(): Storage | null {
  if (typeof localStorage === 'undefined') {
    return null
  }
  return localStorage
}

export function safeReadStorage(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function safeWriteStorage(key: string, value: string): boolean {
  try {
    getStorage()?.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function safeRemoveStorage(key: string): boolean {
  try {
    getStorage()?.removeItem(key)
    return true
  } catch {
    return false
  }
}
