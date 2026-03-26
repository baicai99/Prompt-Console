import { Suspense, lazy, useEffect, useState } from 'react'
import { Drawer } from 'antd'
import { useNavigate } from 'react-router-dom'
import type {
  ImageRuntimeSettings,
  LoggingSettings,
  Side,
  SingleSideSettings,
} from '../../../types/conversation'
import type { ApiChannel } from '../../../types/channel'
import type { ModelSpec } from '../../../types/model'
import type { SettingPrimitive } from '../../../types/primitives'
import type { ConversationSummary } from '../../../types/conversation'
import type { ConversationSourceImagePreviewDebugStats } from '../application/conversationSourceImagePreviewService'
import type { PanelValueFormat, PanelVariableRow } from '../domain/types'
import type { AdvancedTabKey } from './components/useComposerAdvancedPanelController'
import type { ModelPickerTarget } from './modelPickerTarget'
import { WorkspaceSettingsNavRail } from './workspace/sidebar/WorkspaceSettingsNavRail'
import { resolveRightPanelItems, type RightPanelTab } from './workspace/sidebar/workspaceSettingsSidebarShared'

const LazyWorkspaceSettingsDrawerPanel = lazy(async () => {
  const module = await import('./workspace/sidebar/WorkspaceSettingsDrawerPanel')
  return { default: module.WorkspaceSettingsDrawerPanel }
})

interface WorkspaceSettingsSidebarProps {
  mode: 'collapsed' | 'expanded'
  rightPanelTab: RightPanelTab
  setRightPanelMode: (mode: 'collapsed' | 'expanded') => void
  toggleRightPanelMode: () => void
  setRightPanelTab: (tab: RightPanelTab) => void
  expandedWidth: number | string
  collapsedWidth: number
  activeSideMode: 'single' | 'multi'
  activeSideCount: number
  activeSides: Side[]
  composerPanelMode: 'expanded' | 'collapsed'
  modelPickerTarget: ModelPickerTarget
  summaries: ConversationSummary[]
  isSideConfigLocked: boolean
  activeSettingsBySide: Record<Side, SingleSideSettings>
  models: ModelSpec[]
  channels: ApiChannel[]
  activeGenerationMode: 'image' | 'text'
  loggingSettings: LoggingSettings
  showAdvancedVariables: boolean
  dynamicPromptEnabled: boolean
  dynamicPromptRequestedTab?: AdvancedTabKey | null
  dynamicPromptOpenRequestToken?: number
  autoRenameConversationTitle: boolean
  autoRenameConversationTitleModelId: string | null
  runConcurrency: number
  runConcurrencyUnlimited: boolean
  imageRuntimeSettings: ImageRuntimeSettings
  panelValueFormat: PanelValueFormat
  panelVariables: PanelVariableRow[]
  resolvedVariables: Record<string, string>
  finalPromptPreview: string
  missingKeys: string[]
  unusedVariableKeys: string[]
  panelBatchError: string
  panelMismatchRowIds: string[]
  openAddChannelModalSignal: number
  openChannelManagementDrawerSignal?: number
  favoriteModelIds: string[]
  updateSideMode: (mode: 'single' | 'multi') => void
  updateSideCount: (count: number) => void
  updateSideSettings: (side: Side, patch: Partial<SingleSideSettings>) => void
  updateSidesSettings: (sides: Side[], patch: Partial<SingleSideSettings>) => void
  setGenerationMode: (mode: 'image' | 'text') => void
  setSideModel: (side: Side, modelId: string) => void
  setSideModelForCurrentMode: (side: Side, modelId: string) => void
  setSideModelParam: (side: Side, paramKey: string, value: SettingPrimitive) => void
  setChannels: (channels: ApiChannel[]) => void
  setLoggingSettings: (value: Partial<LoggingSettings>) => void
  setAdvancedFeaturesEnabled: (enabled: boolean) => void
  setAutoRenameConversationTitle: (enabled: boolean) => void
  setAutoRenameConversationTitleModelId: (modelId: string | null) => void
  setRunConcurrency: (value: number) => void
  setRunConcurrencyUnlimited: (enabled: boolean) => void
  setImageRuntimeSettings: (value: Partial<ImageRuntimeSettings>) => void
  setPanelValueFormat: (value: PanelValueFormat) => void
  setPanelVariables: (value: PanelVariableRow[]) => void
  setFavoriteModelIds: (value: string[]) => void
  onOpenModelPicker: (target: ModelPickerTarget) => void
  onCollapseComposer: () => void
  onExpandComposer: () => void
  requestComposerFocus: () => void
  getPreviewDebugStats?: () => ConversationSourceImagePreviewDebugStats
  workspaceDiagnostics?: import('../application/conversationControllerContract').ConversationWorkspaceReadModel['workspaceDiagnostics']
}

export function WorkspaceSettingsSidebar(props: WorkspaceSettingsSidebarProps) {
  const navigate = useNavigate()
  const {
    mode,
    rightPanelTab,
    setRightPanelMode,
    toggleRightPanelMode,
    setRightPanelTab,
    expandedWidth,
    collapsedWidth,
    activeSideMode,
    activeSideCount,
    activeSides,
    composerPanelMode,
    modelPickerTarget,
    isSideConfigLocked,
    activeSettingsBySide,
    models,
    channels,
    activeGenerationMode,
    loggingSettings,
    showAdvancedVariables,
    dynamicPromptEnabled,
    dynamicPromptRequestedTab,
    dynamicPromptOpenRequestToken,
    autoRenameConversationTitle,
    autoRenameConversationTitleModelId,
    runConcurrency,
    runConcurrencyUnlimited,
    imageRuntimeSettings,
    panelValueFormat,
    panelVariables,
    resolvedVariables,
    finalPromptPreview,
    missingKeys,
    unusedVariableKeys,
    panelBatchError,
    panelMismatchRowIds,
    openAddChannelModalSignal,
    openChannelManagementDrawerSignal,
    favoriteModelIds,
    updateSideMode,
    updateSideCount,
    updateSideSettings,
    updateSidesSettings,
    setGenerationMode,
    setSideModel,
    setSideModelForCurrentMode,
    setSideModelParam,
    setChannels,
    setLoggingSettings,
    setAdvancedFeaturesEnabled,
    setAutoRenameConversationTitle,
    setAutoRenameConversationTitleModelId,
    setRunConcurrency,
    setRunConcurrencyUnlimited,
    setImageRuntimeSettings,
    setPanelValueFormat,
    setPanelVariables,
    setFavoriteModelIds,
    onOpenModelPicker,
    onCollapseComposer,
    onExpandComposer,
    requestComposerFocus,
    getPreviewDebugStats,
    workspaceDiagnostics,
  } = props
  const rightPanelItems = resolveRightPanelItems(activeSideMode)
  const isDrawerOpen = mode === 'expanded'
  const isDefaultModelTarget = activeSideMode === 'multi' && modelPickerTarget.kind === 'default'
  const isModelPickerNavItemActive = rightPanelTab === 'modelPicker' && (activeSideMode === 'single' || isDefaultModelTarget)
  const activePanelTitle = rightPanelTab === 'modelPicker'
    ? (isDefaultModelTarget ? '默认模型' : '模型管理')
    : (rightPanelItems.find((item) => item.key === rightPanelTab)?.title ?? '工作区设置')
  const isNarrowViewport = typeof window !== 'undefined' ? window.innerWidth <= 920 : false
  const resolvedDrawerWidth = typeof expandedWidth === 'number'
    ? (isNarrowViewport ? 'calc(100vw - 16px)' : `min(${expandedWidth}px, calc(100vw - 32px))`)
    : (isNarrowViewport ? 'calc(100vw - 16px)' : `min(${expandedWidth}, calc(100vw - 32px))`)
  const windowSideIds = activeSides.filter((side) => side !== 'single')
  const [activeWindowSettingsSideTab, setActiveWindowSettingsSideTab] = useState<Side>(windowSideIds[0] ?? 'single')
  const [hasLoadedDrawerPanel, setHasLoadedDrawerPanel] = useState(false)

  useEffect(() => {
    if (activeSideMode !== 'multi') {
      setActiveWindowSettingsSideTab('single')
      return
    }

    if (!windowSideIds.includes(activeWindowSettingsSideTab)) {
      setActiveWindowSettingsSideTab(windowSideIds[0] ?? 'single')
    }
  }, [activeSideMode, activeWindowSettingsSideTab, windowSideIds])

  useEffect(() => {
    if (isDrawerOpen) {
      setHasLoadedDrawerPanel(true)
    }
  }, [isDrawerOpen])

  const handlePanelEntryClick = (tab: RightPanelTab) => {
    if (tab === 'modelPicker') {
      onOpenModelPicker(activeSideMode === 'multi' ? { kind: 'default' } : { kind: 'window', side: 'single' })
      return
    }
    setRightPanelTab(tab)
    if (!isDrawerOpen) {
      toggleRightPanelMode()
    }
  }

  const handleAnalyticsNavigation = (route: string) => {
    setRightPanelMode('collapsed')
    navigate(route)
  }

  return (
    <>
      <WorkspaceSettingsNavRail
        collapsedWidth={collapsedWidth}
        items={rightPanelItems}
        rightPanelTab={rightPanelTab}
        isModelPickerNavItemActive={isModelPickerNavItemActive}
        onPanelEntryClick={handlePanelEntryClick}
        composerPanelMode={composerPanelMode}
        onCollapseComposer={onCollapseComposer}
        onExpandComposer={onExpandComposer}
      />

      <Drawer
        title={activePanelTitle}
        placement="right"
        open={isDrawerOpen}
        onClose={() => setRightPanelMode('collapsed')}
        size={resolvedDrawerWidth}
        className="settings-drawer"
        rootClassName="settings-drawer-root"
        destroyOnClose={false}
        maskClosable
        keyboard
        styles={{
          body: {
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            minHeight: 0,
            overflow: 'hidden',
          },
        }}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {hasLoadedDrawerPanel ? (
            <Suspense fallback={null}>
              <LazyWorkspaceSettingsDrawerPanel
                rightPanelTab={rightPanelTab}
                isDrawerOpen={isDrawerOpen}
                activeSideMode={activeSideMode}
                activeSideCount={activeSideCount}
                activeSides={activeSides}
                activeWindowSettingsSideTab={activeWindowSettingsSideTab}
                setActiveWindowSettingsSideTab={setActiveWindowSettingsSideTab}
                modelPickerTarget={modelPickerTarget}
                isSideConfigLocked={isSideConfigLocked}
                activeSettingsBySide={activeSettingsBySide}
                models={models}
                channels={channels}
                activeGenerationMode={activeGenerationMode}
                loggingSettings={loggingSettings}
                showAdvancedVariables={showAdvancedVariables}
                dynamicPromptEnabled={dynamicPromptEnabled}
                dynamicPromptRequestedTab={dynamicPromptRequestedTab}
                dynamicPromptOpenRequestToken={dynamicPromptOpenRequestToken}
                autoRenameConversationTitle={autoRenameConversationTitle}
                autoRenameConversationTitleModelId={autoRenameConversationTitleModelId}
                runConcurrency={runConcurrency}
                runConcurrencyUnlimited={runConcurrencyUnlimited}
                imageRuntimeSettings={imageRuntimeSettings}
                panelValueFormat={panelValueFormat}
                panelVariables={panelVariables}
                resolvedVariables={resolvedVariables}
                finalPromptPreview={finalPromptPreview}
                missingKeys={missingKeys}
                unusedVariableKeys={unusedVariableKeys}
                panelBatchError={panelBatchError}
                panelMismatchRowIds={panelMismatchRowIds}
                openAddChannelModalSignal={openAddChannelModalSignal}
                openChannelManagementDrawerSignal={openChannelManagementDrawerSignal}
                favoriteModelIds={favoriteModelIds}
                updateSideMode={updateSideMode}
                updateSideCount={updateSideCount}
                updateSideSettings={updateSideSettings}
                updateSidesSettings={updateSidesSettings}
                setGenerationMode={setGenerationMode}
                setSideModel={setSideModel}
                setSideModelForCurrentMode={setSideModelForCurrentMode}
                setSideModelParam={setSideModelParam}
                setChannels={setChannels}
                setLoggingSettings={setLoggingSettings}
                setAdvancedFeaturesEnabled={setAdvancedFeaturesEnabled}
                setAutoRenameConversationTitle={setAutoRenameConversationTitle}
                setAutoRenameConversationTitleModelId={setAutoRenameConversationTitleModelId}
                setRunConcurrency={setRunConcurrency}
                setRunConcurrencyUnlimited={setRunConcurrencyUnlimited}
                setImageRuntimeSettings={setImageRuntimeSettings}
                setPanelValueFormat={setPanelValueFormat}
                setPanelVariables={setPanelVariables}
                setFavoriteModelIds={setFavoriteModelIds}
                requestComposerFocus={requestComposerFocus}
                handleAnalyticsNavigation={handleAnalyticsNavigation}
                getPreviewDebugStats={getPreviewDebugStats}
                workspaceDiagnostics={workspaceDiagnostics}
              />
            </Suspense>
          ) : null}
        </div>
      </Drawer>
    </>
  )
}
