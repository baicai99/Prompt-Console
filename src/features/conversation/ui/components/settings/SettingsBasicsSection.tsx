import { Card, Col, Flex, Form, InputNumber, Row, Segmented, Switch, Typography } from 'antd'
import type { SideMode } from '../../../../../types/conversation'

const { Text } = Typography

interface SettingsBasicsSectionProps {
  token: {
    paddingMD: number
    sizeMD: number
    sizeLG: number
  }
  sideMode: SideMode
  sideCount: number
  isSideConfigLocked: boolean
  generationMode: 'image' | 'text'
  onSideModeChange: (mode: SideMode) => void
  onSideCountChange: (count: number) => void
  onGenerationModeChange: (mode: 'image' | 'text') => void
}

export function SettingsBasicsSection(props: SettingsBasicsSectionProps) {
  return (
    <Card
      size="small"
      title="基础设置"
      styles={{ body: { padding: props.token.paddingMD } }}
    >
      <Form layout="vertical">
        <Row gutter={[props.token.sizeMD, props.token.sizeMD]} align="bottom">
          <Col xs={24} xl={8}>
            <Flex align="center" justify="space-between" gap={props.token.sizeLG}>
              <Text strong>多窗口开启</Text>
              <Switch
                checked={props.sideMode === 'multi'}
                disabled={props.isSideConfigLocked}
                onChange={(checked) => props.onSideModeChange(checked ? 'multi' : 'single')}
              />
            </Flex>
          </Col>

          {props.sideMode === 'multi' ? (
            <Col xs={24} md={8} xl={6}>
              <Form.Item label="窗口数量" style={{ marginBottom: 0 }}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={2}
                  max={8}
                  value={props.sideCount}
                  disabled={props.isSideConfigLocked}
                  onChange={(value) => props.onSideCountChange(typeof value === 'number' ? value : 2)}
                />
              </Form.Item>
            </Col>
          ) : null}

          <Col xs={24} md={props.sideMode === 'multi' ? 16 : 24} xl={props.sideMode === 'multi' ? 10 : 16}>
            <Form.Item label="生成模式" style={{ marginBottom: 0 }}>
              <Segmented
                block
                size="small"
                value={props.generationMode}
                options={[
                  { label: '图片', value: 'image' },
                  { label: '文本', value: 'text' },
                ]}
                onChange={(value) => props.onGenerationModeChange(value as 'image' | 'text')}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  )
}
