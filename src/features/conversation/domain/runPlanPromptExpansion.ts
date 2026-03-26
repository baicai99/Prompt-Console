import { parseTemplateKeys, renderTemplate } from '../../../utils/template'
import { buildPanelVariableBatches } from './panelVariableParsing'
import type { PanelValueFormat, PanelVariableRow } from './types'

export interface ExpandedPromptBatch {
  finalPrompt: string
  variablesSnapshot: Record<string, string>
}

export type ExpandedPromptBatchResult =
  | { ok: false; error: string }
  | { ok: true; value: ExpandedPromptBatch[] }

export function expandPromptBatches(input: {
  templatePrompt: string
  panelVariables: PanelVariableRow[]
  panelValueFormat?: PanelValueFormat
  dynamicPromptEnabled?: boolean
}): ExpandedPromptBatchResult {
  const dynamicPromptEnabled = input.dynamicPromptEnabled ?? true
  const panelValueFormat = input.panelValueFormat ?? 'auto'
  const hasTemplateVariables = parseTemplateKeys(input.templatePrompt).length > 0
  const shouldExpandDynamicPrompt = dynamicPromptEnabled && hasTemplateVariables
  const variableBatches = shouldExpandDynamicPrompt
    ? buildPanelVariableBatches(input.panelVariables, panelValueFormat)
    : {
      validation: { ok: true, mismatchRowIds: [], error: '' },
      batches: [{}],
    }

  if (!variableBatches.validation.ok) {
    return { ok: false, error: variableBatches.validation.error }
  }

  const expanded: ExpandedPromptBatch[] = []
  for (const variablesSnapshot of variableBatches.batches) {
    let finalPrompt = input.templatePrompt
    if (shouldExpandDynamicPrompt) {
      const rendered = renderTemplate(input.templatePrompt, variablesSnapshot)
      if (!rendered.ok) {
        return { ok: false, error: `Missing variables: ${rendered.missingKeys.join(', ')}` }
      }
      finalPrompt = rendered.finalPrompt.trim()
    }

    if (!finalPrompt) {
      return { ok: false, error: 'Prompt is empty after variable replacement.' }
    }

    expanded.push({
      finalPrompt,
      variablesSnapshot: shouldExpandDynamicPrompt ? variablesSnapshot : {},
    })
  }

  return { ok: true, value: expanded }
}
