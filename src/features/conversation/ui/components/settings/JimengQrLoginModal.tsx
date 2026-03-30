import { CopyOutlined, LinkOutlined, QrcodeOutlined } from '@ant-design/icons'
import { Alert, Button, Input, Modal, Space, Typography } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import {
  JIMENG_HOME_URL,
  JIMENG_QR_LOGIN_URL,
  openJimengQrLoginWindow,
} from '../../../../../services/jimengAuth'

const { Paragraph, Text } = Typography

interface JimengQrLoginModalProps {
  open: boolean
  onClose: () => void
}

type PopupState = 'idle' | 'opened' | 'blocked'
type CopyState = 'idle' | 'success' | 'error'

export function JimengQrLoginModal(props: JimengQrLoginModalProps) {
  const { open, onClose } = props
  const [popupState, setPopupState] = useState<PopupState>('idle')
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const resetStates = useCallback(() => {
    setPopupState('idle')
    setCopyState('idle')
  }, [])

  const handleClose = useCallback(() => {
    resetStates()
    onClose()
  }, [onClose, resetStates])

  const handleOpenWindow = useCallback(() => {
    const nextWindow = openJimengQrLoginWindow()
    setPopupState(nextWindow ? 'opened' : 'blocked')
  }, [])

  const handleCopyLink = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard_unavailable')
      }
      await navigator.clipboard.writeText(JIMENG_QR_LOGIN_URL)
      setCopyState('success')
    } catch {
      setCopyState('error')
    }
  }, [])

  const popupAlert = useMemo(() => {
    if (popupState === 'opened') {
      return {
        type: 'success' as const,
        title: '已打开即梦扫码窗口。请在新窗口完成扫码和授权。',
      }
    }
    if (popupState === 'blocked') {
      return {
        type: 'warning' as const,
        title: '浏览器拦截了弹窗。请允许弹窗，或直接复制登录链接到浏览器打开。',
      }
    }
    return null
  }, [popupState])

  const copyAlert = useMemo(() => {
    if (copyState === 'success') {
      return {
        type: 'success' as const,
        title: '登录链接已复制。',
      }
    }
    if (copyState === 'error') {
      return {
        type: 'warning' as const,
        title: '复制失败。请手动复制下方链接。',
      }
    }
    return null
  }, [copyState])

  return (
    <Modal
      title="即梦扫码登录"
      open={open}
      onCancel={handleClose}
      footer={[
        <Button key="home" icon={<LinkOutlined />} href={JIMENG_HOME_URL} target="_blank" rel="noreferrer">
          打开即梦首页
        </Button>,
        <Button key="done" type="primary" onClick={handleClose}>
          已完成登录
        </Button>,
      ]}
      width={880}
      centered
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
      destroyOnHidden
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Paragraph style={{ marginBottom: 0 }}>
          这个功能会直接打开你提供的即梦扫码登录页。你可以在下方内嵌页面扫码，也可以单独打开新窗口扫码。
        </Paragraph>
        <Alert
          type="info"
          showIcon
          title="当前应用无法直接验证外部站点 Cookie。扫码成功后，请回到这里点“已完成登录”。"
        />
        {popupAlert ? <Alert type={popupAlert.type} showIcon title={popupAlert.title} /> : null}
        {copyAlert ? <Alert type={copyAlert.type} showIcon title={copyAlert.title} /> : null}
        <Space wrap>
          <Button type="primary" icon={<QrcodeOutlined />} onClick={handleOpenWindow}>
            打开扫码窗口
          </Button>
          <Button icon={<CopyOutlined />} onClick={() => void handleCopyLink()}>
            复制登录链接
          </Button>
        </Space>
        <Input.TextArea
          readOnly
          value={JIMENG_QR_LOGIN_URL}
          autoSize={{ minRows: 3, maxRows: 6 }}
        />
        <div
          style={{
            border: '1px solid rgba(5, 5, 5, 0.12)',
            borderRadius: 8,
            overflow: 'hidden',
            minHeight: 560,
            background: '#fff',
          }}
        >
          <iframe
            title="即梦扫码登录"
            src={JIMENG_QR_LOGIN_URL}
            style={{
              width: '100%',
              height: 560,
              border: 0,
            }}
          />
        </div>
        <Text type="secondary">
          如果内嵌页面没有显示二维码，通常是登录页禁止被嵌入。这时请使用“打开扫码窗口”。
        </Text>
      </Space>
    </Modal>
  )
}
