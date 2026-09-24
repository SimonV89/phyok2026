# 《心理学空间·自我探索Agent Pro》全栈 API 与协议规范

## 1. 文档目标

本文是当前主方案下的**总接口规范**。

目标不是只定义某一层接口，而是统一下面 7 类协议：

- 浏览器 / App -> Node BFF 外部 API
- 浏览器 / App <- Node BFF 的 SSE 流
- Node BFF -> Node Graph Runtime
- Node Graph / BFF -> Java 领域服务
- Node / Java -> Node Capability
- Java / Node -> Kafka 异步事件
- 第三方 -> 系统的支付 / webhook 回调

本文优先回答 4 个问题：

- 哪一层应该用 `HTTP`
- 哪一层应该用 `SSE`
- 哪一层适合 `gRPC`
- 哪些必须走 `Kafka` 异步

---

## 2. 一句话结论

协议选型统一结论：

- **浏览器 / React 前端**
- 只使用 `HTTPS + SSE`

- **Node BFF 对前端**
- `HTTP/JSON`
- `SSE`
- 文件上传使用 `multipart/form-data`

- **Node 与 Java 内部同步调用**
- 默认 `HTTP/JSON`
- 少量高频、强类型、低延迟接口可用 `gRPC`

- **Node / Java 内部异步**
- `Kafka`

- **第三方回调**
- `HTTP Webhook`

---

## 3. 协议分工原则

## 3.1 浏览器永远不用 gRPC

原因：

- 浏览器对 gRPC-Web 生态更复杂
- 你的前端重点是聊天、上传、SSE，不值得引入额外复杂度

结论：

- 前端只认：
  - `HTTP/JSON`
  - `SSE`
  - 文件上传

## 3.2 BFF 是唯一外部 API 门面

所有前端请求统一走：

```text
/v2/*
```

前端永远不直接访问：

- Java 领域微服务
- Qdrant
- Kafka
- Redis

## 3.3 同步接口只做“当前回合必须知道”的事

例如：

- 发消息
- 查历史
- 查套餐
- 检查记忆门槛
- 拉取列表页数据

## 3.4 重任务必须异步化

例如：

- embedding
- 文档索引
- 大文件解析
- 审计归档
- 支付回调后的账务补偿

---

## 4. 协议矩阵

| 调用方向 | 主协议 | 备选 | 说明 |
| --- | --- | --- | --- |
| 前端 -> Node BFF | HTTP/JSON | multipart | 标准同步请求 |
| 前端 <- Node BFF | SSE | 无 | 主聊天流与任务进度 |
| Node BFF -> Node Graph | 进程内调用 / HTTP | 无 | 取决于是否拆服务 |
| Node Graph -> Java 领域服务 | HTTP/JSON | gRPC | 默认 REST，少量高频场景可 gRPC |
| Node / Java -> Node Capability | HTTP/JSON | gRPC | 默认 REST，多媒体高吞吐可 gRPC |
| Node / Java -> Kafka | Kafka | 无 | 异步事件 |
| 第三方 -> 系统 | HTTP Webhook | 无 | 支付、回调类 |

---

## 5. URL 与版本规范

外部接口统一：

```text
/v2/*
```

内部接口统一：

```text
/internal/*
```

历史兼容：

```text
/app/*
```

保留给旧系统，不进入新实现主口径。

---

## 6. Header 规范

## 6.1 外部请求 Header

- `Authorization: Bearer <token>`
- `X-Request-Id`
- `X-App-Id`
- `X-Client-Version`
- `X-Device-Id`
- `Idempotency-Key`

## 6.2 Node -> Java 内部 Header

- `Authorization`
- `X-Request-Id`
- `X-Trace-Id`
- `X-Tenant-Id`
- `X-App-Id`
- `X-User-Id`
- `X-Session-Id`
- `X-Caller-Service`

## 6.3 gRPC Metadata

如果内部走 gRPC，metadata 需保留同样字段：

- `authorization`
- `x-request-id`
- `x-trace-id`
- `x-tenant-id`
- `x-app-id`
- `x-user-id`
- `x-session-id`

---

## 7. 通用响应规范

## 7.1 HTTP 成功响应

```json
{
  "code": "OK",
  "message": "success",
  "requestId": "req_123",
  "data": {}
}
```

## 7.2 HTTP 错误响应

```json
{
  "code": "MEMORY_GATE_NOT_MET",
  "message": "当前可用于探索的记忆碎片不足 5 条",
  "requestId": "req_123",
  "data": {
    "currentCount": 3,
    "requiredCount": 5
  }
}
```

## 7.3 分页响应

```json
{
  "code": "OK",
  "message": "success",
  "requestId": "req_123",
  "data": {
    "items": [],
    "pageNo": 1,
    "pageSize": 20,
    "total": 245,
    "hasNext": true
  }
}
```

---

## 8. 错误码分层

## 8.1 BFF 层

- `BFF_BAD_REQUEST`
- `BFF_UNAUTHORIZED`
- `BFF_RATE_LIMITED`
- `BFF_UNSUPPORTED_MEDIA_TYPE`

## 8.2 Graph 层

- `GRAPH_EXECUTION_FAILED`
- `GRAPH_TOOL_TIMEOUT`
- `GRAPH_CONTEXT_OVERFLOW`
- `SSE_STREAM_ABORTED`

## 8.3 Java 领域层

- `AUTH_INVALID_TOKEN`
- `AUTH_SESSION_EXPIRED`
- `TENANT_ACCESS_DENIED`
- `MEMORY_GATE_NOT_MET`
- `MEMORY_FRAGMENT_NOT_FOUND`
- `KNOWLEDGE_DOCUMENT_NOT_FOUND`
- `BILLING_QUOTA_EXCEEDED`
- `PAYMENT_ORDER_INVALID`
- `AUDIT_TRACE_NOT_FOUND`

## 8.4 Capability 层

- `CAPABILITY_PARSE_FAILED`
- `CAPABILITY_OCR_FAILED`
- `CAPABILITY_ASR_FAILED`
- `CAPABILITY_TASK_TIMEOUT`

---

## 9. 幂等与重试

必须带 `Idempotency-Key` 的外部接口：

- `POST /v2/chat/send`
- `POST /v2/memory/upsert`
- `POST /v2/media/upload`
- `POST /v2/payment/orders`

内部重试原则：

- GET 可幂等重试
- POST 必须依赖幂等键或业务唯一键
- Kafka consumer 必须幂等消费

---

## 10. 外部 HTTP API

## 10.1 Auth

### `POST /v2/auth/email/send-code`

用途：

- 发送邮箱验证码

请求体：

```json
{
  "email": "demo@example.com",
  "scene": "login"
}
```

### `POST /v2/auth/email/verify`

用途：

- 验证邮箱验证码并登录

响应 `data` 建议：

- `accessToken`
- `refreshToken`
- `expiresIn`
- `user`

### `POST /v2/auth/refresh`

### `POST /v2/auth/logout`

---

## 10.2 Chat

### `POST /v2/chat/send`

用途：

- 启动一轮聊天

请求体：

```json
{
  "conversationId": "conv_xxx",
  "message": {
    "type": "text",
    "content": "我最近一被伴侣冷落就很慌"
  },
  "attachments": [
    {
      "assetId": "asset_xxx",
      "type": "image"
    }
  ],
  "stream": true
}
```

响应：

- 若 `stream=true`，返回 SSE 连接或 SSE 响应流
- 若 `stream=false`，返回完整 message

### `GET /v2/chat/history`

查询参数：

- `conversationId`
- `cursor`
- `limit`

### `POST /v2/chat/cancel`

用途：

- 取消当前生成

### `GET /v2/chat/conversations`

用途：

- 会话列表分页

### `DELETE /v2/chat/conversations/{conversationId}`

---

## 10.3 Memory

### `POST /v2/memory/upsert`

用途：

- 新增记忆
- 修复记忆

请求体建议：

```json
{
  "mode": "create",
  "rawText": "小时候母亲生气时会几天不理我",
  "sourceType": "chat_turn"
}
```

### `POST /v2/memory/delete`

### `GET /v2/memory/list`

查询参数：

- `pageNo`
- `pageSize`
- `timelineRoot`
- `topicTag`

### `GET /v2/memory/graph`

用途：

- 获取旧星图 / 新记忆图可视化投影

### `POST /v2/memory/search`

用途：

- 手动检索用户记忆碎片

---

## 10.4 Knowledge

### `POST /v2/knowledge/upload`

用途：

- 上传文档到知识库

### `GET /v2/knowledge/documents`

### `GET /v2/knowledge/documents/{documentId}`

### `POST /v2/knowledge/search`

---

## 10.5 Media

### `POST /v2/media/upload`

用途：

- 上传图片、语音、文档

协议：

- `multipart/form-data`

表单字段建议：

- `file`
- `scene`
- `conversationId`

### `GET /v2/media/tasks/{taskId}`

用途：

- 查询媒体解析任务状态

### `GET /v2/media/assets/{assetId}`

用途：

- 查询媒体资源元数据

---

## 10.6 Billing / Payment

### `GET /v2/billing/account`

### `GET /v2/billing/ledger`

### `GET /v2/payment/plans`

### `POST /v2/payment/orders`

### `GET /v2/payment/orders/{orderId}`

---

## 10.7 Profile / Settings

### `GET /v2/profile/me`

### `PATCH /v2/profile/me`

### `GET /v2/settings`

### `PATCH /v2/settings`

---

## 10.8 CMS Admin

### `GET /v2/admin/dashboard/overview`

### `GET /v2/admin/users`

### `GET /v2/admin/billing/orders`

### `GET /v2/admin/complaints`

### `GET /v2/admin/audit/events`

### `GET /v2/admin/conversations/{conversationId}`

---

## 11. SSE 协议

## 11.1 使用场景

- 主聊天流式输出
- 媒体任务进度
- 某些长时任务进度

## 11.2 连接方式

建议：

- `POST /v2/chat/send` 直接返回 `text/event-stream`

或：

- 先创建 run
- 再 `GET /v2/chat/stream/{runId}`

P0 更推荐第一种，减少一次握手。

## 11.3 事件类型

- `message.started`
- `message.delta`
- `tool.started`
- `tool.completed`
- `citation.appended`
- `warning.raised`
- `usage.reported`
- `message.completed`
- `stream.completed`
- `stream.failed`

## 11.4 事件结构

```text
event: message.delta
data: {"runId":"run_xxx","delta":"你好"}
```

## 11.5 前端处理要求

- 不直接解析 Graph 内部状态
- 只消费事件类型与事件 payload
- 任何异常关闭都要映射成显式 UI 状态

---

## 12. 文件上传协议

## 12.1 上传方式

- 浏览器 -> BFF：`multipart/form-data`
- BFF -> Node Capability：HTTP 内部调用或对象存储直传

## 12.2 大文件策略

大文件建议：

- 先申请上传凭证
- 前端直传 COS
- 再回调 BFF 创建 `media_task`

P0 小文件可先走 BFF 转发。

## 12.3 解析状态

媒体解析任务状态：

- `queued`
- `uploading`
- `uploaded`
- `parsing`
- `ready`
- `failed`

---

## 13. Node BFF -> Node Graph

如果 BFF 和 Graph 拆成两个服务：

- 内部协议优先 `HTTP/JSON`

### `POST /internal/graph/chat-turn`

### `POST /internal/graph/cancel-run`

### `GET /internal/graph/run-status/{runId}`

如果同进程：

- 直接函数调用，不强行套 HTTP

---

## 14. Node Graph -> Java 内部 HTTP API

## 14.1 Auth

- `POST /internal/auth/verify-token`
- `GET /internal/auth/me`

## 14.2 Tenant

- `GET /internal/tenant/context`
- `GET /internal/tenant/plans/{appId}`

## 14.3 Memory

- `GET /internal/memory/gate-check`
- `POST /internal/memory/retrieve`
- `POST /internal/memory/upsert`
- `POST /internal/memory/delete`
- `GET /internal/memory/graph`

## 14.4 Knowledge

- `POST /internal/knowledge/retrieve`
- `POST /internal/knowledge/index`
- `GET /internal/knowledge/documents/{documentId}`

## 14.5 Billing

- `POST /internal/billing/precheck`
- `POST /internal/billing/usage-record`
- `GET /internal/billing/account`

## 14.6 Payment

- `GET /internal/payment/active-plan`
- `POST /internal/payment/order/create`
- `POST /internal/payment/order/verify`

## 14.7 Audit

- `POST /internal/audit/trace-start`
- `POST /internal/audit/trace-event`
- `POST /internal/audit/trace-complete`

## 14.8 Admin

- `GET /internal/admin/dashboard/overview`
- `GET /internal/admin/users`
- `GET /internal/admin/billing/orders`
- `GET /internal/admin/complaints`
- `GET /internal/admin/audit/events`

---

## 15. 哪些内部接口适合 gRPC

默认不要把所有内部接口都改成 gRPC。

只有满足这些条件才考虑：

- 高频
- 低延迟
- 纯机器调用
- 强 schema
- 无浏览器参与

## 15.1 建议 gRPC 的场景

### `AuthContextService`

用途：

- 高速校验 token
- 返回 principal / tenant context

建议方法：

- `ValidateToken`
- `GetPrincipal`

### `MemoryRetrievalService`

用途：

- 高频召回记忆碎片

建议方法：

- `RecallMemory`
- `GetMemoryGate`

### `KnowledgeRetrievalService`

用途：

- 文档召回

建议方法：

- `RecallKnowledge`

## 15.2 暂不建议 gRPC 的场景

- 外部前端接口
- CMS 列表查询
- 支付回调
- 大文件上传
- 主聊天流到浏览器

这些更适合 HTTP。

---

## 16. Node / Java -> Node Capability API

默认优先 `HTTP/JSON`。

### `POST /internal/capability/file/parse`

### `POST /internal/capability/image/analyze`

### `POST /internal/capability/audio/transcribe`

### `GET /internal/capability/task/status`

### `POST /internal/capability/privacy/mask`

### `POST /internal/capability/risk-alert/check`

如果后期 OCR / ASR 任务量极大，可再补 gRPC，但 P0 不需要先上。

---

## 17. Kafka 异步事件规范

## 17.1 Topic 建议

- `memory.fragment.created`
- `memory.embedding.requested`
- `knowledge.index.requested`
- `billing.usage.recorded`
- `billing.charge.completed`
- `audit.trace.recorded`
- `payment.callback.received`
- `privacy.delete.requested`
- `capability.task.completed`

## 17.2 事件结构

```json
{
  "eventId": "evt_xxx",
  "eventName": "memory.fragment.created",
  "occurredAt": "2026-09-22T10:00:00Z",
  "traceId": "trace_xxx",
  "tenantId": "tenant_xxx",
  "appId": "app_xxx",
  "userId": "user_xxx",
  "payload": {}
}
```

## 17.3 原则

- 所有 consumer 必须幂等
- 事件名稳定
- payload 不塞冗余大文本

---

## 18. 第三方 Webhook

## 18.1 支付回调

建议入口：

- `POST /v2/webhooks/payment/{provider}`

要求：

- 签名校验
- 原始回调体留存
- 立即 ack，后续走 Kafka 异步

## 18.2 对象存储回调

如果直传 COS，可有：

- `POST /v2/webhooks/storage/callback`

---

## 19. 分页 / 排序 / 过滤规范

统一规则：

- `pageNo`
- `pageSize`
- `sortBy`
- `sortOrder`
- `keyword`
- `filters`

后台列表页建议：

- 不用游标分页，优先页码分页

聊天历史建议：

- 用 cursor 分页

---

## 20. OpenAPI / Proto / Event Schema 产物

建议最终同时维护 3 套契约产物：

## 20.1 OpenAPI

用于：

- 外部 `/v2/*`
- 内部 HTTP `/internal/*`

## 20.2 Proto

用于：

- 明确选择 gRPC 的少数接口

## 20.3 JSON Schema / Avro

用于：

- Kafka 事件
- SSE 事件 payload

---

## 21. 最终推荐

如果只记 5 条：

- 前端只用 `HTTP + SSE`
- BFF 是唯一外部门面
- Node / Java 默认内部走 `HTTP/JSON`
- 少数高频检索或鉴权场景再上 `gRPC`
- 重任务统一走 `Kafka`

---

## 22. 与现有文档的关系

本文是总接口规范。

配套细分文档继续参考：

- Node 与 Java 契约：[NODE_JAVA_API_CONTRACTS.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-node/docs/NODE_JAVA_API_CONTRACTS.md)
- 前端状态与 SSE：[FRONTEND_STATE_STREAMING_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-web/docs/architecture/FRONTEND_STATE_STREAMING_ARCHITECTURE.md)
- 双后端总架构：[AGENT_NODE_JAVA_DUAL_STACK_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-node/docs/AGENT_NODE_JAVA_DUAL_STACK_ARCHITECTURE.md)
