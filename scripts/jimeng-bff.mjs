import http from 'node:http'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'

const PORT = Number(process.env.JIMENG_BFF_PORT || 8787)
const SESSION_ROOT = path.join(os.homedir(), '.jimeng-bff')
const PROFILE_DIR = path.join(SESSION_ROOT, 'profile')
const ACCOUNTS_DIR = path.join(SESSION_ROOT, 'accounts')
const JIMENG_ORIGIN = 'https://jimeng.jianying.com'
const JIMENG_GENERATE_URL = `${JIMENG_ORIGIN}/ai-tool/generate?workspace=0`
const JIMENG_IMAGE_GENERATE_URL = `${JIMENG_ORIGIN}/ai-tool/generate?workspace=0&type=image`
const JIMENG_HOME_URL = `${JIMENG_ORIGIN}/ai-tool/home`
const JIMENG_QR_LOGIN_URL =
  'https://open.douyin.com/platform/oauth/connect?client_key=aw97st49sighch6k&response_type=code&scope=user_info&state=71c0ab1f3gAToVCgoVPZIDhhNGQ3ODEzNDA0ZGU5OWNlOThhOGIwMWU1YWFhN2I0oU7ZOGh0dHBzOi8vamltZW5nLmppYW55aW5nLmNvbS9haS10b29sL3RoaXJkLXBhcnR5LWNhbGxiYWNroVYBoUkAoUQAoUHSAAfWn6FNAKFIs2ppbWVuZy5qaWFueWluZy5jb22hUgKiUEzROl6mQUNUSU9OoKFM2ShodHRwczovL2ppbWVuZy5jb20vYWktdG9vbC9ob21loVTZIDAzMzc2OTZkZjE2MjQzMzlmOGMxMzNkMTljMTJlOGVioVcAoUYAolNBAKFVwqJNTMI%3D&redirect_uri=https://jimeng.jianying.com/passport/web/web_login_success'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}

let browserContext = null
let browserMode = null
let browserContextLaunchPromise = null

const JIMENG_DEFAULT_WEB_ID = '7622897301057193491'
const JIMENG_WEB_VERSION = '7.5.0'
const JIMENG_DA_VERSION = '3.3.12'
const JIMENG_AIGC_FEATURES = 'app_lip_sync'

const JIMENG_IMAGE_SCENE_SIZES = [2400, 1080, 900, 720, 480, 360]
const JIMENG_SESSION_SNAPSHOT_VERSION = 1

function detectChromeExecutable() {
  const candidates = [
    process.env.JIMENG_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)

  return candidates.find((candidate) => Boolean(candidate) && existsSync(candidate)) ?? null
}

async function ensureSessionRoot() {
  await fs.mkdir(SESSION_ROOT, { recursive: true })
}

async function ensureAccountsDir() {
  await ensureSessionRoot()
  await fs.mkdir(ACCOUNTS_DIR, { recursive: true })
}

async function closeBrowserContext({ resetProfile = false } = {}) {
  if (browserContext) {
    await browserContext.close().catch(() => {})
    browserContext = null
    browserMode = null
  }
  if (resetProfile) {
    await fs.rm(PROFILE_DIR, { recursive: true, force: true }).catch(() => {})
  }
}

async function ensureBrowserContext({ headless }) {
  if (browserContextLaunchPromise) {
    await browserContextLaunchPromise
  }

  if (browserContext && browserMode === headless) {
    return browserContext
  }

  browserContextLaunchPromise = (async () => {
    if (browserContext && browserMode === headless) {
      return browserContext
    }

    if (browserContext) {
      await closeBrowserContext()
    }

    const executablePath = detectChromeExecutable()
    if (!executablePath) {
      throw new Error('未找到本机 Chrome，可通过 JIMENG_CHROME_PATH 指定浏览器路径。')
    }

    await ensureSessionRoot()
    browserContext = await chromium.launchPersistentContext(PROFILE_DIR, {
      executablePath,
      headless,
      args: headless ? [] : ['--new-window'],
    })
    browserMode = headless
    browserContext.on('close', () => {
      browserContext = null
      browserMode = null
    })
    return browserContext
  })()

  try {
    return await browserContextLaunchPromise
  } finally {
    browserContextLaunchPromise = null
  }
}

async function getPrimaryPage({ headless, targetUrl }) {
  const context = await ensureBrowserContext({ headless })
  const page = context.pages()[0] ?? await context.newPage()
  if (targetUrl) {
    const current = page.url()
    if (current !== targetUrl) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    }
  }
  return page
}

async function createWorkingPage({ headless, targetUrl }) {
  const context = await ensureBrowserContext({ headless })
  const page = await context.newPage()
  if (targetUrl) {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  }
  return page
}

async function ensureJimengPage({ headless }) {
  const page = await getPrimaryPage({ headless, targetUrl: JIMENG_GENERATE_URL })
  if (!page.url().startsWith(JIMENG_ORIGIN)) {
    await page.goto(JIMENG_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  }
  return page
}

async function ensureJimengImagePage({ headless }) {
  const page = await getPrimaryPage({ headless, targetUrl: JIMENG_IMAGE_GENERATE_URL })
  if (!page.url().startsWith(JIMENG_ORIGIN)) {
    await page.goto(JIMENG_IMAGE_GENERATE_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  }
  return page
}

async function tryClickLoginTrigger(page, targetUrl) {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(3_000)

  const startedAt = Date.now()
  while (Date.now() - startedAt < 20_000) {
    const clicked = await page.evaluate(() => {
      const selectors = [
        '.login-button-zpRsZb',
        '[class*="login-button"]',
        'button',
        'a',
        'div',
        'span',
      ]

      const nodes = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      const candidates = nodes.filter((element) => {
        if (!(element instanceof HTMLElement)) {
          return false
        }
        const text = (element.textContent || '').trim()
        const className = element.className || ''
        const rect = element.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) {
          return false
        }
        return (
          text === '登录'
          || text.includes('登录')
          || (typeof className === 'string' && className.includes('login-button'))
        )
      })

      const target = candidates[0]
      if (!target || !(target instanceof HTMLElement)) {
        return false
      }

      target.click()
      return true
    })

    if (clicked) {
      await page.waitForTimeout(2_000)
      return true
    }

    await page.waitForTimeout(1_000)
  }

  return false
}

async function openJimengHomeLoginModal(page) {
  for (const targetUrl of [JIMENG_HOME_URL, JIMENG_GENERATE_URL]) {
    const clicked = await tryClickLoginTrigger(page, targetUrl)
    if (clicked) {
      return
    }
  }

  throw new Error('未找到即梦首页登录按钮')
}

async function clickConsentIfNeeded(page) {
  try {
    const locator = page.locator('text=同意').last()
    if (await locator.count()) {
      await locator.click({ timeout: 3_000 })
      await page.waitForTimeout(1_500)
      return true
    }
  } catch {
    return false
  }
  return false
}

async function extractCurrentLoginQr(page) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 20_000) {
    const qr = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'))
        .map((image) => ({
          src: image.getAttribute('src') || '',
          width: image.clientWidth,
          height: image.clientHeight,
        }))
        .filter((item) => item.src.startsWith('data:image/'))
        .sort((left, right) => (right.width * right.height) - (left.width * left.height))

      const target = images.find((item) => item.width >= 120 && item.height >= 120)
      return target ?? null
    })

    if (qr?.src) {
      return {
        imageSrc: qr.src,
        width: qr.width,
        height: qr.height,
      }
    }

    await page.waitForTimeout(1_000)
  }

  throw new Error('未找到登录二维码')
}

async function openDouyinLoginPopup(page) {
  const context = page.context()
  const popupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null)

  await openJimengHomeLoginModal(page)
  await clickConsentIfNeeded(page)

  const popup = await popupPromise
  if (popup) {
    await popup.waitForLoadState('domcontentloaded', { timeout: 90_000 }).catch(() => {})
    await popup.waitForTimeout(3_000)
    return popup
  }

  await clickConsentIfNeeded(page)
  const secondPopupPromise = context.waitForEvent('page', { timeout: 10_000 }).catch(() => null)
  await openJimengHomeLoginModal(page)
  const secondPopup = await secondPopupPromise
  if (!secondPopup) {
    throw new Error('未捕获到抖音登录弹窗')
  }
  await secondPopup.waitForLoadState('domcontentloaded', { timeout: 90_000 }).catch(() => {})
  await secondPopup.waitForTimeout(3_000)
  return secondPopup
}

async function parseBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload, null, 2))
}

function toAbsoluteJimengUrl(inputPath) {
  if (typeof inputPath !== 'string' || !inputPath.trim()) {
    throw new Error('缺少 path')
  }
  const trimmed = inputPath.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed)
    if (!url.hostname.endsWith('jianying.com')) {
      throw new Error('仅允许代理到 jianying.com 域名')
    }
    return url.toString()
  }
  return new URL(trimmed, JIMENG_ORIGIN).toString()
}

function toCamelCase(value) {
  return value.replace(/_([a-z])/g, (_, char) => char.toUpperCase())
}

function camelizeKeys(value) {
  if (Array.isArray(value)) {
    return value.map((item) => camelizeKeys(item))
  }
  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [toCamelCase(key), camelizeKeys(item)]),
  )
}

function buildImageSceneList() {
  return JIMENG_IMAGE_SCENE_SIZES.map((size) => ({
    scene: size === 2400 ? 'normal' : 'loss',
    width: size,
    height: size,
    uniq_key: String(size),
    format: 'webp',
  }))
}

function resolveImageSize(resolutionType) {
  const normalized = typeof resolutionType === 'string' ? resolutionType.trim().toLowerCase() : '2k'
  if (normalized === '4k') {
    return { width: 4096, height: 4096, resolutionType: '4k' }
  }
  return { width: 2048, height: 2048, resolutionType: '2k' }
}

function buildAssetListRequestBody(resolutionType) {
  const { width, height } = resolveImageSize(resolutionType)
  const imageSceneList = buildImageSceneList()

  return {
    count: 20,
    direction: 1,
    mode: 'workbench',
    option: {
      image_info: {
        width,
        height,
        format: 'webp',
        image_scene_list: imageSceneList,
      },
      origin_image_info: {
        width: 96,
        height,
        format: 'webp',
        image_scene_list: imageSceneList,
      },
      order_by: 0,
      only_favorited: false,
      end_time_stamp: 0,
      hide_story_agent_result: true,
    },
    asset_type_list: [1, 2, 5, 6, 7, 8, 9, 10],
    workspace_id: 0,
  }
}

function safeSnapshotLabel(value, fallback = 'jimeng-account') {
  const normalized = typeof value === 'string' ? value.trim() : ''
  const candidate = (normalized || fallback)
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return candidate || fallback
}

function buildSnapshotFileName(input) {
  const label = safeSnapshotLabel(input.label, 'jimeng-account')
  return `${input.id}-${label}.json`
}

function toSnapshotFilePath(input) {
  return path.join(ACCOUNTS_DIR, buildSnapshotFileName(input))
}

function parseSnapshotListItem(snapshot) {
  return {
    id: snapshot.id,
    label: snapshot.label,
    exportedAt: snapshot.exportedAt,
    account: snapshot.account,
  }
}

async function runFetchInPage(page, request) {
  return page.evaluate(async (input) => {
    const headers = { ...(input.headers || {}) }
    let body
    if (input.body !== undefined && input.body !== null) {
      if (typeof input.body === 'string') {
        body = input.body
      } else {
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json'
        }
        body = JSON.stringify(input.body)
      }
    }

    const response = await fetch(input.url, {
      method: input.method,
      credentials: 'include',
      headers,
      body,
    })
    const text = await response.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      text,
      json,
      finalUrl: response.url,
    }
  }, request)
}

async function getJimengAccountSummary(page) {
  const result = await runFetchInPage(page, {
    method: 'GET',
    url: `${JIMENG_ORIGIN}/passport/account/info/v2/?aid=513695&account_sdk_source=web&sdk_version=2.2.6`,
  })

  const payload = result.json && typeof result.json === 'object' ? result.json : null
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : null
  return {
    loggedIn: payload?.message === 'success',
    payload,
    account: data ? {
      userId: typeof data.user_id_str === 'string' ? data.user_id_str : typeof data.user_id === 'number' ? String(data.user_id) : '',
      screenName: typeof data.screen_name === 'string' ? data.screen_name : '',
      name: typeof data.name === 'string' ? data.name : '',
      mobileMasked: typeof data.mobile === 'string' ? data.mobile : '',
      avatarUrl: typeof data.avatar_url === 'string' ? data.avatar_url : '',
      secUserId: typeof data.sec_user_id === 'string' ? data.sec_user_id : '',
    } : null,
  }
}

async function readJimengWebStorage(page) {
  return page.evaluate(() => ({
    localStorage: Object.fromEntries(Object.keys(window.localStorage).map((key) => [key, window.localStorage.getItem(key)])),
    sessionStorage: Object.fromEntries(Object.keys(window.sessionStorage).map((key) => [key, window.sessionStorage.getItem(key)])),
  }))
}

async function captureJimengSessionSnapshot({ label } = {}) {
  const page = await createWorkingPage({ headless: true, targetUrl: JIMENG_IMAGE_GENERATE_URL })
  try {
    const context = page.context()
    const [accountSummary, storage, cookies] = await Promise.all([
      getJimengAccountSummary(page),
      readJimengWebStorage(page),
      context.cookies(),
    ])

    if (!accountSummary.loggedIn || !accountSummary.account?.userId) {
      throw new Error('当前即梦未登录，无法导出账号快照。')
    }

    const snapshotId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const resolvedLabel = label?.trim() || accountSummary.account.screenName || accountSummary.account.name || accountSummary.account.userId

    return {
      version: JIMENG_SESSION_SNAPSHOT_VERSION,
      id: snapshotId,
      label: resolvedLabel,
      exportedAt: new Date().toISOString(),
      account: accountSummary.account,
      session: {
        cookies: cookies.filter((cookie) => cookie.domain.includes('jianying.com')),
        localStorage: storage.localStorage,
        sessionStorage: storage.sessionStorage,
      },
    }
  } finally {
    await page.close().catch(() => {})
  }
}

async function writeJimengSessionSnapshot(snapshot) {
  await ensureAccountsDir()
  const filePath = toSnapshotFilePath(snapshot)
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8')
  return filePath
}

async function readJimengSessionSnapshotById(snapshotId) {
  await ensureAccountsDir()
  const files = await fs.readdir(ACCOUNTS_DIR)
  const target = files.find((fileName) => fileName.startsWith(`${snapshotId}-`) && fileName.endsWith('.json'))
  if (!target) {
    throw new Error('未找到指定的即梦账号快照')
  }
  const raw = await fs.readFile(path.join(ACCOUNTS_DIR, target), 'utf8')
  return JSON.parse(raw)
}

async function listJimengSessionSnapshots() {
  await ensureAccountsDir()
  const files = await fs.readdir(ACCOUNTS_DIR)
  const snapshots = []
  for (const fileName of files) {
    if (!fileName.endsWith('.json')) {
      continue
    }
    try {
      const raw = await fs.readFile(path.join(ACCOUNTS_DIR, fileName), 'utf8')
      const parsed = JSON.parse(raw)
      snapshots.push(parseSnapshotListItem(parsed))
    } catch {
      // Ignore invalid snapshot files.
    }
  }
  snapshots.sort((left, right) => String(right.exportedAt).localeCompare(String(left.exportedAt)))
  return snapshots
}

async function applyJimengSessionSnapshot(snapshot) {
  await closeBrowserContext({ resetProfile: true })
  const context = await ensureBrowserContext({ headless: true })

  const cookies = Array.isArray(snapshot?.session?.cookies) ? snapshot.session.cookies : []
  if (cookies.length > 0) {
    await context.addCookies(cookies)
  }

  const page = await context.newPage()
  try {
    await page.goto(JIMENG_IMAGE_GENERATE_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.evaluate(({ localStorageData, sessionStorageData }) => {
      window.localStorage.clear()
      window.sessionStorage.clear()
      for (const [key, value] of Object.entries(localStorageData || {})) {
        if (typeof value === 'string') {
          window.localStorage.setItem(key, value)
        }
      }
      for (const [key, value] of Object.entries(sessionStorageData || {})) {
        if (typeof value === 'string') {
          window.sessionStorage.setItem(key, value)
        }
      }
    }, {
      localStorageData: snapshot?.session?.localStorage ?? {},
      sessionStorageData: snapshot?.session?.sessionStorage ?? {},
    })

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForTimeout(1_500)
    return await getJimengAccountSummary(page)
  } finally {
    await page.close().catch(() => {})
  }
}

async function fetchJimengImageModelConfig(page) {
  const response = await runFetchInPage(page, {
    method: 'POST',
    url: `${JIMENG_ORIGIN}/mweb/v1/get_common_config?needCache=true&needRefresh=false&aid=513695&web_version=${JIMENG_WEB_VERSION}&da_version=${JIMENG_DA_VERSION}&aigc_features=${JIMENG_AIGC_FEATURES}`,
    body: {},
  })

  if (!response.ok || !response.json || response.json.ret !== '0') {
    throw new Error('无法读取即梦图片模型配置')
  }

  return response.json
}

async function applyImageGenerationPreferences(page, {
  modelReqKey,
  resolutionType,
}) {
  const config = await fetchJimengImageModelConfig(page)
  const modelList = Array.isArray(config?.data?.model_list) ? config.data.model_list : []
  const selectedModel = modelList.find((item) => item?.model_req_key === modelReqKey) ?? modelList[0] ?? null

  if (!selectedModel) {
    throw new Error('未找到可用的即梦图片模型')
  }

  const size = resolveImageSize(resolutionType)
  await page.evaluate(({ model, size }) => {
    window.localStorage.setItem(
      'dreamina__generator_image__selectedImageModel',
      JSON.stringify(model),
    )
    window.localStorage.setItem(
      'dreamina__generator_image_largeImageInfo',
      JSON.stringify(size),
    )
    window.localStorage.setItem('dreamina__generator_image_isLockRatio', 'false')
    window.localStorage.removeItem('dreamina__generator_image_aspectRatio')
  }, {
    model: camelizeKeys(selectedModel),
    size,
  })
}

async function triggerImageGenerateFromPage(page, prompt) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/mweb/v1/aigc_draft/generate') && response.request().method() === 'POST',
    { timeout: 30_000 },
  ).then((response) => ({ response })).catch((error) => ({ error }))

  const clickInfo = await page.evaluate(async (inputPrompt) => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false
      }
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }

    const cleanupBlockingLayers = () => {
      document
        .querySelectorAll('[class*="dialog-wrapper"], .lv-modal-wrapper, .lv-modal-mask, [class*="modal-mask"]')
        .forEach((element) => element.remove())
    }

    const clickImageModeIfNeeded = () => {
      const bodyText = document.body.innerText || ''
      if (!bodyText.includes('图片生成')) {
        return
      }
      const trigger = Array.from(document.querySelectorAll('button, [role="tab"], div, span'))
        .find((element) => element instanceof HTMLElement && isVisible(element) && (element.textContent || '').trim() === '图片生成')
      if (trigger instanceof HTMLElement) {
        trigger.click()
      }
    }

    const findEditorEntry = () => {
      const selectors = [
        'div.tiptap.ProseMirror[contenteditable="true"]',
        'div.ProseMirror[contenteditable="true"]',
        '[contenteditable="true"]',
      ]
      const candidates = selectors
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .filter((element) => element instanceof HTMLElement && isVisible(element))
        .map((element) => ({
          element,
          rect: element.getBoundingClientRect(),
          text: (element.textContent || '').trim(),
        }))
        .filter((item) => item.element.tagName !== 'INPUT' && item.element.tagName !== 'TEXTAREA')
        .sort((left, right) => (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height))

      return candidates[0] ?? null
    }

    let editorEntry = null
    const startedAt = Date.now()
    while (!editorEntry && Date.now() - startedAt < 20_000) {
      cleanupBlockingLayers()
      clickImageModeIfNeeded()
      editorEntry = findEditorEntry()
      if (!editorEntry) {
        await new Promise((resolve) => window.setTimeout(resolve, 500))
      }
    }

    if (!editorEntry) {
      const debugCandidates = Array.from(document.querySelectorAll('[contenteditable="true"], [role="textbox"]'))
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            tag: element.tagName,
            className: element.className,
            text: (element.textContent || '').trim().slice(0, 80),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          }
        })
      throw new Error(`未找到即梦图片输入框: ${JSON.stringify({
        href: location.href,
        body: (document.body.innerText || '').slice(0, 500),
        candidates: debugCandidates,
      })}`)
    }

    const editor = editorEntry.element
    editor.innerHTML = `<p>${inputPrompt}</p>`
    editor.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: inputPrompt,
    }))
    editor.dispatchEvent(new Event('change', { bubbles: true }))
    editor.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'g' }))

    await new Promise((resolve) => window.setTimeout(resolve, 1_500))

    const buttons = Array.from(document.querySelectorAll('button'))
      .map((element, index) => {
        const rect = element.getBoundingClientRect()
        return {
          element,
          index,
          text: (element.textContent || '').trim(),
          disabled: element.hasAttribute('disabled'),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        }
      })
      .filter((item) => item.width > 0 && item.height > 0)

    const target = buttons
      .filter((item) => !item.disabled)
      .sort((left, right) => {
        if (right.y !== left.y) {
          return right.y - left.y
        }
        return right.x - left.x
      })[0]
    if (!target) {
      throw new Error(`未找到即梦发送按钮: ${JSON.stringify(buttons.map(({ element, ...rest }) => rest))}`)
    }

    target.element.click()
    return {
      target: {
        index: target.index,
        text: target.text,
        x: target.x,
        y: target.y,
      },
    }
  }, prompt)

  const responseResult = await responsePromise
  if (responseResult.error) {
    throw responseResult.error
  }

  const { response } = responseResult
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }

  return {
    clickInfo,
    request: {
      url: response.request().url(),
      method: response.request().method(),
      headers: response.request().headers(),
      body: response.request().postData(),
    },
    response: {
      ok: response.ok(),
      status: response.status(),
      statusText: response.statusText(),
      url: response.url(),
      text,
      json,
    },
  }
}

async function handleGenerateImage(body) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    throw new Error('缺少 prompt')
  }

  const modelReqKey = typeof body?.modelReqKey === 'string' && body.modelReqKey.trim()
    ? body.modelReqKey.trim()
    : 'high_aes_general_v50'
  const resolutionType = typeof body?.resolutionType === 'string' && body.resolutionType.trim()
    ? body.resolutionType.trim()
    : '2k'

  const page = await createWorkingPage({ headless: true, targetUrl: JIMENG_IMAGE_GENERATE_URL })
  try {
    await applyImageGenerationPreferences(page, {
      modelReqKey,
      resolutionType,
    })
    await page.goto(JIMENG_IMAGE_GENERATE_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForTimeout(5_000)

    const result = await triggerImageGenerateFromPage(page, prompt)
    return {
      ok: true,
      ...result,
    }
  } finally {
    await page.close().catch(() => {})
  }
}

async function handleGeneratedAsset(body) {
  const historyId = typeof body?.historyId === 'string' ? body.historyId.trim() : ''
  if (!historyId) {
    throw new Error('缺少 historyId')
  }

  const resolutionType = typeof body?.resolutionType === 'string' && body.resolutionType.trim()
    ? body.resolutionType.trim()
    : '2k'

  const page = await createWorkingPage({ headless: true, targetUrl: JIMENG_IMAGE_GENERATE_URL })
  try {
    const response = await runFetchInPage(page, {
      method: 'POST',
      url: `${JIMENG_ORIGIN}/mweb/v1/get_asset_list?aid=513695&web_version=${JIMENG_WEB_VERSION}&da_version=${JIMENG_DA_VERSION}&aigc_features=${JIMENG_AIGC_FEATURES}`,
      body: buildAssetListRequestBody(resolutionType),
    })

    const assetList = Array.isArray(response.json?.data?.asset_list) ? response.json.data.asset_list : []
    const matched = assetList.find((item) => item?.image?.history_record_id === historyId) ?? null
    const generatedItems = Array.isArray(matched?.image?.item_list) ? matched.image.item_list : []
    const imageUrls = generatedItems
      .map((item) => item?.image?.large_images?.[0]?.image_url)
      .filter((item) => typeof item === 'string' && item.trim())
    const imageUrl = imageUrls[0] ?? null

    return {
      ok: true,
      found: Boolean(matched),
      state: imageUrl ? 'success' : 'pending',
      historyId,
      imageUrl,
      imageUrls,
      raw: matched,
    }
  } finally {
    await page.close().catch(() => {})
  }
}

async function handleAccountList() {
  const page = await createWorkingPage({ headless: true, targetUrl: JIMENG_GENERATE_URL })
  try {
    const current = await getJimengAccountSummary(page)
    const snapshots = await listJimengSessionSnapshots()
    return {
      ok: true,
      current: current.account,
      currentLoggedIn: current.loggedIn,
      accounts: snapshots,
      storageMode: {
        primary: 'cookies',
        secondary: ['localStorage', 'sessionStorage'],
      },
    }
  } finally {
    await page.close().catch(() => {})
  }
}

async function handleSaveCurrentAccount(body) {
  const snapshot = await captureJimengSessionSnapshot({
    label: typeof body?.label === 'string' ? body.label : '',
  })
  const filePath = await writeJimengSessionSnapshot(snapshot)
  return {
    ok: true,
    snapshot: parseSnapshotListItem(snapshot),
    filePath,
  }
}

async function handleExportAccount(body) {
  if (typeof body?.accountId === 'string' && body.accountId.trim()) {
    const snapshot = await readJimengSessionSnapshotById(body.accountId.trim())
    return {
      ok: true,
      snapshot,
    }
  }

  const snapshot = await captureJimengSessionSnapshot({
    label: typeof body?.label === 'string' ? body.label : '',
  })
  return {
    ok: true,
    snapshot,
  }
}

async function handleImportAccount(body) {
  const rawSnapshot = body?.snapshot
  const snapshot = typeof rawSnapshot === 'string' ? JSON.parse(rawSnapshot) : rawSnapshot
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.session) {
    throw new Error('账号快照格式无效')
  }

  const normalizedSnapshot = {
    ...snapshot,
    id: typeof snapshot.id === 'string' && snapshot.id.trim() ? snapshot.id.trim() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: typeof body?.label === 'string' && body.label.trim()
      ? body.label.trim()
      : (typeof snapshot.label === 'string' && snapshot.label.trim() ? snapshot.label.trim() : 'jimeng-account'),
    exportedAt: typeof snapshot.exportedAt === 'string' && snapshot.exportedAt.trim() ? snapshot.exportedAt : new Date().toISOString(),
  }

  const filePath = await writeJimengSessionSnapshot(normalizedSnapshot)
  const activate = body?.activate !== false
  const applied = activate ? await applyJimengSessionSnapshot(normalizedSnapshot) : null

  return {
    ok: true,
    snapshot: parseSnapshotListItem(normalizedSnapshot),
    filePath,
    applied,
  }
}

async function handleSwitchAccount(body) {
  const accountId = typeof body?.accountId === 'string' ? body.accountId.trim() : ''
  if (!accountId) {
    throw new Error('缺少 accountId')
  }

  const snapshot = await readJimengSessionSnapshotById(accountId)
  const applied = await applyJimengSessionSnapshot(snapshot)
  return {
    ok: true,
    snapshot: parseSnapshotListItem(snapshot),
    applied,
  }
}

async function handleDeleteAccount(body) {
  const accountId = typeof body?.accountId === 'string' ? body.accountId.trim() : ''
  if (!accountId) {
    throw new Error('缺少 accountId')
  }

  await ensureAccountsDir()
  const files = await fs.readdir(ACCOUNTS_DIR)
  const target = files.find((fileName) => fileName.startsWith(`${accountId}-`) && fileName.endsWith('.json'))
  if (!target) {
    throw new Error('未找到指定的即梦账号快照')
  }

  await fs.rm(path.join(ACCOUNTS_DIR, target), { force: true })
  return {
    ok: true,
    deleted: accountId,
  }
}

async function readLoginStatus() {
  const page = await createWorkingPage({ headless: true, targetUrl: JIMENG_GENERATE_URL })
  try {
    const result = await runFetchInPage(page, {
      url: `${JIMENG_ORIGIN}/passport/account/info/v2/?aid=513695&account_sdk_source=web&sdk_version=2.2.6`,
      method: 'GET',
    })

    const payload = result.json && typeof result.json === 'object' ? result.json : null
    const errorCode = payload?.data?.error_code
    const loggedIn = payload?.message === 'success' || (typeof errorCode === 'number' && errorCode !== 13) || errorCode === 0

    return {
      browserRunning: Boolean(browserContext),
      browserMode: browserMode === null ? null : browserMode ? 'headless' : 'interactive',
      pageUrl: page.url(),
      loginCheck: {
        loggedIn,
        status: result.status,
        payload,
        snippet: result.text.slice(0, 600),
      },
    }
  } finally {
    await page.close().catch(() => {})
  }
}

async function handleLoginOpen() {
  let lastError = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await closeBrowserContext({ resetProfile: true })
      const page = await getPrimaryPage({ headless: false, targetUrl: JIMENG_HOME_URL })
      const popup = await openDouyinLoginPopup(page)
      return {
        ok: true,
        pageUrl: popup.url(),
        profileDir: PROFILE_DIR,
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('无法打开即梦登录窗口')
}

async function handleLoginQr() {
  let lastError = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await closeBrowserContext({ resetProfile: true })
      const page = await getPrimaryPage({ headless: true, targetUrl: JIMENG_HOME_URL })
      const popup = await openDouyinLoginPopup(page)
      const qr = await extractCurrentLoginQr(popup)
      return {
        ok: true,
        pageUrl: popup.url(),
        qr,
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('无法获取即梦动态二维码')
}

async function handleProxy(body) {
  const method = typeof body?.method === 'string' ? body.method.toUpperCase() : 'GET'
  const url = toAbsoluteJimengUrl(body?.path)
  const headers = body?.headers && typeof body.headers === 'object' ? body.headers : {}
  const page = await createWorkingPage({ headless: true, targetUrl: JIMENG_GENERATE_URL })
  try {
    return await runFetchInPage(page, {
      method,
      url,
      headers,
      body: body?.body ?? null,
    })
  } finally {
    await page.close().catch(() => {})
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { ok: false, error: 'missing_url' })
    return
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()
    return
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'jimeng-bff' })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/jimeng/qr-url') {
      sendJson(res, 200, { ok: true, url: JIMENG_QR_LOGIN_URL })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/jimeng/login/qr') {
      const payload = await handleLoginQr()
      sendJson(res, 200, payload)
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/jimeng/status') {
      const status = await readLoginStatus()
      sendJson(res, 200, { ok: true, ...status })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/jimeng/accounts') {
      const payload = await handleAccountList()
      sendJson(res, 200, payload)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/jimeng/login/open') {
      const payload = await handleLoginOpen()
      sendJson(res, 200, payload)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/jimeng/login/reset') {
      await closeBrowserContext({ resetProfile: true })
      sendJson(res, 200, { ok: true, reset: true })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/jimeng/account/save-current') {
      const body = await parseBody(req)
      const payload = await handleSaveCurrentAccount(body)
      sendJson(res, 200, payload)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/jimeng/account/export') {
      const body = await parseBody(req)
      const payload = await handleExportAccount(body)
      sendJson(res, 200, payload)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/jimeng/account/import') {
      const body = await parseBody(req)
      const payload = await handleImportAccount(body)
      sendJson(res, 200, payload)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/jimeng/account/switch') {
      const body = await parseBody(req)
      const payload = await handleSwitchAccount(body)
      sendJson(res, 200, payload)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/jimeng/account/delete') {
      const body = await parseBody(req)
      const payload = await handleDeleteAccount(body)
      sendJson(res, 200, payload)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/jimeng/generate-image') {
      const body = await parseBody(req)
      const payload = await handleGenerateImage(body)
      sendJson(res, 200, payload)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/jimeng/generated-asset') {
      const body = await parseBody(req)
      const payload = await handleGeneratedAsset(body)
      sendJson(res, 200, payload)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/jimeng/proxy') {
      const body = await parseBody(req)
      const payload = await handleProxy(body)
      sendJson(res, 200, { ok: true, proxy: payload })
      return
    }

    sendJson(res, 404, { ok: false, error: 'not_found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    sendJson(res, 500, { ok: false, error: message })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[jimeng-bff] listening on http://127.0.0.1:${PORT}`)
  console.log('[jimeng-bff] endpoints:')
  console.log('  GET  /health')
  console.log('  GET  /api/jimeng/login/qr')
  console.log('  GET  /api/jimeng/status')
  console.log('  GET  /api/jimeng/accounts')
  console.log('  GET  /api/jimeng/qr-url')
  console.log('  POST /api/jimeng/login/open')
  console.log('  POST /api/jimeng/login/reset')
  console.log('  POST /api/jimeng/account/save-current')
  console.log('  POST /api/jimeng/account/export')
  console.log('  POST /api/jimeng/account/import')
  console.log('  POST /api/jimeng/account/switch')
  console.log('  POST /api/jimeng/account/delete')
  console.log('  POST /api/jimeng/generate-image')
  console.log('  POST /api/jimeng/generated-asset')
  console.log('  POST /api/jimeng/proxy')
})

process.on('SIGINT', async () => {
  await closeBrowserContext()
  server.close(() => process.exit(0))
})

process.on('SIGTERM', async () => {
  await closeBrowserContext()
  server.close(() => process.exit(0))
})
