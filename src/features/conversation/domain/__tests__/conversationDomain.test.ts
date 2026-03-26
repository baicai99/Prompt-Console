import { describe, expect, it } from 'vitest'
import {
  buildPanelVariableBatches,
  reformatRowsForPanelFormat,
  buildSyncPreview,
  collectVariables,
  parseBulkVariables,
  serializeBulkVariables,
} from '../panelVariableParsing'
import { classifyFailure } from '../failureClassifier'
import { normalizeConversation, normalizeSettingsBySide } from '../settingsNormalization'
import { planRunBatch } from '../runPlanning'
import type { ApiChannel } from '../../../../types/channel'
import type { ModelCatalog } from '../../../../types/model'
import type { Side, SingleSideSettings } from '../../../../types/conversation'

const catalog: ModelCatalog = {
  models: [
    {
      id: 'model-a',
      name: 'Model A',
      params: [
        { key: 'quality', label: 'Quality', type: 'enum', options: ['std', 'hd'], default: 'std' },
      ],
    },
  ],
}

const channels: ApiChannel[] = [
  {
    id: 'ch-1',
    name: 'Default',
    baseUrl: 'https://example.com',
    apiKey: 'k',
    models: ['model-a'],
  },
]

describe('conversationDomain variables', () => {
  it('detects and parses JSON bulk object map', () => {
    const parsed = parseBulkVariables('{"hair":["long hair","short hair"],"color":["black","blonde"]}')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.detectedFormat).toBe('json')
      expect(parsed.rows).toHaveLength(2)
      expect(parsed.rows[0].key).toBe('hair')
    }
  })

  it('preserves commas inside structured bulk values', () => {
    const parsed = parseBulkVariables('{"style":["日系职场，昭和复古"]}')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.rows[0].valuesText).toBe('["日系职场，昭和复古"]')
      const batches = buildPanelVariableBatches(parsed.rows, 'auto')
      expect(batches.validation.ok).toBe(true)
      expect(batches.batches).toEqual([{ style: '日系职场，昭和复古' }])
    }
  })

  it('preserves singleton JSON array items even when they contain many commas', () => {
    const parsed = parseBulkVariables(`{
  "style_names": [
    "漫改,日系职场,日系校园,昭和复古,日式治愈,日式悬疑,日式恐怖,日式科幻,日式古装"
  ],
  "style_descriptions": [
    "高清写真级 cosplay 摄影，角色高度还原，精致妆容与服装细节, 日本企业写实, 办公室荧光灯感、整洁压抑、高清晰度, 高曝光、低对比、低饱和的清透暖色调，整体影调偏柔和漫反射、阴影浅、画面干净带一点发白的青春空气感, 日式空气感浪漫, 画面通透且柔和，色调偏向马卡龙色或清新淡雅的电影胶片色。, 影调为自然写实、低对比暖色基调，室内偏钨丝灯暖黄光，环境低饱和米棕色，轻微冷暖对比，整体克制干净、接近纪实广播风格, 低对比、低饱和的暖灰写实影调，自然柔光均匀照明，轻微冷暖对比，整体克制而生活化, 低曝光、高对比的青绿色冷调影调，去暖低饱和处理，深黑阴影强化压抑与恐怖氛围"
  ]
}`)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.rows).toHaveLength(2)
      expect(parsed.rows[0].valuesText).toBe('["漫改,日系职场,日系校园,昭和复古,日式治愈,日式悬疑,日式恐怖,日式科幻,日式古装"]')
      expect(parsed.rows[1].valuesText).toContain('高清写真级 cosplay 摄影，角色高度还原，精致妆容与服装细节')
      const batches = buildPanelVariableBatches(parsed.rows, 'auto')
      expect(batches.validation.ok).toBe(true)
      expect(batches.batches).toEqual([{
        style_names: '漫改,日系职场,日系校园,昭和复古,日式治愈,日式悬疑,日式恐怖,日式科幻,日式古装',
        style_descriptions: '高清写真级 cosplay 摄影，角色高度还原，精致妆容与服装细节, 日本企业写实, 办公室荧光灯感、整洁压抑、高清晰度, 高曝光、低对比、低饱和的清透暖色调，整体影调偏柔和漫反射、阴影浅、画面干净带一点发白的青春空气感, 日式空气感浪漫, 画面通透且柔和，色调偏向马卡龙色或清新淡雅的电影胶片色。, 影调为自然写实、低对比暖色基调，室内偏钨丝灯暖黄光，环境低饱和米棕色，轻微冷暖对比，整体克制干净、接近纪实广播风格, 低对比、低饱和的暖灰写实影调，自然柔光均匀照明，轻微冷暖对比，整体克制而生活化, 低曝光、高对比的青绿色冷调影调，去暖低饱和处理，深黑阴影强化压抑与恐怖氛围',
      }])
    }
  })

  it('detects and parses YAML bulk row array', () => {
    const parsed = parseBulkVariables('- key: hair\n  values: [long hair, short hair]\n- key: color\n  values: black')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.detectedFormat).toBe('yaml')
      expect(parsed.rows).toHaveLength(2)
      expect(parsed.rows[1].valuesText).toBe('["black"]')
    }
  })

  it('detects and parses CSV bulk rows', () => {
    const parsed = parseBulkVariables('hair,long hair,short hair\ncolor,black,blonde')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.detectedFormat).toBe('csv')
      expect(parsed.rows).toHaveLength(2)
      expect(parsed.rows[0].valuesText).toContain('long hair')
    }
  })

  it('detects and parses line bulk rows', () => {
    const parsed = parseBulkVariables('hair: long hair | short hair\ncolor: black | blonde')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.detectedFormat).toBe('line')
      expect(parsed.rows).toHaveLength(2)
      expect(parsed.rows[1].key).toBe('color')
    }
  })

  it('builds sync preview summary', () => {
    const preview = buildSyncPreview(
      [
        { id: '1', key: 'hair', valuesText: 'long,short', selectedValue: '' },
        { id: '2', key: 'color', valuesText: 'black,blonde', selectedValue: '' },
      ],
      [
        { id: '3', key: 'hair', valuesText: 'long,buzz', selectedValue: '' },
        { id: '4', key: 'style', valuesText: 'cinematic', selectedValue: '' },
      ],
    )

    expect(preview.added).toBe(1)
    expect(preview.updated).toBe(1)
    expect(preview.removed).toBe(1)
  })

  it('serializes rows to JSON and supports round-trip parsing', () => {
    const rows = [
      { id: 'r1', key: 'hair', valuesText: 'long,short', selectedValue: '' },
      { id: 'r2', key: 'color', valuesText: 'black,blonde', selectedValue: '' },
    ]
    const serialized = serializeBulkVariables(rows, 'json', 'auto')
    expect(serialized.ok).toBe(true)
    if (serialized.ok) {
      const parsed = parseBulkVariables(serialized.text)
      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.rows).toHaveLength(2)
      }
    }
  })

  it('reformats rows to JSON text for JSON panel parsing', () => {
    const rows = [{ id: 'j1', key: 'style', valuesText: 'a, b, c', selectedValue: '' }]
    const formatted = reformatRowsForPanelFormat(rows, 'json')
    expect(formatted.ok).toBe(true)
    if (formatted.ok) {
      expect(formatted.rows[0].valuesText).toBe('["a","b","c"]')
      const batches = buildPanelVariableBatches(formatted.rows, 'json')
      expect(batches.validation.ok).toBe(true)
      expect(batches.batches).toEqual([{ style: 'a' }, { style: 'b' }, { style: 'c' }])
    }
  })

  it('parses JSON list without splitting commas inside items', () => {
    const batches = buildPanelVariableBatches(
      [{ id: 'j1', key: 'subject', valuesText: '["这是一句话，里面有逗号", "第二条"]', selectedValue: '' }],
      'json',
    )

    expect(batches.validation.ok).toBe(true)
    expect(batches.batches).toEqual([{ subject: '这是一句话，里面有逗号' }, { subject: '第二条' }])
  })

  it('parses YAML list and preserves commas within item text', () => {
    const batches = buildPanelVariableBatches(
      [{ id: 'y1', key: 'subject', valuesText: '- 这是一句话，里面有逗号\n- 第二条', selectedValue: '' }],
      'yaml',
    )

    expect(batches.validation.ok).toBe(true)
    expect(batches.batches).toEqual([{ subject: '这是一句话，里面有逗号' }, { subject: '第二条' }])
  })

  it('parses CSV quoted fields that contain commas', () => {
    const batches = buildPanelVariableBatches(
      [{ id: 'c1', key: 'subject', valuesText: '"这是一句话，里面有逗号",second', selectedValue: '' }],
      'csv',
    )

    expect(batches.validation.ok).toBe(true)
    expect(batches.batches).toEqual([{ subject: '这是一句话，里面有逗号' }, { subject: 'second' }])
  })

  it('parses line mode only by newline', () => {
    const batches = buildPanelVariableBatches(
      [{ id: 'l1', key: 'subject', valuesText: '第一句，保留逗号\n第二句', selectedValue: '' }],
      'line',
    )

    expect(batches.validation.ok).toBe(true)
    expect(batches.batches).toEqual([{ subject: '第一句，保留逗号' }, { subject: '第二句' }])
  })

  it('auto mode keeps legacy comma split compatibility', () => {
    const batches = buildPanelVariableBatches([{ id: 'a1', key: 'subject', valuesText: 'a,b,c', selectedValue: '' }], 'auto')

    expect(batches.validation.ok).toBe(true)
    expect(batches.batches).toEqual([{ subject: 'a' }, { subject: 'b' }, { subject: 'c' }])
  })

  it('returns readable parse error for invalid JSON mode', () => {
    const batches = buildPanelVariableBatches([{ id: 'e1', key: 'subject', valuesText: '["a",}', selectedValue: '' }], 'json')

    expect(batches.validation.ok).toBe(false)
    expect(batches.validation.error).toContain('键 "subject" 的值解析失败')
    expect(batches.validation.error).toContain('JSON 列表解析失败')
  })

  it('classifies sensitive-content provider errors as rejected', () => {
    const code = classifyFailure('HTTP 451: OutputImageSensitiveContentDetected')
    expect(code).toBe('rejected')
  })

  it('drops legacy live-feed entries when normalizing persisted conversations', () => {
    const normalized = normalizeConversation({
      id: 'conv-live-feed',
      title: 'Legacy',
      titleMode: 'manual',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sideMode: 'single',
      sideCount: 2,
      settingsBySide: {
        single: {
          generationMode: 'image',
          resolution: '1K',
          aspectRatio: '1:1',
          imageCount: 4,
          gridColumns: 4,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
          channelId: 'ch-1',
          modelId: 'model-a',
          paramValues: {},
        },
      },
      messages: [
        {
          id: 'assistant-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          role: 'assistant',
          content: 'done',
          runs: [
            {
              id: 'run-1',
              batchId: 'batch-1',
              createdAt: '2026-01-01T00:00:00.000Z',
              sideMode: 'single',
              side: 'single',
              prompt: 'cat',
              imageCount: 4,
              channelId: 'ch-1',
              channelName: 'Default',
              modelId: 'model-a',
              modelName: 'Model A',
              templatePrompt: 'cat',
              finalPrompt: 'cat',
              variablesSnapshot: {},
              paramsSnapshot: {},
              settingsSnapshot: {
                resolution: '1K',
                aspectRatio: '1:1',
                imageCount: 4,
                gridColumns: 4,
                sizeMode: 'preset',
                customWidth: 1024,
                customHeight: 1024,
                autoSave: false,
              },
              retryAttempt: 0,
              images: Array.from({ length: 4 }, (_, index) => ({
                id: `image-${index + 1}`,
                seq: index + 1,
                status: 'success' as const,
                fileRef: `/image-${index + 1}.png`,
              })),
            },
          ],
          liveFeed: [
            {
              id: 'feed-1',
              taskId: 'task-1',
              runId: 'run-1',
              batchId: 'batch-1',
              side: 'single',
              seq: 1,
              finalPrompt: 'cat',
              status: 'succeeded',
              completedAt: '2026-01-01T00:00:01.000Z',
              image: {
                id: 'feed-image-1',
                seq: 1,
                status: 'success',
                fileRef: '/feed-image-1.png',
              },
            },
          ],
        },
      ],
    }, channels, catalog)

    expect(normalized.messages[0].liveFeed).toBeUndefined()
    expect(normalized.messages[0].runs?.[0].images).toHaveLength(4)
  })

  it('only materializes active tasks when normalizing persisted conversations', () => {
    const normalized = normalizeConversation({
      id: 'conv-task-prune',
      title: 'Legacy Tasks',
      titleMode: 'manual',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sideMode: 'single',
      sideCount: 2,
      settingsBySide: {
        single: {
          generationMode: 'image',
          resolution: '1K',
          aspectRatio: '1:1',
          imageCount: 2,
          gridColumns: 2,
          sizeMode: 'preset',
          customWidth: 1024,
          customHeight: 1024,
          autoSave: false,
          channelId: 'ch-1',
          modelId: 'model-a',
          paramValues: {},
        },
      },
      tasksById: {
        'task-success': {
          taskId: 'task-success',
          runId: 'run-1',
          batchId: 'batch-1',
          side: 'single',
          seq: 1,
          finalPrompt: 'cat',
          status: 'succeeded',
          createdAt: '2026-01-01T00:00:00.000Z',
          queuedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      messages: [
        {
          id: 'assistant-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          role: 'assistant',
          content: 'done',
          runs: [
            {
              id: 'run-1',
              batchId: 'batch-1',
              createdAt: '2026-01-01T00:00:00.000Z',
              sideMode: 'single',
              side: 'single',
              prompt: 'cat',
              imageCount: 2,
              channelId: 'ch-1',
              channelName: 'Default',
              modelId: 'model-a',
              modelName: 'Model A',
              templatePrompt: 'cat',
              finalPrompt: 'cat',
              variablesSnapshot: {},
              paramsSnapshot: {},
              settingsSnapshot: {
                resolution: '1K',
                aspectRatio: '1:1',
                imageCount: 2,
                gridColumns: 2,
                sizeMode: 'preset',
                customWidth: 1024,
                customHeight: 1024,
                autoSave: false,
              },
              retryAttempt: 0,
              images: [
                {
                  id: 'image-1',
                  seq: 1,
                  status: 'success',
                  fileRef: '/image-1.png',
                },
                {
                  id: 'image-2',
                  seq: 2,
                  status: 'pending',
                  threadState: 'detached',
                  serverTaskId: 'task-2',
                },
              ],
            },
          ],
        },
      ],
    }, channels, catalog)

    expect(Object.keys(normalized.tasksById ?? {})).toHaveLength(1)
    expect(normalized.tasksById).toMatchObject({
      'run-1:task:2': expect.objectContaining({
        status: 'polling',
        serverTaskId: 'task-2',
      }),
    })
  })

  it('collects variables from panel mode', () => {
    const panel = collectVariables([{ id: '2', key: 'subject', valuesText: 'cat,dog', selectedValue: '' }])
    expect(panel).toEqual({ subject: 'cat' })
  })

  it('returns missing variables error when template has unresolved keys', () => {
    const result = planRunBatch({
      draft: 'a {{style}} portrait of {{subject}}',
      panelVariables: [{ id: '1', key: 'subject', valuesText: 'cat', selectedValue: '' }],
      mode: 'single',
      sideCount: 2,
      settingsBySide: normalizeSettingsBySide(undefined, channels, catalog, 2),
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Missing variables')
      expect(result.error).toContain('style')
    }
  })

  it('builds N batches from one panel list key', () => {
    const result = planRunBatch({
      draft: 'a {{hair}} portrait',
      panelVariables: [{ id: 'p1', key: 'hair', valuesText: 'long hair,short hair,black hair', selectedValue: '' }],
      mode: 'single',
      sideCount: 2,
      settingsBySide: normalizeSettingsBySide(undefined, channels, catalog, 2),
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.runPlans).toHaveLength(3)
      expect(result.value.runPlans[0].pendingRun.finalPrompt).toContain('long hair')
      expect(result.value.runPlans[1].pendingRun.finalPrompt).toContain('short hair')
      expect(result.value.runPlans[2].pendingRun.finalPrompt).toContain('black hair')
    }
  })

  it('treats a plain prompt as a single run even when dynamic prompt is enabled', () => {
    const result = planRunBatch({
      draft: '1girl',
      panelVariables: [{ id: 'p1', key: 'hair', valuesText: 'long hair,short hair,black hair', selectedValue: '' }],
      dynamicPromptEnabled: true,
      mode: 'single',
      sideCount: 2,
      settingsBySide: normalizeSettingsBySide(undefined, channels, catalog, 2),
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.runPlans).toHaveLength(1)
      expect(result.value.runPlans[0].pendingRun.finalPrompt).toBe('1girl')
      expect(result.value.runPlans[0].pendingRun.variablesSnapshot).toEqual({})
    }
  })

  it('skips dynamic variable parsing entirely when the prompt has no template keys', () => {
    const result = planRunBatch({
      draft: '1girl',
      panelVariables: [{ id: 'p1', key: 'subject', valuesText: '["bad",}', selectedValue: '' }],
      panelValueFormat: 'json',
      dynamicPromptEnabled: true,
      mode: 'single',
      sideCount: 2,
      settingsBySide: normalizeSettingsBySide(undefined, channels, catalog, 2),
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.runPlans).toHaveLength(1)
      expect(result.value.runPlans[0].pendingRun.finalPrompt).toBe('1girl')
    }
  })

  it('builds one logical run per prompt batch per window', () => {
    const result = planRunBatch({
      draft: 'a {{hair}} portrait',
      panelVariables: [{ id: 'p1', key: 'hair', valuesText: 'long hair,short hair', selectedValue: '' }],
      mode: 'multi',
      sideCount: 2,
      settingsBySide: normalizeSettingsBySide(undefined, channels, catalog, 2),
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.runPlans).toHaveLength(4)
      expect(result.value.runPlans.map((item) => `${item.side}:${item.pendingRun.finalPrompt}`)).toEqual([
        'win-1:a long hair portrait',
        'win-2:a long hair portrait',
        'win-1:a short hair portrait',
        'win-2:a short hair portrait',
      ])
    }
  })

  it('rejects structured input when paired lists have different lengths', () => {
    const result = planRunBatch({
      draft: '{{style_names}}作品，{{style_descriptions}}。{{subjects}}中国角色。',
      panelVariables: [
        { id: 's1', key: 'style_names', valuesText: '["漫改","日系职场","日系校园"]', selectedValue: '' },
        { id: 's2', key: 'style_descriptions', valuesText: '["高清写真级 cosplay 摄影，角色高度还原，精致妆容与服装细节, 日本企业写实"]', selectedValue: '' },
        { id: 's3', key: 'subjects', valuesText: '["23岁的女性","24岁的女性","25岁的女性"]', selectedValue: '' },
      ],
      mode: 'single',
      sideCount: 2,
      settingsBySide: normalizeSettingsBySide(undefined, channels, catalog, 2),
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('长度必须一致且大于 0')
    }
  })

  it('aligns structured array items by index when planning runs', () => {
    const result = planRunBatch({
      draft: '{{style_names}}作品，{{style_descriptions}}。{{subjects}}中国角色。',
      panelVariables: [
        { id: 's1', key: 'style_names', valuesText: '["漫改","日系职场","日系校园"]', selectedValue: '' },
        { id: 's2', key: 'style_descriptions', valuesText: '["高清写真级 cosplay 摄影","日本企业写实","办公室荧光灯感、整洁压抑、高清晰度"]', selectedValue: '' },
        { id: 's3', key: 'subjects', valuesText: '["23岁的女性","24岁的女性","25岁的女性"]', selectedValue: '' },
      ],
      mode: 'single',
      sideCount: 2,
      settingsBySide: normalizeSettingsBySide(undefined, channels, catalog, 2),
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.runPlans.map((item) => item.pendingRun.finalPrompt)).toEqual([
        '漫改作品，高清写真级 cosplay 摄影。23岁的女性中国角色。',
        '日系职场作品，日本企业写实。24岁的女性中国角色。',
        '日系校园作品，办公室荧光灯感、整洁压抑、高清晰度。25岁的女性中国角色。',
      ])
    }
  })

  it('keeps singleton structured arrays as one run even if values contain commas', () => {
    const parsed = parseBulkVariables(`{
  "style_names": ["漫改,日系职场,日系校园"],
  "subjects": ["23岁的女性,24岁的女性,25岁的女性"]
}`)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = planRunBatch({
      draft: '{{style_names}}作品，{{subjects}}中国角色。',
      panelVariables: parsed.rows,
      mode: 'single',
      sideCount: 2,
      settingsBySide: normalizeSettingsBySide(undefined, channels, catalog, 2),
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.runPlans).toHaveLength(1)
      expect(result.value.runPlans[0].pendingRun.finalPrompt).toBe(
        '漫改,日系职场,日系校园作品，23岁的女性,24岁的女性,25岁的女性中国角色。',
      )
    }
  })

  it('aligns multi-key panel lists by index', () => {
    const batches = buildPanelVariableBatches([
      { id: 'a', key: 'hair', valuesText: 'long,short', selectedValue: '' },
      { id: 'b', key: 'color', valuesText: 'black,blonde', selectedValue: '' },
    ])

    expect(batches.validation.ok).toBe(true)
    expect(batches.batches).toEqual([
      { hair: 'long', color: 'black' },
      { hair: 'short', color: 'blonde' },
    ])
  })

  it('blocks panel submit when list lengths mismatch', () => {
    const result = planRunBatch({
      draft: 'a {{hair}} {{color}} portrait',
      panelVariables: [
        { id: 'a', key: 'hair', valuesText: 'long,short,black', selectedValue: '' },
        { id: 'b', key: 'color', valuesText: 'red,blue', selectedValue: '' },
      ],
      mode: 'single',
      sideCount: 2,
      settingsBySide: normalizeSettingsBySide(undefined, channels, catalog, 2),
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('长度必须一致且大于 0')
    }
  })

  it('skips dynamic replacement when disabled', () => {
    const result = planRunBatch({
      draft: 'a {{hair}} portrait',
      panelVariables: [{ id: 'a', key: 'hair', valuesText: 'long,short', selectedValue: '' }],
      dynamicPromptEnabled: false,
      mode: 'single',
      sideCount: 2,
      settingsBySide: normalizeSettingsBySide(undefined, channels, catalog, 2),
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.runPlans).toHaveLength(1)
      expect(result.value.runPlans[0].pendingRun.finalPrompt).toBe('a {{hair}} portrait')
      expect(result.value.runPlans[0].pendingRun.variablesSnapshot).toEqual({})
    }
  })

  it('fails planning when panel value format parse fails', () => {
    const result = planRunBatch({
      draft: 'a {{subject}} portrait',
      panelVariables: [{ id: 'x', key: 'subject', valuesText: '["bad",}', selectedValue: '' }],
      panelValueFormat: 'json',
      mode: 'single',
      sideCount: 2,
      settingsBySide: normalizeSettingsBySide(undefined, channels, catalog, 2),
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('JSON 列表解析失败')
    }
  })
})

describe('conversationDomain settings normalization', () => {
  it('keeps backward compatibility for legacy A/B settings keys', () => {
    const settingsA = {
      resolution: '1K',
      aspectRatio: '1:1',
      imageCount: 4,
      gridColumns: 4,
      sizeMode: 'preset' as const,
      customWidth: 1024,
      customHeight: 1024,
      autoSave: true,
      channelId: 'ch-1',
      modelId: 'model-a',
      paramValues: { quality: 'hd' },
    }

    const legacy = {
      A: settingsA,
      B: settingsA,
    } as Partial<Record<Side, SingleSideSettings>>

    const normalized = normalizeSettingsBySide(legacy, channels, catalog, 2)

    expect(normalized['win-1']).toBeDefined()
    expect(normalized['win-2']).toBeDefined()
    expect(normalized['win-1'].modelId).toBe('model-a')
    expect(normalized['win-2'].paramValues.quality).toBe('hd')
  })

  it('drops legacy duplicated size params from normalized model param values', () => {
    const normalized = normalizeSettingsBySide({
      single: {
        generationMode: 'image',
        resolution: '2K',
        aspectRatio: '16:9',
        imageCount: 1,
        gridColumns: 1,
        sizeMode: 'preset',
        customWidth: 1024,
        customHeight: 1024,
        autoSave: false,
        channelId: 'ch-1',
        modelId: 'model-a',
        paramValues: {
          quality: 'hd',
          size: '4K',
          aspectRatio: '1:1',
        },
      },
    }, channels, catalog, 2)

    expect(normalized.single.paramValues).toEqual({ quality: 'hd' })
  })

  it('maps preset size to pixel size in params snapshot', () => {
    const base = normalizeSettingsBySide(undefined, channels, catalog, 2)
    const settingsBySide = {
      ...base,
      single: {
        ...base.single,
        sizeMode: 'preset' as const,
        resolution: '2K',
        aspectRatio: '16:9',
      },
    }

    const result = planRunBatch({
      draft: 'pixel preset',
      panelVariables: [],
      mode: 'single',
      sideCount: 2,
      settingsBySide,
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      const params = result.value.runPlans[0].paramsSnapshot
      expect(params.size).toBe('2752x1536')
      expect(params).not.toHaveProperty('aspectRatio')
    }
  })

  it('maps custom width/height to pixel size in params snapshot', () => {
    const base = normalizeSettingsBySide(undefined, channels, catalog, 2)
    const settingsBySide = {
      ...base,
      single: {
        ...base.single,
        sizeMode: 'custom' as const,
        customWidth: 640,
        customHeight: 960,
      },
    }

    const result = planRunBatch({
      draft: 'pixel custom',
      panelVariables: [],
      mode: 'single',
      sideCount: 2,
      settingsBySide,
      channels,
      modelCatalog: catalog,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      const params = result.value.runPlans[0].paramsSnapshot
      expect(params.size).toBe('640x960')
      expect(params).not.toHaveProperty('aspectRatio')
    }
  })
})
