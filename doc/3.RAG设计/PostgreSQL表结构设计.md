# 《心理学空间·自我探索Agent Pro》PostgreSQL 表结构设计

## 1. 文档目标

本文定义 Java 微服务后端在 `PostgreSQL` 中的核心表结构设计，目标是让数据库同时满足：

- 高并发在线会话
- 记忆碎片主数据管理
- 知识库文档管理
- Token 计费与账务
- 审计与回放
- 工作流定义与版本管理
- Outbox 最终一致性

本文是逻辑设计文档，不等于最终 DDL，但字段、约束、索引与分区策略已达到可以进入 DDL 设计的粒度。

---

## 2. 设计原则

### 2.1 主键原则

- 所有核心表使用业务可读主键或雪花/ULID 主键
- 避免对外暴露自增整数 ID
- 内部保留 `bigserial` 作为顺序键可选，但不作为外部主键

推荐：

- 主业务主键：`varchar(64)` 或 `uuid`
- 时间字段统一：`timestamptz`

### 2.2 通用字段

除极少数纯关联表外，所有表建议具备：

- `id`
- `tenant_id`
- `app_id`
- `created_at`
- `updated_at`
- `created_by`
- `updated_by`
- `deleted`
- `version`

### 2.3 隔离原则

所有业务查询默认必须带至少两类隔离键：

- `tenant_id`
- `app_id`

用户私域数据必须额外带：

- `user_id`

### 2.4 软删除原则

- 用户可见业务表统一采用软删除：`deleted boolean`
- 大表清理采用异步归档 + 物理删除任务

### 2.5 大表分区原则

以下大表建议按月分区：

- `conversation_message`
- `token_usage_event`
- `billing_ledger`
- `audit_event`
- `audit_trace`
- `outbox_event`

### 2.6 ORM 原则

- Java 持久层统一使用 `MyBatis`
- 复杂查询、统计报表、审计回放、CMS 分页列表使用显式 SQL
- 简单 CRUD 可采用通用 Mapper，但不得牺牲关键 SQL 的可控性

### 2.7 索引设计原则

- 高频过滤字段优先走联合 B-Tree 索引
- JSONB 标签类字段优先使用 `GIN`
- 大表索引按“查询路径”设计，避免为低频字段滥建索引
- 用户私域检索相关表优先建立 `(tenant_id, app_id, user_id, deleted)` 前缀索引
- 分页查询统一要求有稳定排序键，通常为 `created_at desc, id desc`

---

## 3. 命名规范

### 3.1 表命名

- 小写下划线
- 单数名词优先

示例：

- `conversation`
- `conversation_message`
- `memory_fragment`

### 3.2 索引命名

- `idx_<table>_<field>`
- 唯一索引：`uk_<table>_<field>`

### 3.3 外键原则

高并发核心链路中，不强依赖数据库外键做所有约束，而采用：

- 核心表保留必要外键
- 大写入表更偏向应用层保证一致性
- 防止过多外键拖慢写入与分区管理

---

## 4. 核心主题域

数据库拆分为 8 个主题域：

1. 租户与应用域
2. 用户与鉴权域
3. 会话与上下文域
4. 记忆域
5. 知识库域
6. 计费域
7. 审计域
8. 工作流域

---

## 5. 租户与应用域

## 5.1 `tenant`

用途：

- 逻辑租户

关键字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) | 主键 |
| `tenant_code` | varchar(64) | 租户编码，唯一 |
| `tenant_name` | varchar(128) | 名称 |
| `status` | varchar(32) | `ACTIVE` / `DISABLED` |
| `plan_code` | varchar(64) | 当前租户方案 |
| `deleted` | boolean | 软删除 |
| `version` | bigint | 乐观锁 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

索引：

- `uk_tenant_tenant_code`
- `idx_tenant_status`

## 5.2 `app`

用途：

- 每个租户下的应用实例，例如 `phyok`

关键字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) | 主键 |
| `tenant_id` | varchar(64) | 租户 ID |
| `app_code` | varchar(64) | 应用编码 |
| `app_name` | varchar(128) | 应用名 |
| `app_mode` | varchar(32) | `CHAT` / `WORKFLOW` |
| `default_model_route` | varchar(128) | 默认模型路由 |
| `status` | varchar(32) | 状态 |
| `deleted` | boolean | 软删除 |
| `version` | bigint | 版本 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束：

- `tenant_id + app_code` 唯一

---

## 6. 用户与鉴权域

## 6.1 `user_account`

用途：

- 用户主账号

关键字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) | 主键 |
| `tenant_id` | varchar(64) | 租户 |
| `app_id` | varchar(64) | 应用 |
| `email` | varchar(256) | 邮箱 |
| `mobile` | varchar(64) | 手机号，可空 |
| `display_name` | varchar(128) | 昵称 |
| `status` | varchar(32) | `ACTIVE` / `BANNED` |
| `register_source` | varchar(32) | 注册来源 |
| `last_login_at` | timestamptz | 最后登录 |
| `deleted` | boolean | 软删除 |
| `version` | bigint | 版本 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束：

- `tenant_id + app_id + email` 唯一

## 6.2 `user_session`

用途：

- 登录会话

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `user_id`
- `session_token_hash`
- `refresh_token_hash`
- `device_id`
- `client_version`
- `expired_at`
- `revoked`
- `created_at`

索引：

- `idx_user_session_user_id`
- `idx_user_session_expired_at`

---

## 7. 会话与上下文域

## 7.1 `conversation`

用途：

- 用户会话主表

关键字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) | 主键 |
| `tenant_id` | varchar(64) | 租户 |
| `app_id` | varchar(64) | 应用 |
| `user_id` | varchar(64) | 用户 |
| `title` | varchar(256) | 会话标题 |
| `status` | varchar(32) | `ACTIVE` / `ARCHIVED` |
| `last_turn_at` | timestamptz | 最后活跃时间 |
| `message_count` | int | 消息数 |
| `summary_version` | int | 摘要版本号 |
| `deleted` | boolean | 软删除 |
| `version` | bigint | 版本 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

索引：

- `idx_conversation_user_id_last_turn_at`
- `idx_conversation_tenant_app_user`

## 7.2 `conversation_message`

用途：

- 会话消息大表

分区：

- `created_at` 按月分区

关键字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) | 主键 |
| `tenant_id` | varchar(64) | 租户 |
| `app_id` | varchar(64) | 应用 |
| `user_id` | varchar(64) | 用户 |
| `conversation_id` | varchar(64) | 会话 |
| `turn_id` | varchar(64) | 回合 ID |
| `role` | varchar(32) | `USER` / `ASSISTANT` / `SYSTEM` / `TOOL` |
| `message_type` | varchar(32) | `TEXT` / `IMAGE` / `FILE` / `AUDIO` / `STRUCTURED` |
| `content_text` | text | 文本正文 |
| `content_json` | jsonb | 结构化内容 |
| `token_count` | int | 本条消息 token 估算 |
| `status` | varchar(32) | `NORMAL` / `DELETED` |
| `created_at` | timestamptz | 创建时间 |

索引：

- `idx_conv_msg_conversation_created_at`
- `idx_conv_msg_user_conversation`
- `idx_conv_msg_turn_id`

说明：

- 大文本放 `content_text`
- 附件引用、结构化卡片、工具结果放 `content_json`

## 7.3 `conversation_summary`

用途：

- 会话压缩摘要

关键字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) | 主键 |
| `tenant_id` | varchar(64) | 租户 |
| `app_id` | varchar(64) | 应用 |
| `user_id` | varchar(64) | 用户 |
| `conversation_id` | varchar(64) | 会话 |
| `summary_level` | varchar(16) | `L1` / `L2` / `L3` |
| `topic_code` | varchar(64) | 主题编码 |
| `range_start_turn_no` | int | 覆盖起始轮次 |
| `range_end_turn_no` | int | 覆盖结束轮次 |
| `summary_text` | text | 摘要内容 |
| `summary_json` | jsonb | 结构化摘要 |
| `version` | int | 版本 |
| `created_at` | timestamptz | 创建时间 |

索引：

- `idx_conv_summary_conversation_level`
- `idx_conv_summary_topic_code`

## 7.4 `conversation_run`

用途：

- 一次聊天请求运行记录

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `user_id`
- `conversation_id`
- `turn_id`
- `request_id`
- `intent_code`
- `workflow_code`
- `status`
- `started_at`
- `finished_at`
- `latency_ms`

索引：

- `idx_conv_run_conversation_id`
- `idx_conv_run_request_id`

## 7.5 `conversation_run_step`

用途：

- 一次运行的步骤明细

关键字段：

- `id`
- `run_id`
- `step_type`
- `step_name`
- `status`
- `input_json`
- `output_json`
- `latency_ms`
- `created_at`

---

## 8. 记忆域

## 8.1 `memory_fragment`

用途：

- 用户记忆碎片主表

关键字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) | 主键 |
| `tenant_id` | varchar(64) | 租户 |
| `app_id` | varchar(64) | 应用 |
| `user_id` | varchar(64) | 用户 |
| `source_turn_id` | varchar(64) | 来源回合 |
| `fragment_type` | varchar(32) | `FACT` / `EMOTION` / `EVENT` / `RELATION` |
| `source_type` | varchar(32) | `USER_INPUT` / `IMPORT` / `MANUAL_EDIT` |
| `timeline_root` | varchar(32) | `EARLY` / `CHILDHOOD` / `STUDENT` / `WORK` / `TODAY` |
| `content_text` | text | 记忆正文 |
| `content_structured` | jsonb | 结构化字段 |
| `content_hash` | varchar(128) | 去重与幂等校验 |
| `token_count` | int | 文本 token 估算 |
| `chunk_confidence` | numeric(5,4) | LLM 分片置信度 |
| `chunk_strategy` | varchar(32) | `LLM` / `MANUAL_FIX` |
| `emotion_tags` | jsonb | 情绪标签 |
| `topic_tags` | jsonb | 主题标签 |
| `time_hint` | varchar(64) | 时间线提示 |
| `visibility` | varchar(32) | `PRIVATE` / `APP_SHARED` |
| `embedding_status` | varchar(32) | `PENDING` / `DONE` / `FAILED` |
| `searchable` | boolean | 是否参与检索 |
| `deleted` | boolean | 软删除 |
| `version` | bigint | 版本 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

索引：

- `idx_memory_fragment_user_created_at`
- `idx_memory_fragment_embedding_status`
- `idx_memory_fragment_searchable`
- `idx_memory_fragment_source_turn_id`
- `idx_memory_fragment_scope_search`
- `idx_memory_fragment_scope_timeline`
- `idx_memory_fragment_created_desc`
- `gin_memory_fragment_topic_tags`
- `gin_memory_fragment_emotion_tags`

说明：

- 记忆碎片正文以 PG 为准，不把大文本存为 Qdrant payload 主数据
- `timeline_root` 用于兼容旧星图五根节点
- `chunk_confidence` 用于衡量 LLM 分片质量与人工修复优先级
- 推荐主查询联合索引：

```sql
(tenant_id, app_id, user_id, deleted, searchable, timeline_root, created_at desc)
```

## 8.2 `memory_fragment_relation`

用途：

- 记忆碎片间关系

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `user_id`
- `from_fragment_id`
- `to_fragment_id`
- `relation_type`
- `confidence_score`
- `created_at`

关系类型示例：

- `SAME_TOPIC`
- `CAUSE_OF`
- `TEMPORAL_NEXT`
- `RELATES_TO_PERSON`

索引：

- `idx_memory_relation_from_fragment_id`
- `idx_memory_relation_to_fragment_id`

## 8.3 `memory_embedding_job`

用途：

- 记忆 embedding 异步任务

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `user_id`
- `fragment_id`
- `job_status`
- `retry_count`
- `last_error`
- `created_at`
- `updated_at`

## 8.4 `memory_chunk_job`

用途：

- LLM 记忆语义分片任务

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `user_id`
- `source_turn_id`
- `raw_text`
- `job_status`
- `llm_provider`
- `llm_model`
- `retry_count`
- `last_error`
- `created_at`
- `updated_at`

## 8.5 `memory_star_map_snapshot`

用途：

- 旧星图可视化快照
- 五根节点聚合结果缓存

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `user_id`
- `view_code`
- `root_nodes_json`
- `memory_nodes_json`
- `links_json`
- `memory_count`
- `generated_at`
- `expire_at`

说明：

- 五根节点固定为：`EARLY`、`CHILDHOOD`、`STUDENT`、`WORK`、`TODAY`
- 该表是可视化投影表，不是真相主表
- 快照可异步重建，不参与主事务

---

## 9. 知识库域

## 9.1 `knowledge_document`

用途：

- 知识库文档主表

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `owner_user_id`
- `doc_name`
- `doc_type`
- `asset_id`
- `storage_path`
- `source_type`
- `index_status`
- `visibility`
- `deleted`
- `version`
- `created_at`
- `updated_at`

索引：

- `idx_knowledge_document_owner_user_id`
- `idx_knowledge_document_index_status`

## 9.2 `knowledge_chunk`

用途：

- 文档切片主表

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `knowledge_document_id`
- `chunk_no`
- `chunk_text`
- `chunk_hash`
- `token_count`
- `chunk_type`
- `semantic_parent_no`
- `token_start`
- `token_end`
- `chunk_confidence`
- `chunk_strategy`
- `metadata_json`
- `embedding_status`
- `deleted`
- `created_at`

约束：

- `knowledge_document_id + chunk_no` 唯一

索引：

- `idx_knowledge_chunk_document_id`
- `idx_knowledge_chunk_embedding_status`
- `idx_knowledge_chunk_document_chunk_no`
- `idx_knowledge_chunk_scope_embedding`
- `idx_knowledge_chunk_created_desc`

## 9.3 `knowledge_index_job`

用途：

- 文档解析/切片/embedding 的任务表

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `knowledge_document_id`
- `job_stage`
- `job_status`
- `retry_count`
- `last_error`
- `created_at`
- `updated_at`

---

## 10. 模型与计费域

## 10.1 `model_provider_config`

用途：

- 模型供应商配置

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `provider_code`
- `model_code`
- `endpoint`
- `auth_ref`
- `priority`
- `enabled`
- `rate_limit_qps`
- `cost_rule_json`
- `created_at`
- `updated_at`

## 10.2 `token_usage_event`

用途：

- token 计量原始事件

分区：

- 按月分区

关键字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) | 主键 |
| `tenant_id` | varchar(64) | 租户 |
| `app_id` | varchar(64) | 应用 |
| `user_id` | varchar(64) | 用户 |
| `conversation_id` | varchar(64) | 会话 |
| `turn_id` | varchar(64) | 回合 |
| `run_id` | varchar(64) | 运行 ID |
| `provider_code` | varchar(64) | 供应商 |
| `model_code` | varchar(128) | 模型 |
| `usage_type` | varchar(32) | `CHAT` / `EMBEDDING` / `RERANK` / `OCR` / `ASR` |
| `prompt_tokens` | int | prompt token |
| `completion_tokens` | int | completion token |
| `total_tokens` | int | 总 token |
| `raw_cost` | numeric(18,6) | 原始成本 |
| `currency` | varchar(16) | 币种 |
| `created_at` | timestamptz | 创建时间 |

索引：

- `idx_token_usage_user_created_at`
- `idx_token_usage_conversation_id`
- `idx_token_usage_run_id`

## 10.3 `billing_account`

用途：

- 账务账户

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `user_id`
- `plan_code`
- `quota_balance`
- `cash_balance`
- `status`
- `updated_at`

约束：

- `tenant_id + app_id + user_id` 唯一

## 10.4 `billing_ledger`

用途：

- 账务流水

分区：

- 按月分区

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `user_id`
- `account_id`
- `ledger_type`
- `biz_type`
- `biz_id`
- `change_amount`
- `balance_after`
- `currency`
- `description`
- `created_at`

索引：

- `idx_billing_ledger_account_id_created_at`
- `idx_billing_ledger_biz_id`

## 10.5 `billing_precheck_record`

用途：

- 请求前额度预检记录

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `user_id`
- `conversation_id`
- `request_id`
- `precheck_result`
- `reason_code`
- `created_at`

---

## 11. 审计域

## 11.1 `audit_trace`

用途：

- 对话级审计总链路

分区：

- 按月分区

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `user_id`
- `conversation_id`
- `turn_id`
- `run_id`
- `trace_status`
- `risk_level`
- `started_at`
- `finished_at`
- `created_at`

索引：

- `idx_audit_trace_conversation_id`
- `idx_audit_trace_run_id`
- `idx_audit_trace_risk_level`

## 11.2 `audit_event`

用途：

- 审计事件明细

分区：

- 按月分区

关键字段：

- `id`
- `trace_id`
- `tenant_id`
- `app_id`
- `user_id`
- `conversation_id`
- `event_type`
- `event_name`
- `event_order_no`
- `input_json`
- `output_json`
- `masked`
- `created_at`

索引：

- `idx_audit_event_trace_id`
- `idx_audit_event_event_type`

## 11.3 `audit_snapshot`

用途：

- 争议轮次回放快照

关键字段：

- `id`
- `trace_id`
- `snapshot_type`
- `snapshot_json`
- `created_at`

---

## 12. 工作流域

## 12.1 `workflow_definition`

用途：

- 工作流主定义

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `workflow_code`
- `workflow_name`
- `source_type`
- `source_ref`
- `status`
- `current_version_no`
- `created_at`
- `updated_at`

约束：

- `tenant_id + app_id + workflow_code` 唯一

## 12.2 `workflow_version`

用途：

- 工作流版本定义

关键字段：

- `id`
- `workflow_definition_id`
- `version_no`
- `dsl_source`
- `compiled_definition_json`
- `compatibility_report_json`
- `published`
- `created_at`

约束：

- `workflow_definition_id + version_no` 唯一

## 12.3 `workflow_run_record`

用途：

- 工作流运行记录

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `workflow_definition_id`
- `workflow_version_id`
- `run_status`
- `trigger_type`
- `input_json`
- `output_json`
- `created_at`
- `finished_at`

---

## 13. 媒体域

## 13.1 `media_asset`

用途：

- 文件资产主表

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `user_id`
- `asset_type`
- `file_name`
- `mime_type`
- `file_size`
- `storage_provider`
- `storage_key`
- `sha256`
- `status`
- `created_at`

## 13.2 `media_parse_job`

用途：

- 文件解析任务

关键字段：

- `id`
- `asset_id`
- `parse_type`
- `job_status`
- `result_json`
- `last_error`
- `created_at`
- `updated_at`

---

## 14. Outbox 与异步一致性

## 14.1 `outbox_event`

用途：

- PG 到 Kafka 的一致性桥

分区：

- 按月分区

关键字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) | 主键 |
| `tenant_id` | varchar(64) | 租户 |
| `aggregate_type` | varchar(64) | 聚合类型 |
| `aggregate_id` | varchar(64) | 聚合主键 |
| `event_type` | varchar(128) | 事件类型 |
| `event_key` | varchar(128) | 分区键 |
| `payload_json` | jsonb | 事件内容 |
| `publish_status` | varchar(32) | `NEW` / `SENT` / `FAILED` |
| `retry_count` | int | 重试次数 |
| `next_retry_at` | timestamptz | 下次重试 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

索引：

- `idx_outbox_publish_status`
- `idx_outbox_event_type_created_at`

---

## 15. 推荐索引策略

## 15.1 高频索引

必须有：

- 用户维度索引
- 会话维度索引
- `created_at` 时间索引
- `status/deleted` 组合索引

## 15.2 JSONB 索引

仅对稳定高频查询字段建立：

- `content_structured`
- `summary_json`
- `metadata_json`
- `compatibility_report_json`

不建议一开始对所有 JSONB 全量建 GIN。

---

## 16. 分区策略

建议按月分区的表：

- `conversation_message`
- `token_usage_event`
- `billing_ledger`
- `audit_event`
- `audit_trace`
- `outbox_event`

分区保留策略：

- 热分区：最近 3 个月
- 温分区：3 到 12 个月
- 冷归档：12 个月以上

---

## 17. 脱敏与安全字段

以下字段若进入日志、审计或下游投影，必须脱敏或加密：

- `email`
- `mobile`
- `content_text`
- `summary_text`
- `snapshot_json`
- `input_json`
- `output_json`
- `session_token_hash`
- `refresh_token_hash`

---

## 18. 预留扩展字段

建议大多数主业务表保留：

- `ext_json jsonb`

用途：

- 平滑承接未来字段
- 支持灰度实验
- 避免频繁 DDL

但原则是：

- 核心检索字段不应长期放在 `ext_json`
- 稳定字段应及时提升为正式列

---

## 19. 推荐 DDL 落地顺序

第一批：

1. `tenant`
2. `app`
3. `user_account`
4. `conversation`
5. `conversation_message`
6. `conversation_summary`
7. `memory_fragment`
8. `memory_fragment_relation`
9. `token_usage_event`
10. `billing_account`
11. `billing_ledger`
12. `audit_trace`
13. `audit_event`
14. `outbox_event`

第二批：

1. `knowledge_document`
2. `knowledge_chunk`
3. `knowledge_index_job`
4. `workflow_definition`
5. `workflow_version`
6. `workflow_run_record`
7. `media_asset`
8. `media_parse_job`
9. `memory_star_map_snapshot`

---

## 20. 最终结论

### 20.1 PostgreSQL 定位

PostgreSQL 在本系统中承担的是：

- 事务真相源
- 审计主源
- 会话主源
- 账务主源
- 工作流主源

### 20.2 设计结论

- 所有主业务数据以 PG 为准
- Qdrant 只承接召回检索
- 通过 `outbox_event` 保证最终一致
- 通过分区和归档控制大表规模
- 通过统一隔离键保证租户、应用、用户边界

### 20.3 下一步

基于本文，建议下一步直接输出：

1. Flyway/Liquibase 建表脚本清单
2. 各表 DDL 初版
3. MyBatis 实体与 Mapper 设计
