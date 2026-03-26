import { Badge, Button, Card, Col, ConfigProvider, Flex, Row, Space, Typography } from 'antd'
import type {
  ImageRuntimeSettings,
  LoggingSettings,
  Side,
  SingleSideSettings,
} from '../../../../../types/conversation'
import type { ApiChannel } from '../../../../../types/channel'
import type { ModelSpec } from '../../../../../types/model'
import type { SettingPrimitive } from '../../../../../types/primitives'
import type { ConversationSourceImagePreviewDebugStats } from '../../../application/conversationSourceImagePreviewService'
import type { PanelValueFormat, PanelVariableRow } from '../../../domain/types'
import type { AdvancedTabKey } from '../../components/useComposerAdvancedPanelController'
import { resolveCurrentModeModelId } from '../../../domain/generationMode'
import type { ModelPickerTarget } from '../../modelPickerTarget'
import { resolveModelPickerBoundSide } from '../../modelPickerTarget'
import { AdvancedFeaturesPanel } from '../../components/AdvancedFeaturesPanel'
import { ChatMemoryDiagnosticsPanel } from '../../components/ChatMemoryDiagnosticsPanel'
import { DynamicPromptPanel } from '../../components/DynamicPromptPanel'
import { FavoriteModelPanel } from '../../components/FavoriteModelPill'
import { ImageParamsPanel } from '../../components/ImageParamsPanel'
import { SettingsPanel } from '../../components/SettingsPanel'
import {
  ANALYTICS_ENTRY_CARDS,
  MODEL_PICKER_EMPTY_TEXT,
  type RightPanelTab,
} from './workspaceSettingsSidebarShared'

interface WorkspaceSettingsDrawerPanelProps {
  rightPanelTab: RightPanelTab
  isDrawerOpen: boolean
  activeSideMode: 'single' | 'multi'
  activeSideCount: number
  activeSides: Side[]
  activeWindowSettingsSideTab: Side
  setActiveWindowSettingsSideTab: (side: Side) => void
  modelPickerTarget: ModelPickerTarget
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
  requestComposerFocus: () => void
  handleAnalyticsNavigation: (route: string) => void
  getPreviewDebugStats?: () => ConversationSourceImagePreviewDebugStats
  workspaceDiagnostics?: import('../../../application/conversationControllerContract').ConversationWorkspaceReadModel['workspaceDiagnostics']
}

export function WorkspaceSettingsDrawerPanel(props: WorkspaceSettingsDrawerPanelProps) {
  const modelPickerBoundSide = resolveModelPickerBoundSide(props.modelPickerTarget, props.activeSideMode, props.activeSides)
  const isDefaultModelTarget = props.activeSideMode === 'multi' && props.modelPickerTarget.kind === 'default'
  const windowSideIds = props.activeSides.filter((side) => side !== 'single')

  const renderModelPanel = (side: Side) => {
    const settings = props.activeSettingsBySide[side]
    if (!settings) {
      return <Typography.Text type="secondary">{isDefaultModelTarget ? '默认模型配置不可用' : '当前窗口配置不可用'}</Typography.Text>
    }

    return (
      <FavoriteModelPanel
        currentModelId={resolveCurrentModeModelId(settings)}
        models={props.models}
        favoriteModelIds={props.favoriteModelIds}
        onSelectModel={(modelId) => props.setSideModelForCurrentMode(side, modelId)}
        onFavoriteModelIdsChange={props.setFavoriteModelIds}
        emptyText={MODEL_PICKER_EMPTY_TEXT}
      />
    )
  }

  switch (props.rightPanelTab) {
    case 'modelPicker':
      return (
        <ConfigProvider componentSize="small">
          <Flex className="favorite-model-drawer-shell" vertical style={{ minHeight: 0, minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <div className="favorite-model-drawer-body flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {renderModelPanel(modelPickerBoundSide)}
            </div>
          </Flex>
        </ConfigProvider>
      )
    case 'imageParams':
      return (
        <ImageParamsPanel
          sideMode={props.activeSideMode}
          sideIds={windowSideIds}
          settingsBySide={props.activeSettingsBySide}
          onSettingsChange={props.updateSideSettings}
          onSettingsBatchChange={props.updateSidesSettings}
          activeSideTab={props.activeWindowSettingsSideTab}
          onActiveSideTabChange={props.setActiveWindowSettingsSideTab}
        />
      )
    case 'settings':
      return (
        <SettingsPanel
          isVisible={props.isDrawerOpen}
          sideMode={props.activeSideMode}
          sideCount={props.activeSideCount}
          sideIds={windowSideIds}
          activeSideTab={props.activeWindowSettingsSideTab}
          onActiveSideTabChange={props.setActiveWindowSettingsSideTab}
          isSideConfigLocked={props.isSideConfigLocked}
          settingsBySide={props.activeSettingsBySide}
          models={props.models}
          channels={props.channels}
          generationMode={props.activeGenerationMode}
          loggingSettings={props.loggingSettings}
          onSideModeChange={props.updateSideMode}
          onSideCountChange={props.updateSideCount}
          onSettingsChange={props.updateSideSettings}
          onSettingsBatchChange={props.updateSidesSettings}
          onGenerationModeChange={props.setGenerationMode}
          onModelChange={props.setSideModel}
          onModelParamChange={props.setSideModelParam}
          onChannelsChange={props.setChannels}
          onLoggingSettingsChange={props.setLoggingSettings}
          openAddChannelModalSignal={props.openAddChannelModalSignal}
          openChannelManagementDrawerSignal={props.openChannelManagementDrawerSignal}
        />
      )
    case 'dynamicPrompt':
      return (
        <DynamicPromptPanel
          showAdvancedVariables={props.showAdvancedVariables}
          dynamicPromptEnabled={props.dynamicPromptEnabled}
          requestedTab={props.dynamicPromptRequestedTab}
          openRequestToken={props.dynamicPromptOpenRequestToken}
          panelValueFormat={props.panelValueFormat}
          panelVariables={props.panelVariables}
          resolvedVariables={props.resolvedVariables}
          finalPromptPreview={props.finalPromptPreview}
          missingKeys={props.missingKeys}
          unusedVariableKeys={props.unusedVariableKeys}
          panelBatchError={props.panelBatchError}
          panelMismatchRowIds={props.panelMismatchRowIds}
          onPanelValueFormatChange={props.setPanelValueFormat}
          onPanelVariablesChange={props.setPanelVariables}
          onAdvancedFeaturesEnabledChange={props.setAdvancedFeaturesEnabled}
          requestComposerFocus={props.requestComposerFocus}
        />
      )
    case 'modelStats':
      return (
        <div className="side-tab-panel-root flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pt-2.5 pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <Row gutter={[12, 12]}>
              {ANALYTICS_ENTRY_CARDS.map((item) => (
                <Col key={item.key} xs={24} md={8} xl={8}>
                  <Card
                    size="small"
                    hoverable
                    styles={{ body: { padding: 16 } }}
                    style={{ cursor: 'pointer' }}
                    onClick={() => props.handleAnalyticsNavigation(item.actionRoute)}
                  >
                    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                      <Space align="start" size={12}>
                        <Badge status="processing" />
                        <Space size={8}>
                          {item.icon}
                          <Typography.Text strong>{item.title}</Typography.Text>
                        </Space>
                      </Space>
                      <Button
                        type="primary"
                        block
                        onClick={() => props.handleAnalyticsNavigation(item.actionRoute)}
                      >
                        {item.actionLabel}
                      </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </div>
      )
    case 'advanced':
      return (
        <AdvancedFeaturesPanel
          models={props.models}
          autoRenameConversationTitle={props.autoRenameConversationTitle}
          autoRenameConversationTitleModelId={props.autoRenameConversationTitleModelId}
          runConcurrency={props.runConcurrency}
          runConcurrencyUnlimited={props.runConcurrencyUnlimited}
          imageRuntimeSettings={props.imageRuntimeSettings}
          onAutoRenameConversationTitleChange={props.setAutoRenameConversationTitle}
          onAutoRenameConversationTitleModelIdChange={props.setAutoRenameConversationTitleModelId}
          onRunConcurrencyChange={props.setRunConcurrency}
          onRunConcurrencyUnlimitedChange={props.setRunConcurrencyUnlimited}
          onImageRuntimeSettingsChange={props.setImageRuntimeSettings}
        />
      )
    case 'diagnostics':
      return props.getPreviewDebugStats && props.workspaceDiagnostics ? (
        <ChatMemoryDiagnosticsPanel
          getPreviewDebugStats={props.getPreviewDebugStats}
          workspaceDiagnostics={props.workspaceDiagnostics}
        />
      ) : null
  }
}
