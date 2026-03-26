import type { Run } from '../../../../../types/conversation'
import type { ImageItem } from '../../../../../types/image'

export interface PreviewDetailEntry {
  label: string
  run: Run
  image: ImageItem
}

export interface PreviewSingleDetail {
  mode: 'single'
  seq: number
  single: PreviewDetailEntry
}

export interface PreviewABDetail {
  mode: 'ab'
  seq: number
  left?: PreviewDetailEntry
  right?: PreviewDetailEntry
}

export type PreviewDetail = PreviewSingleDetail | PreviewABDetail
