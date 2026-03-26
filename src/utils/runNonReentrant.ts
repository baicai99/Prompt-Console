export async function runNonReentrant<T>(
  inFlightRef: { current: boolean },
  task: () => Promise<T>,
): Promise<T | undefined> {
  if (inFlightRef.current) {
    return undefined
  }

  inFlightRef.current = true
  try {
    return await task()
  } finally {
    inFlightRef.current = false
  }
}
