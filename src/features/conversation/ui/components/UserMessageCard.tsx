import { memo, useRef } from 'react'
import { CopyOutlined, SendOutlined } from '@ant-design/icons'
import { Button, Card, Space, Tooltip, Typography } from 'antd'
import type { Message } from '../../../../types/conversation'
import type { RunSourceImageRef } from '../../../../types/image'
import { copyUserMessageContent, normalizePromptForReuse } from './messageListUtils'
import type { ResolveImagePreviewSource } from './useResolvedImagePreview'
import { useResolvedImagePreview } from './useResolvedImagePreview'
import { useNearViewport } from './useNearViewport'

const { Paragraph } = Typography

interface UserSourceImageThumbnailProps {
  image: RunSourceImageRef
  resolveImagePreviewSource?: ResolveImagePreviewSource
  offscreenPreviewReleaseDelayMs?: number
}

function UserSourceImageThumbnail({
  image,
  resolveImagePreviewSource,
  offscreenPreviewReleaseDelayMs = 0,
}: UserSourceImageThumbnailProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isNearViewport = useNearViewport({
    targetRef: containerRef,
    rootMarginPx: 160,
    offscreenReleaseDelayMs: offscreenPreviewReleaseDelayMs,
  })
  const { src } = useResolvedImagePreview({
    source: {
      refKind: 'idb-blob',
      refKey: image.assetKey,
    },
    resolveImagePreviewSource,
    enabled: isNearViewport,
    request: { priority: 'visible' },
  })

  return (
    <div ref={containerRef} className="message-user-source-image-item">
      {src ? (
        <img
          src={src}
          alt={image.fileName || '参考图'}
          className="message-user-source-image"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="message-user-source-image message-user-source-image-placeholder" aria-hidden="true" />
      )}
    </div>
  )
}

interface UserMessageCardProps {
  message: Message
  onUseUserPrompt?: (prompt: string) => void
  resolveImagePreviewSource?: ResolveImagePreviewSource
  offscreenPreviewReleaseDelayMs?: number
}

function UserMessageCardComponent({
  message,
  onUseUserPrompt,
  resolveImagePreviewSource,
  offscreenPreviewReleaseDelayMs,
}: UserMessageCardProps) {
  const sourceImages = message.sourceImages ?? []

  return (
    <div className="message-card-shell user flex w-full flex-col items-end gap-2.5">
      <Card
        size="small"
        className="message-card user relative !w-auto !max-w-[60%] overflow-hidden !rounded-[var(--message-bubble-radius)] !border-[#d7e4f1] !bg-[radial-gradient(circle_at_bottom_left,rgba(118,164,214,0.14)_0,rgba(118,164,214,0)_32%),linear-gradient(145deg,#f7fbff_0%,#ffffff_55%,#eff6ff_100%)] !shadow-none"
        styles={{
          body: {
            padding: '16px 18px',
            position: 'relative',
            zIndex: 1,
          },
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 h-40 w-40 rounded-[160px_0_0_0] bg-[radial-gradient(circle_at_bottom_right,rgba(118,164,214,0.24),rgba(118,164,214,0))]"
        />
        <Space orientation="vertical" size={12} className="w-full user-message-layout relative z-[1] gap-[14px]">
          {sourceImages.length > 0 ? (
            <div className="message-user-source-image-list" aria-label="用户发送参考图">
              {sourceImages.map((item) => (
                <UserSourceImageThumbnail
                  key={item.id}
                  image={item}
                  resolveImagePreviewSource={resolveImagePreviewSource}
                  offscreenPreviewReleaseDelayMs={offscreenPreviewReleaseDelayMs}
                />
              ))}
            </div>
          ) : null}
          <Paragraph
            className="user-message-content max-w-[42ch] !text-[15px] !leading-[1.72] !text-[#17304c]"
            style={{
              marginBottom: 0,
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {message.content}
          </Paragraph>
        </Space>
      </Card>

      <div className="user-message-outside-actions flex min-w-0 items-center justify-end pr-2">
        <Space size={6} className="message-bottom-actions user-message-actions justify-end">
          <Tooltip title="发送到输入框">
            <Button
              size="small"
              type="default"
              className="message-use-prompt-btn"
              icon={<SendOutlined />}
              aria-label="发送到输入框"
              onClick={() => onUseUserPrompt?.(normalizePromptForReuse(message.content))}
              disabled={!message.content.trim()}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              size="small"
              type="default"
              className="assistant-action-btn"
              icon={<CopyOutlined />}
              aria-label="复制"
              onClick={() => {
                void copyUserMessageContent(message.content)
              }}
              disabled={!message.content.trim()}
            />
          </Tooltip>
        </Space>
      </div>
    </div>
  )
}

export const UserMessageCard = memo(UserMessageCardComponent)
