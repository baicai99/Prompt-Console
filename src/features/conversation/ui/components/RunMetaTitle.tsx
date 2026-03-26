import { Button, Typography } from 'antd'
import type { Run } from '../../../../types/conversation'
import { URL_RESPONSE_FORMAT_BATCH_DOWNLOAD_HINT } from '../../domain/batchDownload'
import type { AssistantActionTrigger } from './messageListRendererTypes'
import { PROMPT_SUMMARY_MAX_CHARS, summarizeRunPrompt } from './runPromptSummary'

const { Text } = Typography

interface RunMetaTitleProps {
  run: Run
  runNumber: number
  showRunNumber: boolean
  showBatchDownload: boolean
  batchDownloadDisabled?: boolean
  onDownloadBatchRun?: (runId: string) => void
  onAssistantActionTrigger?: AssistantActionTrigger
}

export function RunMetaTitle(props: RunMetaTitleProps) {
  const {
    run,
    runNumber,
    showRunNumber,
    showBatchDownload,
    batchDownloadDisabled = false,
    onDownloadBatchRun,
    onAssistantActionTrigger,
  } = props
  const promptText = run.finalPrompt.trim()
  const promptSummary = summarizeRunPrompt(promptText)

  return (
    <div className="run-meta-title flex w-full min-w-0 flex-wrap items-start gap-3 overflow-visible">
      {showRunNumber ? <Text strong className="run-meta-title-fixed inline-flex min-w-0 shrink-0 items-center rounded-full bg-[#2d2115] px-2 py-[3px] text-[11px] leading-[1.2] tracking-[0.04em] !text-[#fff8ee]">{runNumber}</Text> : null}
      {showBatchDownload ? (
        <Button
          type="link"
          size="small"
          className="run-meta-title-toggle assistant-action-btn !shrink-0 !px-0 !text-[#9a5a1f]"
          disabled={batchDownloadDisabled}
          title={batchDownloadDisabled ? URL_RESPONSE_FORMAT_BATCH_DOWNLOAD_HINT : undefined}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()
            onAssistantActionTrigger?.(`run-${run.id}-download-batch`, event, () => onDownloadBatchRun?.(run.id))
          }}
        >
          下载这一批次
        </Button>
      ) : null}
      <Text
        className="run-meta-title-prompt block min-w-0 flex-[1_1_0] whitespace-normal break-words text-base leading-[1.5] text-[#5e4630]"
        data-run-id={run.id}
        data-prompt-length={promptText.length}
        data-prompt-summary-max-chars={PROMPT_SUMMARY_MAX_CHARS}
      >
        {promptSummary}
      </Text>
    </div>
  )
}
