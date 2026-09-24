# 《心理学空间·自我探索Agent Pro》前端架构文档索引

## 1. 推荐阅读顺序

- 全栈 API 与协议规范：[FULL_STACK_API_PROTOCOL_SPEC.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-node/docs/FULL_STACK_API_PROTOCOL_SPEC.md)
- 前端 Monorepo 总纲：[FRONTEND_MONOREPO_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/FRONTEND_MONOREPO_ARCHITECTURE.md)
- Chat Web 应用架构：[CHAT_WEB_APP_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/CHAT_WEB_APP_ARCHITECTURE.md)
- CMS Admin 应用架构：[CMS_ADMIN_APP_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/CMS_ADMIN_APP_ARCHITECTURE.md)
- 状态流与 SSE：[FRONTEND_STATE_STREAMING_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/FRONTEND_STATE_STREAMING_ARCHITECTURE.md)
- 设计系统与 UI 规范：[FRONTEND_DESIGN_SYSTEM_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/FRONTEND_DESIGN_SYSTEM_ARCHITECTURE.md)

---

## 2. 一句话结论

前端正式采用：

- `Next.js App Router + React 19 + TypeScript 5`
- `pnpm workspace + Turborepo`
- `Redux Toolkit + Redux DevTools`
- `TanStack Query / Table / Virtual`

并且：

- `chat-web` 和 `cms-admin` 共仓
- `packages` 统一承载 UI、API、类型、store、tokens
