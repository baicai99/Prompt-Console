import type { ComponentProps, CSSProperties } from 'react'
import { Layout } from 'antd'
import { Composer } from './components/Composer'
import { COMPOSER_MAX_WIDTH_PX, COMPOSER_MIN_WIDTH_PX } from './components/composerLayoutTokens'
import { ConversationWorkspaceColumns } from './ConversationWorkspaceColumns'
import type { PanelMode } from '../../../hooks/usePersistentPanelMode'

const { Content } = Layout

interface ConversationWorkspaceStageProps {
  isGlobalImageDragging: boolean
  composerPanelMode: PanelMode
  composerAutoFocusOnMount?: boolean
  onExpandComposer: () => void
  onCollapseComposer: () => void
  composerProps: ComponentProps<typeof Composer>
  columnsProps: ComponentProps<typeof ConversationWorkspaceColumns>
}

export function ConversationWorkspaceStage(props: ConversationWorkspaceStageProps) {
  const chatStageStyle = {
    '--chat-content-max-width': `${COMPOSER_MAX_WIDTH_PX}px`,
    '--chat-content-min-width': `${COMPOSER_MIN_WIDTH_PX}px`,
  } as CSSProperties
  const composerPanelInnerStyle = {
    width: 'min(var(--chat-content-max-width, 920px), calc(100% - 32px))',
    minWidth: 'min(var(--chat-content-min-width, 460px), calc(100% - 32px))',
    maxWidth: 'min(var(--chat-content-max-width, 920px), calc(100% - 32px))',
  } as CSSProperties

  return (
    <div className="chat-stage relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#f3f6fb_100%)]" style={chatStageStyle}>
      {props.isGlobalImageDragging ? (
        <div className="chat-image-drop-overlay pointer-events-none absolute inset-0 z-[22] flex items-center justify-center border-2 border-dashed border-[rgba(24,144,255,0.42)] bg-[rgba(24,144,255,0.1)] p-5" role="status" aria-live="polite">
          <div className="chat-image-drop-overlay-card rounded-[14px] border border-[rgba(24,144,255,0.35)] bg-[rgba(255,255,255,0.95)] px-[18px] py-3.5 text-sm leading-[1.4] text-[rgba(0,0,0,0.85)] shadow-[0_10px_24px_rgba(15,23,42,0.12)]">拖拽图片到任意位置即可上传（最多 6 张）</div>
        </div>
      ) : null}
      <Content className={`chat-body flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0 ${props.columnsProps.activeSideMode === 'multi' ? 'chat-body-multi' : ''}`}>
        <ConversationWorkspaceColumns {...props.columnsProps} />
      </Content>

      {props.composerPanelMode === 'expanded' ? (
        <div className="chat-composer-panel relative z-20 shrink-0 border-t border-[rgba(213,223,235,0.9)] bg-[linear-gradient(180deg,rgba(249,251,254,0.94)_0%,rgba(242,246,251,0.98)_100%)] px-5 pt-3.5 pb-3.5 shadow-[0_-12px_32px_rgba(15,23,42,0.04)] transition-[padding,background,box-shadow,border-color] duration-200 ease-in-out">
          <div className="chat-composer-panel-inner mx-auto" style={composerPanelInnerStyle}>
            <Composer
              {...props.composerProps}
              autoFocusOnMount={props.composerAutoFocusOnMount}
              onCollapse={props.onCollapseComposer}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
