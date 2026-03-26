import * as providerGateway from '../../../../services/providerGateway'

export interface ConversationProviderGatewayPort {
  generateImages: typeof providerGateway.generateImagesByProvider
  resumeTask: typeof providerGateway.resumeImageTaskByProvider
  streamImageTask: typeof providerGateway.streamImageTaskByProvider
  streamText: typeof providerGateway.streamTextByProvider
}

export function createConversationProviderGatewayPort(
  overrides: Partial<ConversationProviderGatewayPort> = {},
): ConversationProviderGatewayPort {
  return {
    generateImages: overrides.generateImages ?? ((...args) => providerGateway.generateImagesByProvider(...args)),
    resumeTask: overrides.resumeTask ?? ((...args) => providerGateway.resumeImageTaskByProvider(...args)),
    streamImageTask: overrides.streamImageTask ?? ((...args) => providerGateway.streamImageTaskByProvider(...args)),
    streamText: overrides.streamText ?? ((...args) => providerGateway.streamTextByProvider(...args)),
  }
}

export const conversationProviderGatewayPort = createConversationProviderGatewayPort()
