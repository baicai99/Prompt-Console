import type { ApiChannel } from '../../../types/channel'
import type {
  ImageTaskStreamEvent,
  NormalizedResumeResult,
  ProviderRequestRunner,
  StreamImageTaskResult,
} from '../../../types/provider'
import { conversationProviderGatewayPort } from './ports/providerGatewayPort'

export interface ConversationTaskResumeService {
  resumeTask: (input: {
    channel: ApiChannel
    taskId?: string
    taskMeta?: Record<string, string>
    signal?: AbortSignal
    runWithRequestLimit?: ProviderRequestRunner
  }) => Promise<NormalizedResumeResult>
  streamTask: (input: {
    channel: ApiChannel
    taskId?: string
    taskMeta?: Record<string, string>
    signal?: AbortSignal
    onEvent: (event: ImageTaskStreamEvent) => void
  }) => Promise<StreamImageTaskResult>
}

export function createConversationTaskResumeService(input?: {
  resumeTaskFn?: typeof conversationProviderGatewayPort.resumeTask
  streamTaskFn?: typeof conversationProviderGatewayPort.streamImageTask
}): ConversationTaskResumeService {
  const resumeTaskFn = input?.resumeTaskFn ?? conversationProviderGatewayPort.resumeTask
  const streamTaskFn = input?.streamTaskFn ?? conversationProviderGatewayPort.streamImageTask
  return {
    resumeTask(request) {
      return resumeTaskFn({
        channel: request.channel,
        taskId: request.taskId,
        taskMeta: request.taskMeta,
        signal: request.signal,
        runWithRequestLimit: request.runWithRequestLimit,
      })
    },
    streamTask(request) {
      return streamTaskFn({
        channel: request.channel,
        taskId: request.taskId,
        taskMeta: request.taskMeta,
        signal: request.signal,
        onEvent: request.onEvent,
      })
    },
  }
}
