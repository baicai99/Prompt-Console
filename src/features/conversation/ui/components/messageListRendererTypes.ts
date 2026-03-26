import type { MouseEvent as ReactMouseEvent } from 'react'
import type { ImageItem } from '../../../../types/image'

export interface DisplayImage {
  seq: number
  item: ImageItem | null
  missingReason?: string
}

export interface PaginationControl {
  current: number
  total: number
  label: string
  onLoadMore: () => void
}

export type AssistantActionTrigger = (
  actionKey: string,
  event: ReactMouseEvent<HTMLElement>,
  action: () => void | Promise<void>,
) => void
