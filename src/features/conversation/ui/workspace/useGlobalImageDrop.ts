import { useEffect } from 'react'
import type { MutableRefObject } from 'react'
import { extractImageFilesFromTransfer, hasImageFileInTransfer } from '../../../../utils/imageTransfer'

interface UseGlobalImageDropInput {
  globalImageDragDepthRef: MutableRefObject<number>
  setIsGlobalImageDragging: React.Dispatch<React.SetStateAction<boolean>>
  appendDraftSourceImages: (files: File[]) => void
  requestComposerFocus: () => void
}

export function useGlobalImageDrop(input: UseGlobalImageDropInput) {
  const {
    globalImageDragDepthRef,
    setIsGlobalImageDragging,
    appendDraftSourceImages,
    requestComposerFocus,
  } = input

  useEffect(() => {
    const resetGlobalImageDragState = () => {
      globalImageDragDepthRef.current = 0
      setIsGlobalImageDragging(false)
    }

    const handleDragEnter = (event: DragEvent) => {
      if (!hasImageFileInTransfer(event.dataTransfer)) {
        return
      }
      event.preventDefault()
      globalImageDragDepthRef.current += 1
      setIsGlobalImageDragging(true)
    }

    const handleDragOver = (event: DragEvent) => {
      if (!hasImageFileInTransfer(event.dataTransfer)) {
        return
      }
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
      setIsGlobalImageDragging(true)
    }

    const handleDragLeave = (event: DragEvent) => {
      if (hasImageFileInTransfer(event.dataTransfer)) {
        globalImageDragDepthRef.current = Math.max(0, globalImageDragDepthRef.current - 1)
      } else {
        globalImageDragDepthRef.current = 0
      }
      if (globalImageDragDepthRef.current === 0) {
        setIsGlobalImageDragging(false)
      }
    }

    const handleDrop = (event: DragEvent) => {
      const imageFiles = extractImageFilesFromTransfer(event.dataTransfer)
      if (imageFiles.length === 0) {
        resetGlobalImageDragState()
        return
      }
      event.preventDefault()
      appendDraftSourceImages(imageFiles)
      requestComposerFocus()
      resetGlobalImageDragState()
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    window.addEventListener('dragend', resetGlobalImageDragState)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('dragend', resetGlobalImageDragState)
    }
  }, [appendDraftSourceImages, globalImageDragDepthRef, requestComposerFocus, setIsGlobalImageDragging])
}
