import type { Conversation, ImageRuntimeSettings } from '../../../../types/conversation'
import { normalizeImageRuntimeSettings } from '../../../../utils/imageRuntimeSettings'
import { compactConversationImages as compactConversationImagesWithOptions } from '../../../../utils/conversationCompaction'
import { ensureRunTaskState } from '../../domain/runTaskState'

interface PerformanceMemoryInfoLike {
  usedJSHeapSize: number
  jsHeapSizeLimit: number
}

interface PerformanceLike {
  memory?: PerformanceMemoryInfoLike
}

export function touchConversationCache(order: string[], conversationId: string, maxEntries: number): string[] {
  return [
    conversationId,
    ...order.filter((id) => id !== conversationId),
  ].slice(0, maxEntries)
}

function compactConversationImages(conversation: Conversation, retainedMessageCount: number): Conversation {
  return compactConversationImagesWithOptions(conversation, {
    retainedMessageCount,
    includeMemoryState: true,
  })
}

function resolveRuntimeSettings(runtimeSettings?: Partial<ImageRuntimeSettings>): ImageRuntimeSettings {
  return normalizeImageRuntimeSettings(runtimeSettings)
}

export function compactConversationForMemory(
  conversation: Conversation,
  runtimeSettings?: Partial<ImageRuntimeSettings>,
): Conversation {
  return compactConversationImages(conversation, resolveRuntimeSettings(runtimeSettings).recentMessageRetentionCount)
}

export function compressConversationForHighMemory(
  conversation: Conversation,
  runtimeSettings?: Partial<ImageRuntimeSettings>,
): Conversation {
  return compactConversationImages(conversation, resolveRuntimeSettings(runtimeSettings).highPressureMessageRetentionCount)
}

export function compactConversationForWindow(input: {
  conversation: Conversation
  hydratedMessageCount: number
  pressure?: number
  runtimeSettings?: Partial<ImageRuntimeSettings>
}): Conversation {
  const runtimeSettings = resolveRuntimeSettings(input.runtimeSettings)
  const baseCount = input.pressure && input.pressure >= 0.74
    ? runtimeSettings.highPressureMessageRetentionCount
    : runtimeSettings.recentMessageRetentionCount
  const hydratedMessageCount = Math.max(1, Math.floor(input.hydratedMessageCount))
  let retainedMessageCount = Math.max(baseCount, hydratedMessageCount)
  const cutoffIndex = Math.max(0, input.conversation.messages.length - retainedMessageCount)

  for (let index = 0; index < cutoffIndex; index += 1) {
    const message = input.conversation.messages[index]
    const hasNonSettledRuns = (message.runs ?? []).some((run) => {
      const taskState = ensureRunTaskState(run)
      return taskState.status === 'waiting' || taskState.status === 'generating'
    })
    if (!hasNonSettledRuns) {
      continue
    }
    retainedMessageCount = input.conversation.messages.length - index
    break
  }

  return compactConversationImages(input.conversation, retainedMessageCount)
}

export function prepareConversationForPersistence(input: {
  conversation: Conversation
  isActive: boolean
  pressure: number
  runtimeSettings?: Partial<ImageRuntimeSettings>
}): Conversation {
  if (input.isActive) {
    return input.pressure >= 0.74
      ? compressConversationForHighMemory(input.conversation, input.runtimeSettings)
      : input.conversation
  }

  return compactConversationForMemory(input.conversation, input.runtimeSettings)
}

export function getBrowserMemoryPressure(performanceLike?: PerformanceLike): number {
  const info = performanceLike?.memory
  if (!info || !info.jsHeapSizeLimit) {
    return 0
  }
  return info.usedJSHeapSize / info.jsHeapSizeLimit
}

export function resolveAdaptiveRunConcurrencyByPressure(requested: number, pressure: number): number {
  const normalized = Math.max(1, Math.floor(requested))
  if (pressure >= 0.78) {
    return 1
  }
  if (pressure >= 0.65) {
    return Math.min(2, normalized)
  }
  return normalized
}
