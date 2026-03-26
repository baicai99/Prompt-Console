import { Semaphore } from '../features/conversation/application/utils/semaphore'
import type { ProviderRequestRunner } from '../types/provider'

const MAX_CONCURRENT_IMAGE_REQUESTS = 4

const sharedImageRequestSemaphore = new Semaphore(MAX_CONCURRENT_IMAGE_REQUESTS)

export function runWithImageRequestLimit<T>(fn: () => Promise<T>): Promise<T> {
  return sharedImageRequestSemaphore.use(fn)
}

export function createImageRequestRunner(maxConcurrentRequests: number, label = 'image-request'): ProviderRequestRunner {
  const semaphore = new Semaphore(maxConcurrentRequests)
  void label
  return (fn) => semaphore.use(fn)
}

export { MAX_CONCURRENT_IMAGE_REQUESTS }
