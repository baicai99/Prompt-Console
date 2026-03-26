import { afterEach, describe, expect, it } from 'vitest'
import { acquireWindowLease, isWindowLeaseOwner, releaseWindowLease } from './windowLease'

describe('windowLease', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('grants a lease when no active owner exists and renews for the same owner', () => {
    expect(acquireWindowLease({
      leaseKey: 'lease:test',
      ownerId: 'window-a',
      ttlMs: 1000,
      now: 1_000,
    })).toBe(true)

    expect(acquireWindowLease({
      leaseKey: 'lease:test',
      ownerId: 'window-a',
      ttlMs: 1000,
      now: 1_500,
    })).toBe(true)

    expect(isWindowLeaseOwner({
      leaseKey: 'lease:test',
      ownerId: 'window-a',
      now: 1_800,
    })).toBe(true)
  })

  it('rejects a competing owner until the lease expires', () => {
    expect(acquireWindowLease({
      leaseKey: 'lease:test',
      ownerId: 'window-a',
      ttlMs: 1000,
      now: 1_000,
    })).toBe(true)

    expect(acquireWindowLease({
      leaseKey: 'lease:test',
      ownerId: 'window-b',
      ttlMs: 1000,
      now: 1_500,
    })).toBe(false)

    expect(acquireWindowLease({
      leaseKey: 'lease:test',
      ownerId: 'window-b',
      ttlMs: 1000,
      now: 2_100,
    })).toBe(true)
  })

  it('releases only when called by the current owner', () => {
    acquireWindowLease({
      leaseKey: 'lease:test',
      ownerId: 'window-a',
      ttlMs: 1000,
      now: 1_000,
    })

    releaseWindowLease({ leaseKey: 'lease:test', ownerId: 'window-b' })
    expect(isWindowLeaseOwner({
      leaseKey: 'lease:test',
      ownerId: 'window-a',
      now: 1_100,
    })).toBe(true)

    releaseWindowLease({ leaseKey: 'lease:test', ownerId: 'window-a' })
    expect(isWindowLeaseOwner({
      leaseKey: 'lease:test',
      ownerId: 'window-a',
      now: 1_100,
    })).toBe(false)
  })
})
