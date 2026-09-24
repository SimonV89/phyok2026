# 前端架构

> 本目录收录 chat-web、CMS Admin 及前端工程化相关架构文档。

## 阅读顺序

**推荐按以下顺序阅读：**

1. [前端Monorepo架构](前端Monorepo架构.md) — pnpm workspace + Turborepo + Next.js App Router + React 19 + Redux Toolkit + TanStack Query
2. [Chat_Web应用架构](Chat_Web应用架构.md) — 单聊天框、多模态输入、SSE 流式、引用记忆，核心模块：chat-shell/composer/stream-view/citation-panel
3. [前端状态流与SSE架构](前端状态流与SSE架构.md) — UI State / App State / Server State 三层，SSE 放 Redux，分页放 TanStack Query
4. [前端设计系统架构](前端设计系统架构.md) — tokens / UI primitives / feature components 三层，packages/tokens 共享包
5. [CMS_Admin应用架构](CMS_Admin应用架构.md) — 内部运营后台，核心指标 / 用户 / 付费 / 投诉 / 审计分页回放

## 应用入口

- [Chat_Web_README](Chat_Web_README.md) — chat-web 快速开始，路由结构
- [CMS_Admin_README](CMS_Admin_README.md) — CMS Admin 快速开始，路由结构

## 相关文档

- [Node_BFF_LangGraph架构](../1.服务端架构/Node_BFF_LangGraph架构.md) — 前端 SSE 与 Node BFF 的交互协议
- [全栈API协议规范](../1.服务端架构/全栈API协议规范.md) — 前端 -> Node BFF 的 HTTP/SSE 协议约定
