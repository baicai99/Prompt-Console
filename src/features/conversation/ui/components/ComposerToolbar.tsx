import { AppstoreOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons'
import { Button } from 'antd'

interface ComposerToolbarProps {
  sourceImagesEnabled: boolean
  sourceImageInputRef: React.RefObject<HTMLInputElement | null>
  selectedQuickActions: string[]
  isComparisonModeLocked: boolean
  comparisonModeQuickAction: string
  dynamicPromptEnabled: boolean
  onOpenDynamicPromptToolbar: () => void
  onSend: () => void
  localIsSendBlocked: boolean
  onQuickActionsToolbarMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void
  onQuickActionsToolbarClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  onRemoveQuickAction: (label: string) => void
}

export function ComposerToolbar(props: ComposerToolbarProps) {
  return (
    <div className="composer-main-row composer-toolbar mt-auto flex flex-wrap items-center justify-between gap-2.5">
      <div className="composer-toolbar-left flex min-w-0 flex-[1_1_360px] flex-wrap items-center gap-2">
        <Button
          type="text"
          icon={<PlusOutlined />}
          disabled={!props.sourceImagesEnabled}
          onClick={() => props.sourceImageInputRef.current?.click()}
          className="composer-plus-btn !h-9 !w-9 !min-w-9 !rounded-lg !border !border-[rgba(214,220,229,0.92)] !bg-white !px-0 !text-slate-800 !shadow-[0_1px_4px_rgba(15,23,42,0.05)] hover:!border-[rgba(184,193,204,0.96)] hover:!bg-slate-50 hover:!text-slate-900 focus:!border-[rgba(184,193,204,0.96)] focus:!bg-slate-50 focus:!text-slate-900 active:!border-[rgba(184,193,204,0.96)] active:!bg-slate-50 active:!text-slate-900"
          aria-label={props.sourceImagesEnabled ? '上传参考图' : '文本模式不支持参考图'}
          title={props.sourceImagesEnabled ? '上传参考图（最多 6 张）' : '文本模式不支持参考图'}
        />
        <Button
          type="default"
          icon={<AppstoreOutlined />}
          className="composer-tools-btn !h-9 !rounded-lg !border !border-[rgba(214,220,229,0.92)] !bg-white !px-3 !text-[13px] !text-slate-800 !shadow-[0_1px_4px_rgba(15,23,42,0.05)] hover:!border-[rgba(184,193,204,0.96)] hover:!bg-slate-50 hover:!text-slate-900 focus:!border-[rgba(184,193,204,0.96)] focus:!bg-slate-50 focus:!text-slate-900 active:!border-[rgba(184,193,204,0.96)] active:!bg-slate-50 active:!text-slate-900"
          aria-label="快捷功能"
          onMouseDown={props.onQuickActionsToolbarMouseDown}
          onClick={props.onQuickActionsToolbarClick}
        >
          快捷功能
        </Button>
        {props.selectedQuickActions.length > 0 ? (
          <div className="composer-chip-row flex min-w-0 max-w-full flex-wrap items-center gap-2" aria-label="已选快捷功能">
            {props.selectedQuickActions.map((item) => (
              <span
                key={item}
                className={`composer-chip inline-flex min-h-[34px] items-center rounded-lg border px-2 pl-3 ${props.isComparisonModeLocked && item === props.comparisonModeQuickAction ? 'is-disabled border-[#dde3eb] bg-[#f4f6f8] text-[rgba(15,23,42,0.46)]' : 'border-[rgba(164,197,255,0.4)] bg-[rgba(191,219,254,0.7)] text-blue-700'}`}
              >
                <span className="composer-chip-label text-[13px] leading-[1.2]">{item}</span>
                <button
                  type="button"
                  className="composer-chip-remove ml-[5px] inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-none bg-transparent p-0 text-[13px] leading-none text-slate-600 transition-colors hover:bg-[rgba(59,130,246,0.16)] hover:text-blue-700 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-slate-500 disabled:opacity-45"
                  aria-label={`移除 ${item}`}
                  disabled={props.isComparisonModeLocked && item === props.comparisonModeQuickAction}
                  onClick={() => props.onRemoveQuickAction(item)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="composer-action-col flex shrink-0 items-center justify-end gap-1">
        {props.dynamicPromptEnabled ? (
          <Button
            type="default"
            className="composer-dynamic-prompt-btn !h-9 !rounded-lg !border !border-[rgba(214,220,229,0.92)] !bg-white !px-3 !text-[13px] !text-slate-800 !shadow-[0_1px_4px_rgba(15,23,42,0.05)] hover:!border-[rgba(184,193,204,0.96)] hover:!bg-slate-50 hover:!text-slate-900 focus:!border-[rgba(184,193,204,0.96)] focus:!bg-slate-50 focus:!text-slate-900 active:!border-[rgba(184,193,204,0.96)] active:!bg-slate-50 active:!text-slate-900"
            aria-label="打开动态提示词抽屉"
            title="打开动态提示词抽屉"
            onClick={props.onOpenDynamicPromptToolbar}
          >
            打开动态提示词
          </Button>
        ) : null}
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={props.onSend}
          disabled={props.localIsSendBlocked}
          className="composer-send-btn !h-9 !w-9 !min-w-9 !rounded-lg !border !border-[rgba(214,220,229,0.92)] !px-0 !shadow-[0_3px_10px_rgba(37,99,235,0.16)]"
          aria-label="发送"
          title="发送"
        />
      </div>
    </div>
  )
}
