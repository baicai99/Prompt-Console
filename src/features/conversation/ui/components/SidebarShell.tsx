import type { CSSProperties, ReactNode } from 'react'
import { Layout } from 'antd'
import type { PanelMode } from '../../../../hooks/usePersistentPanelMode'

const { Sider } = Layout

type SidebarSide = 'left' | 'right'
type SidebarContentLayout = 'default' | 'overlay-fixed'

interface SidebarShellProps {
  side: SidebarSide
  mode: PanelMode
  expandedWidth: number
  collapsedWidth: number
  onModeChange: (mode: PanelMode) => void
  expandedContent: ReactNode
  collapsedContent: ReactNode
  className?: string
  breakpoint?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
  autoModeByBreakpoint?: boolean
  contentLayout?: SidebarContentLayout
}

export function SidebarShell(props: SidebarShellProps) {
  const {
    side,
    mode,
    expandedWidth,
    collapsedWidth,
    onModeChange,
    expandedContent,
    collapsedContent,
    className,
    breakpoint,
    autoModeByBreakpoint = false,
    contentLayout = 'default',
  } = props

  const shellStyle = {
    '--sidebar-collapsed-width': `${collapsedWidth}px`,
    '--sidebar-expanded-width': `${expandedWidth}px`,
    overflow: 'hidden',
    transitionProperty: 'width, min-width, max-width',
    transitionDuration: '180ms',
    transitionTimingFunction: 'ease',
  } as CSSProperties
  const layerBaseClassName = 'sidebar-shell-layer absolute inset-0 transition-opacity duration-150'
  const fixedLayerStyle = contentLayout === 'overlay-fixed'
    ? { left: 'auto', right: 0 }
    : undefined
  const expandedLayerStyle = contentLayout === 'overlay-fixed'
    ? {
        ...fixedLayerStyle,
        width: 'var(--sidebar-expanded-width, 320px)',
        minWidth: 'var(--sidebar-expanded-width, 320px)',
        maxWidth: 'var(--sidebar-expanded-width, 320px)',
      }
    : fixedLayerStyle
  const collapsedLayerStyle = contentLayout === 'overlay-fixed'
    ? {
        ...fixedLayerStyle,
        width: 'var(--sidebar-collapsed-width, 56px)',
        minWidth: 'var(--sidebar-collapsed-width, 56px)',
        maxWidth: 'var(--sidebar-collapsed-width, 56px)',
      }
    : fixedLayerStyle

  return (
    <Sider
      width={expandedWidth}
      collapsedWidth={collapsedWidth}
      collapsible
      trigger={null}
      collapsed={mode === 'collapsed'}
      breakpoint={breakpoint}
      onBreakpoint={
        autoModeByBreakpoint
          ? (broken) => {
              if (broken) {
                onModeChange('collapsed')
              }
            }
          : undefined
      }
      style={shellStyle}
      className={[
        'sidebar-shell',
        'relative',
        'overflow-hidden',
        side === 'right'
          ? 'border-l border-[var(--prompt-image-console-colorBorderSecondary)]'
          : 'border-r border-[var(--prompt-image-console-colorBorderSecondary)]',
        'bg-[var(--prompt-image-console-colorBgContainer)]',
        contentLayout === 'overlay-fixed' ? 'has-overlay-fixed' : '',
        className ?? '',
        mode === 'collapsed' ? 'is-collapsed' : 'is-expanded',
      ].join(' ').trim()}
    >
      <div className="sidebar-shell-inner relative h-full w-full">
        <div
          className={[
            layerBaseClassName,
            'sidebar-shell-layer-expanded',
            contentLayout === 'overlay-fixed' ? 'sidebar-shell-layer-fixed' : '',
            mode === 'expanded' ? 'is-active pointer-events-auto opacity-100' : 'is-inactive pointer-events-none opacity-0',
          ].join(' ').trim()}
          style={expandedLayerStyle}
        >
          {expandedContent}
        </div>
        <div
          className={[
            layerBaseClassName,
            'sidebar-shell-layer-collapsed',
            contentLayout === 'overlay-fixed' ? 'sidebar-shell-layer-fixed' : '',
            mode === 'collapsed' ? 'is-active pointer-events-auto opacity-100' : 'is-inactive pointer-events-none opacity-0',
          ].join(' ').trim()}
          style={collapsedLayerStyle}
        >
          {collapsedContent}
        </div>
      </div>
    </Sider>
  )
}
