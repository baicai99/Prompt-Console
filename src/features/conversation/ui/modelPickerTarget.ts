import type { Side } from '../../../types/conversation'

export type ModelPickerTarget =
  | { kind: 'window'; side: Side }
  | { kind: 'default' }

export function normalizeModelPickerTarget(
  target: ModelPickerTarget,
  activeSideMode: 'single' | 'multi',
  activeSides: Side[],
): ModelPickerTarget {
  if (activeSideMode === 'single') {
    return { kind: 'window', side: 'single' }
  }

  if (target.kind === 'default') {
    return target
  }

  return activeSides.includes(target.side)
    ? target
    : { kind: 'window', side: activeSides[0] ?? 'single' }
}

export function resolveModelPickerBoundSide(
  target: ModelPickerTarget,
  activeSideMode: 'single' | 'multi',
  activeSides: Side[],
): Side {
  if (activeSideMode === 'single') {
    return 'single'
  }

  if (target.kind === 'default') {
    return 'single'
  }

  return activeSides.includes(target.side) ? target.side : activeSides[0] ?? 'single'
}

export function resolveWindowSideLabel(side: Side, activeSides: Side[]): string {
  const index = activeSides.indexOf(side)
  return index >= 0 ? `窗口 ${index + 1}` : '当前窗口'
}
