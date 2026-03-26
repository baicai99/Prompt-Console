import type { MouseEvent as ReactMouseEvent } from 'react'

export interface UserSourceImagePreview {
  id: string
  src: string
  fileName: string
}

export type AssistantActionTrigger = (
  actionKey: string,
  event: ReactMouseEvent<HTMLElement>,
  action: () => void | Promise<void>,
) => void
