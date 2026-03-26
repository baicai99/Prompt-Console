import { Alert, Card, Col, Flex, Row, Typography, theme } from 'antd'
import type { ApiChannel } from '../../../../../types/channel'
import type { ModelSpec } from '../../../../../types/model'
import type { SettingPrimitive } from '../../../../../types/primitives'
import type { SingleSideSettings } from '../../../../../types/conversation'
import { URL_RESPONSE_FORMAT_BATCH_DOWNLOAD_HINT } from '../../../domain/batchDownload'
import { renderParamInput } from './settingsPanelHelpers'

const { Text } = Typography

interface GlobalImageParamsSectionProps {
  settings: SingleSideSettings | null | undefined
  currentChannel: ApiChannel | null
  activeImageModel: ModelSpec | undefined
  isBatchDownloadBlocked: boolean
  onParamChange: (paramKey: string, value: SettingPrimitive) => void
}

export function GlobalImageParamsSection(props: GlobalImageParamsSectionProps) {
  const {
    settings,
    currentChannel,
    activeImageModel,
    isBatchDownloadBlocked,
    onParamChange,
  } = props
  const { token } = theme.useToken()

  if (!settings) {
    return null
  }

  return (
    <Card size="small" styles={{ body: { padding: token.paddingMD } }}>
      <Flex vertical gap={token.sizeSM}>
        <Text strong>全局图片模型参数</Text>
        {activeImageModel ? (
          <Flex vertical gap={token.sizeXS} style={{ width: '100%' }}>
            {isBatchDownloadBlocked ? (
              <Alert
                type="warning"
                showIcon
                title={URL_RESPONSE_FORMAT_BATCH_DOWNLOAD_HINT}
                description="启用 URL 返回格式后，“下载全部”和“下载这一批次”会被禁用。"
              />
            ) : null}
            <Row gutter={[token.sizeMD, token.sizeSM]}>
              {activeImageModel.params.map((param) => (
                <Col key={param.key} xs={24} md={12}>
                  <Text>{param.label}</Text>
                  <div style={{ marginTop: 6 }}>
                    {renderParamInput(
                      param,
                      settings.paramValues[param.key],
                      (next) => onParamChange(param.key, next),
                    )}
                  </div>
                </Col>
              ))}
            </Row>
          </Flex>
        ) : (
          <Text type="secondary">
            {currentChannel ? '当前渠道未返回可用图片模型参数。' : '请先新增并选择一个渠道。'}
          </Text>
        )}
      </Flex>
    </Card>
  )
}
