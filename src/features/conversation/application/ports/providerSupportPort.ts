import {
  buildBrowserUnsupportedAssistantContent,
  isBrowserDirectInvocationSupported,
} from '../../../../services/providers/browserSupport'
import { resolveChannelProviderAdapter } from '../../../../services/providers/providerSelection'

export const conversationProviderSupportPort = {
  buildBrowserUnsupportedAssistantContent,
  isBrowserDirectInvocationSupported,
  resolveChannelProviderAdapter,
}
