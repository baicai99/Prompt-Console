import { message, notification } from 'antd'

type MessageApiLike = Pick<typeof message, 'info' | 'success' | 'warning' | 'error'>

export interface AntdFeedback {
  info: (content: string) => void
  success: (content: string) => void
  warning: (content: string) => void
  error: (content: string) => void
  notify: (input: {
    level: 'success' | 'warning' | 'error'
    title: string
    description: string
    duration?: number
    onClick?: () => void
  }) => void
  copyText: (input: {
    text: string
    successMessage: string
    failureMessage: string
  }) => Promise<boolean>
}

function fallbackCopyTextToClipboard(text: string): boolean {
  if (typeof document === 'undefined') {
    return false
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    if (typeof document.execCommand === 'function') {
      return document.execCommand('copy')
    }
    return false
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return fallbackCopyTextToClipboard(text)
    }
  }
  return fallbackCopyTextToClipboard(text)
}

export function createAntdFeedback(messageApi: MessageApiLike = message): AntdFeedback {
  return {
    info(content) {
      void messageApi.info(content)
    },
    success(content) {
      void messageApi.success(content)
    },
    warning(content) {
      void messageApi.warning(content)
    },
    error(content) {
      void messageApi.error(content)
    },
    notify(input) {
      const payload = {
        placement: 'topRight' as const,
        title: input.title,
        description: input.description,
        duration: input.duration,
        onClick: input.onClick,
      }
      if (input.level === 'success') {
        notification.success(payload)
        return
      }
      if (input.level === 'warning') {
        notification.warning(payload)
        return
      }
      notification.error(payload)
    },
    async copyText(input) {
      const copied = await copyTextToClipboard(input.text)
      if (copied) {
        void messageApi.success(input.successMessage)
        return true
      }
      void messageApi.error(input.failureMessage)
      return false
    },
  }
}

export const globalAntdFeedback = createAntdFeedback()
