import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Col,
  ConfigProvider,
  Form,
  Row,
  Typography,
  message,
  theme,
} from 'antd'
import type { ApiChannel } from '../../../../types/channel'
import type { ModelSpec } from '../../../../types/model'
import type { SettingPrimitive } from '../../../../types/primitives'
import type { LoggingSettings, Side, SideMode, SingleSideSettings } from '../../../../types/conversation'
import { settingsPanelService } from '../../application/settingsPanelService'
import { collectModelCategoryTags } from '../../domain/modelCatalogDomain'
import { useDrawerLayout } from './settings/useDrawerLayout'
import { useChannelModels } from './settings/useChannelModels'
import { useChannelImportController } from './settings/useChannelImportController'
import { useWindowSettingsSync } from './settings/useWindowSettingsSync'
import { SideSettingsForm } from './settings/SideSettingsForm'
import { buildChannelImportColumns, buildChannelColumns } from './settings/channelTableColumns'
import { createChannelModalSubmitHandler } from './settings/createChannelModalSubmitHandler'
import { findOfficialChannelPresetById } from './settings/officialChannelPresets'
import { ChannelManagementOverlays } from './settings/ChannelManagementOverlays'
import { GlobalOutputSection } from './settings/GlobalOutputSection'
import { SettingsBasicsSection } from './settings/SettingsBasicsSection'
import { SettingsPanelFooter } from './settings/SettingsPanelFooter'
import { WindowSettingsTabs } from './settings/WindowSettingsTabs'
import { SyncWindowSettingsModal } from './settings/SyncWindowSettingsModal'
import { GlobalChannelSection } from './settings/GlobalChannelSection'

const { Text } = Typography
const ALL_MODEL_TAG = '__all__'

type ChannelFormValues = { name: string; baseUrl: string; apiKey: string }

const CHANNEL_IMPORT_DEBOUNCE_MS = 500
const GITHUB_REPO_URL = 'https://github.com/baicai99/fantastic-couscous'
const CHANNEL_DRAWER_MIN_WIDTH = 720
const CHANNEL_DRAWER_MAX_RATIO = 0.7
const CHANNEL_DRAWER_HORIZONTAL_ALLOWANCE = 64
const {
  fetchChannelModelEntries,
  fetchChannelModels,
  resolveProviderId,
  applyChannelImport,
  buildChannelImportPreview,
  parseApiChannelsFromText,
  isSaveDirectoryReady,
  pickSaveDirectory,
  makeId,
} = settingsPanelService

interface SettingsPanelProps {
  isVisible: boolean
  sideMode: SideMode
  sideCount: number
  sideIds: Side[]
  activeSideTab?: Side
  onActiveSideTabChange?: (side: Side) => void
  isSideConfigLocked: boolean
  settingsBySide: Record<Side, SingleSideSettings>
  models: ModelSpec[]
  channels: ApiChannel[]
  generationMode: 'image' | 'text'
  loggingSettings?: LoggingSettings
  onSideModeChange: (mode: SideMode) => void
  onSideCountChange: (count: number) => void
  onSettingsChange: (side: Side, patch: Partial<SingleSideSettings>) => void
  onSettingsBatchChange: (sides: Side[], patch: Partial<SingleSideSettings>) => void
  onGenerationModeChange: (mode: 'image' | 'text') => void
  onModelChange: (side: Side, modelId: string) => void
  onModelParamChange: (side: Side, paramKey: string, value: SettingPrimitive) => void
  onChannelsChange: (channels: ApiChannel[]) => void
  onLoggingSettingsChange?: (value: Partial<LoggingSettings>) => void
  openAddChannelModalSignal?: number
  openChannelManagementDrawerSignal?: number
}

function getSideTabLabel(sideIds: Side[], side: Side): string {
  const index = sideIds.indexOf(side)
  return index >= 0 ? `窗口 ${index + 1}` : '当前窗口'
}

export function SettingsPanelContainer(props: SettingsPanelProps) {
  const {
    isVisible,
    sideMode,
    sideCount,
    sideIds,
    activeSideTab: controlledActiveSideTab,
    onActiveSideTabChange,
    isSideConfigLocked,
    settingsBySide,
    models,
    channels,
    generationMode,
    onSideModeChange,
    onSideCountChange,
    onSettingsChange,
    onSettingsBatchChange,
    onGenerationModeChange,
    onModelChange,
    onModelParamChange,
    onChannelsChange,
    openAddChannelModalSignal,
    openChannelManagementDrawerSignal,
  } = props

  const [localActiveSideTab, setLocalActiveSideTab] = useState<Side>(sideIds[0] ?? 'single')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null)
  const [modelTagBySide, setModelTagBySide] = useState<Record<Side, string>>({
    single: ALL_MODEL_TAG,
  })
  const [channelForm] = Form.useForm<ChannelFormValues>()
  const [isSavingChannel, setIsSavingChannel] = useState(false)
  const [messageApi, messageContextHolder] = message.useMessage()
  const { token } = theme.useToken()
  const activeSideTab = controlledActiveSideTab ?? localActiveSideTab
  const compactSectionToken = useMemo(() => ({
    paddingMD: token.paddingSM,
    sizeMD: token.sizeSM,
    sizeLG: token.sizeSM,
  }), [token.paddingSM, token.sizeSM])

  const setActiveSideTab = useCallback((nextSide: Side) => {
    if (controlledActiveSideTab === undefined) {
      setLocalActiveSideTab(nextSide)
    }
    onActiveSideTabChange?.(nextSide)
  }, [controlledActiveSideTab, onActiveSideTabChange])
  const {
    isRefreshingChannels,
    refreshChannelModels,
    isModelListDrawerOpen,
    closeModelListDrawer,
    selectedModelListChannelId,
    setSelectedModelListChannelId,
    selectedModelListChannel,
    modelListViewMode,
    setModelListViewMode,
    isModelListLoading,
    modelListError,
    modelSearchInput,
    setModelSearchInput,
    setModelSearchKeyword,
    openModelListDrawer,
    filteredModelListItems,
    loadModelListForChannel,
  } = useChannelModels({
    channels,
    onChannelsChange,
    fetchChannelModels,
    fetchChannelModelEntries,
    messageApi,
  })
  const channelsVersion = useMemo(
    () => channels.map((channel) => `${channel.id}:${channel.models?.length ?? 0}`).join('|'),
    [channels],
  )
  const {
    tableContainerRef: channelTableContainerRef,
    drawerWidth: channelDrawerWidth,
  } = useDrawerLayout({
    isDrawerOpen,
    channelsVersion,
    minWidth: CHANNEL_DRAWER_MIN_WIDTH,
    maxRatio: CHANNEL_DRAWER_MAX_RATIO,
    horizontalAllowance: CHANNEL_DRAWER_HORIZONTAL_ALLOWANCE,
  })

  const availableModelTags = useMemo(() => collectModelCategoryTags(models), [models])
  const {
    channelImportText,
    setChannelImportText,
    channelImportItems,
    channelImportDetected,
    channelImportError,
    isApplyingChannelImport,
    channelSourceType,
    setChannelSourceType,
    selectedOfficialPresetId,
    setSelectedOfficialPresetId,
    parseChannelImportText,
    clearChannelImportState,
    applyOfficialPresetSelection,
    openCreateChannelModal,
    openEditChannelModal,
    updateImportItem,
    applyParsedChannels,
    importSummary,
  } = useChannelImportController({
    channelForm,
    channels,
    isModalOpen,
    setIsModalOpen,
    setEditingChannelId,
    onChannelsChange,
    fetchChannelModels,
    resolveProviderId,
    buildChannelImportPreview,
    parseApiChannelsFromText,
    applyChannelImport,
    messageApi,
    debounceMs: CHANNEL_IMPORT_DEBOUNCE_MS,
  })
  const {
    pendingWindowSyncChoice,
    handleSettingsChange,
    applyPendingWindowSyncToCurrentSide,
    applyPendingWindowSyncToAllSides,
  } = useWindowSettingsSync({
    sideMode,
    sideIds,
    settingsBySide,
    onSettingsChange,
    onSettingsBatchChange,
  })

  useEffect(() => {
    if (!openAddChannelModalSignal) {
      return
    }
    openCreateChannelModal()
  }, [openAddChannelModalSignal, openCreateChannelModal])

  useEffect(() => {
    if (!openChannelManagementDrawerSignal) {
      return
    }
    setIsDrawerOpen(true)
  }, [openChannelManagementDrawerSignal])

  useEffect(() => {
    if (sideMode !== 'multi') {
      setActiveSideTab('single')
      return
    }

    if (!sideIds.includes(activeSideTab)) {
      setActiveSideTab(sideIds[0] ?? 'single')
    }
  }, [activeSideTab, setActiveSideTab, sideIds, sideMode])

  const resetChannelEditorState = useCallback(() => {
    if (isModalOpen) {
      channelForm.resetFields()
    }
    setEditingChannelId(null)
    setChannelSourceType('third-party')
    setSelectedOfficialPresetId(undefined)
    clearChannelImportState()
  }, [channelForm, clearChannelImportState, isModalOpen, setChannelSourceType, setSelectedOfficialPresetId])

  const closeChannelEditorModal = useCallback(() => {
    setIsModalOpen(false)
    resetChannelEditorState()
  }, [resetChannelEditorState])

  const closeChannelManagementDrawer = useCallback(() => {
    closeModelListDrawer()
    closeChannelEditorModal()
    setIsDrawerOpen(false)
  }, [closeChannelEditorModal, closeModelListDrawer])

  useEffect(() => {
    if (isVisible) {
      return
    }

    closeChannelManagementDrawer()
  }, [closeChannelManagementDrawer, isVisible])

  const globalOutputSettings = useMemo(() => {
    if (sideMode === 'multi') {
      for (const sideId of sideIds) {
        if (settingsBySide[sideId]) {
          return settingsBySide[sideId]
        }
      }
    }

    return settingsBySide.single ?? settingsBySide[sideIds[0]]
  }, [settingsBySide, sideIds, sideMode])

  const applyGlobalOutputPatch = useCallback((patch: Partial<SingleSideSettings>) => {
    if (sideMode === 'multi' && sideIds.length > 0) {
      onSettingsBatchChange(sideIds, patch)
      return
    }

    onSettingsChange('single', patch)
  }, [onSettingsBatchChange, onSettingsChange, sideIds, sideMode])

  const renderSettingForm = (side: Side) => (
    <SideSettingsForm
      side={side}
      settingsBySide={settingsBySide}
      modelTagBySide={modelTagBySide}
      setModelTagBySide={setModelTagBySide}
      channels={channels}
      models={models}
      availableModelTags={availableModelTags}
      onSettingsChange={handleSettingsChange}
      onModelChange={onModelChange}
      onModelParamChange={onModelParamChange}
      messageApi={messageApi}
      onOpenChannelDrawer={() => setIsDrawerOpen(true)}
      includeOutputSection={false}
      includeChannelSection={false}
      includeImageModelParamsSection
    />
  )

  const channelImportColumns = useMemo(
    () => buildChannelImportColumns(updateImportItem),
    [updateImportItem],
  )

  const channelColumns = useMemo(
    () =>
      buildChannelColumns({
        channels,
        clearChannelImportState,
        onChannelsChange,
        openModelListDrawer,
        onEditChannel: openEditChannelModal,
      }),
    [
      channels,
      clearChannelImportState,
      onChannelsChange,
      openModelListDrawer,
      openEditChannelModal,
    ],
  )
  const confirmChannelModal = useMemo(
    () =>
      createChannelModalSubmitHandler({
        channelForm,
        channelSourceType,
        selectedOfficialPresetId,
        editingChannelId,
        channels,
        setIsSavingChannel,
        onChannelsChange,
        closeChannelEditorModal,
        messageApi,
        findOfficialChannelPresetById,
        resolveProviderId,
        fetchChannelModels,
        makeId,
      }),
    [
      channelForm,
      channelSourceType,
      selectedOfficialPresetId,
      editingChannelId,
      channels,
      onChannelsChange,
      closeChannelEditorModal,
      messageApi,
    ],
  )

  return (
    <ConfigProvider componentSize="small">
      <div className="flex h-full flex-col overflow-hidden">
        {messageContextHolder}
        <div
          className="flex h-full flex-col overflow-y-auto"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: token.sizeMD,
            height: '100%',
            overflowY: 'auto',
            padding: token.paddingMD,
          }}
        >
          <SettingsBasicsSection
            token={compactSectionToken}
            sideMode={sideMode}
            sideCount={sideCount}
            isSideConfigLocked={isSideConfigLocked}
            generationMode={generationMode}
            onSideModeChange={onSideModeChange}
            onSideCountChange={onSideCountChange}
            onGenerationModeChange={onGenerationModeChange}
          />

          <Row gutter={[token.sizeSM, token.sizeSM]}>
            <Col xs={24} xl={8}>
              <GlobalChannelSection onOpenDrawer={() => setIsDrawerOpen(true)} />
            </Col>
            <Col xs={24} xl={16}>
              <GlobalOutputSection
                settings={globalOutputSettings}
                generationMode={generationMode}
                isSaveDirectoryReady={isSaveDirectoryReady}
                pickSaveDirectory={pickSaveDirectory}
                messageApi={messageApi}
                onPatch={applyGlobalOutputPatch}
              />
            </Col>
          </Row>

          <Text strong>{sideMode === 'multi' ? '按窗口选择模型' : '选择模型'}</Text>

          <div>
            <WindowSettingsTabs
              sideMode={sideMode}
              sideIds={sideIds}
              activeSideTab={activeSideTab}
              onSideTabChange={setActiveSideTab}
              renderSettingForm={renderSettingForm}
            />
          </div>

          <SettingsPanelFooter githubRepoUrl={GITHUB_REPO_URL} />
        </div>

        <SyncWindowSettingsModal
          pendingWindowSyncChoice={pendingWindowSyncChoice}
          sideIds={sideIds}
          getSideTabLabel={getSideTabLabel}
          onApplyCurrent={applyPendingWindowSyncToCurrentSide}
          onApplyAll={applyPendingWindowSyncToAllSides}
        />

        <ChannelManagementOverlays
          isDrawerOpen={isDrawerOpen}
          closeChannelManagementDrawer={closeChannelManagementDrawer}
          channelDrawerWidth={channelDrawerWidth}
          channelTableContainerRef={channelTableContainerRef}
          channelColumns={channelColumns}
          channels={channels}
          isRefreshingChannels={isRefreshingChannels}
          refreshChannelModels={refreshChannelModels}
          openModelListDrawer={openModelListDrawer}
          openCreateChannelModal={openCreateChannelModal}
          isModelListDrawerOpen={isModelListDrawerOpen}
          closeModelListDrawer={closeModelListDrawer}
          selectedModelListChannelId={selectedModelListChannelId}
          setSelectedModelListChannelId={setSelectedModelListChannelId}
          modelSearchInput={modelSearchInput}
          setModelSearchInput={setModelSearchInput}
          setModelSearchKeyword={setModelSearchKeyword}
          modelListViewMode={modelListViewMode}
          setModelListViewMode={setModelListViewMode}
          isModelListLoading={isModelListLoading}
          selectedModelListChannel={selectedModelListChannel}
          loadModelListForChannel={loadModelListForChannel}
          modelListError={modelListError}
          filteredModelListItems={filteredModelListItems}
          isModalOpen={isModalOpen}
          editingChannelId={editingChannelId}
          closeChannelEditorModal={closeChannelEditorModal}
          setChannelSourceType={setChannelSourceType}
          channelSourceType={channelSourceType}
          selectedOfficialPresetId={selectedOfficialPresetId}
          setSelectedOfficialPresetId={setSelectedOfficialPresetId}
          applyOfficialPresetSelection={applyOfficialPresetSelection}
          channelForm={channelForm}
          isSavingChannel={isSavingChannel}
          onConfirmChannelModal={confirmChannelModal}
          clearChannelImportState={clearChannelImportState}
          channelImportText={channelImportText}
          setChannelImportText={setChannelImportText}
          parseChannelImportText={parseChannelImportText}
          isApplyingChannelImport={isApplyingChannelImport}
          applyParsedChannels={applyParsedChannels}
          importSummary={importSummary}
          channelImportDetected={channelImportDetected}
          channelImportError={channelImportError}
          channelImportItems={channelImportItems}
          channelImportColumns={channelImportColumns}
        />
      </div>
    </ConfigProvider>
  )
}
