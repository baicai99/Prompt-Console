import { Suspense, lazy } from 'react'
import {
  ASSISTANT_MARKDOWN_CLASS,
  ASSISTANT_MARKDOWN_TEST_ID,
} from './assistantMarkdownShared'

const AsyncAssistantMarkdown = lazy(() => import('./AssistantMarkdownRenderer'))

interface AssistantMarkdownProps {
  content: string
}

function FallbackMarkdown({ content }: AssistantMarkdownProps) {
  return (
    <div className={ASSISTANT_MARKDOWN_CLASS} data-testid={ASSISTANT_MARKDOWN_TEST_ID}>
      {content}
    </div>
  )
}

export function AssistantMarkdown({ content }: AssistantMarkdownProps) {
  return (
    <Suspense fallback={<FallbackMarkdown content={content} />}>
      <AsyncAssistantMarkdown content={content} />
    </Suspense>
  )
}
