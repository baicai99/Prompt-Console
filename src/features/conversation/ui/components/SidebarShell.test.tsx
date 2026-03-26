import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SidebarShell } from './SidebarShell'

describe('SidebarShell', () => {
  it('shows expanded layer when mode is expanded', () => {
    render(
      <SidebarShell
        side="right"
        mode="expanded"
        expandedWidth={320}
        collapsedWidth={56}
        onModeChange={() => {}}
        expandedContent={<div>expanded-content</div>}
        collapsedContent={<div>collapsed-content</div>}
      />,
    )

    expect(screen.getByText('expanded-content')).toBeInTheDocument()
    expect(screen.getByText('collapsed-content')).toBeInTheDocument()
    expect(document.querySelector('.sidebar-shell-layer-expanded')?.className).toContain('is-active')
    expect(document.querySelector('.sidebar-shell-layer-collapsed')?.className).toContain('is-inactive')
  })

  it('shows collapsed layer when mode is collapsed', () => {
    render(
      <SidebarShell
        side="right"
        mode="collapsed"
        expandedWidth={320}
        collapsedWidth={56}
        onModeChange={() => {}}
        expandedContent={<div>expanded-content</div>}
        collapsedContent={<div>collapsed-content</div>}
      />,
    )

    expect(screen.getByText('expanded-content')).toBeInTheDocument()
    expect(screen.getByText('collapsed-content')).toBeInTheDocument()
    expect(document.querySelector('.sidebar-shell-layer-expanded')?.className).toContain('is-inactive')
    expect(document.querySelector('.sidebar-shell-layer-collapsed')?.className).toContain('is-active')
  })

  it('supports overlay-fixed layout for the right settings sidebar', () => {
    render(
      <SidebarShell
        side="right"
        mode="expanded"
        expandedWidth={320}
        collapsedWidth={56}
        onModeChange={() => {}}
        contentLayout="overlay-fixed"
        expandedContent={<div>expanded-content</div>}
        collapsedContent={<div>collapsed-content</div>}
      />,
    )

    const shell = document.querySelector('.sidebar-shell')
    const expandedLayer = document.querySelector('.sidebar-shell-layer-expanded')
    const collapsedLayer = document.querySelector('.sidebar-shell-layer-collapsed')

    expect(shell?.className).toContain('has-overlay-fixed')
    expect(shell).toHaveStyle({ '--sidebar-expanded-width': '320px', '--sidebar-collapsed-width': '56px' })
    expect(expandedLayer?.className).toContain('sidebar-shell-layer-fixed')
    expect(collapsedLayer?.className).toContain('sidebar-shell-layer-fixed')
    expect(expandedLayer?.className).toContain('is-active')
    expect(collapsedLayer?.className).toContain('is-inactive')
  })
})
