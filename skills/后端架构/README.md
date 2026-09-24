# 后端架构

> 涉及 Node BFF、Java 微服务、API 契约时必须遵守的规范。

## 微服务分工

| 服务 | 职责 |
|------|------|
| `node2-runtime` | BFF、意图编排、多模态解析、LangGraph Agent Runtime |
| `memory-service` | 记忆业务写入、Outbox 生成、召回聚合 |
| `billing-service` | 额度预检、扣减、支付逻辑 |
| `audit-service` | 审计与请求追踪 |
| `auth-service` | 登录鉴权、会话签发 |
| `payment-service` | 支付订单管理、支付宝接入 |
| `privacy-service` | 隐私删除工单、投诉反馈 |
| `ops-admin-service` | CMS 内部运营与审计后台 |

## 身份路由一致性

- `node2` 必须从鉴权 Token 中提取真实 `userId` / `appId`
- 透传至所有后端服务，不得自行伪造或使用占位 ID
- 读写链路必须使用一致的身份信息

## API 契约

- **Node 决定"什么时候调用"**，Java 决定"业务真相"
- Node BFF → Java 领域服务：HTTP 调用，统一 JSON 协议
- SSE 流式：Node → 前端，固定事件类型前缀 `stream.*`
- Kafka 异步：Node → Java，用于 Outbox 投影

## 鉴权拦截机制

- 未登录用户调用核心业务（大模型）时
- 后端返回固定错误码：`BFF_UNAUTHORIZED`
- 前端据此自动弹出登录框

## Node 侧职责边界

- **不得 Mock Java 接口**：必须走真实 Java 接口
- 确保 `http-java-domain-client.ts` 正确透传用户信息
- LangGraph Agent Runtime 专注编排，不直接操作业务数据

## Java 侧职责边界

- 专注业务域：鉴权、记忆、支付、审计、CMS
- 不做 LangGraph Runtime
- 提供稳定的 HTTP API，不关心调用方实现细节

## 数据库规范

- Java 侧 ORM 强制 **MyBatis + XML Mapper**
- Node 侧分层明确，代码易于 review
- 各微服务使用 **Flyway** 管理迁移版本

## 相关文档

- [doc/1.服务端架构/](../doc/1.服务端架构/)
