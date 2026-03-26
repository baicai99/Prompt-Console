import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import type { ModelSpec } from '../../../../types/model'
import type { DashCommandOption } from './composerHelpers'

type PickerMode = 'quick-actions' | 'models' | 'commands'
const QUICK_PICKER_MOUSE_LEAVE_CLOSE_DELAY_MS = 500

interface ComposerQuickPickerProps {
  isOpen: boolean
  pickerMode: PickerMode
  matchedModels: ModelSpec[]
  matchedDashCommands: DashCommandOption[]
  quickPickerItems: string[]
  quickPickerActiveIndex: number
  setQuickPickerActiveIndex: (index: number) => void
  applyModelShortcutItem: (model: ModelSpec) => void
  applyDashCommandItem: (command: DashCommandOption) => void
  applyQuickPickerItem: (label: string) => void
  isSideConfigLocked: boolean
  comparisonModeQuickAction: string
  onRequestClose: () => void
}

export function ComposerQuickPicker(props: ComposerQuickPickerProps) {
  const {
    isOpen,
    pickerMode,
    matchedModels,
    matchedDashCommands,
    quickPickerItems,
    quickPickerActiveIndex,
    setQuickPickerActiveIndex,
    applyModelShortcutItem,
    applyDashCommandItem,
    applyQuickPickerItem,
    isSideConfigLocked,
    comparisonModeQuickAction,
    onRequestClose,
  } = props
  const closeTimerRef = useRef<number | null>(null)

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  useEffect(() => clearCloseTimer, [])
  useEffect(() => {
    if (!isOpen) {
      clearCloseTimer()
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const handlePointerSelect = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault()
    action()
  }

  const handleKeyboardClick = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    if (event.detail !== 0) {
      return
    }
    action()
  }

  const handleMouseLeave = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      onRequestClose()
    }, QUICK_PICKER_MOUSE_LEAVE_CLOSE_DELAY_MS)
  }

  return (
    <div
      className="composer-quick-picker absolute bottom-[calc(100%+8px)] left-0 z-40 max-h-[min(260px,34vh)] w-[min(300px,100%)] overflow-y-auto rounded-lg border border-[rgba(214,220,229,0.92)] bg-white p-[5px] shadow-[0_10px_26px_rgba(15,23,42,0.14)]"
      role="listbox"
      aria-label="快捷功能选择"
      onMouseEnter={clearCloseTimer}
      onMouseLeave={handleMouseLeave}
    >
      {pickerMode === 'models'
        ? matchedModels.length > 0
          ? matchedModels.map((model, index) => (
            <button
              key={model.id}
              type="button"
              className={`composer-quick-picker-item w-full overflow-wrap-anywhere rounded-[10px] border-none bg-transparent px-3 py-[9px] text-left text-sm leading-[1.3] ${index === quickPickerActiveIndex ? 'is-active bg-[#eef4ff]' : 'hover:bg-[#eef4ff]'}`}
              onMouseEnter={() => setQuickPickerActiveIndex(index)}
              onMouseDown={(event) => handlePointerSelect(event, () => applyModelShortcutItem(model))}
              onClick={(event) => handleKeyboardClick(event, () => applyModelShortcutItem(model))}
            >
              {model.name}
            </button>
          ))
          : <div className="composer-quick-picker-empty px-2.5 py-2 text-xs text-[#8c8c8c]">未找到匹配模型</div>
        : pickerMode === 'commands'
          ? matchedDashCommands.length > 0
            ? matchedDashCommands.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={`composer-quick-picker-item w-full overflow-wrap-anywhere rounded-[10px] border-none bg-transparent px-3 py-[9px] text-left text-sm leading-[1.3] ${index === quickPickerActiveIndex ? 'is-active bg-[#eef4ff]' : 'hover:bg-[#eef4ff]'}`}
                onMouseEnter={() => setQuickPickerActiveIndex(index)}
                onMouseDown={(event) => handlePointerSelect(event, () => applyDashCommandItem(item))}
                onClick={(event) => handleKeyboardClick(event, () => applyDashCommandItem(item))}
              >
                {item.label}
              </button>
            ))
            : <div className="composer-quick-picker-empty px-2.5 py-2 text-xs text-[#8c8c8c]">未找到匹配命令</div>
          : quickPickerItems.map((item, index) => (
            <button
              key={item}
              type="button"
              className={`composer-quick-picker-item w-full overflow-wrap-anywhere rounded-[10px] border-none px-3 py-[9px] text-left text-sm leading-[1.3] ${index === quickPickerActiveIndex ? 'is-active bg-[#eef4ff]' : 'bg-transparent hover:bg-[#eef4ff]'} ${isSideConfigLocked && item === comparisonModeQuickAction ? 'is-disabled cursor-not-allowed bg-transparent text-[#bfbfbf] hover:bg-transparent' : ''}`}
              onMouseEnter={() => setQuickPickerActiveIndex(index)}
              onMouseDown={(event) => handlePointerSelect(event, () => applyQuickPickerItem(item))}
              disabled={isSideConfigLocked && item === comparisonModeQuickAction}
              onClick={(event) => handleKeyboardClick(event, () => applyQuickPickerItem(item))}
            >
              {item}
            </button>
          ))}
    </div>
  )
}
