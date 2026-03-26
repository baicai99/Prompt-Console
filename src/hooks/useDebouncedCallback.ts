/* eslint-disable react-hooks/refs */
import { useCallback, useEffect, useMemo, useRef } from 'react'

type Debounced<TArgs extends unknown[]> = ((...args: TArgs) => void) & {
  cancel: () => void
  flush: () => void
}

export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay = 80,
): Debounced<TArgs> {
  const callbackRef = useRef(callback)
  const timerRef = useRef<number | null>(null)
  const argsRef = useRef<TArgs | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    argsRef.current = null
  }, [])

  const flush = useCallback(() => {
    if (!argsRef.current) {
      return
    }
    const nextArgs = argsRef.current
    cancel()
    callbackRef.current(...nextArgs)
  }, [cancel])

  const debounced = useCallback(
    (...args: TArgs) => {
      argsRef.current = args
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
      timerRef.current = window.setTimeout(() => {
        flush()
      }, delay)
    },
    [delay, flush],
  )

  useEffect(() => cancel, [cancel])

  return useMemo(
    () =>
      Object.assign(
        ((...args: TArgs) => {
          debounced(...args)
        }) as Debounced<TArgs>,
        { cancel, flush },
      ),
    [cancel, debounced, flush],
  )
}
