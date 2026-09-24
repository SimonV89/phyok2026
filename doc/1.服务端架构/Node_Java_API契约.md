# 《心理学空间·自我探索Agent Pro》Node <-> Java API 契约

## 1. 文档目标

本文定义：

- Node BFF
- Node LangGraph Runtime
- Java 领域服务

三者之间的协议约束。

目标：

- 让 Node 和 Java 明确通过什么接口协作
- 避免 Node 复制 Java 业务规则
- 避免 Java 反向感知 Node 内部 Graph 实现

---

## 2. 一句话结论

Node 与 Java 的关系是：

- Node 决定“什么时候调用”
- Java 决定“业务真相是什么”

因此 API 契约必须：

- 显式
- 稳定
- schema 化
- 错误码统一

---

## 3. Header 规范

Node 调 Java 时统一带：

- `Authorization`
- `X-Request-Id`
- `X-Tenant-Id`
- `X-App-Id`
- `X-User-Id`
- `X-Session-Id`
- `X-Trace-Id`

原则：

- Node 不得丢失 Java 需要的多租户上下文

---

## 4. 统一响应规范

```json
{
  "code": "OK",
  "message": "success",
  "requestId": "req_xxx",
  "data": {}
}
```

错误示例：

```json
{
  "code": "MEMORY_GATE_NOT_MET",
  "message": "当前可用于探索的记忆碎片不足 5 条",
  "requestId": "req_xxx",
  "data": {
    "currentCount": 3,
    "requiredCount": 5
  }
}
```

---

## 5. Node BFF 对前端的主要接口

## 5.1 `POST /v2/chat/send`

用途：

- 单轮聊天请求

Node 行为：

- 接收前端请求
- 调 Graph
- 流式输出 SSE

## 5.2 `GET /v2/chat/history`

用途：

- 查询历史消息

Node 行为：

- 调 Java `context/message` 相关接口聚合

## 5.3 `POST /v2/media/upload`

用途：

- 上传附件

Node 行为：

- 调 `node-capability-service`
- 必要时回写 Java 媒体元数据

---

## 6. Node Graph -> Java Auth

## 6.1 `POST /internal/auth/verify-token`

返回：

- `tenantId`
- `appId`
- `userId`
- `roles`
- `sessionId`

## 6.2 `GET /internal/auth/me`

用途：

- 获取用户主信息

---

## 7. Node Graph -> Java Memory

## 7.1 `GET /internal/memory/gate-check`

用途：

- 检查 5 个记忆碎片门槛

入参：

- `tenantId`
- `appId`
- `userId`

## 7.2 `POST /internal/memory/retrieve`

用途：

- 相似度召回用户记忆碎片

入参：

- `query`
- `topK`
- `minScore`
- `timelineRoots`
- `topicTags`

返回：

- `fragmentId`
- `score`
- `timelineRoot`
- `topicTags`
- `emotionTags`
- `content`

## 7.3 `POST /internal/memory/upsert`

用途：

- 沉淀记忆或修复记忆

---

## 8. Node Graph -> Java Knowledge

## 8.1 `POST /internal/knowledge/retrieve`

用途：

- 文档知识召回

## 8.2 `POST /internal/knowledge/index`

用途：

- 创建文档索引任务

---

## 9. Node Graph -> Java Billing

## 9.1 `POST /internal/billing/precheck`

用途：

- 在主模型调用前检查额度或配额

## 9.2 `POST /internal/billing/usage-record`

用途：

- 上报 token 使用事件

---

## 10. Node Graph -> Java Audit

## 10.1 `POST /internal/audit/trace-start`

## 10.2 `POST /internal/audit/trace-event`

## 10.3 `POST /internal/audit/trace-complete`

要求：

- Node 每次 Graph 运行必须发起完整 trace

---

## 11. Node Graph -> Java Payment

## 11.1 `GET /internal/payment/active-plan`

## 11.2 `POST /internal/payment/order/create`

## 11.3 `POST /internal/payment/order/verify`

---

## 12. Node BFF -> Java Ops Admin

CMS 场景下，Node 只做可选 BFF。

建议接口：

- `GET /internal/admin/dashboard/overview`
- `GET /internal/admin/users`
- `GET /internal/admin/billing/orders`
- `GET /internal/admin/complaints`
- `GET /internal/admin/audit/events`

---

## 13. Node -> Node Capability

## 13.1 `POST /internal/capability/file/parse`

## 13.2 `POST /internal/capability/image/analyze`

## 13.3 `POST /internal/capability/audio/transcribe`

## 13.4 `GET /internal/capability/task/status`

---

## 14. SSE 事件契约

推荐事件类型：

- `message.delta`
- `tool.started`
- `tool.completed`
- `citation.appended`
- `warning.raised`
- `message.completed`
- `usage.reported`

前端只消费这些事件，不直接理解内部 Graph 状态。

---

## 15. 错误码分层

## 15.1 Node 层错误

- `GRAPH_EXECUTION_FAILED`
- `SSE_STREAM_ABORTED`
- `CAPABILITY_TIMEOUT`

## 15.2 Java 领域错误

- `AUTH_INVALID_TOKEN`
- `TENANT_ACCESS_DENIED`
- `MEMORY_GATE_NOT_MET`
- `BILLING_QUOTA_EXCEEDED`
- `PAYMENT_ORDER_INVALID`

要求：

- Node 不重新发明 Java 领域错误码

---

## 16. 幂等要求

以下接口必须带 `Idempotency-Key`：

- `POST /v2/chat/send`
- `POST /internal/memory/upsert`
- `POST /internal/payment/order/create`

---

## 17. 契约演进规则

- 所有 breaking change 需要版本说明
- DTO 由 `contracts` 包统一维护
- Node 和 Java 同时升级时先兼容后切换

---

## 18. 一句话结论

Node 和 Java 真正能长期协作，不靠口头约定，而靠：

- **稳定 API 契约**
- **统一 header**
- **统一错误码**
- **统一 SSE 事件协议**
