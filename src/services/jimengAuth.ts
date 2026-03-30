export const JIMENG_QR_LOGIN_URL =
  'https://open.douyin.com/platform/oauth/connect?client_key=aw97st49sighch6k&response_type=code&scope=user_info&state=71c0ab1f3gAToVCgoVPZIDhhNGQ3ODEzNDA0ZGU5OWNlOThhOGIwMWU1YWFhN2I0oU7ZOGh0dHBzOi8vamltZW5nLmppYW55aW5nLmNvbS9haS10b29sL3RoaXJkLXBhcnR5LWNhbGxiYWNroVYBoUkAoUQAoUHSAAfWn6FNAKFIs2ppbWVuZy5qaWFueWluZy5jb22hUgKiUEzROl6mQUNUSU9OoKFM2ShodHRwczovL2ppbWVuZy5jb20vYWktdG9vbC9ob21loVTZIDAzMzc2OTZkZjE2MjQzMzlmOGMxMzNkMTljMTJlOGVioVcAoUYAolNBAKFVwqJNTMI%3D&redirect_uri=https://jimeng.jianying.com/passport/web/web_login_success'

export const JIMENG_HOME_URL = 'https://jimeng.jianying.com/ai-tool/home'
export const JIMENG_QR_LOGIN_WINDOW_NAME = 'jimeng-qr-login'

type PopupWindowTarget = Pick<Window, 'open' | 'screen'>

export function buildJimengQrLoginWindowFeatures(targetWindow: Pick<Window, 'screen'> | undefined): string {
  const width = 540
  const height = 760
  const screenWidth = targetWindow?.screen?.width ?? 1280
  const screenHeight = targetWindow?.screen?.height ?? 900
  const left = Math.max(0, Math.round((screenWidth - width) / 2))
  const top = Math.max(0, Math.round((screenHeight - height) / 2))

  return [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes',
  ].join(',')
}

export function openJimengQrLoginWindow(targetWindow: PopupWindowTarget = window): Window | null {
  return targetWindow.open(
    JIMENG_QR_LOGIN_URL,
    JIMENG_QR_LOGIN_WINDOW_NAME,
    buildJimengQrLoginWindowFeatures(targetWindow),
  )
}

