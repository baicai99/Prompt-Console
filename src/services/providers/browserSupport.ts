import type { ApiChannel } from '../../types/channel'
import type { ProviderAdapter } from '../../types/provider'

const DEFAULT_BROWSER_UNSUPPORTED_MESSAGE = '当前渠道不支持在浏览器中直接调用。请为该模型配置服务端中转（BFF / Serverless API）后再使用。'
const DEFAULT_BROWSER_UNSUPPORTED_DETAIL = '这是渠道接入方式限制，不是提示词或参数错误。当前浏览器无法安全完成鉴权，或上游未开放跨域访问。'

export function isBrowserDirectInvocationSupported(adapter: Pick<ProviderAdapter, 'capabilities'>): boolean {
  return adapter.capabilities.browserInvocation === 'supported'
}

export function buildBrowserUnsupportedMessage(channelName?: string | null): string {
  if (typeof channelName === 'string' && channelName.trim()) {
    return `${channelName.trim()} 当前不支持在浏览器中直接调用。请为该渠道配置服务端中转（BFF / Serverless API）后再使用。`
  }
  return DEFAULT_BROWSER_UNSUPPORTED_MESSAGE
}

export function buildBrowserUnsupportedDetail(): string {
  return DEFAULT_BROWSER_UNSUPPORTED_DETAIL
}

export function buildBrowserUnsupportedAssistantContent(channel?: Pick<ApiChannel, 'name'> | null): string {
  return `${buildBrowserUnsupportedMessage(channel?.name)}\n\n${buildBrowserUnsupportedDetail()}`
}
