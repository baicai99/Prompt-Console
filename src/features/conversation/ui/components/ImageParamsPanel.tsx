import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Card,
  Col,
  Flex,
  Form,
  InputNumber,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd'
import type { Side, SingleSideSettings } from '../../../../types/conversation'
import { settingsPanelService } from '../../application/settingsPanelService'
import { WindowSettingsTabs } from './settings/WindowSettingsTabs'

const { Text } = Typography
const {
  getAspectRatioOptions,
  getSizeTierOptions,
  getComputedPresetResolution,
  normalizeSizeTier,
} = settingsPanelService

type EditingScope = 'all' | 'current'

interface ImageParamsPanelProps {
  sideMode: 'single' | 'multi'
  sideIds: Side[]
  settingsBySide: Record<Side, SingleSideSettings>
  onSettingsChange: (side: Side, patch: Partial<SingleSideSettings>) => void
  onSettingsBatchChange: (sides: Side[], patch: Partial<SingleSideSettings>) => void
  activeSideTab?: Side
  onActiveSideTabChange?: (side: Side) => void
}

interface ImageParamsEditorProps {
  settings: SingleSideSettings
  onPatch: (patch: Partial<SingleSideSettings>) => void
}

const IMAGE_PARAM_KEYS: Array<keyof ReturnType<typeof buildImageParamsPatch>> = [
  'imageCount',
  'gridColumns',
  'sizeMode',
  'aspectRatio',
  'resolution',
  'customWidth',
  'customHeight',
]

function buildImageParamsPatch(settings: SingleSideSettings): Partial<SingleSideSettings> {
  return {
    imageCount: settings.imageCount,
    gridColumns: settings.gridColumns,
    sizeMode: settings.sizeMode,
    aspectRatio: settings.aspectRatio,
    resolution: settings.resolution,
    customWidth: settings.customWidth,
    customHeight: settings.customHeight,
  }
}

function hasImageParamsDiff(
  currentSettings: SingleSideSettings | undefined,
  targetSettings: SingleSideSettings,
): boolean {
  if (!currentSettings) {
    return false
  }

  const targetPatch = buildImageParamsPatch(targetSettings)
  return IMAGE_PARAM_KEYS.some((key) => !Object.is(currentSettings[key], targetPatch[key]))
}

function buildComputedResolution(settings: SingleSideSettings): string {
  if (settings.sizeMode === 'custom') {
    return `${settings.customWidth}x${settings.customHeight}`
  }

  return getComputedPresetResolution(
    settings.aspectRatio,
    normalizeSizeTier(settings.resolution),
  ) ?? settings.resolution
}

function ImageParamsEditor(props: ImageParamsEditorProps) {
  const {
    settings,
    onPatch,
  } = props
  const { token } = theme.useToken()
  const aspectRatioOptions = useMemo(
    () => getAspectRatioOptions().map((value) => ({ label: value, value })),
    [],
  )
  const sizeTierOptions = useMemo(
    () => getSizeTierOptions().map((value) => ({ label: value.toLowerCase(), value })),
    [],
  )
  const isTextMode = settings.generationMode === 'text'
  const computedResolution = buildComputedResolution(settings)
  const formItemStyle = { marginBottom: token.marginSM }

  return (
    <Flex vertical gap={token.sizeMD} style={{ width: '100%' }}>
      <Row gutter={[token.sizeMD, token.sizeMD]}>
        <Col xs={24} xl={10}>
          <Card size="small" styles={{ body: { padding: token.paddingMD, height: '100%' } }}>
            <Flex vertical gap={token.sizeSM}>
              <Flex align="center" justify="space-between" gap={token.sizeSM}>
                <Text type="secondary">基础生成参数</Text>
                {isTextMode ? <Tag>文本模式</Tag> : null}
              </Flex>
              <Form layout="vertical">
                <Form.Item label="单次生成张数" style={formItemStyle}>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={1}
                    precision={0}
                    value={settings.imageCount}
                    disabled={isTextMode}
                    onChange={(value) => onPatch({ imageCount: typeof value === 'number' ? value : 4 })}
                  />
                </Form.Item>
                <Form.Item label="结果排布" style={{ marginBottom: 0 }}>
                  <Segmented
                    block
                    value={String(settings.gridColumns)}
                    disabled={isTextMode}
                    options={[
                      { label: '自动', value: '1' },
                      { label: '2 列', value: '2' },
                      { label: '3 列', value: '3' },
                      { label: '4 列', value: '4' },
                    ]}
                    onChange={(value) => onPatch({ gridColumns: Number(value) })}
                  />
                </Form.Item>
              </Form>
              <Text type="secondary">
                {isTextMode ? '图片专属参数已禁用。' : '优先调整生成数量与结果排布。'}
              </Text>
            </Flex>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card size="small" styles={{ body: { padding: token.paddingMD, height: '100%' } }}>
            <Flex vertical gap={token.sizeSM}>
              <Flex align="center" justify="space-between" gap={token.sizeSM} wrap>
                <Text type="secondary">尺寸与构图</Text>
                <Tag>{computedResolution}</Tag>
              </Flex>
              <Form layout="vertical">
                <Form.Item label="尺寸模式" style={formItemStyle}>
                  <Segmented
                    block
                    size="middle"
                    value={settings.sizeMode}
                    disabled={isTextMode}
                    options={[
                      { label: '预设', value: 'preset' },
                      { label: '自定义', value: 'custom' },
                    ]}
                    onChange={(value) => onPatch({ sizeMode: value as SingleSideSettings['sizeMode'] })}
                  />
                </Form.Item>
                <Row gutter={[token.sizeSM, 0]}>
                  {settings.sizeMode === 'preset' ? (
                    <>
                      <Col xs={24} md={12}>
                        <Form.Item label="比例" style={{ marginBottom: 0 }}>
                          <Select
                            value={settings.aspectRatio}
                            disabled={isTextMode}
                            options={aspectRatioOptions}
                            onChange={(value) => onPatch({ aspectRatio: value })}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item label="预设尺寸" style={{ marginBottom: 0 }}>
                          <Select
                            value={settings.resolution}
                            disabled={isTextMode}
                            options={sizeTierOptions}
                            onChange={(value) => onPatch({ resolution: value })}
                          />
                        </Form.Item>
                      </Col>
                    </>
                  ) : (
                    <Col xs={24}>
                      <Form.Item label="自定义宽高" style={{ marginBottom: 0 }}>
                        <Space.Compact block>
                          <InputNumber
                            aria-label="自定义宽度"
                            style={{ width: '100%' }}
                            min={256}
                            max={8192}
                            value={settings.customWidth}
                            disabled={isTextMode}
                            onChange={(value) =>
                              onPatch({ customWidth: typeof value === 'number' ? value : 1024 })}
                          />
                          <InputNumber
                            aria-label="自定义高度"
                            style={{ width: '100%' }}
                            min={256}
                            max={8192}
                            value={settings.customHeight}
                            disabled={isTextMode}
                            onChange={(value) =>
                              onPatch({ customHeight: typeof value === 'number' ? value : 1024 })}
                          />
                        </Space.Compact>
                      </Form.Item>
                    </Col>
                  )}
                </Row>
              </Form>
            </Flex>
          </Card>
        </Col>
      </Row>

    </Flex>
  )
}

export function ImageParamsPanel(props: ImageParamsPanelProps) {
  const {
    sideMode,
    sideIds,
    settingsBySide,
    onSettingsChange,
    onSettingsBatchChange,
    activeSideTab: controlledActiveSideTab,
    onActiveSideTabChange,
  } = props
  const [localActiveSideTab, setLocalActiveSideTab] = useState<Side>(sideIds[0] ?? 'single')
  const [editingScope, setEditingScope] = useState<EditingScope>(sideMode === 'multi' ? 'all' : 'current')
  const previousSideModeRef = useRef(sideMode)
  const { token } = theme.useToken()
  const activeSideTab = controlledActiveSideTab ?? localActiveSideTab

  const setActiveSideTab = useCallback((nextSide: Side) => {
    if (controlledActiveSideTab === undefined) {
      setLocalActiveSideTab(nextSide)
    }
    onActiveSideTabChange?.(nextSide)
  }, [controlledActiveSideTab, onActiveSideTabChange])

  useEffect(() => {
    if (sideMode !== 'multi') {
      setActiveSideTab('single')
      return
    }

    if (!sideIds.includes(activeSideTab)) {
      setActiveSideTab(sideIds[0] ?? 'single')
    }
  }, [activeSideTab, setActiveSideTab, sideIds, sideMode])

  useEffect(() => {
    const previousSideMode = previousSideModeRef.current

    if (sideMode !== 'multi') {
      setEditingScope('current')
    } else if (previousSideMode !== 'multi') {
      setEditingScope('all')
    }

    previousSideModeRef.current = sideMode
  }, [sideMode])

  const resolvedActiveSide = sideMode === 'multi' && sideIds.includes(activeSideTab)
    ? activeSideTab
    : (sideIds[0] ?? 'single')
  const representativeSide = sideMode === 'multi'
    ? resolvedActiveSide
    : 'single'
  const settings = settingsBySide[representativeSide]

  if (!settings) {
    return <Text type="secondary">当前窗口配置不可用</Text>
  }

  const handleEditingScopeChange = (value: EditingScope) => {
    if (
      sideMode === 'multi'
      && value === 'all'
      && editingScope !== 'all'
      && sideIds.length > 0
    ) {
      const sourceSettings = settingsBySide[resolvedActiveSide]
      const shouldSyncAllSides = sourceSettings
        ? sideIds.some((side) => hasImageParamsDiff(settingsBySide[side], sourceSettings))
        : false
      if (sourceSettings && shouldSyncAllSides) {
        onSettingsBatchChange(sideIds, buildImageParamsPatch(sourceSettings))
      }
    }

    setEditingScope(value)
  }

  const applyPatch = (patch: Partial<SingleSideSettings>) => {
    if (sideMode === 'multi' && editingScope === 'all' && sideIds.length > 0) {
      onSettingsBatchChange(sideIds, patch)
      return
    }

    onSettingsChange(representativeSide, patch)
  }

  const renderCurrentScopeEditor = (side: Side) => {
    const sideSettings = settingsBySide[side]
    if (!sideSettings) {
      return <Text type="secondary">当前窗口配置不可用</Text>
    }

    return (
      <ImageParamsEditor
        settings={sideSettings}
        onPatch={(patch) => onSettingsChange(side, patch)}
      />
    )
  }

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        padding: token.paddingLG,
      }}
    >
      <Flex vertical gap={token.sizeLG} style={{ width: '100%' }}>
        {sideMode === 'multi' ? (
          <Card size="small" styles={{ body: { padding: token.paddingMD } }}>
            <Flex vertical gap={token.sizeSM}>
              <Flex align="center" justify="space-between" gap={token.sizeSM} wrap>
                <Flex vertical gap={token.sizeXXS}>
                  <Text type="secondary">作用范围</Text>
                  <Text strong>先选范围，再编辑参数</Text>
                </Flex>
                <Segmented
                  value={editingScope}
                  options={[
                    { label: '应用于全部窗口', value: 'all' },
                    { label: '仅当前窗口', value: 'current' },
                  ]}
                  onChange={(value) => handleEditingScopeChange(value as EditingScope)}
                />
              </Flex>
            </Flex>
          </Card>
        ) : null}

        {sideMode === 'multi' && editingScope === 'current' ? (
          <WindowSettingsTabs
            sideMode={sideMode}
            sideIds={sideIds}
            activeSideTab={activeSideTab}
            onSideTabChange={setActiveSideTab}
            renderSettingForm={renderCurrentScopeEditor}
          />
        ) : (
          <ImageParamsEditor
            settings={settings}
            onPatch={applyPatch}
          />
        )}
      </Flex>
    </div>
  )
}
