# 《心理学空间·自我探索Agent Pro》服务边界与接口清单

> 历史稿说明：本文保留为上一阶段“Java 主控、Node 辅助”方案参考。当前主方案请优先阅读 [ARCHITECTURE_DOCS_INDEX.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-node/docs/ARCHITECTURE_DOCS_INDEX.md)、[AGENT_NODE_JAVA_DUAL_STACK_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-node/docs/AGENT_NODE_JAVA_DUAL_STACK_ARCHITECTURE.md) 与 [NODE_LANGGRAPH_BFF_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-node/docs/NODE_LANGGRAPH_BFF_ARCHITECTURE.md)。

## 1. 文档目标

本文用于把总架构文档中的微服务拆分，进一步落为可实施的服务边界与接口清单，重点解决三个问题：

- 每个服务到底拥有哪类数据与职责
- 哪些接口对外暴露，哪些接口只允许内部调用
- 哪些流程走同步调用，哪些流程必须走 MQ 异步解耦

本文面向：

- Java 后端工程初始化
- 微服务仓库拆分
- API 网关规划
- MQ 主题规划
- 前后端对接与联调

---

## 2. 边界原则

### 2.1 服务边界原则

- 一个服务只拥有一类主数据的写权限
- 一个服务只对自己的主数据负责
- 其他服务读取该类数据时，优先通过查询接口或投影表，不允许跨库直写
- Agent Orchestrator 负责“编排”，不负责“沉淀全部业务主数据”

### 2.2 接口分层原则

- 外部接口：统一由 `agent-api-gateway` 暴露
- 内部同步接口：优先 `REST/gRPC`
- 内部异步接口：通过 `Kafka / CKafka`
- 文件上传下载：统一走 `media-service` / `node-capability-service` + `COS`

### 2.3 读写原则

- 写路径单一
- 查路径可读扩展
- 大文本不在高频接口里重复返回
- 需要多服务汇总的数据由 orchestrator 做 BFF 聚合

---

## 3. 服务清单

## 3.1 P0 核心服务

- `agent-api-gateway`
- `auth-service`
- `agent-orchestrator-service`
- `context-service`
- `memory-service`
- `knowledge-service`
- `semantic-chunk-service`
- `model-gateway-service`
- `billing-service`
- `audit-service`
- `privacy-service`

## 3.2 P1 扩展服务

- `media-service`
- `workflow-runtime-service`
- `ops-admin-service`
- `legacy-node-adapter-service`
- `node-capability-service`

---

## 4. 服务边界总览

| 服务名 | 主职责 | 主数据所有权 | 对外暴露 | 内部调用性质 |
| --- | --- | --- | --- | --- |
| `agent-api-gateway` | 外部统一入口、鉴权、限流、SSE 代理 | 无主业务数据 | 是 | 同步 |
| `auth-service` | 多租户鉴权、JWT 主签发、会话管理 | `user_account`、`user_session` | 否 | 同步 |
| `agent-orchestrator-service` | Agent 主编排、意图分流、调用链组织 | 会话运行态、临时执行态 | 否 | 同步 + 异步 |
| `context-service` | 会话历史、摘要、上下文压缩 | `conversation`、`message`、`summary` | 否 | 同步 + 异步 |
| `memory-service` | 记忆碎片、关系、向量同步 | `memory_fragment` | 否 | 同步 + 异步 |
| `knowledge-service` | 文档知识库、切片、索引 | `knowledge_document`、`knowledge_chunk` | 否 | 同步 + 异步 |
| `semantic-chunk-service` | LLM 语义分片、结构化 chunk 输出 | `chunk_task`、分片投影 | 否 | 同步 + 异步 |
| `model-gateway-service` | 模型路由、供应商适配、token 归一 | `model_provider_config`、`model_usage_raw` | 否 | 同步 |
| `billing-service` | 计费、配额、账务 | `billing_account`、`billing_ledger` | 否 | 同步 + 异步 |
| `audit-service` | 审计、回放、风控轨迹 | `audit_event`、`audit_trace` | 否 | 异步为主 |
| `privacy-service` | 用户删除主编排、隐私清理调度 | `privacy_job`、删除审计记录 | 否 | 同步 + 异步 |
| `media-service` | OCR/ASR/图片理解/文件解析 | `media_asset` | 否 | 同步 + 异步 |
| `workflow-runtime-service` | 工作流执行、DSL 导入、节点映射 | `workflow_definition`、`workflow_version` | 否 | 同步 |
| `ops-admin-service` | 运营管理台、人工审核、灰度配置 | `ops_config`、审核记录 | 是，内网 | 同步 |
| `legacy-node-adapter-service` | 旧 Node 能力桥接 | 无主数据，仅桥接缓存 | 否 | 同步 |
| `node-capability-service` | Node 多模态、轻流式、shared 工具能力 | `media_asset`、任务投影、过渡支付投影 | 否 | 同步 + 异步 |

---

## 5. 外部 API 统一入口

所有对前端、客户端、小程序、管理端开放的 API，统一由 `agent-api-gateway` 暴露，统一前缀：

```text
/v2
```

兼容策略：

- `/v2/*`：新系统正式入口
- `/app/*`：旧 `phyok-node` legacy 入口，继续服务存量客户端

### 5.1 外部 API 分类

- 认证类：`/v2/auth/*`
- 会话类：`/v2/chat/*`
- 记忆类：`/v2/memory/*`
- 知识库类：`/v2/knowledge/*`
- 上传类：`/v2/media/*`
- 账务类：`/v2/billing/*`
- 审计运营类：`/v2/admin/*`

### 5.2 统一 Header 约定

- `Authorization: Bearer <token>`
- `X-Request-Id`
- `X-App-Id`
- `X-Client-Version`
- `X-Device-Id`
- `Idempotency-Key`

### 5.3 统一响应结构

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

## 6. `agent-api-gateway`

## 6.1 职责

- API 统一入口
- 租户识别与 JWT 校验
- 请求签名校验
- 统一限流
- 灰度分流
- SSE 转发
- 统一错误码包装

## 6.2 对外接口

### `POST /v2/chat/send`

用途：

- 单轮聊天请求
- 支持文本 + 附件引用
- 支持流式模式

请求体：

```json
{
  "conversationId": "conv_xxx",
  "message": {
    "type": "text",
    "content": "我最近总是会因为伴侣冷淡而难受"
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

转发到：

- `agent-orchestrator-service`

### `GET /v2/chat/history`

用途：

- 获取会话历史

查询参数：

- `conversationId`
- `cursor`
- `limit`

转发到：

- `context-service`

### `POST /v2/memory/upsert`

用途：

- 新增或修复记忆碎片

转发到：

- `memory-service`

### `POST /v2/memory/delete`

用途：

- 软删除记忆碎片

转发到：

- `memory-service`

### `GET /v2/memory/list`

用途：

- 查询用户记忆碎片列表

转发到：

- `memory-service`

### `POST /v2/knowledge/upload`

用途：

- 上传文档到知识库

转发到：

- `media-service`
- `knowledge-service`

### `GET /v2/billing/account`

用途：

- 查询余额、套餐、额度

转发到：

- `billing-service`

---

## 7. `auth-service`

## 7.1 职责

- 多租户主鉴权
- JWT / Refresh Token 主签发
- 会话管理与注销
- 用户身份、租户、应用 claim 注入

## 7.2 设计结论

- 主认证中心必须放在 Java
- Node 可以保留验证码发送、邮件模板、过渡登录辅助逻辑
- `node-capability-service` 不负责 JWT 主签发

## 7.3 外部接口

### `POST /v2/auth/email/send-code`

### `POST /v2/auth/email/verify`

### `POST /v2/auth/refresh`

### `POST /v2/auth/logout`

---

## 8. `agent-orchestrator-service`

## 8.1 职责

- 会话主流程编排
- 意图识别
- 探索门槛判断
- 多服务聚合调用
- Tool 调用调度
- 最终回答生成

## 8.2 数据拥有权

该服务不拥有大多数业务主表，只拥有：

- `conversation_run`
- `conversation_run_step`
- 临时执行上下文缓存

## 8.3 内部同步接口

### `POST /internal/orchestrator/chat-turn`

调用方：

- `agent-api-gateway`

作用：

- 发起一轮会话执行

请求体：

```json
{
  "tenantId": "t_001",
  "appId": "phyok",
  "userId": "u_001",
  "conversationId": "conv_001",
  "turnId": "turn_001",
  "input": {
    "text": "我总是反复想起小时候父母吵架"
  },
  "attachments": []
}
```

### `POST /internal/orchestrator/replay-turn`

调用方：

- `ops-admin-service`

作用：

- 重放某一轮执行，供审计和问题排查

## 8.4 调用下游同步链路

一轮主流程标准顺序：

1. 调用 `context-service` 获取 prompt-ready context
2. 调用意图分类器或 `workflow-runtime-service` 做路由判定
3. 如果是记忆类，调用 `memory-service`
4. 如果是探索类：
- 调用 `memory-service` 查询记忆总数
- 判定是否达到 5 条门槛
- 达标后调用 `memory-service` 做召回
- 如有文档范围，再调 `knowledge-service`
5. 如需处理长文本记忆沉淀或文档切片，调用 `semantic-chunk-service`
6. 调用 `model-gateway-service`
7. 如存在多模态附件或轻流式任务，调用 `node-capability-service`
8. 返回结果
9. 异步投递账务、审计、摘要等事件

## 8.5 异步事件发布

- `conversation.turn.completed`
- `conversation.turn.failed`
- `conversation.summary.refresh.requested`
- `audit.trace.record.requested`
- `billing.usage.recorded`

---

## 9. `context-service`

## 9.1 职责

- 会话元数据管理
- 历史消息读写
- 摘要生成任务触发与落库
- prompt-ready context 生成

## 9.2 主数据

- `conversation`
- `conversation_message`
- `conversation_summary`

## 9.3 内部接口

### `POST /internal/context/create-conversation`

用途：

- 新建会话

### `POST /internal/context/append-message`

用途：

- 写入用户消息或系统消息

### `GET /internal/context/build`

用途：

- 构建本轮 prompt-ready context

查询参数：

- `tenantId`
- `appId`
- `userId`
- `conversationId`
- `mode`

返回示例：

```json
{
  "systemContext": "...",
  "recentMessages": [],
  "compressedSummary": [],
  "tokenEstimate": 3180
}
```

### `GET /internal/context/history`

用途：

- 返回会话历史分页结果

## 9.4 异步事件

消费：

- `conversation.turn.completed`

发布：

- `conversation.summary.generated`
- `conversation.summary.failed`

---

## 10. `memory-service`

## 10.1 职责

- 管理用户记忆碎片生命周期
- 维护记忆关系
- 调用 `semantic-chunk-service` 获取结构化分片结果
- 发起 embedding 与向量同步
- 提供记忆召回能力

## 10.2 主数据

- `memory_fragment`
- `memory_fragment_relation`
- `memory_fragment_embedding_job`

## 10.3 外部接口

### `POST /v2/memory/upsert`

请求体：

```json
{
  "fragmentId": null,
  "rawText": "我小学时经常害怕回家，因为父母总在吵架",
  "source": "user_input",
  "tags": ["原生家庭", "恐惧"],
  "timeHint": "childhood"
}
```

返回：

```json
{
  "fragmentId": "mf_001",
  "status": "PENDING_EMBEDDING"
}
```

### `POST /v2/memory/delete`

用途：

- 软删除记忆碎片

### `GET /v2/memory/list`

用途：

- 查询用户记忆碎片

### `GET /v2/memory/count`

用途：

- 查询可探索记忆数量

## 10.4 内部接口

### `GET /internal/memory/retrieve`

用途：

- 按 query 做相似召回

参数：

- `tenantId`
- `appId`
- `userId`
- `query`
- `topK`
- `minScore`

### `GET /internal/memory/gate-check`

用途：

- 检查探索门槛

返回：

```json
{
  "qualified": false,
  "currentCount": 3,
  "requiredCount": 5
}
```

### `POST /internal/memory/chunk-and-upsert`

用途：

- 对标准化后的原始文本做 LLM 语义分片并写入记忆主表

## 10.5 异步事件

发布：

- `memory.fragment.created`
- `memory.fragment.updated`
- `memory.fragment.deleted`
- `memory.embedding.requested`

消费：

- `memory.embedding.completed`

---

## 11. `knowledge-service`

## 11.1 职责

- 文档知识库接入
- 文档切片
- 调用 `semantic-chunk-service` 做 LLM 语义切分
- chunk 索引
- 文档检索

## 11.2 主数据

- `knowledge_document`
- `knowledge_chunk`
- `knowledge_index_job`

## 11.3 外部接口

### `POST /v2/knowledge/upload`

用途：

- 创建文档索引任务

### `GET /v2/knowledge/document/list`

### `GET /v2/knowledge/document/detail`

### `POST /v2/knowledge/document/delete`

## 11.4 内部接口

### `GET /internal/knowledge/retrieve`

用途：

- 文档语义召回

参数：

- `tenantId`
- `appId`
- `knowledgeScope`
- `query`
- `topK`

### `GET /internal/knowledge/document-chunks`

用途：

- 查询某文档 chunk 列表

### `POST /internal/knowledge/chunk`

用途：

- 对文档正文做结构化语义切片

## 11.5 异步事件

发布：

- `knowledge.document.created`
- `knowledge.index.requested`
- `knowledge.index.completed`
- `knowledge.document.deleted`

---

## 12. `semantic-chunk-service`

## 12.1 职责

- 调用 `LLM API` 做自然语义分片
- 输出结构化 chunk JSON
- 生成 `fragment_type`、`timeline_root`、`topic_tags`、`emotion_tags`
- 输出 `chunk_confidence`

## 12.2 主数据

- `chunk_task`
- `chunk_result_projection`

## 12.3 内部接口

### `POST /internal/chunk/memory`

用途：

- 对用户输入做心理记忆语义分片

### `POST /internal/chunk/document`

用途：

- 对文档正文做语义切片

### `POST /internal/chunk/validate`

用途：

- 对 LLM 分片结果做 schema 校验与 token 边界校验

## 12.4 异步事件

发布：

- `chunk.memory.completed`
- `chunk.document.completed`
- `chunk.failed`

---

## 13. `model-gateway-service`

## 12.1 职责

- 模型供应商适配
- 多模型路由
- 统一 token 使用统计
- provider fallback
- 统一超时、重试、熔断

## 12.2 主数据

- `model_provider_config`
- `model_route_policy`
- `model_usage_raw`

## 12.3 内部接口

### `POST /internal/model/chat`

请求体：

```json
{
  "scene": "exploration",
  "modelPreference": "deep-reasoning",
  "messages": [],
  "tools": [],
  "temperature": 0.6
}
```

返回：

```json
{
  "provider": "openai-compatible",
  "model": "xxx",
  "outputText": "......",
  "usage": {
    "promptTokens": 1200,
    "completionTokens": 420,
    "totalTokens": 1620
  }
}
```

### `POST /internal/model/embed`

用途：

- 文本向量化

### `POST /internal/model/rerank`

用途：

- 结果重排

## 12.4 异步事件

发布：

- `model.usage.recorded`

---

## 14. `billing-service`

## 13.1 职责

- 预占额度校验
- token 计费
- 账务流水
- 套餐权益管理

## 13.2 主数据

- `billing_account`
- `billing_plan`
- `billing_ledger`
- `token_usage_event`

## 13.3 外部接口

### `GET /v2/billing/account`

### `GET /v2/billing/ledger`

### `GET /v2/billing/plans`

## 13.4 内部接口

### `POST /internal/billing/precheck`

用途：

- 本轮执行前做额度校验

### `POST /internal/billing/record-usage`

用途：

- 同步记录一轮 token 使用

### `POST /internal/billing/reconcile`

用途：

- 对账修复

## 13.5 异步事件

消费：

- `billing.usage.recorded`

发布：

- `billing.charge.completed`
- `billing.limit.reached`

---

## 15. `audit-service`

## 14.1 职责

- 审计事件留存
- 对话链路回放
- 风险行为捕捉
- 审计快照导出

## 14.2 主数据

- `audit_event`
- `audit_trace`
- `audit_snapshot`

## 14.3 内部接口

### `POST /internal/audit/record-event`

### `POST /internal/audit/record-trace`

### `GET /internal/audit/trace/{traceId}`

### `GET /internal/audit/conversation/{conversationId}`

## 14.4 异步事件

消费：

- `conversation.turn.completed`
- `conversation.turn.failed`
- `memory.fragment.created`
- `knowledge.index.completed`
- `billing.charge.completed`

---

## 16. `privacy-service`

## 15.1 职责

- 用户删除主编排
- 隐私清理任务下发
- 删除流程审计与补偿
- 调用各下游执行器完成删除

## 15.2 设计结论

- 删除主编排必须在 Java
- `node-capability-service` 与 legacy Node 只负责执行自己持有数据的删除
- 任何删除请求都不能绕过 `privacy-service` 直接散落到各个下游

## 15.3 内部接口

### `POST /internal/privacy/delete-user`

### `POST /internal/privacy/delete-conversation`

### `POST /internal/privacy/replay-job`

## 15.4 异步事件

- `privacy.delete.requested`
- `privacy.delete.dispatched`
- `privacy.delete.completed`
- `privacy.delete.failed`

---

## 17. `media-service`

## 16.1 职责

- 文件上传
- COS 对象管理
- OCR/ASR/图片理解
- 文档解析

## 16.2 主数据

- `media_asset`
- `media_parse_job`

## 16.3 外部接口

### `POST /v2/media/upload`

### `GET /v2/media/{assetId}`

## 16.4 内部接口

### `POST /internal/media/parse`

### `GET /internal/media/asset/{assetId}`

## 16.5 异步事件

发布：

- `media.asset.uploaded`
- `media.parse.completed`
- `media.parse.failed`

---

## 18. `workflow-runtime-service`

## 17.1 职责

- 工作流定义持久化
- 工作流版本管理
- Dify DSL 导入编译
- 运行时节点映射

## 17.2 主数据

- `workflow_definition`
- `workflow_version`
- `workflow_run_record`

## 17.3 内部接口

### `POST /internal/workflow/import-dify-dsl`

### `POST /internal/workflow/execute`

### `GET /internal/workflow/{workflowCode}/version/{version}`

### `POST /internal/workflow/validate`

---

## 19. `ops-admin-service`

## 18.1 职责

- 运营后台
- 人工审核
- 工作流启停
- 灰度开关
- 人工回放

## 18.2 对外暴露

仅内网、VPN 或管理域名开放。

## 18.3 外部接口

### `GET /v2/admin/audit/trace`

### `POST /v2/admin/workflow/publish`

### `POST /v2/admin/workflow/rollback`

### `POST /v2/admin/conversation/replay`

---

## 20. `legacy-node-adapter-service`

## 19.1 职责

- 调用现有 `phyok-node` 能力
- 对旧接口做领域语义封装
- 为新系统提供稳定适配层

## 19.2 适配范围

- 旧 `/app/auth/*`
- 旧 `/app/pay/*`
- 旧 `/app/subconscious/*`
- 旧 `/app/bench-contexts/*`

## 19.3 内部接口

### `POST /internal/legacy/auth/*`

### `POST /internal/legacy/pay/*`

### `POST /internal/legacy/subconscious/*`

---

## 21. `node-capability-service`

## 20.1 职责

- 承接 `phyok-node` 演进出的 `/v2` 能力路由
- 多模态输入处理
- 文件处理
- 图片理解
- 语音转写
- 图片格式预处理
- 某些轻量级流式输出/中转
- `shared` 工具模块复用

## 20.2 主数据

- `media_asset`
- `media_parse_job`
- 过渡支付投影
- 轻量任务状态投影

## 20.3 约束

- 不承担多租户主鉴权
- 不承担 JWT 主签发
- 不承担计费主账本
- 不承担审计总控
- 不承担主聊天编排
- 不承担主 RAG 链路
- 不承担用户删除主编排

## 20.4 外部接口

### `POST /v2/media/parse`

### `POST /v2/media/asr`

### `POST /v2/media/vision`

### `GET /v2/stream/tasks/{taskId}`

## 20.5 内部接口

### `POST /internal/node-capability/media/parse`

### `POST /internal/node-capability/pay/apple-verify`

### `POST /internal/node-capability/privacy/delete-user`

---

## 22. 同步与异步边界

## 21.1 必须同步的链路

- 聊天主请求
- 会话上下文构建
- 探索门槛检查
- 记忆召回
- 模型生成
- 额度预检
- 多模态同步解析请求
- 轻量级流式任务建立

## 21.2 必须异步的链路

- embedding
- 文档切片索引
- 长会话摘要生成
- 审计归档
- 账务汇总
- 离线报表
- 用户删除分发
- 媒体重解析任务

---

## 23. MQ 主题建议

建议 Topic：

- `conversation.turn.completed`
- `conversation.turn.failed`
- `conversation.summary.refresh.requested`
- `memory.fragment.created`
- `memory.fragment.updated`
- `memory.fragment.deleted`
- `memory.embedding.requested`
- `memory.embedding.completed`
- `knowledge.document.created`
- `knowledge.index.requested`
- `knowledge.index.completed`
- `billing.usage.recorded`
- `billing.charge.completed`
- `audit.trace.record.requested`
- `media.asset.uploaded`
- `media.parse.completed`
- `privacy.delete.requested`
- `privacy.delete.completed`

---

## 24. 幂等与一致性要求

### 23.1 幂等要求

以下接口必须支持 `Idempotency-Key`：

- `POST /v2/chat/send`
- `POST /v2/memory/upsert`
- `POST /v2/knowledge/upload`
- `POST /v2/media/upload`
- `POST /internal/billing/record-usage`

### 23.2 一致性要求

- PostgreSQL 内部主数据写操作采用本地事务
- 向量同步通过 Outbox + Kafka 最终一致
- 对账与审计允许补偿，不允许静默丢失

---

## 25. 推荐优先级

### P0 首批落地

- `agent-api-gateway`
- `auth-service`
- `agent-orchestrator-service`
- `context-service`
- `memory-service`
- `model-gateway-service`
- `billing-service`
- `audit-service`
- `privacy-service`

### P1 第二批落地

- `knowledge-service`
- `media-service`
- `node-capability-service`
- `workflow-runtime-service`
- `legacy-node-adapter-service`

### P2 后续增强

- `ops-admin-service`
- 复杂审批、人审流、灰度流

---

## 26. 下一步

基于本文，后续实现可直接进入：

1. Spring Boot 多模块工程初始化
2. OpenAPI/Feign/gRPC 契约生成
3. PostgreSQL 表结构落地
4. Kafka Topic 与消费组初始化
5. Qdrant collection 建模
