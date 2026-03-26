import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DynamicPromptPanel } from './DynamicPromptPanel'

function renderDynamicPromptPanel(overrides: Partial<Parameters<typeof DynamicPromptPanel>[0]> = {}) {
  const onAdvancedFeaturesEnabledChange = vi.fn()

  render(
    <DynamicPromptPanel
      showAdvancedVariables={false}
      dynamicPromptEnabled={false}
      requestedTab="table"
      openRequestToken={1}
      panelValueFormat="json"
      panelVariables={[{ id: 'row-1', key: 'subject', valuesText: '', selectedValue: '' }]}
      resolvedVariables={{}}
      finalPromptPreview=""
      missingKeys={[]}
      unusedVariableKeys={[]}
      panelBatchError=""
      panelMismatchRowIds={[]}
      onPanelValueFormatChange={vi.fn()}
      onPanelVariablesChange={vi.fn()}
      onAdvancedFeaturesEnabledChange={onAdvancedFeaturesEnabledChange}
      requestComposerFocus={vi.fn()}
      {...overrides}
    />,
  )

  return { onAdvancedFeaturesEnabledChange }
}

describe('DynamicPromptPanel', () => {
  it('renders the dedicated enable switch and forwards toggle changes', () => {
    const { onAdvancedFeaturesEnabledChange } = renderDynamicPromptPanel()

    expect(screen.getByText('启用动态提示词')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch'))

    expect(onAdvancedFeaturesEnabledChange.mock.calls[0]?.[0]).toBe(true)
  })

  it('switches to the requested tab when opened from the workspace', () => {
    renderDynamicPromptPanel({ requestedTab: 'bulk', openRequestToken: 2 })

    expect(screen.getByRole('tab', { name: '批量导入' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByPlaceholderText('{"hair":["long hair","short hair"]}')).toBeInTheDocument()
  })
})
