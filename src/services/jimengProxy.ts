export const DEFAULT_JIMENG_PROXY_BASE_URL = 'http://127.0.0.1:8787'
export const JIMENG_PROXY_BASE_URL_STORAGE_KEY = 'jimeng:proxy-base-url'

export interface JimengProxyStatus {
  ok: boolean
  browserRunning: boolean
  browserMode: 'interactive' | 'headless' | null
  pageUrl: string | null
  loginCheck: {
    loggedIn: boolean
    status: number
    payload: unknown
    snippet: string
  }
}

export interface JimengProxyResponse {
  ok: boolean
  proxy: {
    ok: boolean
    status: number
    statusText: string
    headers: Record<string, string>
    text: string
    json: unknown
    finalUrl: string
  }
}

export interface JimengProxyQrResponse {
  ok: boolean
  pageUrl: string
  qr: {
    imageSrc: string
    width: number
    height: number
  }
}

export interface JimengImageModelConfigResponse {
  ok: boolean
  proxy: {
    ok: boolean
    status: number
    statusText: string
    headers: Record<string, string>
    text: string
    json: unknown
    finalUrl: string
  }
}

export interface JimengGenerateImageResponse {
  ok: boolean
  clickInfo: {
    target: {
      index: number
      text: string
      x: number
      y: number
    }
  }
  request: {
    url: string
    method: string
    headers: Record<string, string>
    body: string | null
  }
  response: {
    ok: boolean
    status: number
    statusText: string
    url: string
    text: string
    json: unknown
  }
}

export interface JimengGeneratedAssetResponse {
  ok: boolean
  found: boolean
  state: 'pending' | 'success'
  historyId: string
  imageUrl: string | null
  imageUrls: string[]
  raw: unknown
}

export interface JimengAccountSnapshotSummary {
  id: string
  label: string
  exportedAt: string
  account: {
    userId: string
    screenName: string
    name: string
    mobileMasked: string
    avatarUrl: string
    secUserId: string
  } | null
}

export interface JimengAccountListResponse {
  ok: boolean
  current: JimengAccountSnapshotSummary['account']
  currentLoggedIn: boolean
  accounts: JimengAccountSnapshotSummary[]
  storageMode: {
    primary: string
    secondary: string[]
  }
}

export interface JimengExportAccountResponse {
  ok: boolean
  snapshot: unknown
}

export interface JimengImportAccountResponse {
  ok: boolean
  snapshot: JimengAccountSnapshotSummary
  filePath: string
  applied: {
    loggedIn: boolean
    payload: unknown
    account: JimengAccountSnapshotSummary['account']
  } | null
}

export interface JimengSaveCurrentAccountResponse {
  ok: boolean
  snapshot: JimengAccountSnapshotSummary
  filePath: string
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function buildUrl(baseUrl: string, endpoint: string): string {
  return `${normalizeBaseUrl(baseUrl)}${endpoint}`
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = JSON.parse(text)
  } catch {
    payload = { ok: false, error: text || `HTTP ${response.status}` }
  }
  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `HTTP ${response.status}`
    throw new Error(errorMessage)
  }
  return payload as T
}

export function loadJimengProxyBaseUrl(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_JIMENG_PROXY_BASE_URL
  }
  const stored = window.localStorage.getItem(JIMENG_PROXY_BASE_URL_STORAGE_KEY)?.trim()
  return stored || DEFAULT_JIMENG_PROXY_BASE_URL
}

export function saveJimengProxyBaseUrl(value: string): string {
  const normalized = normalizeBaseUrl(value) || DEFAULT_JIMENG_PROXY_BASE_URL
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(JIMENG_PROXY_BASE_URL_STORAGE_KEY, normalized)
  }
  return normalized
}

export async function getJimengProxyStatus(baseUrl: string): Promise<JimengProxyStatus> {
  return requestJson<JimengProxyStatus>(buildUrl(baseUrl, '/api/jimeng/status'))
}

export async function getJimengProxyLoginQr(baseUrl: string): Promise<JimengProxyQrResponse> {
  return requestJson<JimengProxyQrResponse>(buildUrl(baseUrl, '/api/jimeng/login/qr'))
}

export async function openJimengProxyLogin(baseUrl: string): Promise<{ ok: boolean; pageUrl: string; profileDir: string }> {
  return requestJson(buildUrl(baseUrl, '/api/jimeng/login/open'), {
    method: 'POST',
  })
}

export async function resetJimengProxyLogin(baseUrl: string): Promise<{ ok: boolean; reset: boolean }> {
  return requestJson(buildUrl(baseUrl, '/api/jimeng/login/reset'), {
    method: 'POST',
  })
}

export async function proxyJimengRequest(input: {
  baseUrl: string
  method: string
  path: string
  body?: unknown
  headers?: Record<string, string>
}): Promise<JimengProxyResponse> {
  return requestJson<JimengProxyResponse>(buildUrl(input.baseUrl, '/api/jimeng/proxy'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: input.method,
      path: input.path,
      body: input.body,
      headers: input.headers,
    }),
  })
}

export async function fetchJimengImageModelConfig(baseUrl: string): Promise<JimengImageModelConfigResponse> {
  return proxyJimengRequest({
    baseUrl,
    method: 'POST',
    path: '/mweb/v1/get_common_config?needCache=true&needRefresh=false&aid=513695&web_version=7.5.0&da_version=3.3.12&aigc_features=app_lip_sync',
    body: {},
  })
}

export async function generateJimengImage(input: {
  baseUrl: string
  prompt: string
  modelReqKey: string
  resolutionType: string
}): Promise<JimengGenerateImageResponse> {
  return requestJson<JimengGenerateImageResponse>(buildUrl(input.baseUrl, '/api/jimeng/generate-image'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: input.prompt,
      modelReqKey: input.modelReqKey,
      resolutionType: input.resolutionType,
    }),
  })
}

export async function getJimengGeneratedAsset(input: {
  baseUrl: string
  historyId: string
  resolutionType: string
}): Promise<JimengGeneratedAssetResponse> {
  return requestJson<JimengGeneratedAssetResponse>(buildUrl(input.baseUrl, '/api/jimeng/generated-asset'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      historyId: input.historyId,
      resolutionType: input.resolutionType,
    }),
  })
}

export async function listJimengAccounts(baseUrl: string): Promise<JimengAccountListResponse> {
  return requestJson<JimengAccountListResponse>(buildUrl(baseUrl, '/api/jimeng/accounts'))
}

export async function saveCurrentJimengAccount(input: {
  baseUrl: string
  label?: string
}): Promise<JimengSaveCurrentAccountResponse> {
  return requestJson<JimengSaveCurrentAccountResponse>(buildUrl(input.baseUrl, '/api/jimeng/account/save-current'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      label: input.label,
    }),
  })
}

export async function exportJimengAccount(input: {
  baseUrl: string
  accountId?: string
  label?: string
}): Promise<JimengExportAccountResponse> {
  return requestJson<JimengExportAccountResponse>(buildUrl(input.baseUrl, '/api/jimeng/account/export'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountId: input.accountId,
      label: input.label,
    }),
  })
}

export async function importJimengAccount(input: {
  baseUrl: string
  snapshot: string
  label?: string
  activate?: boolean
}): Promise<JimengImportAccountResponse> {
  return requestJson<JimengImportAccountResponse>(buildUrl(input.baseUrl, '/api/jimeng/account/import'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snapshot: input.snapshot,
      label: input.label,
      activate: input.activate,
    }),
  })
}

export async function switchJimengAccount(input: {
  baseUrl: string
  accountId: string
}): Promise<JimengImportAccountResponse> {
  return requestJson<JimengImportAccountResponse>(buildUrl(input.baseUrl, '/api/jimeng/account/switch'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountId: input.accountId,
    }),
  })
}

export async function deleteJimengAccount(input: {
  baseUrl: string
  accountId: string
}): Promise<{ ok: boolean; deleted: string }> {
  return requestJson(buildUrl(input.baseUrl, '/api/jimeng/account/delete'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountId: input.accountId,
    }),
  })
}
