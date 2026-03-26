import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, KeyboardEvent, MutableRefObject, RefObject, SyntheticEvent } from 'react'
import type { ModelSpec } from '../../../../types/model'
import { extractImageFilesFromTransfer } from '../../../../utils/imageTransfer'
import { inferModelShortcutTokens } from '../../domain/modelShortcuts'
import {
  findDashCommandNearCursor,
  findModelShortcutAtLineStart,
  isQuickPickerTriggerAtLineStart,
  normalizeDashCommandQuery,
  normalizeModelShortcutQuery,
} from './composerHelpers'
import type { DashCommandOption, QuickPickerRange } from './composerHelpers'
import type { ComposerAnimationReason } from './useComposerOvershootAnimation'

type PickerMode = 'quick-actions' | 'models' | 'commands'
const TEMPLATE_TOKEN_REGEXP = /\{\{\s*[a-zA-Z0-9_-]+\s*\}\}/g

interface DraftInputPayload {
  nextText: string
  cursor: number
  changeReason: ComposerAnimationReason
  target: HTMLTextAreaElement
}

interface UseComposerInputControllerInput {
  composerTextareaRef: RefObject<HTMLTextAreaElement | null>
  isComposingRef: MutableRefObject<boolean>
  isSendBlocked: boolean
  models: ModelSpec[]
  onDraftInput: (payload: DraftInputPayload) => void
  onModelSelected: (model: ModelSpec) => void
  onCommandSelected: (command: DashCommandOption) => void
  onQuickActionSelected: (label: string) => void
  onSendAttempt: () => void | Promise<void>
  onSourceImagesAppend: (files: File[]) => void
  qualifiesForPasteOvershoot: (text: string) => boolean
  quickPickerItems: string[]
  sourceImagesEnabled: boolean
  dashCommandOptions: DashCommandOption[]
}

export function useComposerInputController(input: UseComposerInputControllerInput) {
  const {
    composerTextareaRef,
    isComposingRef,
    isSendBlocked,
    models,
    onDraftInput,
    onModelSelected,
    onCommandSelected,
    onQuickActionSelected,
    onSendAttempt,
    onSourceImagesAppend,
    qualifiesForPasteOvershoot,
    quickPickerItems,
    sourceImagesEnabled,
    dashCommandOptions,
  } = input

  const [isQuickPickerOpen, setIsQuickPickerOpen] = useState(false)
  const [quickPickerRange, setQuickPickerRange] = useState<QuickPickerRange | null>(null)
  const [quickPickerActiveIndex, setQuickPickerActiveIndex] = useState(0)
  const [pickerMode, setPickerMode] = useState<PickerMode>('quick-actions')
  const [modelShortcutQuery, setModelShortcutQuery] = useState('')
  const [dashCommandQuery, setDashCommandQuery] = useState('')
  const quickPickerRootRef = useRef<HTMLDivElement | null>(null)
  const pendingInputReasonRef = useRef<ComposerAnimationReason>('input')
  const normalizedModelShortcutQuery = normalizeModelShortcutQuery(modelShortcutQuery)
  const normalizedDashCommandQuery = normalizeDashCommandQuery(dashCommandQuery)
  const matchedModels = useMemo(() => {
    if (normalizedModelShortcutQuery.length === 0) {
      return models
    }

    return models
      .map((model) => ({
        model,
        tokens: inferModelShortcutTokens(model),
      }))
      .filter(({ model, tokens }) => {
        const haystack = `${model.id} ${model.name} ${tokens.join(' ')}`.toLowerCase()
        return haystack.includes(normalizedModelShortcutQuery)
      })
      .map(({ model }) => model)
  }, [models, normalizedModelShortcutQuery])

  const matchedDashCommands = useMemo(() => {
    if (normalizedDashCommandQuery.length === 0) {
      return dashCommandOptions
    }
    return dashCommandOptions.filter((item) => item.key.includes(normalizedDashCommandQuery))
  }, [dashCommandOptions, normalizedDashCommandQuery])

  const closeQuickPicker = useCallback(() => {
    setIsQuickPickerOpen(false)
    setQuickPickerRange(null)
    setQuickPickerActiveIndex(0)
    setPickerMode('quick-actions')
    setModelShortcutQuery('')
    setDashCommandQuery('')
  }, [])

  const openQuickActions = (target?: HTMLTextAreaElement | null) => {
    const activeTarget = target ?? composerTextareaRef.current
    const cursor = activeTarget?.selectionStart ?? activeTarget?.value.length ?? 0

    if (activeTarget) {
      composerTextareaRef.current = activeTarget
    }
    setQuickPickerRange({ start: cursor, end: cursor })
    setQuickPickerActiveIndex(0)
    setPickerMode('quick-actions')
    setModelShortcutQuery('')
    setDashCommandQuery('')
    setIsQuickPickerOpen(true)
  }

  const findTemplateTokenBeforeCursor = (value: string, cursor: number) => {
    if (cursor <= 0) {
      return null
    }

    const matches = Array.from(value.matchAll(TEMPLATE_TOKEN_REGEXP))
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const match = matches[index]
      const start = match.index ?? -1
      if (start < 0) {
        continue
      }
      const token = match[0]
      const end = start + token.length
      if (end === cursor) {
        return { start, end }
      }
      if (end < cursor) {
        break
      }
    }

    return null
  }

  const findTemplateTokenAfterCursor = (value: string, cursor: number) => {
    if (cursor >= value.length) {
      return null
    }

    const matches = Array.from(value.matchAll(TEMPLATE_TOKEN_REGEXP))
    for (const match of matches) {
      const start = match.index ?? -1
      if (start < 0) {
        continue
      }
      const token = match[0]
      const end = start + token.length
      if (start === cursor) {
        return { start, end }
      }
      if (start > cursor) {
        break
      }
    }

    return null
  }

  const applyStructuredDeletion = (
    event: KeyboardEvent<HTMLTextAreaElement>,
    range: { start: number; end: number },
  ) => {
    const target = event.currentTarget
    const nextText = `${target.value.slice(0, range.start)}${target.value.slice(range.end)}`
    closeQuickPicker()
    onDraftInput({
      nextText,
      cursor: range.start,
      changeReason: 'input',
      target,
    })
    window.requestAnimationFrame(() => {
      target.focus()
      target.setSelectionRange(range.start, range.start)
    })
  }

  useEffect(() => {
    if (!isQuickPickerOpen) {
      return undefined
    }

    const onMouseDown = (event: MouseEvent) => {
      const root = quickPickerRootRef.current
      if (!root) {
        return
      }
      if (event.target instanceof Node && !root.contains(event.target)) {
        closeQuickPicker()
      }
    }

    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [closeQuickPicker, isQuickPickerOpen])

  const handleChange = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    const nextText = event.currentTarget.value
    const cursor = event.currentTarget.selectionStart ?? nextText.length
    const changeReason = pendingInputReasonRef.current
    const isComposing = isComposingRef.current || Boolean((event.nativeEvent as InputEvent | undefined)?.isComposing)

    pendingInputReasonRef.current = 'input'
    onDraftInput({
      nextText,
      cursor,
      changeReason,
      target: event.currentTarget,
    })

    if (isComposing) {
      closeQuickPicker()
      return
    }

    const modelShortcut = findModelShortcutAtLineStart(nextText, cursor)
    if (modelShortcut) {
      setQuickPickerRange({ start: modelShortcut.start, end: modelShortcut.end })
      setQuickPickerActiveIndex(0)
      setPickerMode('models')
      setModelShortcutQuery(modelShortcut.query)
      setIsQuickPickerOpen(true)
      return
    }

    const dashCommand = findDashCommandNearCursor(nextText, cursor)
    if (dashCommand) {
      setQuickPickerRange({ start: dashCommand.start, end: dashCommand.end })
      setQuickPickerActiveIndex(0)
      setPickerMode('commands')
      setDashCommandQuery(dashCommand.query)
      setIsQuickPickerOpen(true)
      return
    }

    const triggerIndex = cursor - 1
    if (isQuickPickerTriggerAtLineStart(nextText, triggerIndex)) {
      setQuickPickerRange({ start: triggerIndex, end: triggerIndex + 1 })
      setQuickPickerActiveIndex(0)
      setPickerMode('quick-actions')
      setIsQuickPickerOpen(true)
      return
    }

    if (quickPickerRange) {
      const trigger = nextText[quickPickerRange.start]
      if ((trigger === '/' || trigger === '、') && isQuickPickerTriggerAtLineStart(nextText, quickPickerRange.start)) {
        return
      }
    }

    closeQuickPicker()
  }

  const handleSelect = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    composerTextareaRef.current = event.currentTarget
    if (isComposingRef.current) {
      return
    }
    if (!isQuickPickerOpen || !quickPickerRange) {
      return
    }
    const cursor = event.currentTarget.selectionStart ?? 0
    if (cursor < quickPickerRange.start + 1) {
      closeQuickPicker()
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = extractImageFilesFromTransfer(event.clipboardData)
    if (imageFiles.length === 0) {
      const pastedText = event.clipboardData.getData('text/plain')
      pendingInputReasonRef.current = qualifiesForPasteOvershoot(pastedText) ? 'paste-expand' : 'input'
      return
    }
    if (!sourceImagesEnabled) {
      return
    }
    event.preventDefault()
    onSourceImagesAppend(imageFiles)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current || event.nativeEvent.isComposing) {
      return
    }
    const selectionStart = event.currentTarget.selectionStart ?? 0
    const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart
    const hasCollapsedSelection = selectionStart === selectionEnd
    if (hasCollapsedSelection && event.key === 'Backspace') {
      const tokenRange = findTemplateTokenBeforeCursor(event.currentTarget.value, selectionStart)
      if (tokenRange) {
        event.preventDefault()
        applyStructuredDeletion(event, tokenRange)
        return
      }
    }
    if (hasCollapsedSelection && event.key === 'Delete') {
      const tokenRange = findTemplateTokenAfterCursor(event.currentTarget.value, selectionStart)
      if (tokenRange) {
        event.preventDefault()
        applyStructuredDeletion(event, tokenRange)
        return
      }
    }
    if (!isQuickPickerOpen) {
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeQuickPicker()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const length =
        pickerMode === 'models'
          ? matchedModels.length
          : pickerMode === 'commands'
            ? matchedDashCommands.length
            : quickPickerItems.length
      if (length > 0) {
        setQuickPickerActiveIndex((prev) => (prev + 1) % length)
      }
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const length =
        pickerMode === 'models'
          ? matchedModels.length
          : pickerMode === 'commands'
            ? matchedDashCommands.length
            : quickPickerItems.length
      if (length > 0) {
        setQuickPickerActiveIndex((prev) => (prev - 1 + length) % length)
      }
    }
  }

  const handlePressEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current || event.nativeEvent.isComposing) {
      return
    }
    if (isQuickPickerOpen && pickerMode === 'quick-actions') {
      event.preventDefault()
      const selected = quickPickerItems[quickPickerActiveIndex] ?? quickPickerItems[0]
      onQuickActionSelected(selected)
      return
    }
    if (isQuickPickerOpen && pickerMode === 'models') {
      event.preventDefault()
      const selected = matchedModels[quickPickerActiveIndex] ?? matchedModels[0]
      if (selected) {
        onModelSelected(selected)
      }
      return
    }
    if (isQuickPickerOpen && pickerMode === 'commands') {
      event.preventDefault()
      const selected = matchedDashCommands[quickPickerActiveIndex] ?? matchedDashCommands[0]
      if (selected) {
        onCommandSelected(selected)
      }
      return
    }

    if (!event.shiftKey && !isSendBlocked) {
      event.preventDefault()
      void onSendAttempt()
    }
  }

  return {
    closeQuickPicker,
    handleChange,
    handleKeyDown,
    handlePaste,
    handlePressEnter,
    handleSelect,
    isQuickPickerOpen,
    matchedDashCommands,
    matchedModels,
    openQuickActions,
    pickerMode,
    quickPickerActiveIndex,
    quickPickerRange,
    quickPickerRootRef,
    setQuickPickerActiveIndex,
    setTextareaRefFromEvent: (node: HTMLTextAreaElement) => {
      composerTextareaRef.current = node
    },
  }
}
