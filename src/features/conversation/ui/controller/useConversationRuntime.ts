import { useEffect, useId, useRef, useState } from 'react'
import type { ProviderRequestRunner } from '../../../../types/provider'
import type { ActiveRunRegistration } from '../../application/runtime/activeRunRegistry'
import { MESSAGE_HISTORY_INITIAL_LIMIT } from '../../application/queries/conversationView'
import { Semaphore } from '../../application/utils/semaphore'
import type { RunLocation } from '../../application/queries/conversationIndexes'

export function useConversationRuntime<State>(state: State) {
  const backgroundPollOwnerId = useId()
  const stateRef = useRef(state)
  const [replayingRunIds, setReplayingRunIds] = useState<string[]>([])
  const replayingRunIdsRef = useRef<Set<string>>(new Set())
  const [historyVisibleLimit, setHistoryVisibleLimit] = useState(MESSAGE_HISTORY_INITIAL_LIMIT)
  const historyVisibleLimitRef = useRef(MESSAGE_HISTORY_INITIAL_LIMIT)
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false)
  const [sendScrollTrigger, setSendScrollTrigger] = useState(0)
  const [sendScrollTargetMessageId, setSendScrollTargetMessageId] = useState<string | null>(null)
  const pendingPersistConversationIdsRef = useRef<Set<string>>(new Set())
  const persistTimerRef = useRef<number | null>(null)
  const resumePollTimerRef = useRef<number | null>(null)
  const backgroundResumePollTimerRef = useRef<number | null>(null)
  const resumePollInFlightRef = useRef(false)
  const backgroundResumePollInFlightRef = useRef(false)
  const backgroundPollOwnerIdRef = useRef(`window:${backgroundPollOwnerId}`)
  const conversationCacheOrderRef = useRef<string[]>([])
  const runLocationByConversationRef = useRef<Record<string, Map<string, RunLocation>>>({})
  const activeRunControllersRef = useRef<Record<string, Map<string, ActiveRunRegistration>>>({})
  const resumingImageIdsRef = useRef<Set<string>>(new Set())
  const runCompletionSignatureRef = useRef<Map<string, string>>(new Map())
  const resumePendingImagesForConversationRef = useRef<(conversationId: string) => Promise<void> | void>(() => {})
  const globalSubmitSemaphoreRef = useRef(new Semaphore(1))
  const globalSubmitRequestRunnerRef = useRef<ProviderRequestRunner>((fn) => globalSubmitSemaphoreRef.current.use(fn))

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    historyVisibleLimitRef.current = historyVisibleLimit
  }, [historyVisibleLimit])

  const getDebugStats = () => {
    const runLocationConversationCount = Object.keys(runLocationByConversationRef.current).length
    const runLocationEntryCount = Object.values(runLocationByConversationRef.current)
      .reduce((sum, map) => sum + map.size, 0)
    const activeRunControllerConversationCount = Object.keys(activeRunControllersRef.current).length
    const activeRunControllerCount = Object.values(activeRunControllersRef.current)
      .reduce((sum, map) => sum + map.size, 0)

    return {
      replayingRunIdsCount: replayingRunIdsRef.current.size,
      historyVisibleLimit: historyVisibleLimitRef.current,
      isLoadingOlderMessages,
      sendScrollTrigger,
      pendingPersistConversationCount: pendingPersistConversationIdsRef.current.size,
      persistTimerActive: persistTimerRef.current !== null,
      resumePollTimerActive: resumePollTimerRef.current !== null,
      backgroundResumePollTimerActive: backgroundResumePollTimerRef.current !== null,
      resumePollInFlight: resumePollInFlightRef.current,
      backgroundResumePollInFlight: backgroundResumePollInFlightRef.current,
      conversationCacheOrderCount: conversationCacheOrderRef.current.length,
      runLocationConversationCount,
      runLocationEntryCount,
      activeRunControllerConversationCount,
      activeRunControllerCount,
      resumingImageCount: resumingImageIdsRef.current.size,
      runCompletionSignatureCount: runCompletionSignatureRef.current.size,
      backgroundPollOwnerId: backgroundPollOwnerIdRef.current,
      globalSubmit: globalSubmitSemaphoreRef.current.getDebugStats(),
    }
  }

  return {
    stateRef,
    replayingRunIds,
    setReplayingRunIds,
    replayingRunIdsRef,
    historyVisibleLimit,
    setHistoryVisibleLimit,
    historyVisibleLimitRef,
    isLoadingOlderMessages,
    setIsLoadingOlderMessages,
    sendScrollTrigger,
    setSendScrollTrigger,
    sendScrollTargetMessageId,
    setSendScrollTargetMessageId,
    pendingPersistConversationIdsRef,
    persistTimerRef,
    resumePollTimerRef,
    backgroundResumePollTimerRef,
    resumePollInFlightRef,
    backgroundResumePollInFlightRef,
    backgroundPollOwnerIdRef,
    conversationCacheOrderRef,
    runLocationByConversationRef,
    activeRunControllersRef,
    resumingImageIdsRef,
    runCompletionSignatureRef,
    resumePendingImagesForConversationRef,
    globalSubmitSemaphoreRef,
    globalSubmitRequestRunnerRef,
    getDebugStats,
  }
}
