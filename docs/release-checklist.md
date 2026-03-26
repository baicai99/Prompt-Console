# 上线检查清单

适用于当前静态前端发布模型。目标是在发布前把仓库内门禁、手工回归、发布动作和回滚路径拉通。

## 1. 本地门禁

发布前必须在干净工作区通过：

```bash
npm run ci
```

检查项包括：

- ESLint
- 架构边界检查
- 复杂度检查
- Vitest
- TypeScript + Vite 生产构建
- 主包体积检查

如需在生产产物下做冒烟，运行：

```bash
npm run preview -- --host 127.0.0.1
```

重点确认：

- 首页可正常加载
- 路由刷新不白屏
- `dist/assets/index*.js` 小于 `1850 KB`

## 2. 配置与部署

生产环境默认保持以下变量关闭：

```bash
VITE_ENABLE_RUNTIME_METRICS=false
VITE_ENABLE_CHAT_MEMORY_DIAGNOSTICS=false
VITE_ENABLE_STRICT_MODE=false
```

发布前核对：

- 目标托管方式是否兼容 `vite.config.ts` 中的 `base: './'`
- HTTPS、CORS、超时、限流策略是否与目标渠道兼容
- 静态资源缓存刷新策略是否明确
- 构建产物来源是否唯一且可追溯

## 3. Provider 契约验收

至少用 1 个真实可用渠道验证以下能力：

- `GET /v1/models`
- `POST /v1/images/generations`
- `POST /v1/images/edits`
- `POST /mj/submit/imagine`
- `GET /mj/task/:taskId/fetch`

重点关注：

- 认证头是否正确
- `baseUrl` 自动归一化是否正常
- 模型列表解析、图片返回字段兼容、错误文案映射是否可用

## 4. 核心回归

在干净浏览器存储下完成一轮：

1. 新增渠道并拉取模型
2. 文生图发送、查看、下载、失败重试、Replay
3. 图生图上传、粘贴、拖拽、删除、清空、重试
4. 多窗口配置切换
5. 动态变量编辑、模板预览、批量运行
6. 刷新后恢复会话、渠道、侧栏状态和 staged settings

再用已有旧数据状态完成一轮：

1. 会话迁移
2. `indexedDB` 不可用时的 `localStorage` 回退
3. 大会话、长 prompt、多图结果下的滚动和存储稳定性

建议浏览器矩阵：

- Chrome
- Safari
- Edge

## 5. 上线后观察

当前仓库已内置最小运行时异常缓冲：

- 自动记录未捕获异常
- 自动记录未处理 Promise 拒绝
- 自动记录脚本、图片、样式等资源加载失败
- 在诊断面板中可复制最近异常快照，附带版本号和页面地址

发布当天重点观察：

- 页面是否白屏
- 模型拉取失败率
- 生成成功率和超时情况
- 图片下载失败率
- 浏览器控制台和诊断面板中的运行时异常

## 6. 回滚

发布前必须明确：

- 上一个稳定构建产物的位置
- 回滚执行人
- 缓存刷新方式
- 回滚验证步骤

最小回滚演练要求：

1. 切回上一版静态资源
2. 清理或刷新 CDN / 网关缓存
3. 打开首页并验证主路径
4. 核对设置面板中的版本号已回退
