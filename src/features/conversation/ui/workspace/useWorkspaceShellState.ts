import { useCallback, useEffect, useRef, useState } from 'react'
import type { MessageAction, Side } from '../../../../types/conversation'
import { usePersistentPanelMode } from '../../../../hooks/usePersistentPanelMode'
import type { AdvancedTabKey } from '../components/useComposerAdvancedPanelController'
import type { ModelPickerTarget } from '../modelPickerTarget'
import { normalizeModelPickerTarget } from '../modelPickerTarget'

const RIGHT_PANEL_COLLAPSED_STORAGE_KEY = 'm3:right-panel-collapsed'
const COMPOSER_PANEL_COLLAPSED_STORAGE_KEY = 'm3:composer-panel-collapsed'

type RightPanelTab =
  | 'modelPicker'
  | 'settings'
  | 'modelStats'
  | 'imageParams'
  | 'dynamicPrompt'
  | 'advanced'
  | 'diagnostics'

interface UseWorkspaceShellStateInput {
  activeSideMode: 'single' | 'multi'
  activeSides: Side[]
}

export function useWorkspaceShellState(input: UseWorkspaceShellStateInput) {
  const { mode: rightPanelMode, setMode: setRightPanelMode, toggleMode: toggleRightPanelMode } = usePersistentPanelMode({
    storageKey: RIGHT_PANEL_COLLAPSED_STORAGE_KEY,
    defaultMode: 'collapsed',
  })
  const { mode: composerPanelMode, setMode: setComposerPanelMode } = usePersistentPanelMode({
    storageKey: COMPOSER_PANEL_COLLAPSED_STORAGE_KEY,
    defaultMode: 'expanded',
  })
  const globalImageDragDepthRef = useRef(0)
  const [composerFocusToken, setComposerFocusToken] = useState(0)
  const [composerAutoFocusOnMount, setComposerAutoFocusOnMount] = useState(false)
  const [openAddChannelModalSignal, setOpenAddChannelModalSignal] = useState(0)
  const [openChannelManagementDrawerSignal, setOpenChannelManagementDrawerSignal] = useState(0)
  const [isGlobalImageDragging, setIsGlobalImageDragging] = useState(false)
  const [isLeftNavDrawerOpen, setIsLeftNavDrawerOpen] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('settings')
  const [modelPickerTarget, setModelPickerTarget] = useState<ModelPickerTarget>({ kind: 'window', side: 'single' })
  const [dynamicPromptRequestedTab, setDynamicPromptRequestedTab] = useState<AdvancedTabKey | null>(null)
  const [dynamicPromptOpenRequestToken, setDynamicPromptOpenRequestToken] = useState(0)

  const requestComposerFocus = useCallback(() => {
    setComposerFocusToken((prev) => prev + 1)
  }, [])
  const handleCollapseComposer = useCallback(() => {
    setComposerPanelMode('collapsed')
  }, [setComposerPanelMode])
  const handleExpandComposer = useCallback(() => {
    setComposerAutoFocusOnMount(true)
    setComposerPanelMode('expanded')
  }, [setComposerPanelMode])

  useEffect(() => {
    setModelPickerTarget((prev) => normalizeModelPickerTarget(prev, input.activeSideMode, input.activeSides))
  }, [input.activeSideMode, input.activeSides])

  const openSettingsPanel = useCallback(() => {
    setRightPanelTab('settings')
    setRightPanelMode('expanded')
  }, [setRightPanelMode])

  const openChannelManagementDrawer = useCallback(() => {
    setRightPanelTab('settings')
    setRightPanelMode('expanded')
    setOpenChannelManagementDrawerSignal((prev) => prev + 1)
  }, [setRightPanelMode])

  const openModelPickerDrawer = useCallback((target: ModelPickerTarget) => {
    setModelPickerTarget(normalizeModelPickerTarget(target, input.activeSideMode, input.activeSides))
    setRightPanelTab('modelPicker')
    setRightPanelMode('expanded')
  }, [input.activeSideMode, input.activeSides, setRightPanelMode])

  const openDynamicPromptDrawer = useCallback((tab?: AdvancedTabKey) => {
    setRightPanelTab('dynamicPrompt')
    if (tab) {
      setDynamicPromptRequestedTab(tab)
    }
    setDynamicPromptOpenRequestToken((prev) => prev + 1)
    setRightPanelMode('expanded')
  }, [setRightPanelMode])

  const handleAssistantMessageAction = useCallback((action: MessageAction) => {
    openSettingsPanel()
    if (action.type === 'add-api') {
      setOpenAddChannelModalSignal((prev) => prev + 1)
    }
  }, [openSettingsPanel])

  return {
    globalImageDragDepthRef,
    composerFocusToken,
    composerAutoFocusOnMount,
    openAddChannelModalSignal,
    openChannelManagementDrawerSignal,
    isGlobalImageDragging,
    setIsGlobalImageDragging,
    isLeftNavDrawerOpen,
    setIsLeftNavDrawerOpen,
    rightPanelTab,
    setRightPanelTab,
    modelPickerTarget,
    dynamicPromptRequestedTab,
    dynamicPromptOpenRequestToken,
    rightPanelMode,
    setRightPanelMode,
    toggleRightPanelMode,
    composerPanelMode,
    requestComposerFocus,
    handleCollapseComposer,
    handleExpandComposer,
    openSettingsPanel,
    openChannelManagementDrawer,
    openModelPickerDrawer,
    openDynamicPromptDrawer,
    handleAssistantMessageAction,
  }
}
