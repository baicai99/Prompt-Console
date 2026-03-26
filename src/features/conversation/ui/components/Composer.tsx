import { useEffect, useRef, useState } from 'react'
import type { CompositionEvent, CSSProperties, MouseEvent } from 'react'
import { Alert, Button, Card, Input, Space } from 'antd'
import type { SideMode } from '../../../../types/conversation'
import type { ModelSpec } from '../../../../types/model'
import type { PanelValueFormat, PanelVariableRow } from '../../domain/types'
import { ComposerQuickPicker } from './ComposerQuickPicker'
import { ComposerSourceImageControls } from './ComposerSourceImageControls'
import { ComposerToolbar } from './ComposerToolbar'
import { handleComposerSendAttempt } from './composerSendAttempt'
import {
  detectIsNarrowLayout,
} from './composerHelpers'
import type { DashCommandOption, QuickPickerRange } from './composerHelpers'
import { useComposerDraftSync } from './useComposerDraftSync'
import { useComposerOvershootAnimation } from './useComposerOvershootAnimation'
import { useComposerInputController } from './useComposerInputController'
import type { AdvancedTabKey } from './useComposerAdvancedPanelController'
import { useMediaQueryState } from '../../../../hooks/useMediaQueryState'

interface ComposerProps {
  draft: string
  sourceImages: Array<{ id: string; file: File; previewUrl: string }>
  sendError: string
  models: ModelSpec[]
  showAdvancedVariables: boolean
  dynamicPromptEnabled: boolean
  generationMode?: 'image' | 'text'
  panelValueFormat: PanelValueFormat
  panelVariables: PanelVariableRow[]
  resolvedVariables: Record<string, string>
  finalPromptPreview: string
  missingKeys: string[]
  unusedVariableKeys: string[]
  isSending: boolean
  isSendBlocked: boolean
  panelBatchError: string
  panelMismatchRowIds: string[]
  sideMode: SideMode
  isSideConfigLocked: boolean
  onDraftChange: (value: string) => void
  onSourceImagesAppend: (files: File[]) => void
  onSourceImageRemove: (id: string) => void
  onSourceImagesClear: () => void
  onPanelValueFormatChange: (value: PanelValueFormat) => void
  onPanelVariablesChange: (rows: PanelVariableRow[]) => void
  onAdvancedFeaturesEnabledChange: (value: boolean) => void
  onGenerationModeChange?: (mode: 'image' | 'text') => void
  onSideModeChange: (mode: SideMode) => void
  sourceImagesEnabled?: boolean
  focusRequestToken?: number
  autoFocusOnMount?: boolean
  onOpenDynamicPromptDrawer?: (tab?: AdvancedTabKey) => void
  onCollapse?: () => void
  registerCollapseAction?: (action: (() => void) | null) => void
  onSend: () => void
}

const DYNAMIC_PROMPT_QUICK_ACTION = '动态提示词'
const COMPARISON_MODE_QUICK_ACTION = '对照模式'
const IMAGE_GENERATION_QUICK_ACTION = '图片生成'
const QUICK_PICKER_ITEMS = [IMAGE_GENERATION_QUICK_ACTION, DYNAMIC_PROMPT_QUICK_ACTION, COMPARISON_MODE_QUICK_ACTION]
const DASH_COMMAND_OPTIONS: DashCommandOption[] = [
  { key: 'ar', insertText: '--ar ', label: '--ar ' },
  { key: 'size', insertText: '--size ', label: '--size ' },
  { key: 'wh', insertText: '--wh ', label: '--wh ' },
]

const COMPOSER_TEXTAREA_STYLE: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.5,
  minHeight: 34,
}
export function Composer(props: ComposerProps) {
  const {
    draft,
    sourceImages,
    sendError,
    models,
    showAdvancedVariables,
    dynamicPromptEnabled,
    generationMode = 'text',
    panelVariables,
    missingKeys,
    unusedVariableKeys,
    panelBatchError,
    sideMode,
    isSideConfigLocked,
    onDraftChange,
    onSourceImagesAppend,
    onSourceImageRemove,
    onPanelVariablesChange,
    onAdvancedFeaturesEnabledChange,
    onGenerationModeChange,
    onSideModeChange,
    sourceImagesEnabled = true,
    focusRequestToken = 0,
    autoFocusOnMount = false,
    onOpenDynamicPromptDrawer,
    onCollapse,
    registerCollapseAction,
    onSend,
  } = props

  const useSheet = useMediaQueryState('(max-width: 920px)', detectIsNarrowLayout())
  const sourceImageInputRef = useRef<HTMLInputElement | null>(null)
  const [localDraft, setLocalDraft] = useState(draft)
  const selectedQuickActions = [
    ...(generationMode === 'image' ? [IMAGE_GENERATION_QUICK_ACTION] : []),
    ...(dynamicPromptEnabled ? [DYNAMIC_PROMPT_QUICK_ACTION] : []),
    ...(sideMode === 'multi' ? [COMPARISON_MODE_QUICK_ACTION] : []),
  ]
  const composerCardRef = useRef<HTMLDivElement | null>(null)
  const { animationMeta, markAnimationReason } = useComposerOvershootAnimation({
    composerCardRef,
    draft: localDraft,
    selectedQuickActionsCount: selectedQuickActions.length,
    showAdvancedVariables,
    sourceImagesCount: sourceImages.length,
    useSheet,
  })
  const {
    composerTextareaRef,
    isComposingRef,
    resolveComposerTextarea,
    syncDraftImmediately,
    commitDraftMutation,
    handleDraftInput,
    handleCompositionStart,
    handleCompositionEnd,
    qualifiesForPasteOvershoot,
  } = useComposerDraftSync({
    draft,
    localDraft,
    setLocalDraft,
    onDraftChange,
    focusRequestToken,
    autoFocusOnMount,
    composerCardRef,
    markAnimationReason,
  })
  const isComparisonModeLocked = isSideConfigLocked && sideMode === 'multi'
  const isAdvancedFeaturesEnabled = showAdvancedVariables || dynamicPromptEnabled
  const hasComposerFeedback = (
    (isAdvancedFeaturesEnabled && missingKeys.length > 0)
    || (isAdvancedFeaturesEnabled && unusedVariableKeys.length > 0)
    || sendError.length > 0
  )
  const draftPlaceholder = dynamicPromptEnabled
    ? '输入模板 prompt，如：{{subject}} portrait'
    : '输入 prompt，按 Enter 发送，Shift + Enter 换行'
  const localIsSendBlocked = localDraft.trim().length === 0 || panelBatchError.length > 0

  const insertUnusedVariableToken = (key: string) => {
    const input = resolveComposerTextarea()
    const token = `{{${key}}}`
    const hasActiveSelection =
      input != null &&
      document.activeElement === input &&
      input.selectionStart != null &&
      input.selectionEnd != null
    const selectionStart = hasActiveSelection ? input.selectionStart ?? localDraft.length : localDraft.length
    const selectionEnd = hasActiveSelection ? input.selectionEnd ?? selectionStart : selectionStart
    const baseDraft = input?.value ?? localDraft
    const nextDraft = `${baseDraft.slice(0, selectionStart)}${token}${baseDraft.slice(selectionEnd)}`
    const nextCursor = selectionStart + token.length

    commitDraftMutation(nextDraft, nextCursor, closeQuickPicker)
  }

  const applyModelShortcutWithRange = (model: ModelSpec, range: QuickPickerRange, baseDraft: string) => {
    const prefix = baseDraft.slice(0, range.start)
    const suffix = baseDraft.slice(range.end)
    const insertedToken = `@${model.id}`
    const separator = suffix.length === 0 || /^\s/.test(suffix) ? '' : ' '
    const appendTrailingSpace = suffix.length === 0 ? ' ' : ''
    const nextDraft = `${prefix}${insertedToken}${separator}${appendTrailingSpace}${suffix}`
    const nextCursor = prefix.length + insertedToken.length + separator.length + appendTrailingSpace.length
    commitDraftMutation(nextDraft, nextCursor, closeQuickPicker)
  }

  const applyModelShortcutItem = (model: ModelSpec) => {
    if (!quickPickerRange) {
      return
    }
    const baseDraft = composerTextareaRef.current?.value ?? localDraft
    applyModelShortcutWithRange(model, quickPickerRange, baseDraft)
  }

  const applyDashCommandWithRange = (command: DashCommandOption, range: QuickPickerRange, baseDraft: string) => {
    const prefix = baseDraft.slice(0, range.start)
    const suffix = baseDraft.slice(range.end)
    const separator = suffix.length === 0 || /^\s/.test(suffix) || /\s$/.test(command.insertText) ? '' : ' '
    const nextDraft = `${prefix}${command.insertText}${separator}${suffix}`
    const nextCursor = prefix.length + command.insertText.length + separator.length
    commitDraftMutation(nextDraft, nextCursor)
  }

  const applyDashCommandItem = (command: DashCommandOption) => {
    if (!quickPickerRange) {
      return
    }
    const baseDraft = composerTextareaRef.current?.value ?? localDraft
    applyDashCommandWithRange(command, quickPickerRange, baseDraft)
  }

  const handleSendAttempt = async () => {
    await handleComposerSendAttempt({
      draft: localDraft,
      dynamicPromptEnabled,
      panelVariables,
      onSend: () => {
        syncDraftImmediately()
        onSend()
      },
      onAdvancedFeaturesEnabledChange,
      onPanelVariablesChange,
      onOpenDynamicPromptDrawer,
    })
  }

  const applyQuickPickerItem = (label: string) => {
    if (!quickPickerRange) {
      return
    }
    const baseDraft = composerTextareaRef.current?.value ?? localDraft
    const nextDraft = `${baseDraft.slice(0, quickPickerRange.start)}${baseDraft.slice(quickPickerRange.end)}`
    const nextCursor = quickPickerRange.start

    commitDraftMutation(nextDraft, nextCursor, closeQuickPicker)
    if (label === DYNAMIC_PROMPT_QUICK_ACTION && !dynamicPromptEnabled) {
      onAdvancedFeaturesEnabledChange(true)
    }
    if (label === IMAGE_GENERATION_QUICK_ACTION && generationMode !== 'image') {
      onGenerationModeChange?.('image')
    }
    if (label === COMPARISON_MODE_QUICK_ACTION && sideMode !== 'multi') {
      if (!isSideConfigLocked) {
        onSideModeChange('multi')
      }
    }
  }

  const {
    closeQuickPicker,
    handleChange,
    handleKeyDown,
    handlePaste,
    handlePressEnter,
    handleSelect,
    isQuickPickerOpen,
    matchedDashCommands,
    matchedModels,
    openQuickActions,
    pickerMode,
    quickPickerActiveIndex,
    quickPickerRange,
    quickPickerRootRef,
    setQuickPickerActiveIndex,
    setTextareaRefFromEvent,
  } = useComposerInputController({
    composerTextareaRef,
    isComposingRef,
    isSendBlocked: localIsSendBlocked,
    models,
    onDraftInput: ({ nextText, changeReason, target }) => {
      setTextareaRefFromEvent(target)
      handleDraftInput(nextText, changeReason)
    },
    onModelSelected: applyModelShortcutItem,
    onCommandSelected: applyDashCommandItem,
    onQuickActionSelected: applyQuickPickerItem,
    onSendAttempt: handleSendAttempt,
    onSourceImagesAppend,
    qualifiesForPasteOvershoot,
    quickPickerItems: QUICK_PICKER_ITEMS,
    sourceImagesEnabled,
    dashCommandOptions: DASH_COMMAND_OPTIONS,
  })

  const removeQuickAction = (label: string) => {
    if (label === IMAGE_GENERATION_QUICK_ACTION && generationMode === 'image') {
      onGenerationModeChange?.('text')
      return
    }
    if (label === DYNAMIC_PROMPT_QUICK_ACTION && dynamicPromptEnabled) {
      onAdvancedFeaturesEnabledChange(false)
    }
    if (label === COMPARISON_MODE_QUICK_ACTION && isSideConfigLocked) {
      return
    }
    if (label === COMPARISON_MODE_QUICK_ACTION && sideMode === 'multi') {
      onSideModeChange('single')
    }
  }

  const openQuickActionsFromToolbar = () => {
    const input = resolveComposerTextarea()
    const cursor = input?.selectionStart ?? input?.value.length ?? localDraft.length
    openQuickActions(input)
    window.requestAnimationFrame(() => {
      const activeInput = resolveComposerTextarea()
      if (!activeInput) {
        return
      }
      activeInput.focus({ preventScroll: true })
      activeInput.setSelectionRange(cursor, cursor)
    })
  }

  const handleQuickActionsToolbarMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    openQuickActionsFromToolbar()
  }

  const handleQuickActionsToolbarClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) {
      return
    }
    openQuickActionsFromToolbar()
  }

  const handleOpenDynamicPromptToolbar = () => {
    closeQuickPicker()
    onOpenDynamicPromptDrawer?.('table')
  }

  useEffect(() => {
    if (!registerCollapseAction || !onCollapse) {
      return
    }

    const collapseAction = () => {
      closeQuickPicker()
      syncDraftImmediately()
      onCollapse()
    }

    registerCollapseAction(collapseAction)
    return () => {
      registerCollapseAction(null)
    }
  }, [closeQuickPicker, onCollapse, registerCollapseAction, syncDraftImmediately])

  return (
    <div className="chat-input w-full pointer-events-auto">
      <div
        className={`composer-shell relative w-full ${animationMeta.active ? `composer-shell-overshoot composer-shell-overshoot-${animationMeta.reason}` : ''}`}
        data-overshoot-active={animationMeta.active ? 'true' : 'false'}
        data-overshoot-reason={animationMeta.reason}
        data-overshoot-intensity={animationMeta.intensity.toFixed(3)}
        style={
          {
            '--composer-overshoot-scale-x': animationMeta.scaleX.toFixed(4),
            '--composer-overshoot-scale-y': animationMeta.scaleY.toFixed(4),
            '--composer-overshoot-duration': `${animationMeta.durationMs}ms`,
          } as CSSProperties
        }
      >
        <Card
          variant="borderless"
          className={`composer-card rounded-lg border border-[rgba(214,220,229,0.92)] bg-[rgba(255,255,255,0.98)] shadow-[0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur-md ${sourceImages.length > 0 ? 'has-source-images' : ''}`}
          style={animationMeta.active ? {
            animation: `composer-card-overshoot ${animationMeta.durationMs}ms cubic-bezier(0.22, 1.12, 0.3, 1) both`,
            transformOrigin: 'center bottom',
            willChange: 'transform',
          } : undefined}
          styles={{
            body: {
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minHeight: sourceImages.length > 0 ? 180 : 0,
              padding: '10px 14px',
            },
          }}
          ref={composerCardRef}
        >
          <ComposerSourceImageControls
            sourceImageInputRef={sourceImageInputRef}
            sourceImages={sourceImages}
            sourceImagesEnabled={sourceImagesEnabled}
            onSourceImagesAppend={onSourceImagesAppend}
            onSourceImageRemove={onSourceImageRemove}
          />
          <div className="composer-interaction-wrap flex min-h-0 w-full min-w-0 flex-col gap-2.5" ref={quickPickerRootRef}>
            <div className="composer-textarea-wrap relative min-h-0 w-full overflow-visible">
              <Input.TextArea
                value={localDraft}
                wrap="soft"
                variant="borderless"
                onChange={handleChange}
                onCompositionStart={() => handleCompositionStart(closeQuickPicker)}
                onCompositionEnd={(event: CompositionEvent<HTMLTextAreaElement>) => handleCompositionEnd(event.currentTarget.value)}
                onFocus={(event) => {
                  setTextareaRefFromEvent(event.target)
                }}
                onSelect={handleSelect}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                placeholder={draftPlaceholder}
                autoSize={{ minRows: 1, maxRows: 6 }}
                className="composer-textarea"
                classNames={{
                  root: '!bg-transparent !shadow-none !outline-none',
                  textarea: '!bg-transparent !px-0 !py-0 !text-[15px] !leading-[1.5] !text-slate-900 placeholder:!text-[rgba(15,23,42,0.5)] [scrollbar-width:none] [&::-webkit-scrollbar:horizontal]:hidden',
                  count: 'mr-2',
                }}
                styles={{
                  root: {
                    border: 'none',
                    boxShadow: 'none',
                    outline: 'none',
                    background: 'transparent',
                  },
                  textarea: {
                    ...COMPOSER_TEXTAREA_STYLE,
                    border: 'none',
                    boxShadow: 'none',
                    outline: 'none',
                    resize: 'none',
                    background: 'transparent',
                    overflowX: 'hidden',
                    padding: 0,
                    color: '#111827',
                  },
                }}
                onPressEnter={handlePressEnter}
              />
              <ComposerQuickPicker
                isOpen={isQuickPickerOpen}
                pickerMode={pickerMode}
                matchedModels={matchedModels}
                matchedDashCommands={matchedDashCommands}
                quickPickerItems={QUICK_PICKER_ITEMS}
                quickPickerActiveIndex={quickPickerActiveIndex}
                setQuickPickerActiveIndex={setQuickPickerActiveIndex}
                applyModelShortcutItem={applyModelShortcutItem}
                applyDashCommandItem={applyDashCommandItem}
                applyQuickPickerItem={applyQuickPickerItem}
                isSideConfigLocked={isSideConfigLocked}
                comparisonModeQuickAction={COMPARISON_MODE_QUICK_ACTION}
                onRequestClose={closeQuickPicker}
              />
            </div>
            <ComposerToolbar
              sourceImagesEnabled={sourceImagesEnabled}
              sourceImageInputRef={sourceImageInputRef}
              selectedQuickActions={selectedQuickActions}
              isComparisonModeLocked={isComparisonModeLocked}
              comparisonModeQuickAction={COMPARISON_MODE_QUICK_ACTION}
              dynamicPromptEnabled={dynamicPromptEnabled}
              onOpenDynamicPromptToolbar={handleOpenDynamicPromptToolbar}
              onSend={() => {
                void handleSendAttempt()
              }}
              localIsSendBlocked={localIsSendBlocked}
              onQuickActionsToolbarMouseDown={handleQuickActionsToolbarMouseDown}
              onQuickActionsToolbarClick={handleQuickActionsToolbarClick}
              onRemoveQuickAction={removeQuickAction}
            />
          </div>
        </Card>
      </div>

      {hasComposerFeedback ? (
        <div className="composer-feedback-stack mt-2 flex flex-col gap-2">
          {isAdvancedFeaturesEnabled && missingKeys.length > 0 ? (
            <Alert
              type="warning"
              showIcon
              title={`prompt 中存在未定义变量：${missingKeys.join(', ')}`}
              action={
                <Button type="link" size="small" onClick={() => onOpenDynamicPromptDrawer?.('table')}>
                  去配置变量
                </Button>
              }
              className="composer-variable-feedback composer-variable-feedback-warning rounded-lg"
            />
          ) : null}
          {isAdvancedFeaturesEnabled && unusedVariableKeys.length > 0 ? (
            <Alert
              type="info"
              showIcon
              title={
                <Space size={[8, 8]} wrap>
                  <span>已配置但当前 prompt 未使用的变量：</span>
                  {unusedVariableKeys.map((key) => (
                    <Button
                      key={key}
                      type="default"
                      size="small"
                      onMouseDown={(event) => {
                        event.preventDefault()
                      }}
                      onClick={() => insertUnusedVariableToken(key)}
                    >
                      {key}
                    </Button>
                  ))}
                </Space>
              }
              className="composer-variable-feedback composer-variable-feedback-info rounded-lg"
            />
          ) : null}
          {sendError ? <Alert type="error" title={sendError} className="composer-send-error rounded-lg" /> : null}
        </div>
      ) : null}
    </div>
  )
}
