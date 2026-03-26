export async function runWithConcurrency<TItem, TResult>(input: {
  items: TItem[]
  concurrency: number
  worker: (item: TItem, index: number) => Promise<TResult>
}): Promise<TResult[]> {
  const { items, worker } = input
  const concurrency = Math.max(1, Math.floor(input.concurrency))
  const results = new Array<TResult>(items.length)
  let nextIndex = 0

  const runWorker = async () => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= items.length) {
        return
      }
      results[currentIndex] = await worker(items[currentIndex] as TItem, currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  )

  return results
}
