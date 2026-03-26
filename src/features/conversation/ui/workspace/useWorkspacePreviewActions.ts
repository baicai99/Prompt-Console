import { useCallback, useMemo } from 'react'
import type { Conversation } from '../../../../types/conversation'
import type { PreviewImage } from '../../../../types/image'
import { recordChatMemoryEvent } from '../../../performance/chatMemoryDiagnostics'
import { globalAntdFeedback } from '../antdFeedback'
import type { PreviewDetail, PreviewDetailEntry } from '../components/imagePreview/previewTypes'

interface PreviewPairLike {
  seq: number
  left?: PreviewImage
  right?: PreviewImage
}

interface UseWorkspacePreviewActionsInput {
  activeConversation: Conversation | null
  previewMode: 'single' | 'ab'
  currentPreviewImage: PreviewImage | undefined
  currentPreviewPair: PreviewPairLike | undefined
  closePreview: () => void
  requestComposerFocus: () => void
  setDraft: (value: string) => void
  setGenerationMode: (mode: 'image' | 'text') => void
  replayRunAsNewMessage: (runId: string) => void
}

export function useWorkspacePreviewActions(input: UseWorkspacePreviewActionsInput) {
  const findPreviewDetailEntry = useCallback((runId?: string, imageId?: string, label = '当前图'): PreviewDetailEntry | null => {
    if (!input.activeConversation || !runId || !imageId) {
      return null
    }

    for (const message of input.activeConversation.messages) {
      for (const run of message.runs ?? []) {
        if (run.id !== runId) {
          continue
        }

        const image = run.images.find((item) => item.id === imageId)
        if (!image) {
          return null
        }

        return { label, run, image }
      }
    }

    return null
  }, [input.activeConversation])

  const currentPreviewDetail = useMemo<PreviewDetail | null>(() => {
    if (input.previewMode === 'single') {
      const entry = findPreviewDetailEntry(input.currentPreviewImage?.runId, input.currentPreviewImage?.id, '当前图')
      if (!entry) {
        return null
      }

      return {
        mode: 'single',
        seq: input.currentPreviewImage?.seq ?? entry.image.seq,
        single: entry,
      }
    }

    if (!input.currentPreviewPair) {
      return null
    }

    const left = findPreviewDetailEntry(input.currentPreviewPair.left?.runId, input.currentPreviewPair.left?.id, 'A 侧')
    const right = findPreviewDetailEntry(input.currentPreviewPair.right?.runId, input.currentPreviewPair.right?.id, 'B 侧')
    if (!left && !right) {
      return null
    }

    return {
      mode: 'ab',
      seq: input.currentPreviewPair.seq,
      left: left ?? undefined,
      right: right ?? undefined,
    }
  }, [findPreviewDetailEntry, input.currentPreviewImage?.id, input.currentPreviewImage?.runId, input.currentPreviewImage?.seq, input.currentPreviewPair, input.previewMode])

  const handleClosePreview = useCallback(() => {
    recordChatMemoryEvent('preview-close', input.currentPreviewImage?.id ?? input.currentPreviewPair?.seq?.toString())
    input.closePreview()
    input.requestComposerFocus()
  }, [input])

  const copyPreviewPrompt = useCallback(async (entry: PreviewDetailEntry) => {
    await globalAntdFeedback.copyText({
      text: entry.run.finalPrompt || entry.run.templatePrompt || '',
      successMessage: '已复制 Prompt',
      failureMessage: '复制 Prompt 失败，请手动复制',
    })
  }, [])

  const copyPreviewParams = useCallback(async (entry: PreviewDetailEntry) => {
    await globalAntdFeedback.copyText({
      text: JSON.stringify({
        paramsSnapshot: entry.run.paramsSnapshot,
        settingsSnapshot: entry.run.settingsSnapshot,
      }, null, 2),
      successMessage: '已复制参数与设置',
      failureMessage: '复制参数失败，请手动复制',
    })
  }, [])

  const reusePreviewPrompt = useCallback((entry: PreviewDetailEntry) => {
    const nextDraft = entry.run.templatePrompt?.trim()
      ? entry.run.templatePrompt
      : entry.run.finalPrompt
    input.setGenerationMode('image')
    input.setDraft(nextDraft)
    input.requestComposerFocus()
    input.closePreview()
  }, [input])

  const replayPreviewRun = useCallback((entry: PreviewDetailEntry) => {
    void input.replayRunAsNewMessage(entry.run.id)
  }, [input])

  return {
    currentPreviewDetail,
    handleClosePreview,
    copyPreviewPrompt,
    copyPreviewParams,
    reusePreviewPrompt,
    replayPreviewRun,
  }
}
