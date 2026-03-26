import type { ConversationSummary, Run } from '../../../types/conversation'
import type { ModelCatalog } from '../../../types/model'
import { runWithConcurrency } from '../../../utils/runWithConcurrency'
import type { ConversationRepository } from '../infra/conversationRepository'
import {
  aggregateModelUsageStats,
  type ModelUsageGranularity,
  type ModelUsagePresetRange,
  type ModelUsageSnapshot,
} from '../domain/modelUsageStats'

const MODEL_USAGE_LOAD_CONCURRENCY = 4

export interface LoadModelUsageStatsInput {
  repository: ConversationRepository
  summaries: ConversationSummary[]
  modelCatalog: ModelCatalog
  range: ModelUsagePresetRange
  granularity: ModelUsageGranularity
  timeZone: string
  sourceFilter?: string | null
  anchorDate?: string
  now?: Date
}

export interface ModelUsageLoadIssues {
  failedConversationCount: number
  totalConversationCount: number
}

export interface LoadedModelUsageSnapshot extends ModelUsageSnapshot {
  loadIssues: ModelUsageLoadIssues | null
}

function extractRunsFromConversation(conversation: {
  messages: Array<{ runs?: Run[] }>
}): Run[] {
  return conversation.messages.flatMap((message) => message.runs ?? [])
}

export async function loadModelUsageStats(input: LoadModelUsageStatsInput): Promise<LoadedModelUsageSnapshot> {
  const loaded = await runWithConcurrency({
    items: input.summaries,
    concurrency: MODEL_USAGE_LOAD_CONCURRENCY,
    worker: async (summary) => {
      try {
        const conversation = await input.repository.loadConversation(summary.id, summary.title)
        return {
          conversation,
          failed: false,
        }
      } catch {
        return {
          conversation: null,
          failed: true,
        }
      }
    },
  })

  const failedCount = loaded.filter((entry) => entry.failed).length
  if (failedCount > 0 && loaded.every((entry) => entry.conversation === null)) {
    throw new Error('模型调用统计暂时无法读取，请稍后重试。')
  }

  const runs = loaded
    .map((entry) => entry.conversation)
    .filter((conversation): conversation is NonNullable<typeof conversation> => Boolean(conversation))
    .flatMap((conversation) => extractRunsFromConversation(conversation))

  const snapshot = aggregateModelUsageStats({
    runs,
    modelCatalog: input.modelCatalog,
    range: input.range,
    granularity: input.granularity,
    timeZone: input.timeZone,
    sourceFilter: input.sourceFilter,
    anchorDate: input.anchorDate,
    now: input.now,
  })

  return {
    ...snapshot,
    loadIssues: failedCount > 0 ? {
      failedConversationCount: failedCount,
      totalConversationCount: input.summaries.length,
    } : null,
  }
}
