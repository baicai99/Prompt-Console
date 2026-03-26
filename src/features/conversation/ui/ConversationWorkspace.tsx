import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Drawer, Layout } from 'antd'
import { ConversationList } from './components/ConversationList'
import { WorkspaceSettingsSidebar } from './WorkspaceSettingsSidebar'
import { ConversationWorkspaceStage } from './ConversationWorkspaceStage'
import { createConversationSourceImagePreviewService } from '../application/conversationSourceImagePreviewService'
import { useImagePreview } from '../../../hooks/useImagePreview'
import type { Side } from '../../../types/conversation'
import { useConversationWorkspaceController } from './controller/useConversationWorkspaceController'
import { resolveCurrentModeModelId, resolveSharedGenerationMode } from '../domain/generationMode'
import { useGlobalImageDrop } from './workspace/useGlobalImageDrop'
import { useWorkspaceNavigationActions } from './workspace/useWorkspaceNavigationActions'
import { useWorkspacePreviewActions } from './workspace/useWorkspacePreviewActions'
import { useWorkspaceShellState } from './workspace/useWorkspaceShellState'

const LEFT_NAV_WIDTH = 52
const LEFT_NAV_DRAWER_WIDTH = 280
const SETTINGS_SIDER_EXPANDED_WIDTH = '55vw'
const SETTINGS_SIDER_MINI_WIDTH = 52
const { Sider } = Layout
const imagePreviewModalModule = import('./components/ImagePreviewModal')
const ImagePreviewModal = lazy(async () => ({
  default: (await imagePreviewModalModule).ImagePreviewModal,
}))
void imagePreviewModalModule

interface MultiRenderProfile {
  runInitialLimit: number
  runPageSize: number
  imageInitialLimit: number
  imagePageSize: number
  messageWindowSize: number
  messageOverscan: number
}

function resolveMultiRenderProfile(sideCount: number): MultiRenderProfile {
  if (sideCount >= 4) {
    return {
      runInitialLimit: 8,
      runPageSize: 8,
      imageInitialLimit: 12,
      imagePageSize: 12,
      messageWindowSize: 16,
      messageOverscan: 6,
    }
  }

  if (sideCount >= 3) {
    return {
      runInitialLimit: 10,
      runPageSize: 10,
      imageInitialLimit: 14,
      imagePageSize: 14,
      messageWindowSize: 18,
      messageOverscan: 7,
    }
  }

  return {
    runInitialLimit: 12,
    runPageSize: 12,
    imageInitialLimit: 16,
    imagePageSize: 16,
    messageWindowSize: 20,
    messageOverscan: 8,
  }
}

export function ConversationWorkspace() {
  const [conversationOpenScrollTrigger, setConversationOpenScrollTrigger] = useState(0)
  const previousActiveConversationIdRef = useRef<string | null>(null)
  const previousSendScrollTriggerRef = useRef(0)
  const composerCollapseActionRef = useRef<(() => void) | null>(null)
  const {
    summaries,
    activeConversation,
    imageTasksByRunId,
    shouldConfirmCreateConversation,
    activeId,
    draft,
    draftSourceImages,
    sendError,
    isSending,
    showAdvancedVariables,
    dynamicPromptEnabled,
    autoRenameConversationTitle,
    autoRenameConversationTitleModelId,
    panelValueFormat,
    panelVariables,
    favoriteModelIds,
    runConcurrency,
    runConcurrencyUnlimited,
    imageRuntimeSettings,
    loggingSettings,
    historyVisibleLimit,
    historyPageSize,
    isLoadingOlderMessages,
    sendScrollTrigger,
    sendScrollTargetMessageId,
    workspaceDiagnostics,
    resolvedVariables,
    templatePreview,
    unusedVariableKeys,
    activeSideMode,
    activeSideCount,
    activeSides,
    isSideConfigLocked,
    activeSettingsBySide,
    modelCatalog,
    channels,
    isSendBlocked,
    panelBatchError,
    panelMismatchRowIds,
    replayingRunIds,
    setDraft,
    appendDraftSourceImages,
    removeDraftSourceImage,
    clearDraftSourceImages,
    setShowAdvancedVariables,
    setDynamicPromptEnabled,
    setAutoRenameConversationTitle,
    setAutoRenameConversationTitleModelId,
    setPanelValueFormat,
    setPanelVariables,
    setFavoriteModelIds,
    setRunConcurrency,
    setRunConcurrencyUnlimited,
    setImageRuntimeSettings,
    setLoggingSettings,
    createNewConversation,
    clearAllConversations,
    removeConversation,
    renameConversation,
    togglePinConversation,
    switchConversation,
    updateSideMode,
    updateSideCount,
    updateSideSettings,
    updateSidesSettings,
    setGenerationMode,
    setSideModel,
    setSideModelForCurrentMode,
    setSideModelParam,
    setChannels,
    sendDraft,
    loadOlderMessages,
    retryRun,
    cancelMessageRuns,
    replayRunAsNewMessage,
    downloadAllRunImages,
    downloadMessageRunImages,
    downloadSingleRunImage,
    downloadBatchRunImages,
  } = useConversationWorkspaceController()
  const {
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
    openChannelManagementDrawer,
    openModelPickerDrawer,
    openDynamicPromptDrawer,
    handleAssistantMessageAction,
  } = useWorkspaceShellState({
    activeSideMode,
    activeSides,
  })
  const sourceImagePreviewService = useMemo(
    () => createConversationSourceImagePreviewService({
      maxActivePreviews: imageRuntimeSettings.maxActivePreviewHandles,
    }),
    [imageRuntimeSettings.maxActivePreviewHandles],
  )
  const setAdvancedFeaturesEnabled = useCallback((enabled: boolean) => {
    setShowAdvancedVariables(enabled)
    setDynamicPromptEnabled(enabled)
  }, [setDynamicPromptEnabled, setShowAdvancedVariables])
  const registerComposerCollapseAction = useCallback((action: (() => void) | null) => {
    composerCollapseActionRef.current = action
  }, [])
  const handleSidebarComposerCollapse = useCallback(() => {
    if (composerCollapseActionRef.current) {
      composerCollapseActionRef.current()
      return
    }
    handleCollapseComposer()
  }, [handleCollapseComposer])

  const {
    isPreviewOpen,
    previewMode,
    previewImages,
    previewPairs,
    interactionMode,
    compareMode,
    isSyncLocked,
    showInfoPanel,
    pixelMode,
    activePane,
    zoom,
    offset,
    transform,
    sharedTransform,
    leftTransform,
    rightTransform,
    isDragging,
    dragOriginRef,
    currentPreviewImage,
    currentPreviewPair,
    openPreview,
    closePreview,
    goPrevPreview,
    goNextPreview,
    goFirstPreview,
    goLastPreview,
    goToPreview,
    zoomBy,
    zoomTo,
    panBy,
    panTo,
    toggleFitMode,
    setActualPixelMode,
    setCompareMode,
    setIsSyncLocked,
    toggleInfoPanel,
    setActivePane,
    setIsDragging,
  } = useImagePreview()
  const {
    currentPreviewDetail,
    handleClosePreview,
    copyPreviewPrompt,
    copyPreviewParams,
    reusePreviewPrompt,
    replayPreviewRun,
  } = useWorkspacePreviewActions({
    activeConversation,
    previewMode,
    currentPreviewImage,
    currentPreviewPair,
    closePreview,
    requestComposerFocus,
    setDraft,
    setGenerationMode,
    replayRunAsNewMessage,
  })

  const multiRenderProfile = useMemo(() => resolveMultiRenderProfile(activeSideCount), [activeSideCount])
  const activeGenerationMode = useMemo(
    () =>
      resolveSharedGenerationMode({
        sideMode: activeSideMode,
        sideCount: activeSideCount,
        settingsBySide: activeSettingsBySide,
      }),
    [activeSettingsBySide, activeSideCount, activeSideMode],
  )
  const currentModelsForTrigger = useMemo(() => {
    const targetSides = activeSideMode === 'single' ? ['single'] : activeSides
    const nextModels: Record<Side, (typeof modelCatalog.models)[number] | null> = {}

    for (const side of targetSides) {
      const settings = activeSettingsBySide[side]
      const currentModelId = settings ? resolveCurrentModeModelId(settings) : ''
      nextModels[side] = modelCatalog.models.find((model) => model.id === currentModelId) ?? null
    }

    return nextModels
  }, [activeSettingsBySide, activeSideMode, activeSides, modelCatalog])
  const sourceImagesEnabled = activeGenerationMode === 'image'

  useEffect(() => {
    if (showAdvancedVariables === dynamicPromptEnabled) {
      return
    }
    setAdvancedFeaturesEnabled(showAdvancedVariables || dynamicPromptEnabled)
  }, [dynamicPromptEnabled, setAdvancedFeaturesEnabled, showAdvancedVariables])

  useEffect(() => {
    const previousActiveConversationId = previousActiveConversationIdRef.current
    const previousSendScrollTrigger = previousSendScrollTriggerRef.current
    const activeConversationChanged = previousActiveConversationId !== activeId
    const sendTriggered = previousSendScrollTrigger !== sendScrollTrigger && Boolean(sendScrollTargetMessageId)

    if (activeConversationChanged && activeId && !sendTriggered) {
      setConversationOpenScrollTrigger((prev) => prev + 1)
    }

    previousActiveConversationIdRef.current = activeId
    previousSendScrollTriggerRef.current = sendScrollTrigger
  }, [activeId, sendScrollTargetMessageId, sendScrollTrigger])

  useGlobalImageDrop({
    globalImageDragDepthRef,
    setIsGlobalImageDragging,
    appendDraftSourceImages,
    requestComposerFocus,
  })
  const {
    handleCreateConversation,
    handleClearAllConversations,
    handleRemoveConversation,
    handleSwitchConversation,
    handleUsePrompt,
    handleAppendDraftSourceImages,
    handleCancelMessageRuns,
  } = useWorkspaceNavigationActions({
    activeId,
    activeConversationId: activeConversation?.id ?? null,
    setIsLeftNavDrawerOpen,
    requestComposerFocus,
    createNewConversation,
    clearAllConversations,
    removeConversation,
    switchConversation,
    setDraft,
    appendDraftSourceImages,
    cancelMessageRuns,
  })

  return (
    <Layout className="h-screen overflow-hidden bg-[var(--prompt-image-console-colorBgLayout)]">
      <Sider
        width={LEFT_NAV_WIDTH}
        collapsedWidth={LEFT_NAV_WIDTH}
        trigger={null}
        collapsible={false}
        theme="light"
        className="!min-w-[52px] !max-w-[52px] !flex-[0_0_52px] overflow-hidden bg-[var(--prompt-image-console-colorBgContainer)] transition-[width,min-width,max-width] duration-150 ease-in"
      >
        <ConversationList
          summaries={summaries}
          activeId={activeId}
          viewMode="collapsed"
          onOpenDrawer={() => setIsLeftNavDrawerOpen(true)}
          shouldConfirmCreateConversation={shouldConfirmCreateConversation}
          onCreateConversation={handleCreateConversation}
          onClearAllConversations={handleClearAllConversations}
          onDeleteConversation={handleRemoveConversation}
          onRenameConversation={renameConversation}
          onTogglePinConversation={togglePinConversation}
          onSwitchConversation={handleSwitchConversation}
        />
      </Sider>

      <Drawer
        title="会话导航"
        placement="left"
        open={isLeftNavDrawerOpen}
        onClose={() => setIsLeftNavDrawerOpen(false)}
        size={LEFT_NAV_DRAWER_WIDTH}
        rootClassName="conversation-nav-drawer-root"
        styles={{
          body: {
            padding: 0,
          },
        }}
      >
        <div className="h-full">
          <ConversationList
            summaries={summaries}
            activeId={activeId}
            viewMode="expanded"
            onOpenDrawer={() => {}}
            shouldConfirmCreateConversation={shouldConfirmCreateConversation}
            onCreateConversation={handleCreateConversation}
            onClearAllConversations={handleClearAllConversations}
            onDeleteConversation={handleRemoveConversation}
            onRenameConversation={renameConversation}
            onTogglePinConversation={togglePinConversation}
            onSwitchConversation={handleSwitchConversation}
          />
        </div>
      </Drawer>

      <Layout className="flex min-h-0 min-w-[420px] flex-col overflow-hidden">
        <ConversationWorkspaceStage
          isGlobalImageDragging={isGlobalImageDragging}
          composerPanelMode={composerPanelMode}
          composerAutoFocusOnMount={composerAutoFocusOnMount}
          onExpandComposer={handleExpandComposer}
          onCollapseComposer={handleCollapseComposer}
          columnsProps={{
            activeSideMode,
            activeSides,
            activeSideCount,
            currentModelsForTrigger,
            hasApiChannels: channels.length > 0,
            onOpenChannelManagement: openChannelManagementDrawer,
            onOpenModelPicker: openModelPickerDrawer,
            multiRenderProfile,
            activeConversation,
            imageTasksByRunId,
            onOpenPreview: openPreview,
            onUseUserPrompt: handleUsePrompt,
            onRetryRun: retryRun,
            onReplayRun: replayRunAsNewMessage,
            onCancelMessageRuns: handleCancelMessageRuns,
            onDownloadAllRun: downloadAllRunImages,
            onDownloadMessageImages: downloadMessageRunImages,
            onDownloadSingleImage: downloadSingleRunImage,
            onDownloadBatchRun: downloadBatchRunImages,
            replayingRunIds,
            historyVisibleLimit,
            historyPageSize,
            isLoadingOlderMessages,
            conversationOpenScrollTrigger,
            sendScrollTrigger,
            sendScrollTargetMessageId,
            loadOlderMessages,
            handleAssistantMessageAction,
            sourceImagePreviewService,
            imageRuntimeSettings,
          }}
          composerProps={{
            draft,
            sourceImages: draftSourceImages,
            sendError,
            models: modelCatalog.models,
            isSending,
            isSendBlocked,
            panelBatchError,
            panelMismatchRowIds,
            sideMode: activeSideMode,
            isSideConfigLocked,
            showAdvancedVariables,
            dynamicPromptEnabled,
            generationMode: activeGenerationMode,
            panelValueFormat,
            panelVariables,
            resolvedVariables,
            finalPromptPreview: templatePreview.ok ? templatePreview.finalPrompt : '',
            missingKeys: templatePreview.missingKeys,
            unusedVariableKeys,
            onDraftChange: setDraft,
            onSourceImagesAppend: handleAppendDraftSourceImages,
            onSourceImageRemove: removeDraftSourceImage,
            onSourceImagesClear: clearDraftSourceImages,
            onPanelValueFormatChange: setPanelValueFormat,
            onPanelVariablesChange: setPanelVariables,
            onAdvancedFeaturesEnabledChange: setAdvancedFeaturesEnabled,
            onGenerationModeChange: setGenerationMode,
            onSideModeChange: updateSideMode,
            sourceImagesEnabled,
            focusRequestToken: composerFocusToken,
            onOpenDynamicPromptDrawer: openDynamicPromptDrawer,
            registerCollapseAction: registerComposerCollapseAction,
            onSend: sendDraft,
          }}
        />
      </Layout>

      <WorkspaceSettingsSidebar
        mode={rightPanelMode}
        rightPanelTab={rightPanelTab}
        setRightPanelMode={setRightPanelMode}
        toggleRightPanelMode={toggleRightPanelMode}
        setRightPanelTab={setRightPanelTab}
        expandedWidth={SETTINGS_SIDER_EXPANDED_WIDTH}
        collapsedWidth={SETTINGS_SIDER_MINI_WIDTH}
        activeSideMode={activeSideMode}
        activeSideCount={activeSideCount}
        activeSides={activeSides}
        composerPanelMode={composerPanelMode}
        modelPickerTarget={modelPickerTarget}
        summaries={summaries}
        isSideConfigLocked={isSideConfigLocked}
        activeSettingsBySide={activeSettingsBySide}
        models={modelCatalog.models}
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
        finalPromptPreview={templatePreview.ok ? templatePreview.finalPrompt : ''}
        missingKeys={templatePreview.missingKeys}
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
        onOpenModelPicker={openModelPickerDrawer}
        onCollapseComposer={handleSidebarComposerCollapse}
        onExpandComposer={handleExpandComposer}
        requestComposerFocus={requestComposerFocus}
        getPreviewDebugStats={sourceImagePreviewService.getDebugStats}
        workspaceDiagnostics={workspaceDiagnostics}
      />

      <Suspense fallback={null}>
        <ImagePreviewModal
          isPreviewOpen={isPreviewOpen}
          previewMode={previewMode}
          closePreview={handleClosePreview}
          goPrevPreview={goPrevPreview}
          goNextPreview={goNextPreview}
          goToPreview={goToPreview}
          previewImages={previewImages}
          previewPairs={previewPairs}
          currentPreviewImage={currentPreviewImage}
          currentPreviewPair={currentPreviewPair}
          interactionMode={interactionMode}
          compareMode={compareMode}
          isSyncLocked={isSyncLocked}
          showInfoPanel={showInfoPanel}
          pixelMode={pixelMode}
          activePane={activePane}
          zoom={zoom}
          offset={offset}
          transform={transform}
          sharedTransform={sharedTransform}
          leftTransform={leftTransform}
          rightTransform={rightTransform}
          detail={currentPreviewDetail}
          goFirstPreview={goFirstPreview}
          goLastPreview={goLastPreview}
          zoomBy={zoomBy}
          zoomTo={zoomTo}
          panBy={panBy}
          panTo={panTo}
          toggleFitMode={toggleFitMode}
          setActualPixelMode={setActualPixelMode}
          setCompareMode={setCompareMode}
          setIsSyncLocked={setIsSyncLocked}
          toggleInfoPanel={toggleInfoPanel}
          setActivePane={setActivePane}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          dragOriginRef={dragOriginRef}
          resolveImagePreviewSource={sourceImagePreviewService.acquirePreview}
          prefetchImagePreviewSource={sourceImagePreviewService.prefetchPreview}
          onDownloadSingleImage={downloadSingleRunImage}
          onCopyPrompt={copyPreviewPrompt}
          onCopyParams={copyPreviewParams}
          onReusePrompt={reusePreviewPrompt}
          onReplayRun={replayPreviewRun}
        />
      </Suspense>
    </Layout>
  )
}
