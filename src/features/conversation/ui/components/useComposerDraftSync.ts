import { startTransition, useCallback, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { ComposerAnimationReason } from './useComposerOvershootAnimation'

const COMPOSER_PASTE_TEXT_LENGTH_THRESHOLD = 140
const COMPOSER_PASTE_NEWLINE_THRESHOLD = 2

interface UseComposerDraftSyncInput {
  draft: string
  localDraft: string
  setLocalDraft: Dispatch<SetStateAction<string>>
  onDraftChange: (value: string) => void
  focusRequestToken: number
  autoFocusOnMount: boolean
  composerCardRef: RefObject<HTMLDivElement | null>
  markAnimationReason: (reason: ComposerAnimationReason) => void
}

export function useComposerDraftSync(input: UseComposerDraftSyncInput) {
  const {
    draft,
    localDraft,
    setLocalDraft,
    onDraftChange,
    focusRequestToken,
    autoFocusOnMount,
    composerCardRef,
    markAnimationReason,
  } = input
  const isComposingRef = useRef(false)
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pendingDraftRef = useRef(draft)
  const draftSyncFrameRef = useRef<number | null>(null)
  const pendingDraftSyncValueRef = useRef(draft)
  const resolveComposerTextarea = useCallback(() => {
    if (composerTextareaRef.current) {
      return composerTextareaRef.current
    }
    const node = composerCardRef.current?.querySelector<HTMLTextAreaElement>('textarea.composer-textarea') ?? null
    if (node) {
      composerTextareaRef.current = node
    }
    return node
  }, [composerCardRef])

  useEffect(() => {
    if (isComposingRef.current) {
      return
    }
    const hasPendingLocalSync = draftSyncFrameRef.current !== null
    const isLatestLocalDraft = draft === pendingDraftSyncValueRef.current
    if (hasPendingLocalSync && !isLatestLocalDraft) {
      return
    }
    if (draft === pendingDraftRef.current) {
      return
    }
    pendingDraftRef.current = draft
    pendingDraftSyncValueRef.current = draft
    const handle = window.requestAnimationFrame(() => {
      setLocalDraft(draft)
    })
    return () => window.cancelAnimationFrame(handle)
  }, [draft, setLocalDraft])

  useEffect(() => {
    return () => {
      if (draftSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(draftSyncFrameRef.current)
        draftSyncFrameRef.current = null
      }
    }
  }, [])

  const lastFocusRequestTokenRef = useRef(focusRequestToken)
  useEffect(() => {
    if (lastFocusRequestTokenRef.current === focusRequestToken) {
      return
    }
    lastFocusRequestTokenRef.current = focusRequestToken
    const handle = window.requestAnimationFrame(() => {
      const textarea = resolveComposerTextarea()
      if (!textarea) {
        return
      }
      textarea.focus({ preventScroll: true })
      const nextCursor = textarea.value.length
      textarea.setSelectionRange(nextCursor, nextCursor)
    })
    return () => window.cancelAnimationFrame(handle)
  }, [focusRequestToken, resolveComposerTextarea])

  useEffect(() => {
    if (!autoFocusOnMount) {
      return
    }
    const handle = window.requestAnimationFrame(() => {
      const textarea = resolveComposerTextarea()
      if (!textarea) {
        return
      }
      textarea.focus({ preventScroll: true })
      const nextCursor = textarea.value.length
      textarea.setSelectionRange(nextCursor, nextCursor)
    })
    return () => window.cancelAnimationFrame(handle)
  }, [autoFocusOnMount, resolveComposerTextarea])

  const restoreComposerSelection = useCallback((cursor: number) => {
    window.requestAnimationFrame(() => {
      const textarea = resolveComposerTextarea()
      if (!textarea) {
        return
      }
      textarea.focus()
      textarea.setSelectionRange(cursor, cursor)
    })
  }, [resolveComposerTextarea])

  const cancelPendingDraftSync = useCallback(() => {
    if (draftSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(draftSyncFrameRef.current)
      draftSyncFrameRef.current = null
    }
  }, [])

  const syncDraftImmediately = useCallback(() => {
    cancelPendingDraftSync()
    const latestDraft = pendingDraftSyncValueRef.current
    pendingDraftRef.current = latestDraft
    pendingDraftSyncValueRef.current = latestDraft
    setLocalDraft(latestDraft)
    flushSync(() => {
      onDraftChange(latestDraft)
    })
  }, [cancelPendingDraftSync, onDraftChange, setLocalDraft])

  const scheduleDraftSync = useCallback(() => {
    if (isComposingRef.current || draftSyncFrameRef.current !== null) {
      return
    }
    draftSyncFrameRef.current = window.requestAnimationFrame(() => {
      draftSyncFrameRef.current = null
      const latestDraft = pendingDraftSyncValueRef.current
      startTransition(() => {
        onDraftChange(latestDraft)
      })
    })
  }, [onDraftChange])

  const commitDraftMutation = useCallback((nextDraft: string, nextCursor: number, onAfterCommit?: () => void) => {
    cancelPendingDraftSync()
    pendingDraftRef.current = nextDraft
    pendingDraftSyncValueRef.current = nextDraft
    setLocalDraft(nextDraft)
    markAnimationReason('input')
    startTransition(() => {
      onDraftChange(nextDraft)
    })
    onAfterCommit?.()
    restoreComposerSelection(nextCursor)
  }, [cancelPendingDraftSync, markAnimationReason, onDraftChange, restoreComposerSelection, setLocalDraft])

  const handleDraftInput = useCallback((nextText: string, changeReason: ComposerAnimationReason) => {
    pendingDraftRef.current = nextText
    pendingDraftSyncValueRef.current = nextText
    setLocalDraft(nextText)
    markAnimationReason(changeReason)
    scheduleDraftSync()
  }, [markAnimationReason, scheduleDraftSync, setLocalDraft])

  const handleCompositionStart = useCallback((onBeforeCompose?: () => void) => {
    isComposingRef.current = true
    cancelPendingDraftSync()
    onBeforeCompose?.()
  }, [cancelPendingDraftSync])

  const handleCompositionEnd = useCallback((nextDraft: string) => {
    isComposingRef.current = false
    pendingDraftRef.current = nextDraft
    pendingDraftSyncValueRef.current = nextDraft
    setLocalDraft(nextDraft)
    scheduleDraftSync()
  }, [scheduleDraftSync, setLocalDraft])

  const qualifiesForPasteOvershoot = useCallback((text: string) => {
    const newlineCount = (text.match(/\n/g) ?? []).length
    return text.length >= COMPOSER_PASTE_TEXT_LENGTH_THRESHOLD || newlineCount >= COMPOSER_PASTE_NEWLINE_THRESHOLD
  }, [])

  return {
    localDraft,
    composerTextareaRef,
    isComposingRef,
    resolveComposerTextarea,
    syncDraftImmediately,
    commitDraftMutation,
    handleDraftInput,
    handleCompositionStart,
    handleCompositionEnd,
    qualifiesForPasteOvershoot,
  }
}
