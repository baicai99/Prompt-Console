import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { Button, Card, Col, Descriptions, List, Row, Space, Switch, Tag, Typography } from 'antd'
import type { ConversationSourceImagePreviewDebugStats } from '../../application/conversationSourceImagePreviewService'
import type { ConversationWorkspaceReadModel } from '../../application/conversationControllerContract'
import {
  getChatMemoryDiagnosticsState,
  isChatMemoryDiagnosticsEnabled,
  reportPreviewServiceDiagnostics,
  setChatMemoryDiagnosticsEnabled,
  subscribeChatMemoryDiagnostics,
  summarizeChatMemoryDiagnostics,
} from '../../../performance/chatMemoryDiagnostics'
import {
  clearRuntimeErrorState,
  getRuntimeErrorState,
  subscribeRuntimeErrorState,
} from '../../../performance/runtimeErrorMonitor'
import { globalAntdFeedback } from '../antdFeedback'

const SAMPLE_INTERVAL_MS = 1500
const { Paragraph, Text } = Typography

interface ChatMemoryDiagnosticsPanelProps {
  getPreviewDebugStats: () => ConversationSourceImagePreviewDebugStats
  workspaceDiagnostics: ConversationWorkspaceReadModel['workspaceDiagnostics']
}

interface PerformanceMemoryLike {
  usedJSHeapSize?: number
  jsHeapSizeLimit?: number
}

function formatBytes(value: number | undefined): string {
  if (!value || Number.isNaN(value)) {
    return '不可用'
  }
  const mb = value / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

function buildDiagnosticsCopyText(input: {
  summary: ReturnType<typeof summarizeChatMemoryDiagnostics>
  state: ReturnType<typeof getChatMemoryDiagnosticsState>
  runtimeErrors: ReturnType<typeof getRuntimeErrorState>
  performanceMemory?: PerformanceMemoryLike
  workspaceDiagnostics: ConversationWorkspaceReadModel['workspaceDiagnostics']
}) {
  const { summary, state, runtimeErrors, performanceMemory, workspaceDiagnostics } = input
  const messageLists = Object.values(state.messageLists)
  const runtimeErrorSection = runtimeErrors.events.length === 0
    ? 'runtime_errors: none'
    : runtimeErrors.events.map((item) => [
      `- ${item.at} | ${item.kind}`,
      `  message: ${item.message}`,
      `  version: ${item.version}`,
      `  href: ${item.href}`,
      `  file: ${item.filename ?? 'none'}:${item.lineno ?? '-'}:${item.colno ?? '-'}`,
      `  stack: ${item.stack ?? 'none'}`,
    ].join('\n')).join('\n')
  const listSection = messageLists.length === 0
    ? 'message_lists: none'
    : messageLists.map((item) => [
      `- key: ${item.key}`,
      `  conversation_id: ${item.conversationId ?? 'none'}`,
      `  side_view: ${item.sideView}`,
      `  total_messages: ${item.totalMessages}`,
      `  hydrated_messages: ${item.hydratedMessages}`,
      `  rendered_messages: ${item.renderedMessages}`,
      `  mounted_messages: ${item.mountedMessages}`,
      `  visible_messages: ${item.visibleMessages}`,
      `  img_nodes: ${item.imgNodes}`,
      `  viewport_nodes: ${item.viewportNodes}`,
      `  scroll_top: ${Math.round(item.scrollTop)}`,
      `  scroll_height: ${Math.round(item.scrollHeight)}`,
      `  viewport_height: ${Math.round(item.viewportHeight)}`,
      `  virtual_range: ${item.virtualRangeStart}-${item.virtualRangeEnd}`,
    ].join('\n')).join('\n')
  const eventSection = state.events.length === 0
    ? 'events: none'
    : state.events.map((item) => `- ${item.at} | ${item.name}${item.detail ? ` | ${item.detail}` : ''}`).join('\n')

  return [
    'chat_memory_diagnostics',
    '',
    '[summary]',
    `mounted_messages: ${summary.mountedMessages}`,
    `visible_messages: ${summary.visibleMessages}`,
    `img_nodes: ${summary.imgNodes}`,
    `preview_cache_size: ${summary.previewService?.cacheSize ?? 0}`,
    `preview_total_refs: ${summary.previewService?.totalRefs ?? 0}`,
    `active_object_urls: ${summary.previewService?.activeObjectUrls ?? 0}`,
    `created_object_urls: ${summary.previewService?.createdObjectUrls ?? 0}`,
    `revoked_object_urls: ${summary.previewService?.revokedObjectUrls ?? 0}`,
    `js_heap_used: ${performanceMemory?.usedJSHeapSize ?? 'unavailable'}`,
    `js_heap_limit: ${performanceMemory?.jsHeapSizeLimit ?? 'unavailable'}`,
    '',
    '[workspace_runtime]',
    ...Object.entries(workspaceDiagnostics).map(([key, value]) => `${key}: ${String(value)}`),
    '',
    '[message_lists]',
    listSection,
    '',
    '[events]',
    eventSection,
    '',
    '[runtime_errors]',
    runtimeErrorSection,
  ].join('\n')
}

export function ChatMemoryDiagnosticsPanel(props: ChatMemoryDiagnosticsPanelProps) {
  const { getPreviewDebugStats, workspaceDiagnostics } = props
  const state = useSyncExternalStore(
    subscribeChatMemoryDiagnostics,
    getChatMemoryDiagnosticsState,
    getChatMemoryDiagnosticsState,
  )
  const diagnosticsEnabled = useSyncExternalStore(
    subscribeChatMemoryDiagnostics,
    isChatMemoryDiagnosticsEnabled,
    isChatMemoryDiagnosticsEnabled,
  )
  const runtimeErrors = useSyncExternalStore(
    subscribeRuntimeErrorState,
    getRuntimeErrorState,
    getRuntimeErrorState,
  )

  useEffect(() => {
    if (!diagnosticsEnabled) {
      return
    }

    const publish = () => {
      reportPreviewServiceDiagnostics(getPreviewDebugStats())
    }

    publish()
    const timer = window.setInterval(publish, SAMPLE_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [diagnosticsEnabled, getPreviewDebugStats])

  const summary = useMemo(() => summarizeChatMemoryDiagnostics(state), [state])
  const performanceMemory = typeof performance !== 'undefined'
    ? (performance as typeof performance & { memory?: PerformanceMemoryLike }).memory
    : undefined
  const copyPayload = useMemo(
    () => buildDiagnosticsCopyText({ summary, state, runtimeErrors, performanceMemory, workspaceDiagnostics }),
    [performanceMemory, runtimeErrors, state, summary, workspaceDiagnostics],
  )

  return (
    <div className="side-tab-panel-root flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pt-2.5 pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <Row gutter={[12, 12]}>
          <Col xs={24} xl={12}>
            <Card
              size="small"
              title="当前快照"
              extra={(
                <Space size={12}>
                  <Space size={8}>
                    <Text type="secondary">实时监测</Text>
                    <Switch
                      size="small"
                      checked={diagnosticsEnabled}
                      checkedChildren="开"
                      unCheckedChildren="关"
                      onChange={setChatMemoryDiagnosticsEnabled}
                    />
                  </Space>
                  <Button
                    size="small"
                    disabled={!diagnosticsEnabled}
                    onClick={() => {
                      void globalAntdFeedback.copyText({
                        text: copyPayload,
                        successMessage: '已复制诊断信息',
                        failureMessage: '复制诊断信息失败',
                      })
                    }}
                  >
                    复制给 LLM
                  </Button>
                </Space>
              )}
            >
              {!diagnosticsEnabled ? (
                <Paragraph className="!mb-0" type="secondary">
                  入口始终可见。开启实时监测后，才会采集消息列表、预览缓存、事件流与堆内存快照，用完可以随时关闭以减少额外开销。
                </Paragraph>
              ) : null}
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="消息挂载数">
                  {summary.mountedMessages}
                </Descriptions.Item>
                <Descriptions.Item label="消息可见数">
                  {summary.visibleMessages}
                </Descriptions.Item>
                <Descriptions.Item label="图片节点数">
                  {summary.imgNodes}
                </Descriptions.Item>
                <Descriptions.Item label="预览缓存 / 引用">
                  {summary.previewService ? `${summary.previewService.cacheSize} / ${summary.previewService.totalRefs}` : '0 / 0'}
                </Descriptions.Item>
                <Descriptions.Item label="Object URL 活跃数">
                  {summary.previewService?.activeObjectUrls ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="JS Heap">
                  {formatBytes(performanceMemory?.usedJSHeapSize)}
                </Descriptions.Item>
                <Descriptions.Item label="Heap Limit">
                  {formatBytes(performanceMemory?.jsHeapSizeLimit)}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card size="small" title="运行时快照">
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="已加载会话 / 摘要">
                  {`${workspaceDiagnostics.loadedConversationCount} / ${workspaceDiagnostics.summariesCount}`}
                </Descriptions.Item>
                <Descriptions.Item label="运行时任务 / 会话">
                  {`${workspaceDiagnostics.runtimeTaskTotalCount} / ${workspaceDiagnostics.runtimeTaskConversationCount}`}
                </Descriptions.Item>
                <Descriptions.Item label="活跃会话 消息 / runs / 图片 / task">
                  {`${workspaceDiagnostics.activeConversationMessageCount} / ${workspaceDiagnostics.activeConversationRunCount} / ${workspaceDiagnostics.activeConversationImageCount} / ${workspaceDiagnostics.activeConversationTaskCount}`}
                </Descriptions.Item>
                <Descriptions.Item label="图片引用 inline / idb / url">
                  {`${workspaceDiagnostics.inlineImageCount} / ${workspaceDiagnostics.idbBackedImageCount} / ${workspaceDiagnostics.directUrlImageCount}`}
                </Descriptions.Item>
                <Descriptions.Item label="inline 图片字节">
                  {formatBytes(workspaceDiagnostics.inlineImageBytes)}
                </Descriptions.Item>
                <Descriptions.Item label="任务 active / settled">
                  {`${workspaceDiagnostics.activeTaskCount} / ${workspaceDiagnostics.settledTaskCount}`}
                </Descriptions.Item>
                <Descriptions.Item label="草稿字符 / 变量行 / 已解析变量">
                  {`${workspaceDiagnostics.draftCharacterCount} / ${workspaceDiagnostics.panelVariableRowCount} / ${workspaceDiagnostics.resolvedVariableCount}`}
                </Descriptions.Item>
                <Descriptions.Item label="草稿参考图 / 预览 URL / 字节">
                  {`${workspaceDiagnostics.draftSourceImageCount} / ${workspaceDiagnostics.draftSourcePreviewUrlCount} / ${formatBytes(workspaceDiagnostics.totalDraftSourceBytes)}`}
                </Descriptions.Item>
                <Descriptions.Item label="日志缓冲 / UI 缓存">
                  {`${workspaceDiagnostics.logEntryCount}/${workspaceDiagnostics.logBufferLimit} / ${workspaceDiagnostics.uiRenderCacheSize}`}
                </Descriptions.Item>
                <Descriptions.Item label="并发池 max / active / queued">
                  {`${workspaceDiagnostics.globalSubmitMax} / ${workspaceDiagnostics.globalSubmitActive} / ${workspaceDiagnostics.globalSubmitQueued}`}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card size="small" title="验证脚本">
              <Space direction="vertical" size={8}>
                <Paragraph className="!mb-0">
                  纯文本长会话：持续发送文本消息，观察消息挂载数、列表 DOM、JS Heap 是否同步上涨。
                </Paragraph>
                <Paragraph className="!mb-0">
                  图片长会话：持续生成图片，观察图片节点数、Object URL 活跃数、预览缓存引用数。
                </Paragraph>
                <Paragraph className="!mb-0">
                  会话切换与清空：切换到新会话或清空后，确认挂载消息数、Object URL 活跃数、Heap 有回落。
                </Paragraph>
              </Space>
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card
              size="small"
              title="运行时异常"
              extra={(
                <Space size={8}>
                  <Button
                    size="small"
                    disabled={runtimeErrors.events.length === 0}
                    onClick={() => {
                      void globalAntdFeedback.copyText({
                        text: copyPayload,
                        successMessage: '已复制运行时异常快照',
                        failureMessage: '复制运行时异常快照失败',
                      })
                    }}
                  >
                    复制快照
                  </Button>
                  <Button
                    size="small"
                    disabled={runtimeErrors.events.length === 0}
                    onClick={clearRuntimeErrorState}
                  >
                    清空
                  </Button>
                </Space>
              )}
            >
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="已缓存异常数">
                  {runtimeErrors.events.length}
                </Descriptions.Item>
                <Descriptions.Item label="最近异常版本">
                  {runtimeErrors.events[0]?.version ?? __APP_VERSION__}
                </Descriptions.Item>
                <Descriptions.Item label="说明">
                  浏览器会自动缓存最近未捕获异常、资源加载失败和未处理 Promise 拒绝，刷新后仍可在本地查看与复制。
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24}>
            <Card size="small" title="消息列表">
              <Row gutter={[12, 12]}>
                {Object.values(state.messageLists).map((item) => (
                  <Col key={item.key} xs={24} xl={12}>
                    <Card size="small" type="inner" title={`${item.sideView} / ${item.conversationId ?? 'none'}`}>
                      <Descriptions size="small" column={1}>
                        <Descriptions.Item label="总消息 / 已 hydrate">
                          {`${item.totalMessages} / ${item.hydratedMessages}`}
                        </Descriptions.Item>
                        <Descriptions.Item label="渲染目标 / 挂载 / 可见">
                          {`${item.renderedMessages} / ${item.mountedMessages} / ${item.visibleMessages}`}
                        </Descriptions.Item>
                        <Descriptions.Item label="列表 DOM / 图片">
                          {`${item.viewportNodes} / ${item.imgNodes}`}
                        </Descriptions.Item>
                        <Descriptions.Item label="滚动位置">
                          {`${Math.round(item.scrollTop)} / ${Math.round(item.scrollHeight)} / ${Math.round(item.viewportHeight)}`}
                        </Descriptions.Item>
                        <Descriptions.Item label="虚拟区间">
                          {`${item.virtualRangeStart} - ${item.virtualRangeEnd}`}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          <Col xs={24}>
            <Card size="small" title="缓存与轮询">
              <Row gutter={[12, 12]}>
                <Col xs={24} xl={12}>
                  <Card size="small" type="inner" title="缓存与索引">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="待持久化会话">
                        {workspaceDiagnostics.pendingPersistConversationCount}
                      </Descriptions.Item>
                      <Descriptions.Item label="LRU 缓存顺序数">
                        {workspaceDiagnostics.conversationCacheOrderCount}
                      </Descriptions.Item>
                      <Descriptions.Item label="runLocation 会话 / 条目">
                        {`${workspaceDiagnostics.runLocationConversationCount} / ${workspaceDiagnostics.runLocationEntryCount}`}
                      </Descriptions.Item>
                      <Descriptions.Item label="active controllers 会话 / 条目">
                        {`${workspaceDiagnostics.activeRunControllerConversationCount} / ${workspaceDiagnostics.activeRunControllerCount}`}
                      </Descriptions.Item>
                      <Descriptions.Item label="resuming images / completion signatures">
                        {`${workspaceDiagnostics.resumingImageCount} / ${workspaceDiagnostics.runCompletionSignatureCount}`}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col xs={24} xl={12}>
                  <Card size="small" type="inner" title="定时器与日志">
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="persist timer">
                        {workspaceDiagnostics.persistTimerActive ? 'active' : 'idle'}
                      </Descriptions.Item>
                      <Descriptions.Item label="resume poll timer">
                        {workspaceDiagnostics.resumePollTimerActive ? 'active' : 'idle'}
                      </Descriptions.Item>
                      <Descriptions.Item label="background poll timer">
                        {workspaceDiagnostics.backgroundResumePollTimerActive ? 'active' : 'idle'}
                      </Descriptions.Item>
                      <Descriptions.Item label="poll inflight / background inflight">
                        {`${String(workspaceDiagnostics.resumePollInFlight)} / ${String(workspaceDiagnostics.backgroundResumePollInFlight)}`}
                      </Descriptions.Item>
                      <Descriptions.Item label="logging enabled / level / subscribers">
                        {`${String(workspaceDiagnostics.loggingEnabled)} / ${workspaceDiagnostics.loggingDetailLevel} / ${workspaceDiagnostics.logSubscriberCount}`}
                      </Descriptions.Item>
                      <Descriptions.Item label="historyVisibleLimit / scrollTrigger">
                        {`${workspaceDiagnostics.historyVisibleLimit} / ${workspaceDiagnostics.sendScrollTrigger}`}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24}>
            <Card size="small" title="最近事件">
              <List
                size="small"
                dataSource={state.events}
                locale={{ emptyText: '暂无事件' }}
                renderItem={(item) => (
                  <List.Item>
                    <Space direction="vertical" size={2}>
                      <Space size={8}>
                        <Tag color="blue">{item.name}</Tag>
                        <Text type="secondary">{new Date(item.at).toLocaleTimeString()}</Text>
                      </Space>
                      {item.detail ? <Text type="secondary">{item.detail}</Text> : null}
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          <Col xs={24}>
            <Card size="small" title="最近运行时异常">
              <List
                size="small"
                dataSource={runtimeErrors.events}
                locale={{ emptyText: '暂无未捕获异常' }}
                renderItem={(item) => (
                  <List.Item>
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Space size={8} wrap>
                        <Tag color={item.kind === 'error' ? 'red' : item.kind === 'unhandledrejection' ? 'orange' : 'gold'}>
                          {item.kind}
                        </Tag>
                        <Text>{item.message}</Text>
                        <Text type="secondary">{new Date(item.at).toLocaleString()}</Text>
                      </Space>
                      <Text type="secondary">{`${item.version} · ${item.href}`}</Text>
                      {item.filename ? (
                        <Text type="secondary">{`${item.filename}:${item.lineno ?? '-'}:${item.colno ?? '-'}`}</Text>
                      ) : null}
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  )
}
