# 服务端架构

> 本目录收录项目后端（Node BFF + Java SpringCloud 双栈）的核心架构文档。

## 阅读顺序

**推荐按以下顺序阅读：**

1. [Node_Java双后端架构总览](Node_Java双后端架构总览.md) — 先读总纲，了解整体分层
2. [Node_BFF_LangGraph架构](Node_BFF_LangGraph架构.md) — Node 侧职责：BFF、LangGraph Agent Runtime、SSE、SSR、多模态
3. [Java_SpringCloud业务域架构](Java_SpringCloud业务域架构.md) — Java 侧职责：鉴权、记忆主数据、支付、审计、CMS
4. [Node_v2服务定位](Node_v2服务定位.md) — Node v2（phyok-node2）定位为能力服务
5. [Node_Monorepo骨架](Node_Monorepo骨架.md) — Node 侧代码组织：pnpm workspace + Turborepo
6. [Java_微服务模块骨架](Java_微服务模块骨架.md) — Java 侧代码组织：Gradle 多模块 + apps/libs
7. [服务边界与API](服务边界与API.md) — 微服务拆分原则与服务边界约定
8. [全栈API协议规范](全栈API协议规范.md) — HTTP/SSE/gRPC/Kafka 协议选型结论
9. [Node_Java_API契约](Node_Java_API契约.md) — Node BFF、LangGraph Runtime 与 Java 领域服务之间的调用契约

## 部署与运维

- [Docker_Compose快速开始](../deploy/compose/README.md) — 单机完整体验
- [K3s单节点部署指南](K3s单节点部署指南.md) — 腾讯云轻量应用服务器 K3s 部署
- [K3s与Nginx集成指南](K3s与Nginx集成指南.md) — 宿主机已有 Nginx 时接入 K3s
- [轻量服务器部署运维](轻量服务器部署运维.md) — 轻量服务器 Docker Compose 单机方案

## 内部系统

- [CMS后台架构](CMS后台架构.md) — ops-admin-service 承担的内部运营与审计后台
