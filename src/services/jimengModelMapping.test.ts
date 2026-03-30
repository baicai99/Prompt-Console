import { describe, expect, it } from 'vitest'
import { mapJimengImageConfigToModelCatalog } from './jimengModelMapping'

describe('jimengModelMapping', () => {
  it('maps Jimeng image model config into internal model specs', () => {
    const catalog = mapJimengImageConfigToModelCatalog({
      data: {
        model_list: [
          {
            model_req_key: 'high_aes_general_v50',
            model_name: '图片5.0 Lite',
            generation_category_name: '5.0 Lite',
            sample_steps: {
              steps: 16,
              min_steps: 10,
              max_steps: 41,
            },
            blend_enable: {
              face_swap: true,
              bg_paint: false,
              canny: true,
              depth: false,
              pose: true,
            },
            feat_config: {
              canny: { strength: 0.6 },
              pose: { strength: 0.7 },
            },
            feats: ['new_model', 'support_subject'],
            extra: {
              model_source: 'by Seedream 5.0 Lite',
              raw_model_source: 'Seedream 5.0 Lite',
            },
            resolution_map: {
              '2k': {
                image_ratio_sizes: [
                  { ratio_type: 1, width: 2048, height: 2048 },
                  { ratio_type: 3, width: 2560, height: 1440 },
                ],
              },
              '4k': {
                image_ratio_sizes: [
                  { ratio_type: 1, width: 4096, height: 4096 },
                  { ratio_type: 5, width: 3040, height: 5404 },
                ],
              },
            },
          },
        ],
      },
    })

    expect(catalog.models).toHaveLength(1)
    expect(catalog.models[0]).toMatchObject({
      id: '__jimeng-proxy__::high_aes_general_v50',
      rawId: 'high_aes_general_v50',
      sourceName: '即梦图片',
    })
    expect(catalog.models[0].params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'resolution',
          type: 'enum',
          default: '2k',
          options: ['2k', '4k'],
        }),
        expect.objectContaining({
          key: 'aspectRatio',
          type: 'enum',
          default: '1:1',
          options: expect.arrayContaining(['1:1', '16:9', '9:16']),
        }),
        expect.objectContaining({
          key: 'steps',
          type: 'number',
          default: 16,
          min: 10,
          max: 41,
        }),
        expect.objectContaining({
          key: 'enableFaceSwap',
          type: 'boolean',
          default: false,
        }),
        expect.objectContaining({
          key: 'enableCanny',
          type: 'boolean',
          default: false,
        }),
        expect.objectContaining({
          key: 'enableCannyStrength',
          type: 'number',
          default: 0.6,
        }),
        expect.objectContaining({
          key: 'enablePose',
          type: 'boolean',
          default: false,
        }),
        expect.objectContaining({
          key: 'enablePoseStrength',
          type: 'number',
          default: 0.7,
        }),
      ]),
    )
  })

  it('returns an empty catalog when payload shape is invalid', () => {
    expect(mapJimengImageConfigToModelCatalog({})).toEqual({ models: [] })
  })
})
