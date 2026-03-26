import { safeReadStorage, safeRemoveStorage, safeWriteStorage } from '../utils/safeStorage'

interface LeaseRecord {
  ownerId: string
  expiresAt: number
}

export interface AcquireLeaseInput {
  leaseKey: string
  ownerId: string
  ttlMs: number
  now?: number
}

function readLease(leaseKey: string): LeaseRecord | null {
  const raw = safeReadStorage(leaseKey)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LeaseRecord>
    if (typeof parsed.ownerId !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null
    }
    return {
      ownerId: parsed.ownerId,
      expiresAt: parsed.expiresAt,
    }
  } catch {
    return null
  }
}

function writeLease(input: { leaseKey: string; record: LeaseRecord }) {
  safeWriteStorage(input.leaseKey, JSON.stringify(input.record))
}

export function acquireWindowLease(input: AcquireLeaseInput): boolean {
  const now = input.now ?? Date.now()
  const nextRecord: LeaseRecord = {
    ownerId: input.ownerId,
    expiresAt: now + Math.max(1, Math.floor(input.ttlMs)),
  }
  const current = readLease(input.leaseKey)
  if (current && current.ownerId !== input.ownerId && current.expiresAt > now) {
    return false
  }

  writeLease({ leaseKey: input.leaseKey, record: nextRecord })
  const confirmed = readLease(input.leaseKey)
  return confirmed?.ownerId === input.ownerId
}

export function releaseWindowLease(input: { leaseKey: string; ownerId: string }) {
  const current = readLease(input.leaseKey)
  if (!current || current.ownerId !== input.ownerId) {
    return
  }
  safeRemoveStorage(input.leaseKey)
}

export function isWindowLeaseOwner(input: { leaseKey: string; ownerId: string; now?: number }): boolean {
  const now = input.now ?? Date.now()
  const current = readLease(input.leaseKey)
  return Boolean(current && current.ownerId === input.ownerId && current.expiresAt > now)
}
