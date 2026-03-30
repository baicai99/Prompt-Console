# 即梦 `ai-tool/generate` 接口梳理

更新时间: 2026-03-30

目标页面:

- `https://jimeng.jianying.com/ai-tool/generate?workspace=0`

本文档基于两类证据整理:

1. 真实页面加载抓包
2. 页面引用的前端 bundle 静态分析

结论先说:

- 这个页面的大量接口都走 `https://jimeng.jianying.com` 同域 API
- 未登录时页面会命中一批公开接口和登录检测接口，很多生成类接口不会实际触发
- 真正的“生成提交/队列/流式会话/预处理”接口能从前端 bundle 明确提取出来
- 很多生成接口都要求登录态、Cookie、`withCredentials`，部分请求还会附带 `aid/webId/region/web_version/da_version/msToken/a_bogus`

## 1. 抓取方式

我实际做了这几步:

1. `curl` 拉取页面 HTML，提取 SSR 注入数据和 JS chunk 列表
2. 用 Playwright + 本机 Chrome 打开页面，记录 document/xhr/fetch 请求
3. 下载页面引用的 JS chunk，直接从 bundle 中抽取接口路径和调用片段

限制:

- 当前抓取环境未登录，所以“登录后才会真实发出的生成请求”主要依赖前端静态分析，不是运行时实测
- “所有接口”这里按“这个页面及其功能 bundle 中能确认存在的接口”理解，不包含即梦全站所有接口

## 2. 通用请求特征

### 2.1 Host

- 绝大多数接口 host: `https://jimeng.jianying.com`
- 少量监控/实验/配置接口会打到:
  - `https://abtestvm.bytedance.com`
  - `https://mssdk.bytedance.com`
  - `https://mcs.zijieapi.com`
  - `https://mon.zijieapi.com`
  - `https://starling.zijieapi.com`

### 2.2 常见 Header

- `Content-Type: application/json`
- 大部分请求都带 Cookie，且客户端配置了 `withCredentials: true`
- 某些模型/控制类接口还会带:
  - `X-Platform: pc`
  - `Device-Type: web`
  - `ch: online`

### 2.3 常见 Query 参数

运行时抓到或 bundle 中能确认的公共参数包括:

- `aid=513695`
- `device_platform=web`
- `region=CN`
- `web_id=<动态值>`
- `web_version=7.5.0`
- `da_version=3.3.12` 或 `3.1.3`
- `msToken=<动态值>`
- `a_bogus=<动态值>`
- `needCache=true/false`
- `needRefresh=true/false`

Agent 流式接口额外会补:

- `web_component_open_flag=<动态值>`
- `commerce_with_input_video=1`

### 2.4 登录要求

未登录实测返回:

- `GET /passport/account/info/v2/`:
  - `error_code: 13`
  - `message: "error"`
- `POST /lv/v1/user/get_enable_list`:
  - `ret: "1015"`
  - `errmsg: "check login error"`
- `POST /mweb/v1/get_user_local_item_list`:
  - `ret: "1015"`
  - `errmsg: "login error"`

所以:

- 生成类接口基本都要求登录态
- 本文里的请求示例都应视为“带有效 Cookie 后再调用”

## 3. 运行时实际抓到的接口

下面这些是页面加载时真实发出的请求。

| 方法 | 路径 | 作用 | 备注 |
| --- | --- | --- | --- |
| GET | `/api/v1/web-cookie-privacy/config` | Cookie/隐私配置 | 公开接口 |
| GET | `/passport/account/info/v2/` | 登录态检查 | 未登录返回 `error_code=13` |
| POST | `/lv/v1/user/get_enable_list` | 用户能力开关 | 未登录返回 `ret=1015` |
| POST | `/mweb/v1/creation_agent/v2/get_agent_config` | Agent 模式配置 | 生成页会加载 |
| POST | `/mweb/v1/video_generate/get_common_config` | 视频生成模型配置 | 页面加载时触发 |
| POST | `/mweb/search/v1/guess` | 搜索/提示词猜你想搜 | 返回 `guess_list` |
| POST | `/mweb/v1/feed` | 素材/模板 feed | 页面加载时就会拉 |
| POST | `/mweb/v1/get_user_local_item_list` | 用户本地/私有素材列表 | 未登录返回登录错误 |
| POST | `/mweb/v1/get_weekly_challenge_list` | 周活动列表 | 页面加载触发 |
| POST | `/mweb/v1/get_explore` | 探索流/模板流 | 页面加载触发 |
| POST | `/commerce/v1/resource_position` | 商业化资源位 | 返回 `resource_info` |
| POST | `/mweb/v1/gen_help_desk_token` | 帮助中心 token | 客服入口相关 |
| POST | `/mweb/v1/get_help_desk_entrance` | 帮助中心跳转入口 | 客服入口相关 |
| POST | `/luckycat/cn/jianying/campaign/v1/dreamina/web/resource` | 活动资源 | 页面加载触发 |
| POST | `/mweb/v1/batch_collect` | 埋点/批量行为上报 | 页面加载时会发 |

### 3.1 运行时返回样例

`POST /mweb/search/v1/guess`

- 返回字段里有 `data.guess_list`
- 内容是“包装 / 建筑 / 书法字 / 涂鸦 / 标题 ...”

`POST /mweb/v1/feed`

- 返回 `data.item_list`
- 每个 item 带 `effect_id / effect_type / cover_url / item_urls`

`POST /mweb/v1/video_generate/get_common_config`

- 返回 `data.model_list`
- 每个模型包含:
  - `model_name`
  - `model_req_key`
  - `options`
  - `commercial_config`

`POST /mweb/v1/creation_agent/v2/get_agent_config`

- 返回 `data.image_data.model_list`
- 能确认这是图片生成 Agent 配置入口之一

## 4. 登录后实际抓到的新增接口

这部分是我在临时 Chrome 窗口手动登录后，再次对同一页面抓包得到的结果。

和未登录相比，登录后新增或从错误态变为成功态的重点接口有:

| 方法 | 路径 | 用途 | 登录后状态 |
| --- | --- | --- | --- |
| POST | `/mweb/v1/get_user_info` | 当前用户资料 | 成功 |
| POST | `/mweb/v1/get_settings` | 用户设置 | 成功 |
| POST | `/mweb/v1/workspace/list` | 对话工作区列表 | 成功 |
| POST | `/cc/v1/workspace/get_user_workspaces` | 工作区列表，CC 体系 | 成功 |
| POST | `/mweb/v1/infinite_canvas/list_project` | 无限画布项目列表 | 成功 |
| POST | `/mweb/v1/get_user_local_item_list` | 用户本地素材/声音等 | 成功 |
| POST | `/mweb/v1/get_asset_list` | 资产列表 | 成功 |
| POST | `/mweb/v1/get_image_by_uri` | URI 转图像 URL | 成功 |
| POST | `/mweb/v1/cc_data_sync/get_account_info` | 账号同步信息 | 成功 |
| POST | `/commerce/v1/common/start_up` | 商业化启动配置 | 成功 |
| POST | `/commerce/v1/benefits/user_credit` | 当前积分/权益 | 成功 |
| POST | `/commerce/v1/benefits/user_credit_history` | 积分历史 | 成功 |
| POST | `/commerce/v1/purchase/price_list` | 购买价格列表 | 成功 |
| POST | `/commerce/v1/subscription/price_list` | 订阅价格列表 | 成功 |
| POST | `/commerce/v1/subscription/user_info` | 订阅用户信息 | 成功 |
| POST | `/commerce/v3/benefits/batch_get_user_benefit` | 批量权益查询 | 成功 |
| POST | `/commerce/v3/resource/benefit_metadata` | 权益元数据 | 成功 |
| POST | `/commerce/v1/benefits/credit_receive` | 积分领取 | 页面加载触发 |

### 4.1 登录态真实返回样例

`POST /mweb/v1/get_user_info`

- 返回里能确认:
  - `name: "LA"`
  - `uid`
  - `sec_uid`
  - `avatar_url`

`POST /mweb/v1/get_settings`

- 返回里能确认:
  - `user_custom_settings.work_sharing_allowed`
  - `allow_remake`
  - `agent_credit_consume_warn`
  - `infinite_canvas_credit_consume_warn`
  - `close_watermark`

`POST /mweb/v1/workspace/list`

- 返回里能确认:
  - `data.workspaces`
  - 每个 workspace 有:
    - `workspace_id`
    - `name`
    - `is_pinned`
    - `create_time`
    - `update_time`
    - `cover_image` 可选

`POST /mweb/v1/get_user_local_item_list`

- 登录后从未登录时的 `ret=1015` 变为:
  - `ret: "0"`
  - `data.item_list: []`

### 4.2 登录态加载时抓到的实际请求体

下面这些是页面登录后首屏加载时真实发出的 body。

#### `POST /mweb/v1/cc_data_sync/get_account_info`

```json
{
  "account_type": "capcut"
}
```

#### `POST /mweb/v1/video_generate/get_common_config`

页面登录后实际打了两个 scene:

```json
{
  "scene": "lip_sync_image_generate_video",
  "params": {}
}
```

```json
{
  "scene": "lip_sync_video_generate_video",
  "params": {}
}
```

#### `POST /mweb/v1/creation_agent/v2/get_agent_config`

```json
{}
```

#### `POST /mweb/v1/get_user_local_item_list`

```json
{
  "offset": 0,
  "count": 50,
  "effect_type": 218,
  "filter_opt": {
    "clone_voice_status": [1, 2]
  },
  "pack_local_item_opt": {
    "need_favorite_info": true
  }
}
```

这说明当前生成页还会把“克隆声音”资产作为本地素材加载进来。

#### `POST /mweb/v1/workspace/list`

```json
{}
```

#### `POST /mweb/v1/get_asset_list`

这是登录后最有价值的一个真实 body 之一，页面会携带大量图片规格参数:

```json
{
  "count": 20,
  "direction": 1,
  "mode": "workbench",
  "option": {
    "image_info": {
      "width": 2048,
      "height": 2048,
      "format": "webp"
    },
    "origin_image_info": {
      "width": 96,
      "height": 2048,
      "format": "webp"
    },
    "order_by": 0,
    "only_favorited": false,
    "end_time_stamp": 0
  }
}
```

实际请求里还带了完整 `image_scene_list`，包括:

- `2400`
- `1080`
- `900`
- `720`
- `480`
- `360`

#### `POST /cc/v1/workspace/get_user_workspaces`

```json
{
  "count": 100,
  "cursor": "0",
  "need_convert_workspace": true
}
```

#### `POST /mweb/v1/infinite_canvas/list_project`

```json
{
  "cursor": 0,
  "limit": 20,
  "image_info": {
    "image_scene_list": [
      {"width": 20, "height": 20, "uniq_key": "20"},
      {"width": 200, "height": 200, "uniq_key": "200"},
      {"width": 360, "height": 360, "uniq_key": "360"},
      {"width": 480, "height": 480, "uniq_key": "480"}
    ]
  }
}
```

#### `POST /mweb/v1/get_image_by_uri`

页面真实请求体:

```json
{
  "uris": [
    "tos-cn-i-tb4s082cfz/01540f5e8f9d9043e0f76994ccc33f9b.jpg",
    "tos-cn-i-tb4s082cfz/perfumenoctis.png",
    "tos-cn-i-tb4s082cfz/c-1.png",
    "tos-cn-i-tb4s082cfz/c-2.png"
  ]
}
```

#### `POST /mweb/v1/get_user_info`

页面真实请求体:

```json
{
  "sec_uid": "<当前登录用户 sec_uid>"
}
```

#### `POST /commerce/v1/benefits/user_credit`

```json
{}
```

#### `POST /commerce/v1/benefits/user_credit_history`

```json
{
  "count": 20,
  "cursor": "0"
}
```

## 5. 手工补测的登录态接口

为了避免误触发生成计费，我只手工补测了低风险接口。

### 5.1 `POST /mweb/v1/get_upload_token`

请求体:

```json
{
  "scene": 3
}
```

返回登录态实测成功，字段包括:

- `access_key_id`
- `secret_access_key`
- `session_token`
- `expired_time`
- `current_time`
- `space_name`
- `upload_domain`
- `space_type`
- `region`

这条接口已经足够复刻素材上传链路。

### 5.2 `POST /mweb/v1/get_panel_info`

我手工用最小 body 试了:

```json
{
  "panel": "dreamina_tone",
  "panelSource": "loki",
  "appId": 1775
}
```

返回:

- `ret: "2012"`
- `errmsg: "get panel info failed"`

说明:

- 这条接口不是只靠 `panel/panelSource/appId` 就能成功
- 页面里应该还依赖额外上下文或请求封装

### 5.3 `POST /mweb/v1/get_asset_list`

我手工用极简 body 试了:

```json
{
  "panel": "dreamina_tone",
  "panelSource": "loki",
  "appId": 1775,
  "packItemOpt": {
    "needFavoriteInfo": true
  }
}
```

返回:

- `ret: "2054"`
- `errmsg: "get asset list failed"`

说明:

- 真正可用的 body 要比这个复杂
- 应以页面真实加载时抓到的 body 为准

### 5.4 `POST /mweb/v1/get_image_by_uri`

我手工用空列表试了:

```json
{
  "uri_list": []
}
```

返回:

- `ret: "1000"`
- `errmsg: "invalid parameter"`

说明:

- 真实字段名应以页面实际抓包为准，即 `uris`
- 且通常需要非空数组
## 6. 生成主链路接口

这部分是从 bundle 中直接提取出来的，属于最核心的一组。

### 4.1 提交生成

#### `POST /mweb/v1/aigc_draft/generate`

用途:

- 图片/视频等 AIGC 草稿生成提交主接口

前端调用特征:

- body: 提交对象 `e`，前端会额外注入:
  - `httpCommonInfo: { aid: 513695 }`
- query params:
  - `aid`
  - `device_platform=web`
  - `region`
  - `webId`
  - `da_version=3.1.3`
  - `os` 可选
  - 再叠加业务参数对象 `t`
  - `babi_param=<JSON.stringify(t.babiParam)>`
  - `commerce_with_input_video=1`

返回:

- 成功时取 `data.aigc_data`
- 错误时会解析:
  - `ret`
  - `errmsg`
  - `data.fail_code`
  - `data.fail_starling_message`

调用片段要点:

```ts
POST /mweb/v1/aigc_draft/generate
body = {
  ...draftPayload,
  httpCommonInfo: { aid: 513695 }
}
query = {
  aid,
  device_platform: "web",
  region,
  webId,
  da_version: "3.1.3",
  ...bizParams,
  babi_param: JSON.stringify(bizParams.babiParam),
  commerce_with_input_video: "1"
}
```

#### `POST /mweb/v1/aigc_draft/generate_accelerate`

用途:

- 对排队中的任务做“加速”

前端实际构造的请求体之一:

```json
{
  "historyInfoList": [
    {
      "historyId": "<historyId>",
      "localQueueInfo": {
        "queueIdx": 1,
        "queueLength": 20
      }
    }
  ],
  "scene": 0
}
```

另一个变体:

```json
{
  "scene": 1
}
```

含义:

- `scene: 0` 是针对当前具体排队任务加速
- `scene: 1` 看起来是 VIP/批量刷新相关加速调用

#### `POST /mweb/v1/aigc_draft/cancel_generate`

用途:

- 取消排队或进行中的生成任务

前端调用实参能确认到:

```json
{
  "historyId": "<historyId>"
}
```

### 4.2 队列与历史

#### `POST /mweb/v1/get_history_queue_info`

用途:

- 轮询历史任务的排队状态

前端调用实参:

```json
{
  "historyIds": ["<historyId1>", "<historyId2>"]
}
```

前端会把返回值按 `historyId` 映射，读取:

- `status`
- `queueInfo`
- `forecastCostTime`

#### `POST /mweb/v1/mget_item_info`

用途:

- 批量获取已发布历史作品详情

前端说明:

- body 来自 `_convertRequestToServerRequest(e)`
- 如果传了 `imageResolutionStrategy`，会额外打包成 `imageInfo`
- 如果是下载场景，还会带 `isForVideoDownload`

因此它是“历史详情/下载详情”的关键接口。

#### `POST /mweb/v1/get_local_item_list`

用途:

- 获取未发布或本地态作品详情

和 `mget_item_info` 组成一对:

- `mget_item_info`: 已发布/历史详情
- `get_local_item_list`: 本地未发布详情

## 5. 模型、提示词与上传接口

### 5.1 图片模型配置

#### `POST /mweb/v1/get_common_config`

用途:

- 获取图片模型配置

请求体:

```json
{
  "isClientFilter": true,
  "needBetaModel": true
}
```

常见 query:

- `needCache`
- `needRefresh`

### 5.2 图片描述/反推提示词

#### `POST /mweb/v1/get_image_description`

用途:

- 根据图片拿描述或 prompt

前端调用方式:

```ts
POST /mweb/v1/get_image_description
body = imagePayload
query = extraParams
```

### 5.3 上传 token

#### `POST /mweb/v1/get_upload_token`

用途:

- 获取上传素材到对象存储所需的临时 token

请求体:

```json
{
  "scene": 3
}
```

前端会把返回转换为:

- `accessKeyId`
- `secretAccessKey`
- `sessionToken`
- `expiredTime`
- `currentTime`
- `region`
- `serviceId`/`spaceName`

### 5.4 图片打包与 URI 解析

#### `POST /mweb/v1/mpack_image`

用途:

- 将图片输入打包成后续生成链路需要的结构

#### `POST /mweb/v1/get_image_by_uri`

用途:

- 把内部 `uri` 解析为可直接访问的图片 URL

返回会整理成:

```json
{
  "uri2Image": {
    "<uri>": {
      "imageUri": "<uri>",
      "imageUrl": "<signed url>",
      "width": 1024,
      "height": 1024
    }
  }
}
```

#### `POST /mweb/v1/get_video_by_vid`

用途:

- 根据视频 `vid` 取视频详情和可播放地址

返回中会包含:

- `vid`
- `fps`
- `width`
- `height`
- `duration`
- `video_url`
- `cover_url`
- `transcoded_video`

## 6. 视频预处理与检测接口

这一组对“图生视频/数字人/口型/控制图”很关键。

### 6.1 视频预处理

#### `POST /mweb/v1/video_generate/pre_process`

用途:

- 提交视频预处理任务

请求体:

```json
{
  "inputList": [
    {
      "...": "具体预处理任务对象"
    }
  ]
}
```

返回:

- `data.taskList`

#### `POST /mweb/v1/video_generate/mget_pre_process_result`

用途:

- 批量查询预处理任务结果

请求体:

```json
{
  "submitIdList": ["<submitId1>", "<submitId2>"]
}
```

返回:

- `data.taskList`

### 6.2 控制图/识别/抠图

#### `POST /mweb/v1/blend_preview`

用途:

- ControlNet/参考图预览

调用方式:

```ts
POST /mweb/v1/blend_preview
body = previewPayload
query = extraParams
```

#### `POST /mweb/v1/pose_detect`

用途:

- 姿态检测

调用方式:

```ts
POST /mweb/v1/pose_detect
body = payload
query = extraParams
```

#### `POST /mweb/v1/face_recognize`

用途:

- 人脸识别

调用方式:

```ts
POST /mweb/v1/face_recognize
body = payload
options = requestOptions
```

#### `POST /mweb/v1/saliency_seg`

用途:

- 显著性分割/主体抠图

调用方式:

```ts
POST /mweb/v1/saliency_seg
body = payload
options = requestOptions
```

## 7. Agent / Infinite Canvas 流式接口

这是生成页里最像“对话式生成器”的一组接口。

### 7.1 接口列表

- `POST /mweb/v1/creation_agent/v2/conversation`
- `POST /mweb/v1/creation_agent/v2/resume`
- `POST /mweb/v1/creation_agent/v2/stop_stream`

Infinite Canvas 变体:

- `POST /mweb/v1/infinite_canvas/conversation`
- `POST /mweb/v1/infinite_canvas/resume`
- `POST /mweb/v1/infinite_canvas/stop_stream`
- `POST /mweb/v1/infinite_canvas/edit`

### 7.2 调用方式

前端不是普通 JSON API 调用，而是 `fetch + text/event-stream`:

```http
Accept: text/event-stream
Content-Type: application/json
credentials: include
```

公共 query 参数会自动拼上:

- `aid`
- `device_platform=web`
- `region`
- `webId`
- `da_version=3.1.3`
- `web_version=7.5.0`
- `web_component_open_flag=<动态值>`
- `commerce_with_input_video=1`

如果前端上下文里有 `projectId/workspaceId`，会把它们注入 body:

```json
{
  "...原始请求体": "...",
  "project_id": "<projectId>",
  "workspace_id": 0
}
```

### 7.3 创建会话时前端配置

前端显式构造:

- `endpoint = /conversation`
- `reconnectEndpoint = /resume`
- `interruptEndpoint = /stop_stream`
- `headers = { pf: "7" }`

说明:

- 这是一个标准的“创建流式会话 -> 断线续传 -> 中断流”设计
- 真正业务内容在 body 的 `messages` 或 message payload 里

## 8. 主体、声音、TTS 相关接口

这几组虽然不是页面首屏必打，但 bundle 明确引用了。

### 8.1 主体库

- `POST /mweb/v1/dreamina_subject/create`
- `POST /mweb/v1/dreamina_subject/get`
- `POST /mweb/v1/dreamina_subject/update`
- `POST /mweb/v1/dreamina_subject/delete`

用途:

- 角色/主体资源的创建、读取、修改、删除

### 8.2 声音克隆与声音资源

- `POST /mweb/v1/voice/submit_task`
- `POST /mweb/v1/voice/query_task`
- `POST /mweb/v1/voice/update`
- `POST /mweb/v1/voice/delete`
- `POST /mweb/v1/simple_favorite_item`

用途:

- 提交声音克隆任务
- 查询声音任务
- 更新克隆声音
- 删除克隆声音
- 收藏声音资源

### 8.3 TTS

#### `POST /mweb/v1/tts_generate`

用途:

- 文本转语音

前端请求体能明确还原出主要字段:

```json
{
  "text": "<文本>",
  "idInfo": {
    "id": "<voice id>",
    "itemPlatform": "<item platform>"
  },
  "audioConfig": {
    "format": "mp3",
    "pitchRate": 0,
    "sampleRate": 24000,
    "speechRate": 0,
    "emotion": "<可选>",
    "emotionScale": "<可选>"
  }
}
```

同时会带业务 query:

```json
{
  "babiParam": {
    "scenario": "image_video_generation",
    "featureKey": "to_video-voice",
    "featureEntrance": "<动态入口>",
    "featureEntranceDetail": "<动态入口>-voice"
  }
}
```

## 9. 其它页面相关接口

下面这些也在 generate 页 bundle 里出现过:

- `POST /mweb/v1/get_panel_info`
- `POST /mweb/v1/feed`
- `POST /mweb/v1/simple_favorite_item`
- `POST /mweb/v1/locate_workbench`
- `POST /mweb/v1/submit_async_task`
- `POST /mweb/v1/mget_async_task`
- `POST /mweb/v1/remove_history`
- `POST /mweb/v1/mark_favorite_items`
- `POST /mweb/v1/update_video_default_bgm`
- `POST /mweb/v1/mix_audio_video`
- `POST /mweb/v1/mix_audio_videos`
- `POST /mweb/v1/workspace/create`
- `POST /mweb/v1/workspace/delete`
- `POST /mweb/v1/workspace/list`
- `POST /mweb/v1/workspace/update`

这些接口在当前未登录抓包中没有全部触发，但属于页面功能代码明确引用的接口。

## 10. 关键接口使用示例

注意:

- 以下示例都是“带有效登录 Cookie 的复刻写法”
- `msToken/a_bogus` 是否必需，取决于具体接口和风控策略
- 实际业务 body 需要从前端 state 拼出来

### 10.1 获取上传 token

```bash
curl 'https://jimeng.jianying.com/mweb/v1/get_upload_token' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <your cookies>' \
  --data-raw '{"scene":3}'
```

### 10.2 查询历史队列

```bash
curl 'https://jimeng.jianying.com/mweb/v1/get_history_queue_info' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <your cookies>' \
  --data-raw '{"historyIds":["7599999999999999999"]}'
```

### 10.3 取消生成

```bash
curl 'https://jimeng.jianying.com/mweb/v1/aigc_draft/cancel_generate' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <your cookies>' \
  --data-raw '{"historyId":"7599999999999999999"}'
```

### 10.4 视频预处理

```bash
curl 'https://jimeng.jianying.com/mweb/v1/video_generate/pre_process' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <your cookies>' \
  --data-raw '{
    "inputList": [
      {
        "submitId": "local-test-1",
        "scene": "example",
        "videoLipSyncProcess": {
          "video": { "vid": "<video vid>" }
        }
      }
    ]
  }'
```

### 10.5 Agent 流式会话

```bash
curl -N 'https://jimeng.jianying.com/mweb/v1/creation_agent/v2/conversation?aid=513695&device_platform=web&region=CN&webId=<webId>&da_version=3.1.3&web_version=7.5.0' \
  -H 'Accept: text/event-stream' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <your cookies>' \
  -H 'pf: 7' \
  --data-raw '{
    "messages": [
      {
        "id": "msg-user-1",
        "author": { "role": "user" },
        "content": "帮我生成一张未来城市海报"
      }
    ],
    "project_id": "<project id>",
    "workspace_id": 0
  }'
```

## 11. 建议怎么继续深挖

如果你后面要把这些接口做成可复用脚本，建议按这个顺序继续:

1. 先登录网页版，导出完整 HAR
2. 优先复刻这几条:
   - `/mweb/v1/get_upload_token`
   - `/mweb/v1/aigc_draft/generate`
   - `/mweb/v1/get_history_queue_info`
   - `/mweb/v1/aigc_draft/cancel_generate`
3. 如果要做 Agent 模式，再复刻:
   - `/mweb/v1/creation_agent/v2/conversation`
   - `/mweb/v1/creation_agent/v2/resume`
   - `/mweb/v1/creation_agent/v2/stop_stream`
4. 如果要做数字人/口型/控制图，再复刻:
   - `/mweb/v1/video_generate/pre_process`
   - `/mweb/v1/video_generate/mget_pre_process_result`
   - `/mweb/v1/face_recognize`
   - `/mweb/v1/pose_detect`
   - `/mweb/v1/saliency_seg`

## 12. 本次抓到的证据文件

本地临时文件:

- `/tmp/jimeng_generate.html`
- `/tmp/jimeng_network_load.json`
- `/tmp/jimeng/alljs/`

仓库内整理文档:

- `docs/jimeng-generate-apis.md`
