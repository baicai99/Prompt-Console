import { Modal } from 'antd'
import type { PanelVariableRow } from '../../domain/types'
import { parseTemplateKeys } from '../../../../utils/template'
import { buildRowsFromTemplateKeys, hasAnyPanelVariableKey } from './composerHelpers'
import type { AdvancedTabKey } from './useComposerAdvancedPanelController'

interface HandleComposerSendAttemptInput {
  draft: string
  dynamicPromptEnabled: boolean
  panelVariables: PanelVariableRow[]
  onSend: () => void
  onAdvancedFeaturesEnabledChange: (value: boolean) => void
  onPanelVariablesChange: (rows: PanelVariableRow[]) => void
  onOpenDynamicPromptDrawer?: (tab?: AdvancedTabKey) => void
}

function openConfirm(input: { title: string; content: string; okText: string }): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: boolean) => {
      if (settled) {
        return
      }
      settled = true
      resolve(value)
    }

    Modal.confirm({
      title: input.title,
      content: input.content,
      okText: input.okText,
      cancelText: '取消',
      onOk: () => finish(true),
      onCancel: () => finish(false),
    })
  })
}

export async function handleComposerSendAttempt(input: HandleComposerSendAttemptInput) {
  const {
    draft,
    dynamicPromptEnabled,
    panelVariables,
    onSend,
    onAdvancedFeaturesEnabledChange,
    onPanelVariablesChange,
    onOpenDynamicPromptDrawer,
  } = input

  const templateKeys = parseTemplateKeys(draft)
  if (templateKeys.length === 0) {
    onSend()
    return
  }

  let dynamicEnabled = dynamicPromptEnabled
  if (!dynamicEnabled) {
    const shouldEnableDynamicPrompt = await openConfirm({
      title: '检测到模板关键词',
      content: '当前输入包含 {{变量}}，但未开启动态提示词。是否帮你开启？',
      okText: '帮我开启',
    })
    if (!shouldEnableDynamicPrompt) {
      return
    }
    onAdvancedFeaturesEnabledChange(true)
    dynamicEnabled = true
  }

  if (dynamicEnabled && !hasAnyPanelVariableKey(panelVariables)) {
    const shouldAddVariables = await openConfirm({
      title: '检测到未配置动态提示词',
      content: '当前输入包含 {{变量}}，但动态提示词为空。是否帮你按关键词自动添加？',
      okText: '帮我添加',
    })
    if (!shouldAddVariables) {
      return
    }
    onPanelVariablesChange(buildRowsFromTemplateKeys(templateKeys))
    onOpenDynamicPromptDrawer?.('table')
    return
  }

  onSend()
}
