# 《心理学空间·自我探索Agent Pro》前端 Monorepo 架构说明

## 1. 目标

本文件把 `phyok-web` 从“起始说明”推进到可开工的前端 Monorepo 架构。

目标：

- 支持 `chat-web`
- 支持 `cms-admin`
- 支持共享 UI、类型、状态和 API SDK
- 与 Node BFF `/v2` 协议严格对齐

推荐入口：

- [FRONTEND_DOCS_INDEX.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/FRONTEND_DOCS_INDEX.md)

---

## 2. 技术结论

- `pnpm workspace`
- `Turborepo`
- `Next.js App Router`
- `React 19`
- `TypeScript 5`
- `Redux Toolkit + Redux DevTools`
- `TanStack Query`
- `TanStack Table`
- `TanStack Virtual`

---

## 3. 目录结构

```text
phyok-web/
  apps/
    chat-web/
    cms-admin/
  packages/
    api-client/
    domain/
    store/
    ui/
    tokens/
    utils/
    eslint-config/
    tsconfig/
  docs/
    architecture/
```

---

## 4. 两个应用

## 4.1 `apps/chat-web`

职责：

- 单聊天框主应用
- 多模态输入
- SSE 流式输出
- 记忆依据引用展示

## 4.2 `apps/cms-admin`

职责：

- 用户、付费、投诉、审计、系统资源后台
- 列表页分页查询
- 指标页展示

---

## 5. 共享包职责

## 5.1 `packages/api-client`

- `/v2` API SDK
- 鉴权头封装
- 错误码适配

## 5.2 `packages/domain`

- `Conversation`
- `Message`
- `Attachment`
- `MemoryCitation`
- `AdminDashboard`
- `Complaint`

## 5.3 `packages/store`

- Redux store 工厂
- 公共 slice
- 中间件

## 5.4 `packages/ui`

- 通用 UI 组件
- Chat 组件
- CMS 基础组件

---

## 6. 状态分层

## 6.1 Redux

适合：

- 聊天会话运行态
- SSE 状态
- 上传中的附件状态
- 全局 UI 状态

## 6.2 TanStack Query

适合：

- 指标接口
- 列表分页接口
- 会话历史接口
- 媒体任务状态接口

---

## 7. 与后端对齐原则

- 统一只请求 `/v2/*`
- Chat Web 对接：
  - `/v2/chat/*`
  - `/v2/memory/*`
  - `/v2/media/*`
- CMS Admin 对接：
  - `/v2/admin/*`
  - `/v2/billing/*`
  - `/v2/audit/*`

---

## 8. 开工顺序

1. 初始化 workspace
2. 初始化 `apps/chat-web`
3. 初始化 `apps/cms-admin`
4. 初始化 `packages/api-client`
5. 初始化 `packages/domain`
6. 初始化 `packages/store`

---

## 9. 结论

`phyok-web` 不再只是一个 README，而是正式作为：

- `chat-web + cms-admin + packages` 的前端 Monorepo 基座

继续阅读：

- [CHAT_WEB_APP_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/CHAT_WEB_APP_ARCHITECTURE.md)
- [CMS_ADMIN_APP_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/CMS_ADMIN_APP_ARCHITECTURE.md)
- [FRONTEND_STATE_STREAMING_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/FRONTEND_STATE_STREAMING_ARCHITECTURE.md)
- [FRONTEND_DESIGN_SYSTEM_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/FRONTEND_DESIGN_SYSTEM_ARCHITECTURE.md)
