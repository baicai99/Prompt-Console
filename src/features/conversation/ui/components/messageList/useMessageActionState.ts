import { useCallback, useRef, useState } from 'react'
import type { Run } from '../../../../../types/conversation'

interface UseMessageActionStateInput {
  onRetryRun: (runId: string) => void | Promise<void>
  onDownloadAllRun?: (runId: string) => void | Promise<void>
  onDownloadMessageImages?: (runIds: string[]) => void | Promise<void>
  onCancelMessageRuns?: (messageId: string, runIds: string[]) => void | Promise<void>
}

export function useMessageActionState(input: UseMessageActionStateInput) {
  const retryingMessageIdsRef = useRef<Set<string>>(new Set())
  const downloadingMessageIdsRef = useRef<Set<string>>(new Set())
  const cancellingMessageIdsRef = useRef<Set<string>>(new Set())
  const [, setRetryingMessageIds] = useState<string[]>([])
  const [, setDownloadingMessageIds] = useState<string[]>([])
  const [, setCancellingMessageIds] = useState<string[]>([])
  const [paramModalMessageId, setParamModalMessageId] = useState<string | null>(null)

  const isRetryingMessage = useCallback((messageId: string) => retryingMessageIdsRef.current.has(messageId), [])
  const isDownloadingMessage = useCallback((messageId: string) => downloadingMessageIdsRef.current.has(messageId), [])
  const isCancellingMessage = useCallback((messageId: string) => cancellingMessageIdsRef.current.has(messageId), [])

  const handleRetryAllFailed = useCallback(
    async (messageId: string, runs: Run[]) => {
      if (retryingMessageIdsRef.current.has(messageId)) {
        return
      }

      const failedRunIds = runs
        .filter((run) => run.images.some((item) => item.status === 'failed'))
        .map((run) => run.id)
      if (failedRunIds.length === 0) {
        return
      }

      retryingMessageIdsRef.current.add(messageId)
      setRetryingMessageIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]))
      try {
        await Promise.all(
          failedRunIds.map((runId) =>
            Promise.resolve(input.onRetryRun(runId)).catch(() => {}),
          ),
        )
      } finally {
        retryingMessageIdsRef.current.delete(messageId)
        setRetryingMessageIds((prev) => prev.filter((id) => id !== messageId))
      }
    },
    [input],
  )

  const handleDownloadAllForMessage = useCallback(
    async (messageId: string, runIds: string[], primaryRunId: string) => {
      if (downloadingMessageIdsRef.current.has(messageId)) {
        return
      }

      downloadingMessageIdsRef.current.add(messageId)
      setDownloadingMessageIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]))
      try {
        if (input.onDownloadMessageImages) {
          await Promise.resolve(input.onDownloadMessageImages(runIds))
          return
        }
        await Promise.resolve(input.onDownloadAllRun?.(primaryRunId))
      } finally {
        downloadingMessageIdsRef.current.delete(messageId)
        setDownloadingMessageIds((prev) => prev.filter((id) => id !== messageId))
      }
    },
    [input],
  )

  const handleCancelMessageRuns = useCallback(async (messageId: string, runIds: string[]) => {
    if (!input.onCancelMessageRuns || cancellingMessageIdsRef.current.has(messageId)) {
      return
    }

    cancellingMessageIdsRef.current.add(messageId)
    setCancellingMessageIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]))
    try {
      await input.onCancelMessageRuns(messageId, runIds)
    } finally {
      cancellingMessageIdsRef.current.delete(messageId)
      setCancellingMessageIds((prev) => prev.filter((id) => id !== messageId))
    }
  }, [input])

  return {
    paramModalMessageId,
    setParamModalMessageId,
    isRetryingMessage,
    isDownloadingMessage,
    isCancellingMessage,
    handleRetryAllFailed,
    handleDownloadAllForMessage,
    handleCancelMessageRuns,
  }
}
