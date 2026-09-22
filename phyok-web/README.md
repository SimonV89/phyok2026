# 《心理学空间·自我探索Agent Pro》React 前端架构起始说明

## 1. 目录目的

此目录作为新 Web 前端的起始目录。

当前阶段只做架构，不立即生成完整业务工程。

目标是先把：

- 技术栈
- 目录结构
- 状态管理
- CMS 与 Chat Web 的边界
- Monorepo 组织方式

定清楚，再进入工程初始化。

推荐入口：

- 前端文档索引：[FRONTEND_DOCS_INDEX.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/FRONTEND_DOCS_INDEX.md)
- 全栈 API 与协议规范：[FULL_STACK_API_PROTOCOL_SPEC.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-node/docs/FULL_STACK_API_PROTOCOL_SPEC.md)

---

## 2. 技术栈结论

前端建议统一采用：

- `Next.js App Router`
- `React 19`
- `TypeScript 5`
- `pnpm workspace`
- `Turborepo`
- `Redux Toolkit`
- `Redux DevTools`
- `TanStack Query`
- `TanStack Table`
- `TanStack Virtual`
- `Tailwind CSS` 或 `UnoCSS` 二选一

## 2.1 为什么这样选

### `Next.js App Router`

- 适合 Web Chat 与 CMS 共仓
- 路由组织清晰
- 支持服务端组件和流式 UI

### `Redux Toolkit`

- 经典的可观测单向数据流
- 原生支持时间漫游调试
- 对复杂聊天状态、输入附件状态、会话状态更稳

### `TanStack Query`

- 专门负责 server state
- 非常适合：
  - 分页列表
  - 指标查询
  - 会话详情
  - 审计分页

### `TanStack Table / Virtual`

- CMS 列表页性能更好
- 适合大数据分页表格

---

## 3. 状态管理分层

统一采用三层：

## 3.1 UI State

由组件本地 state 处理：

- 输入框展开状态
- 弹窗开关
- hover / focus

## 3.2 App State

由 `Redux Toolkit` 处理：

- 当前会话
- 聊天输入草稿
- 上传附件状态
- SSE 流式消息状态
- 用户登录态投影
- 全局 UI 偏好

## 3.3 Server State

由 `TanStack Query` 处理：

- 用户列表
- 账单列表
- 审计事件列表
- 指标数据
- 会话历史分页
- 文件解析任务状态

原则：

- 不要让 `Redux` 承担所有请求缓存
- 不要让 `TanStack Query` 接管所有前端交互状态

---

## 4. Monorepo 规划

推荐结构：

```text
phyok-web/
  apps/
    chat-web/
    cms-admin/
  packages/
    ui/
    tokens/
    eslint-config/
    types/
    api-client/
    store/
    utils/
  docs/
    architecture/
```

当前阶段建议直接把这些目录建出来，即使先只有 README，也能让后续工程初始化不再从零开始。

## 4.1 `apps/chat-web`

定位：

- 用户聊天端
- 单聊天框
- 多模态输入
- 流式回复
- 记忆依据展示

## 4.2 `apps/cms-admin`

定位：

- 运营后台
- 指标页
- 用户 / 付费 / 投诉 / 审计分页查询

## 4.3 `packages/store`

定位：

- Redux slices
- store 配置
- 中间件
- DevTools 配置

## 4.4 `packages/api-client`

定位：

- `fetch` / `axios` 封装
- 鉴权头处理
- `/v2` API SDK

## 4.5 `packages/domain`

定位：

- 聊天领域模型
- 记忆领域模型
- CMS 领域类型
- 前后端共享 DTO

---

## 5. 路由设计

## 5.1 Chat Web

建议路由：

- `/`
- `/chat/[conversationId]`
- `/settings`
- `/profile`

## 5.2 CMS Admin

建议路由：

- `/dashboard`
- `/users`
- `/billing/orders`
- `/complaints`
- `/audit/events`
- `/conversations/[conversationId]`

---

## 6. Chat Web 核心页面设计

## 6.1 单聊天框原则

整体风格参考：

- Codex
- Trae Work

界面要求：

- 单主输入区
- 支持文档、图片、语音上传
- 流式输出
- 依据引用卡片

## 6.2 消息模型

建议统一消息结构：

- `messageId`
- `conversationId`
- `role`
- `content`
- `attachments`
- `citations`
- `streamStatus`
- `createdAt`

## 6.3 上传模型

附件统一结构：

- `assetId`
- `assetType`
- `fileName`
- `parseStatus`
- `previewUrl`

## 6.4 前端模块切分

建议按 feature 组织：

- `features/chat`
- `features/attachments`
- `features/memory-citations`
- `features/session`
- `features/profile`

这样更适合单聊天框产品持续演进。

---

## 7. CMS 核心页面设计

## 7.1 仪表盘

展示：

- 用户指标
- 付费指标
- 投诉指标
- 审计指标
- 系统资源

## 7.2 列表页

统一要求：

- 分页
- 关键字搜索
- 时间范围筛选
- 排序
- 行详情抽屉

---

## 8. SSE 与流式处理

主聊天 SSE 来自：

- Node `api-bff-gateway` / `agent-runtime-langgraph`

媒体类轻量进度流来自：

- `node-capability-service`

前端接入原则：

- SSE 连接状态放 Redux
- 流式消息增量合并放 Redux
- 任务轮询与后台分页数据走 TanStack Query

## 8.1 聊天前端关键 Slice

建议最少拆这些 slice：

- `chatSessionsSlice`
- `chatComposerSlice`
- `chatStreamSlice`
- `attachmentsSlice`
- `uiPreferenceSlice`

## 8.2 Query Key 规范

建议统一：

- `['dashboard', 'overview']`
- `['users', pageNo, filters]`
- `['billing-orders', pageNo, filters]`
- `['audit-events', pageNo, filters]`
- `['conversation-history', conversationId, cursor]`
- `['media-task', taskId]`

---

## 9. 前端安全

- 统一只请求 `/v2/*`
- Token 由 httpOnly Cookie 或安全 header 方案管理
- CMS 与 Chat 可使用不同鉴权域
- 敏感导出操作必须确认

---

## 10. 下一步建议

当前目录完成的是架构起点。

下一步可继续：

1. 初始化 `pnpm workspace + turborepo`
2. 建 `apps/chat-web`
3. 建 `apps/cms-admin`
4. 建 `packages/store`
5. 建 `packages/api-client`
6. 建 `packages/domain`
7. 建 `docs/architecture`

推荐先读：

- 前端文档索引：[FRONTEND_DOCS_INDEX.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/FRONTEND_DOCS_INDEX.md)
- 全栈 API 与协议规范：[FULL_STACK_API_PROTOCOL_SPEC.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-node/docs/FULL_STACK_API_PROTOCOL_SPEC.md)
- 总体前端架构：[FRONTEND_MONOREPO_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/FRONTEND_MONOREPO_ARCHITECTURE.md)
- Chat Web 架构：[CHAT_WEB_APP_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/CHAT_WEB_APP_ARCHITECTURE.md)
- CMS Admin 架构：[CMS_ADMIN_APP_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/CMS_ADMIN_APP_ARCHITECTURE.md)
- 状态流与 SSE：[FRONTEND_STATE_STREAMING_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/FRONTEND_STATE_STREAMING_ARCHITECTURE.md)
- 设计系统：[FRONTEND_DESIGN_SYSTEM_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/FRONTEND_DESIGN_SYSTEM_ARCHITECTURE.md)
- 聊天端应用：[README.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/apps/chat-web/README.md)
- CMS 应用：[README.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/apps/cms-admin/README.md)
- 共享包规划：[README.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/packages/README.md)

---

## 11. 一句话结论

新 Web 前端采用：

- `Next.js App Router + React 19 + TypeScript 5`
- `Redux Toolkit + Redux DevTools`
- `TanStack Query/Table/Virtual`
- `pnpm workspace + Turborepo`

这是最符合你“经典单向数据流 + 时间漫游调试 + 企业级可维护性”的路线。
