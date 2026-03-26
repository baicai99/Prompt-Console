import { Alert, Button, Card, Flex, Switch, Typography, theme } from 'antd'
import type { SingleSideSettings } from '../../../../../types/conversation'

const { Text } = Typography

interface GlobalOutputSectionProps {
  settings: SingleSideSettings | null | undefined
  generationMode: 'image' | 'text'
  isSaveDirectoryReady: (value: string | undefined) => boolean
  pickSaveDirectory: () => Promise<{ saveDirectory: string; directoryName: string } | null>
  messageApi: {
    warning: (content: string) => void
    success: (content: string) => void
    error: (content: string) => void
  }
  onPatch: (patch: Partial<SingleSideSettings>) => void
}

export function GlobalOutputSection(props: GlobalOutputSectionProps) {
  const {
    settings,
    generationMode,
    isSaveDirectoryReady,
    pickSaveDirectory,
    messageApi,
    onPatch,
  } = props

  if (!settings) {
    return null
  }

  const hasSelectedDirectory = isSaveDirectoryReady(settings.saveDirectory)
  const { token } = theme.useToken()

  return (
    <Card size="small" styles={{ body: { padding: token.paddingSM } }}>
      <Flex vertical gap={token.sizeXS}>
        <Flex align="center" justify="space-between" gap={token.sizeSM}>
          <Text strong>自动保存到本地</Text>
          <Switch
            checked={hasSelectedDirectory ? settings.autoSave : false}
            disabled={!hasSelectedDirectory || generationMode === 'text'}
            onChange={(checked) => onPatch({ autoSave: checked })}
          />
        </Flex>
        <Flex justify="flex-end">
          <Button
            disabled={generationMode === 'text'}
            onClick={async () => {
              try {
                const result = await pickSaveDirectory()
                if (!result) {
                  messageApi.warning('当前环境不支持路径选择，无法开启自动保存')
                  return
                }
                onPatch({ saveDirectory: result.saveDirectory })
                messageApi.success(`已选择保存路径：${result.directoryName}`)
              } catch (error) {
                const reason = error instanceof Error ? error.message : '选择目录失败'
                messageApi.error(reason)
              }
            }}
          >
            选择保存路径
          </Button>
        </Flex>

        {generationMode === 'text' ? (
          <Alert type="info" showIcon title="文本模式将调用 /v1/chat/completions 流式接口。" />
        ) : null}
      </Flex>
    </Card>
  )
}
