import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import {
  ASSISTANT_MARKDOWN_CLASS,
  ASSISTANT_MARKDOWN_TEST_ID,
} from './assistantMarkdownShared'

interface AssistantMarkdownRendererProps {
  content: string
}

export default function AssistantMarkdownRenderer({ content }: AssistantMarkdownRendererProps) {
  return (
    <div className={ASSISTANT_MARKDOWN_CLASS} data-testid={ASSISTANT_MARKDOWN_TEST_ID}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: (props) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer noopener"
            />
          ),
          table: (props) => (
            <div className="assistant-markdown-table-scroll mb-3 overflow-x-auto">
              <table {...props} />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
