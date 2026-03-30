import { ApiOutlined, DeleteOutlined, DownloadOutlined, LinkOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons'
import { Alert, Button, Descriptions, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ApiChannel } from '../../../../../types/channel'
import {
  deleteJimengAccount,
  exportJimengAccount,
  fetchJimengImageModelConfig,
  getJimengProxyLoginQr,
  getJimengProxyStatus,
  importJimengAccount,
  listJimengAccounts,
  loadJimengProxyBaseUrl,
  openJimengProxyLogin,
  proxyJimengRequest,
  resetJimengProxyLogin,
  saveCurrentJimengAccount,
  saveJimengProxyBaseUrl,
  switchJimengAccount,
  type JimengAccountListResponse,
  type JimengProxyStatus,
} from '../../../../../services/jimengProxy'
import {
  clearJimengModelCatalog,
  JIMENG_VIRTUAL_CHANNEL_ID,
  mapJimengImageConfigToModelCatalog,
  saveJimengModelCatalog,
} from '../../../../../services/jimengModelMapping'
import { JIMENG_PROXY_PROVIDER_ID } from '../../../../../services/jimengVirtualChannel'
import type { ModelSpec } from '../../../../../types/model'

const { Paragraph, Text } = Typography

interface JimengProxyModalProps {
  open: boolean
  onClose: () => void
  channels: ApiChannel[]
  onChannelsChange: (channels: ApiChannel[]) => void
}

type RequestPresetId = 'settings' | 'workspace' | 'upload-token'

const REQUEST_PRESETS: Array<{
  id: RequestPresetId
  label: string
  method: 'POST'
  path: string
  body: string
}> = [
  {
    id: 'settings',
    label: '读取设置',
    method: 'POST',
    path: '/mweb/v1/get_settings',
    body: '{}',
  },
  {
    id: 'workspace',
    label: '读取工作区',
    method: 'POST',
    path: '/mweb/v1/workspace/list?os=mac&aid=513695&web_version=7.5.0&da_version=3.3.12&aigc_features=app_lip_sync',
    body: '{}',
  },
  {
    id: 'upload-token',
    label: '申请上传令牌',
    method: 'POST',
    path: '/mweb/v1/get_upload_token',
    body: '{"scene":3}',
  },
]

const AUTO_LOAD_JIMENG_MODEL_MAX_ATTEMPTS = 4
const AUTO_LOAD_JIMENG_MODEL_RETRY_MS = 1_500

function stringifyPayload(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text.trim()) {
    return false
  }
  try {
    if (!navigator.clipboard?.writeText) {
      return false
    }
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function triggerJsonDownload(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function JimengProxyModal(props: JimengProxyModalProps) {
  const { open, onClose, channels, onChannelsChange } = props
  const [proxyBaseUrl, setProxyBaseUrl] = useState(() => loadJimengProxyBaseUrl())
  const [status, setStatus] = useState<JimengProxyStatus | null>(null)
  const [statusError, setStatusError] = useState('')
  const [isStatusLoading, setIsStatusLoading] = useState(false)
  const [qrImageSrc, setQrImageSrc] = useState('')
  const [qrError, setQrError] = useState('')
  const [isQrLoading, setIsQrLoading] = useState(false)
  const [isLoginLaunching, setIsLoginLaunching] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [requestPresetId, setRequestPresetId] = useState<RequestPresetId>('settings')
  const [requestMethod, setRequestMethod] = useState<'POST'>('POST')
  const [requestPath, setRequestPath] = useState(REQUEST_PRESETS[0].path)
  const [requestBody, setRequestBody] = useState(REQUEST_PRESETS[0].body)
  const [requestResult, setRequestResult] = useState('')
  const [requestError, setRequestError] = useState('')
  const [isRequestLoading, setIsRequestLoading] = useState(false)
  const [isAwaitingLoginReceipt, setIsAwaitingLoginReceipt] = useState(false)
  const [loginReceiptMessage, setLoginReceiptMessage] = useState('')
  const [jimengModels, setJimengModels] = useState<ModelSpec[]>([])
  const [selectedJimengModelId, setSelectedJimengModelId] = useState<string | null>(null)
  const [jimengModelError, setJimengModelError] = useState('')
  const [isJimengModelLoading, setIsJimengModelLoading] = useState(false)
  const [jimengAccounts, setJimengAccounts] = useState<JimengAccountListResponse['accounts']>([])
  const [currentJimengAccount, setCurrentJimengAccount] = useState<JimengAccountListResponse['current']>(null)
  const [selectedJimengAccountId, setSelectedJimengAccountId] = useState<string | null>(null)
  const [accountLabel, setAccountLabel] = useState('')
  const [accountBundleText, setAccountBundleText] = useState('')
  const [accountStatusMessage, setAccountStatusMessage] = useState('')
  const [accountError, setAccountError] = useState('')
  const [isAccountListLoading, setIsAccountListLoading] = useState(false)
  const [isAccountSaving, setIsAccountSaving] = useState(false)
  const [isAccountExporting, setIsAccountExporting] = useState(false)
  const [isAccountImporting, setIsAccountImporting] = useState(false)
  const [isAccountSwitching, setIsAccountSwitching] = useState(false)
  const [isAccountDeleting, setIsAccountDeleting] = useState(false)

  const pollTimerRef = useRef<number | null>(null)
  const pollingAttemptRef = useRef(0)
  const hasAutoLoadedModelsRef = useRef(false)

  const normalizedBaseUrl = useMemo(() => normalizeBaseUrl(proxyBaseUrl), [proxyBaseUrl])
  const selectedJimengModel = useMemo(
    () => jimengModels.find((item) => item.id === selectedJimengModelId) ?? jimengModels[0] ?? null,
    [jimengModels, selectedJimengModelId],
  )

  const stopLoginPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    pollingAttemptRef.current = 0
  }, [])

  const upsertJimengChannel = useCallback((modelsToBind: ModelSpec[]) => {
    const nextChannel: ApiChannel = {
      id: JIMENG_VIRTUAL_CHANNEL_ID,
      name: '即梦本地代理',
      baseUrl: normalizedBaseUrl,
      apiKey: 'local-session',
      providerId: JIMENG_PROXY_PROVIDER_ID,
      models: modelsToBind.map((model) => model.rawId ?? model.id),
    }

    const existingIndex = channels.findIndex((channel) => channel.id === JIMENG_VIRTUAL_CHANNEL_ID)
    if (existingIndex >= 0) {
      const next = [...channels]
      next[existingIndex] = nextChannel
      onChannelsChange(next)
      return
    }
    onChannelsChange([nextChannel, ...channels])
  }, [channels, normalizedBaseUrl, onChannelsChange])

  const removeJimengChannel = useCallback(() => {
    if (!channels.some((channel) => channel.id === JIMENG_VIRTUAL_CHANNEL_ID)) {
      return
    }
    onChannelsChange(channels.filter((channel) => channel.id !== JIMENG_VIRTUAL_CHANNEL_ID))
  }, [channels, onChannelsChange])

  const handlePresetChange = useCallback((value: RequestPresetId) => {
    setRequestPresetId(value)
    const preset = REQUEST_PRESETS.find((item) => item.id === value)
    if (!preset) {
      return
    }
    setRequestMethod(preset.method)
    setRequestPath(preset.path)
    setRequestBody(preset.body)
  }, [])

  const refreshStatus = useCallback(async () => {
    setIsStatusLoading(true)
    setStatusError('')
    try {
      saveJimengProxyBaseUrl(normalizedBaseUrl)
      const next = await getJimengProxyStatus(normalizedBaseUrl)
      setStatus(next)
      if (next.loginCheck.loggedIn) {
        setLoginReceiptMessage('即梦登录成功，代理会话已建立。')
      }
    } catch (error) {
      setStatus(null)
      setStatusError(error instanceof Error ? error.message : '代理不可用')
    } finally {
      setIsStatusLoading(false)
    }
  }, [normalizedBaseUrl])

  const pollForLoginReceipt = useCallback(async () => {
    stopLoginPolling()
    setIsAwaitingLoginReceipt(true)
    setLoginReceiptMessage('')

    const run = async () => {
      try {
        saveJimengProxyBaseUrl(normalizedBaseUrl)
        const next = await getJimengProxyStatus(normalizedBaseUrl)
        setStatus(next)

        if (next.loginCheck.loggedIn) {
          setIsAwaitingLoginReceipt(false)
          setLoginReceiptMessage('即梦登录成功，代理会话已建立。')
          stopLoginPolling()
          return
        }
      } catch (error) {
        setStatusError(error instanceof Error ? error.message : '代理不可用')
      }

      pollingAttemptRef.current += 1
      if (pollingAttemptRef.current >= 60) {
        setIsAwaitingLoginReceipt(false)
        stopLoginPolling()
        return
      }

      pollTimerRef.current = window.setTimeout(() => {
        void run()
      }, 2_000)
    }

    await run()
  }, [normalizedBaseUrl, stopLoginPolling])

  const launchLogin = useCallback(async () => {
    setIsLoginLaunching(true)
    setStatusError('')
    try {
      saveJimengProxyBaseUrl(normalizedBaseUrl)
      await openJimengProxyLogin(normalizedBaseUrl)
      await refreshStatus()
      await pollForLoginReceipt()
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : '无法打开代理登录窗口')
    } finally {
      setIsLoginLaunching(false)
    }
  }, [normalizedBaseUrl, pollForLoginReceipt, refreshStatus])

  const refreshQr = useCallback(async () => {
    setIsQrLoading(true)
    setQrError('')
    try {
      saveJimengProxyBaseUrl(normalizedBaseUrl)
      const result = await getJimengProxyLoginQr(normalizedBaseUrl)
      setQrImageSrc(result.qr.imageSrc)
      setLoginReceiptMessage('')
      await pollForLoginReceipt()
    } catch (error) {
      setQrImageSrc('')
      setQrError(error instanceof Error ? error.message : '无法获取动态二维码')
    } finally {
      setIsQrLoading(false)
    }
  }, [normalizedBaseUrl, pollForLoginReceipt])

  const resetLogin = useCallback(async () => {
    setIsResetting(true)
    setStatusError('')
    try {
      saveJimengProxyBaseUrl(normalizedBaseUrl)
      await resetJimengProxyLogin(normalizedBaseUrl)
      setStatus(null)
      setQrImageSrc('')
      setLoginReceiptMessage('')
      setIsAwaitingLoginReceipt(false)
      setJimengModels([])
      setSelectedJimengModelId(null)
      setJimengModelError('')
      clearJimengModelCatalog()
      hasAutoLoadedModelsRef.current = false
      removeJimengChannel()
      setRequestResult('')
      setRequestError('')
      stopLoginPolling()
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : '无法重置代理会话')
    } finally {
      setIsResetting(false)
    }
  }, [normalizedBaseUrl, removeJimengChannel, stopLoginPolling])

  const sendRequest = useCallback(async () => {
    setIsRequestLoading(true)
    setRequestError('')
    try {
      saveJimengProxyBaseUrl(normalizedBaseUrl)
      const parsedBody = requestBody.trim() ? JSON.parse(requestBody) : undefined
      const result = await proxyJimengRequest({
        baseUrl: normalizedBaseUrl,
        method: requestMethod,
        path: requestPath,
        body: parsedBody,
      })
      setRequestResult(stringifyPayload(result))
    } catch (error) {
      setRequestResult('')
      setRequestError(error instanceof Error ? error.message : '代理请求失败')
    } finally {
      setIsRequestLoading(false)
    }
  }, [normalizedBaseUrl, requestBody, requestMethod, requestPath])

  const applyJimengCatalog = useCallback((modelsToBind: ModelSpec[]) => {
    setJimengModels(modelsToBind)
    setSelectedJimengModelId(modelsToBind[0]?.id ?? null)
    saveJimengModelCatalog({ models: modelsToBind })
    upsertJimengChannel(modelsToBind)
  }, [upsertJimengChannel])

  const loadJimengModels = useCallback(async (options?: {
    retryCount?: number
    retryDelayMs?: number
  }) => {
    const retryCount = options?.retryCount ?? 0
    const retryDelayMs = options?.retryDelayMs ?? AUTO_LOAD_JIMENG_MODEL_RETRY_MS

    setIsJimengModelLoading(true)
    setJimengModelError('')
    try {
      saveJimengProxyBaseUrl(normalizedBaseUrl)

      let lastError: Error | null = null

      for (let attempt = 0; attempt <= retryCount; attempt += 1) {
        try {
          const result = await fetchJimengImageModelConfig(normalizedBaseUrl)
          const catalog = mapJimengImageConfigToModelCatalog(result.proxy.json)
          if (catalog.models.length === 0) {
            throw new Error('登录已完成，但即梦暂未返回图片模型配置。')
          }
          applyJimengCatalog(catalog.models)
          return
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('无法加载即梦图片模型')
          if (attempt < retryCount) {
            await sleep(retryDelayMs)
          }
        }
      }

      throw lastError ?? new Error('无法加载即梦图片模型')
    } catch (error) {
      setJimengModels([])
      setSelectedJimengModelId(null)
      setJimengModelError(error instanceof Error ? error.message : '无法加载即梦图片模型')
    } finally {
      setIsJimengModelLoading(false)
    }
  }, [applyJimengCatalog, normalizedBaseUrl])

  const refreshJimengAccounts = useCallback(async () => {
    setIsAccountListLoading(true)
    setAccountError('')
    try {
      saveJimengProxyBaseUrl(normalizedBaseUrl)
      const result = await listJimengAccounts(normalizedBaseUrl)
      setCurrentJimengAccount(result.current)
      setJimengAccounts(result.accounts)
      setSelectedJimengAccountId((prev) => prev ?? result.accounts[0]?.id ?? null)
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : '无法读取即梦账号列表')
    } finally {
      setIsAccountListLoading(false)
    }
  }, [normalizedBaseUrl])

  const saveCurrentAccountSnapshot = useCallback(async () => {
    setIsAccountSaving(true)
    setAccountError('')
    setAccountStatusMessage('')
    try {
      saveJimengProxyBaseUrl(normalizedBaseUrl)
      const result = await saveCurrentJimengAccount({
        baseUrl: normalizedBaseUrl,
        label: accountLabel.trim() || undefined,
      })
      setAccountStatusMessage(`已保存即梦账号快照：${result.snapshot.label}`)
      await refreshJimengAccounts()
      setSelectedJimengAccountId(result.snapshot.id)
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : '保存即梦账号失败')
    } finally {
      setIsAccountSaving(false)
    }
  }, [accountLabel, normalizedBaseUrl, refreshJimengAccounts])

  const exportCurrentAccountSnapshot = useCallback(async () => {
    setIsAccountExporting(true)
    setAccountError('')
    setAccountStatusMessage('')
    try {
      saveJimengProxyBaseUrl(normalizedBaseUrl)
      const result = await exportJimengAccount({
        baseUrl: normalizedBaseUrl,
        accountId: selectedJimengAccountId ?? undefined,
        label: accountLabel.trim() || undefined,
      })
      const content = JSON.stringify(result.snapshot, null, 2)
      setAccountBundleText(content)
      const snapshotRecord = result.snapshot as { label?: unknown }
      const snapshotLabel = typeof snapshotRecord.label === 'string' && snapshotRecord.label.trim()
        ? snapshotRecord.label.trim()
        : 'jimeng-account'
      triggerJsonDownload(`${snapshotLabel}.jimeng-account.json`, content)
      setAccountStatusMessage('已导出即梦账号快照，可在另一台电脑导入使用。')
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : '导出即梦账号失败')
    } finally {
      setIsAccountExporting(false)
    }
  }, [accountLabel, normalizedBaseUrl, selectedJimengAccountId])

  const importAccountSnapshot = useCallback(async () => {
    setIsAccountImporting(true)
    setAccountError('')
    setAccountStatusMessage('')
    try {
      saveJimengProxyBaseUrl(normalizedBaseUrl)
      const result = await importJimengAccount({
        baseUrl: normalizedBaseUrl,
        snapshot: accountBundleText,
        label: accountLabel.trim() || undefined,
        activate: true,
      })
      setAccountStatusMessage(`已导入并切换到即梦账号：${result.snapshot.label}`)
      await refreshStatus()
      await refreshJimengAccounts()
      setSelectedJimengAccountId(result.snapshot.id)
      hasAutoLoadedModelsRef.current = false
      await loadJimengModels({
        retryCount: AUTO_LOAD_JIMENG_MODEL_MAX_ATTEMPTS - 1,
        retryDelayMs: AUTO_LOAD_JIMENG_MODEL_RETRY_MS,
      })
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : '导入即梦账号失败')
    } finally {
      setIsAccountImporting(false)
    }
  }, [accountBundleText, accountLabel, loadJimengModels, normalizedBaseUrl, refreshJimengAccounts, refreshStatus])

  const switchSavedAccount = useCallback(async () => {
    if (!selectedJimengAccountId) {
      return
    }
    setIsAccountSwitching(true)
    setAccountError('')
    setAccountStatusMessage('')
    try {
      saveJimengProxyBaseUrl(normalizedBaseUrl)
      const result = await switchJimengAccount({
        baseUrl: normalizedBaseUrl,
        accountId: selectedJimengAccountId,
      })
      setAccountStatusMessage(`已切换到即梦账号：${result.snapshot.label}`)
      await refreshStatus()
      await refreshJimengAccounts()
      hasAutoLoadedModelsRef.current = false
      await loadJimengModels({
        retryCount: AUTO_LOAD_JIMENG_MODEL_MAX_ATTEMPTS - 1,
        retryDelayMs: AUTO_LOAD_JIMENG_MODEL_RETRY_MS,
      })
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : '切换即梦账号失败')
    } finally {
      setIsAccountSwitching(false)
    }
  }, [loadJimengModels, normalizedBaseUrl, refreshJimengAccounts, refreshStatus, selectedJimengAccountId])

  const deleteSavedAccount = useCallback(async () => {
    if (!selectedJimengAccountId) {
      return
    }
    setIsAccountDeleting(true)
    setAccountError('')
    setAccountStatusMessage('')
    try {
      saveJimengProxyBaseUrl(normalizedBaseUrl)
      await deleteJimengAccount({
        baseUrl: normalizedBaseUrl,
        accountId: selectedJimengAccountId,
      })
      setAccountStatusMessage('已删除即梦账号快照。')
      setSelectedJimengAccountId(null)
      await refreshJimengAccounts()
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : '删除即梦账号失败')
    } finally {
      setIsAccountDeleting(false)
    }
  }, [normalizedBaseUrl, refreshJimengAccounts, selectedJimengAccountId])

  useEffect(() => {
    if (!status?.loginCheck.loggedIn) {
      hasAutoLoadedModelsRef.current = false
      return
    }
    if (hasAutoLoadedModelsRef.current) {
      return
    }
    hasAutoLoadedModelsRef.current = true
    void loadJimengModels({
      retryCount: AUTO_LOAD_JIMENG_MODEL_MAX_ATTEMPTS - 1,
      retryDelayMs: AUTO_LOAD_JIMENG_MODEL_RETRY_MS,
    })
  }, [loadJimengModels, status?.loginCheck.loggedIn])

  useEffect(() => {
    if (!open) {
      stopLoginPolling()
      setIsAwaitingLoginReceipt(false)
      hasAutoLoadedModelsRef.current = false
      return
    }

    return () => {
      stopLoginPolling()
    }
  }, [open, stopLoginPolling])

  useEffect(() => {
    if (!open) {
      return
    }
    void refreshJimengAccounts()
  }, [open, refreshJimengAccounts])

  return (
    <Modal
      title="即梦本地代理"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={960}
      centered
      styles={{ body: { maxHeight: '78vh', overflowY: 'auto' } }}
      destroyOnHidden
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title="先在终端运行 `npm run jimeng:bff`，再用这里的按钮驱动即梦登录窗口和代理请求。"
        />
        <Form layout="vertical">
          <Form.Item label="代理地址" style={{ marginBottom: 12 }}>
            <Input
              value={proxyBaseUrl}
              placeholder="http://127.0.0.1:8787"
              onChange={(event) => setProxyBaseUrl(event.target.value)}
            />
          </Form.Item>
        </Form>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={isStatusLoading} onClick={() => void refreshStatus()}>
            检查代理状态
          </Button>
          <Button loading={isQrLoading} onClick={() => void refreshQr()}>
            刷新动态二维码
          </Button>
          <Button type="primary" icon={<LinkOutlined />} loading={isLoginLaunching} onClick={() => void launchLogin()}>
            打开代理登录窗口
          </Button>
          <Button danger loading={isResetting} onClick={() => void resetLogin()}>
            重置代理会话
          </Button>
        </Space>
        {statusError ? <Alert type="error" showIcon title={statusError} /> : null}
        {qrError ? <Alert type="error" showIcon title={qrError} /> : null}
        {loginReceiptMessage ? <Alert type="success" showIcon title={loginReceiptMessage} /> : null}
        {isAwaitingLoginReceipt ? (
          <Alert
            type="info"
            showIcon
            title="等待扫码完成中，系统会自动检测即梦登录状态。"
          />
        ) : null}
        <Space wrap>
          <Tag color={status ? 'blue' : 'default'}>{status ? '代理在线' : '未检测'}</Tag>
          {status ? (
            <Tag color={status.loginCheck.loggedIn ? 'success' : 'warning'}>
              {status.loginCheck.loggedIn ? '即梦已登录' : '即梦未登录'}
            </Tag>
          ) : null}
          {status?.browserMode ? <Tag>{status.browserMode === 'interactive' ? '交互浏览器' : '无头浏览器'}</Tag> : null}
        </Space>
        {status ? (
          <>
            <Paragraph style={{ marginBottom: 0 }}>
              当前页面: <Text code>{status.pageUrl || 'N/A'}</Text>
            </Paragraph>
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: 'receipt',
                  label: '登录回执',
                  children: status.loginCheck.loggedIn ? '即梦已登录，当前代理可继续读取模型与工作区。' : '即梦尚未登录。',
                },
                {
                  key: 'status',
                  label: '登录状态码',
                  children: String(status.loginCheck.status),
                },
              ]}
            />
            <Input.TextArea
              readOnly
              value={stringifyPayload(status.loginCheck.payload || status.loginCheck.snippet)}
              autoSize={{ minRows: 4, maxRows: 10 }}
            />
          </>
        ) : null}
        {qrImageSrc ? (
          <div
            style={{
              width: 240,
              padding: 12,
              border: '1px solid rgba(5, 5, 5, 0.12)',
              borderRadius: 8,
              background: '#fff',
            }}
          >
            <img
              src={qrImageSrc}
              alt="即梦动态二维码"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>
        ) : null}
        <Alert
          type="warning"
          showIcon
          title="即梦登录态不是单一 token，而是以 jianying.com 域名 cookies 为主，辅以 jimeng 页面 localStorage / sessionStorage。下面的账号快照会一并导出这些登录态数据。"
        />
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text strong>账号管理</Text>
          <Space wrap>
            <Button loading={isAccountListLoading} onClick={() => void refreshJimengAccounts()}>
              刷新账号列表
            </Button>
            <Button loading={isAccountSaving} onClick={() => void saveCurrentAccountSnapshot()}>
              保存当前账号
            </Button>
            <Button icon={<DownloadOutlined />} loading={isAccountExporting} onClick={() => void exportCurrentAccountSnapshot()}>
              导出账号快照
            </Button>
            <Button type="primary" icon={<SwapOutlined />} disabled={!selectedJimengAccountId} loading={isAccountSwitching} onClick={() => void switchSavedAccount()}>
              切换到选中账号
            </Button>
            <Button danger icon={<DeleteOutlined />} disabled={!selectedJimengAccountId} loading={isAccountDeleting} onClick={() => void deleteSavedAccount()}>
              删除选中快照
            </Button>
          </Space>
          <Input
            value={accountLabel}
            placeholder="账号备注，可选"
            onChange={(event) => setAccountLabel(event.target.value)}
          />
          {currentJimengAccount ? (
            <Descriptions
              size="small"
              column={1}
              title="当前账号"
              items={[
                {
                  key: 'current-name',
                  label: '名称',
                  children: currentJimengAccount.screenName || currentJimengAccount.name || currentJimengAccount.userId || '-',
                },
                {
                  key: 'current-user-id',
                  label: 'User ID',
                  children: <Text code>{currentJimengAccount.userId || '-'}</Text>,
                },
                {
                  key: 'current-mobile',
                  label: '手机号',
                  children: currentJimengAccount.mobileMasked || '-',
                },
              ]}
            />
          ) : null}
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder="选择已保存的即梦账号快照"
            value={selectedJimengAccountId ?? undefined}
            options={jimengAccounts.map((account) => ({
              label: `${account.label} · ${(account.account?.screenName || account.account?.name || account.account?.userId || '未知账号')}`,
              value: account.id,
            }))}
            onChange={(value) => setSelectedJimengAccountId(value)}
          />
          {accountStatusMessage ? <Alert type="success" showIcon title={accountStatusMessage} /> : null}
          {accountError ? <Alert type="error" showIcon title={accountError} /> : null}
          <Space wrap>
            <Button disabled={!accountBundleText.trim()} onClick={() => void copyToClipboard(accountBundleText)}>
              复制快照 JSON
            </Button>
            <Button type="primary" loading={isAccountImporting} onClick={() => void importAccountSnapshot()}>
              导入并切换账号
            </Button>
          </Space>
          <Input.TextArea
            value={accountBundleText}
            placeholder="导出的即梦账号快照 JSON 会显示在这里；在另一台电脑粘贴进来后点击“导入并切换账号”。"
            autoSize={{ minRows: 6, maxRows: 16 }}
            onChange={(event) => setAccountBundleText(event.target.value)}
          />
        </Space>
        <Space wrap>
          <Button loading={isJimengModelLoading} onClick={() => void loadJimengModels()}>
            加载即梦图片模型
          </Button>
          {jimengModels.length > 0 ? <Tag color="success">已映射 {jimengModels.length} 个模型</Tag> : null}
        </Space>
        {jimengModelError ? <Alert type="error" showIcon title={jimengModelError} /> : null}
        {jimengModels.length > 0 ? (
          <>
            <Select
              style={{ width: '100%' }}
              value={selectedJimengModel?.id ?? undefined}
              options={jimengModels.map((item) => ({ label: item.name, value: item.id }))}
              onChange={(value) => setSelectedJimengModelId(value)}
            />
            {selectedJimengModel ? (
              <Descriptions
                size="small"
                column={1}
                title="模型映射"
                items={[
                  {
                    key: 'model-id',
                    label: '模型 ID',
                    children: <Text code>{selectedJimengModel.id}</Text>,
                  },
                  {
                    key: 'raw-id',
                    label: '原始模型 ID',
                    children: <Text code>{selectedJimengModel.rawId ?? ''}</Text>,
                  },
                  {
                    key: 'source',
                    label: '来源',
                    children: selectedJimengModel.sourceName ?? '-',
                  },
                  {
                    key: 'tags',
                    label: '标签',
                    children: (
                      <Space wrap>
                        {(selectedJimengModel.tags ?? []).map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </Space>
                    ),
                  },
                ]}
              />
            ) : null}
            {selectedJimengModel ? (
              <Descriptions
                size="small"
                column={1}
                title="参数映射"
                items={selectedJimengModel.params.map((param) => ({
                  key: param.key,
                  label: `${param.label} (${param.key})`,
                  children: (
                    <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {stringifyPayload({
                        type: param.type,
                        default: param.default,
                        min: param.min,
                        max: param.max,
                        options: param.options,
                      })}
                    </Text>
                  ),
                }))}
              />
            ) : null}
          </>
        ) : null}
        <Space wrap align="center">
          <Select<RequestPresetId>
            style={{ minWidth: 220 }}
            value={requestPresetId}
            options={REQUEST_PRESETS.map((item) => ({ label: item.label, value: item.id }))}
            onChange={handlePresetChange}
          />
          <Select value={requestMethod} options={[{ label: 'POST', value: 'POST' }]} style={{ width: 100 }} />
          <Button type="primary" icon={<ApiOutlined />} loading={isRequestLoading} onClick={() => void sendRequest()}>
            发送测试请求
          </Button>
        </Space>
        <Input
          value={requestPath}
          placeholder="/mweb/v1/get_settings"
          onChange={(event) => setRequestPath(event.target.value)}
        />
        <Input.TextArea
          value={requestBody}
          autoSize={{ minRows: 4, maxRows: 10 }}
          onChange={(event) => setRequestBody(event.target.value)}
        />
        {requestError ? <Alert type="error" showIcon title={requestError} /> : null}
        <Input.TextArea
          readOnly
          value={requestResult}
          placeholder="请求结果会显示在这里"
          autoSize={{ minRows: 8, maxRows: 20 }}
        />
      </Space>
    </Modal>
  )
}
