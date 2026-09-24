# 《心理学空间·自我探索Agent Pro》PostgreSQL DDL 初版

## 1. 目标

本文给出可直接进入 `Flyway` / `Liquibase` 的 PostgreSQL DDL 初版。

定位：

- 不是最终完整全量 DDL
- 但已经达到“可作为首版脚本骨架直接开工”的粒度

覆盖重点：

- 多租户
- 鉴权
- 会话
- 记忆碎片
- 知识文档
- 计费
- 审计
- CMS
- Node v2 媒体能力表

---

## 2. 建议脚本顺序

```text
V1__base_extensions.sql
V2__tenant_and_app.sql
V3__user_and_auth.sql
V4__conversation.sql
V5__memory.sql
V6__knowledge.sql
V7__billing.sql
V8__audit.sql
V9__media_and_node_v2.sql
V10__cms_admin.sql
V11__outbox.sql
```

---

## 3. 基础扩展

```sql
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
```

---

## 4. 租户与应用

```sql
create table if not exists tenant (
  id varchar(64) primary key,
  tenant_code varchar(64) not null,
  tenant_name varchar(128) not null,
  status varchar(32) not null default 'ACTIVE',
  plan_code varchar(64),
  deleted boolean not null default false,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uk_tenant_tenant_code on tenant (tenant_code);
create index if not exists idx_tenant_status on tenant (status);

create table if not exists app (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_code varchar(64) not null,
  app_name varchar(128) not null,
  app_mode varchar(32) not null default 'CHAT',
  default_model_route varchar(128),
  status varchar(32) not null default 'ACTIVE',
  deleted boolean not null default false,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uk_app_tenant_app_code on app (tenant_id, app_code);
create index if not exists idx_app_status on app (status);
```

---

## 5. 用户与鉴权

```sql
create table if not exists user_account (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  email varchar(256),
  mobile varchar(64),
  display_name varchar(128),
  status varchar(32) not null default 'ACTIVE',
  register_source varchar(32),
  last_login_at timestamptz,
  deleted boolean not null default false,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uk_user_account_email on user_account (tenant_id, app_id, email) where email is not null;
create index if not exists idx_user_account_status on user_account (tenant_id, app_id, status);
create index if not exists idx_user_account_created_at on user_account (tenant_id, app_id, created_at desc);

create table if not exists user_session (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64) not null,
  session_token_hash varchar(256) not null,
  refresh_token_hash varchar(256) not null,
  device_id varchar(128),
  client_version varchar(64),
  expired_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_session_user_id on user_session (tenant_id, app_id, user_id, revoked, expired_at);
create index if not exists idx_user_session_expired_at on user_session (expired_at);
```

---

## 6. 会话与上下文

```sql
create table if not exists conversation (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64) not null,
  title varchar(256),
  status varchar(32) not null default 'ACTIVE',
  last_turn_at timestamptz,
  message_count int not null default 0,
  summary_version int not null default 0,
  deleted boolean not null default false,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversation_user_last_turn on conversation (tenant_id, app_id, user_id, deleted, last_turn_at desc);
create index if not exists idx_conversation_created_at on conversation (tenant_id, app_id, created_at desc);

create table if not exists conversation_message (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  conversation_id varchar(64) not null,
  user_id varchar(64) not null,
  role varchar(32) not null,
  content_text text,
  attachment_json jsonb,
  token_count int,
  created_at timestamptz not null default now(),
  deleted boolean not null default false
) partition by range (created_at);

create index if not exists idx_conversation_message_conv_created on conversation_message (tenant_id, app_id, conversation_id, created_at desc);
create index if not exists idx_conversation_message_user_created on conversation_message (tenant_id, app_id, user_id, created_at desc);
```

---

## 7. 记忆域

```sql
create table if not exists memory_fragment (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64) not null,
  source_turn_id varchar(64),
  fragment_type varchar(32) not null,
  source_type varchar(32) not null,
  timeline_root varchar(32) not null,
  content_text text not null,
  content_structured jsonb,
  content_hash varchar(128) not null,
  token_count int,
  chunk_confidence numeric(5,4),
  chunk_strategy varchar(32) not null default 'LLM',
  emotion_tags jsonb,
  topic_tags jsonb,
  time_hint varchar(64),
  visibility varchar(32) not null default 'PRIVATE',
  embedding_status varchar(32) not null default 'PENDING',
  searchable boolean not null default true,
  deleted boolean not null default false,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uk_memory_fragment_content_hash on memory_fragment (tenant_id, app_id, user_id, content_hash);
create index if not exists idx_memory_fragment_scope_search on memory_fragment (
  tenant_id, app_id, user_id, deleted, searchable, created_at desc
);
create index if not exists idx_memory_fragment_scope_timeline on memory_fragment (
  tenant_id, app_id, user_id, timeline_root, deleted, searchable, created_at desc
);
create index if not exists idx_memory_fragment_embedding_status on memory_fragment (tenant_id, app_id, embedding_status, created_at desc);
create index if not exists idx_memory_fragment_source_turn_id on memory_fragment (source_turn_id);
create index if not exists idx_memory_fragment_created_desc on memory_fragment (tenant_id, app_id, user_id, created_at desc, id desc);
create index if not exists gin_memory_fragment_topic_tags on memory_fragment using gin (topic_tags);
create index if not exists gin_memory_fragment_emotion_tags on memory_fragment using gin (emotion_tags);

create table if not exists memory_fragment_relation (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64) not null,
  from_fragment_id varchar(64) not null,
  to_fragment_id varchar(64) not null,
  relation_type varchar(32) not null,
  confidence_score numeric(5,4),
  created_at timestamptz not null default now()
);

create index if not exists idx_memory_relation_from on memory_fragment_relation (tenant_id, app_id, user_id, from_fragment_id);
create index if not exists idx_memory_relation_to on memory_fragment_relation (tenant_id, app_id, user_id, to_fragment_id);

create table if not exists memory_embedding_job (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64) not null,
  fragment_id varchar(64) not null,
  job_status varchar(32) not null,
  retry_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_memory_embedding_job_status on memory_embedding_job (tenant_id, app_id, job_status, created_at asc);

create table if not exists memory_chunk_job (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64) not null,
  source_turn_id varchar(64),
  raw_text text not null,
  job_status varchar(32) not null,
  llm_provider varchar(64),
  llm_model varchar(128),
  retry_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_memory_chunk_job_status on memory_chunk_job (tenant_id, app_id, job_status, created_at asc);

create table if not exists memory_star_map_snapshot (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64) not null,
  view_code varchar(32) not null,
  root_nodes_json jsonb not null,
  memory_nodes_json jsonb not null,
  links_json jsonb not null,
  memory_count int not null default 0,
  generated_at timestamptz not null default now(),
  expire_at timestamptz
);

create index if not exists idx_memory_star_map_scope on memory_star_map_snapshot (tenant_id, app_id, user_id, view_code, generated_at desc);
```

---

## 8. 知识库域

```sql
create table if not exists knowledge_document (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  owner_user_id varchar(64),
  doc_name varchar(256) not null,
  doc_type varchar(64),
  asset_id varchar(64),
  storage_path varchar(512),
  source_type varchar(32),
  index_status varchar(32) not null default 'PENDING',
  visibility varchar(32) not null,
  deleted boolean not null default false,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_document_owner on knowledge_document (tenant_id, app_id, owner_user_id, created_at desc);
create index if not exists idx_knowledge_document_index_status on knowledge_document (tenant_id, app_id, index_status, created_at desc);

create table if not exists knowledge_chunk (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  knowledge_document_id varchar(64) not null,
  chunk_no int not null,
  chunk_text text not null,
  chunk_hash varchar(128) not null,
  token_count int,
  chunk_type varchar(32),
  semantic_parent_no int,
  token_start int,
  token_end int,
  chunk_confidence numeric(5,4),
  chunk_strategy varchar(32) not null default 'LLM',
  metadata_json jsonb,
  embedding_status varchar(32) not null default 'PENDING',
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists uk_knowledge_chunk_document_no on knowledge_chunk (knowledge_document_id, chunk_no);
create index if not exists idx_knowledge_chunk_document_id on knowledge_chunk (tenant_id, app_id, knowledge_document_id, deleted, chunk_no);
create index if not exists idx_knowledge_chunk_embedding_status on knowledge_chunk (tenant_id, app_id, embedding_status, created_at asc);
create index if not exists idx_knowledge_chunk_created_desc on knowledge_chunk (tenant_id, app_id, created_at desc, id desc);

create table if not exists knowledge_index_job (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  knowledge_document_id varchar(64) not null,
  job_stage varchar(32) not null,
  job_status varchar(32) not null,
  retry_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_index_job_status on knowledge_index_job (tenant_id, app_id, job_status, created_at asc);
```

---

## 9. 计费域

```sql
create table if not exists billing_account (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64) not null,
  balance_tokens bigint not null default 0,
  balance_points bigint not null default 0,
  status varchar(32) not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uk_billing_account_scope on billing_account (tenant_id, app_id, user_id);

create table if not exists billing_ledger (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64) not null,
  conversation_id varchar(64),
  ledger_type varchar(32) not null,
  amount bigint not null,
  balance_after bigint,
  biz_type varchar(64),
  biz_id varchar(64),
  remark varchar(256),
  created_at timestamptz not null default now()
) partition by range (created_at);

create index if not exists idx_billing_ledger_user_created on billing_ledger (tenant_id, app_id, user_id, created_at desc);

create table if not exists token_usage_event (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64),
  conversation_id varchar(64),
  run_id varchar(64),
  provider_code varchar(64),
  model_code varchar(128),
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  embedding_tokens int not null default 0,
  rerank_tokens int not null default 0,
  created_at timestamptz not null default now()
) partition by range (created_at);

create index if not exists idx_token_usage_user_created on token_usage_event (tenant_id, app_id, user_id, created_at desc);
create index if not exists idx_token_usage_conversation on token_usage_event (conversation_id, created_at desc);
```

---

## 10. 审计域

```sql
create table if not exists audit_trace (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64),
  conversation_id varchar(64),
  trace_id varchar(128) not null,
  run_id varchar(64),
  trace_type varchar(32) not null,
  status varchar(32) not null,
  created_at timestamptz not null default now()
) partition by range (created_at);

create index if not exists idx_audit_trace_trace_id on audit_trace (trace_id);
create index if not exists idx_audit_trace_scope_created on audit_trace (tenant_id, app_id, user_id, created_at desc);

create table if not exists audit_event (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  trace_id varchar(128) not null,
  event_type varchar(64) not null,
  event_level varchar(32) not null,
  event_json jsonb not null,
  created_at timestamptz not null default now()
) partition by range (created_at);

create index if not exists idx_audit_event_trace_id on audit_event (trace_id, created_at asc);
create index if not exists idx_audit_event_type_created on audit_event (tenant_id, app_id, event_type, created_at desc);
```

---

## 11. Node v2 媒体域

```sql
create table if not exists media_asset (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64),
  asset_type varchar(32) not null,
  file_name varchar(256),
  mime_type varchar(128),
  file_size bigint,
  storage_path varchar(512),
  preview_url varchar(512),
  parse_status varchar(32) not null default 'PENDING',
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_media_asset_scope_created on media_asset (tenant_id, app_id, user_id, created_at desc);
create index if not exists idx_media_asset_parse_status on media_asset (tenant_id, app_id, parse_status, created_at desc);

create table if not exists media_parse_job (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64),
  asset_id varchar(64) not null,
  job_type varchar(32) not null,
  job_status varchar(32) not null,
  result_json jsonb,
  retry_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_media_parse_job_scope_status on media_parse_job (tenant_id, app_id, job_status, created_at desc);
```

---

## 12. CMS 域

```sql
create table if not exists admin_operator (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  username varchar(64) not null,
  password_hash varchar(256) not null,
  display_name varchar(128),
  email varchar(256),
  status varchar(32) not null default 'ACTIVE',
  force_reset_password boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uk_admin_operator_username on admin_operator (tenant_id, username);

create table if not exists user_complaint (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  app_id varchar(64) not null,
  user_id varchar(64),
  conversation_id varchar(64),
  complaint_type varchar(64) not null,
  complaint_content text not null,
  status varchar(32) not null default 'OPEN',
  handled_by varchar(64),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_complaint_status_created on user_complaint (tenant_id, app_id, status, created_at desc);
create index if not exists idx_user_complaint_user_id on user_complaint (tenant_id, app_id, user_id, created_at desc);
```

---

## 13. Outbox

```sql
create table if not exists outbox_event (
  id varchar(64) primary key,
  tenant_id varchar(64),
  app_id varchar(64),
  aggregate_type varchar(64) not null,
  aggregate_id varchar(64) not null,
  event_type varchar(128) not null,
  payload_json jsonb not null,
  publish_status varchar(32) not null default 'PENDING',
  retry_count int not null default 0,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
) partition by range (created_at);

create index if not exists idx_outbox_publish_status on outbox_event (publish_status, next_retry_at, created_at asc);
create index if not exists idx_outbox_aggregate on outbox_event (aggregate_type, aggregate_id, created_at desc);
```

---

## 14. MyBatis 落地建议

优先为以下表建立显式 Mapper：

- `conversation`
- `conversation_message`
- `memory_fragment`
- `knowledge_chunk`
- `billing_ledger`
- `audit_trace`
- `audit_event`
- `media_asset`
- `media_parse_job`
- `user_complaint`

原因：

- 这些表最容易出现复杂分页、统计、条件过滤和索引调优需求

---

## 15. 下一步

基于本文，下一步可以直接继续：

1. 生成 `Flyway` 目录结构
2. 按本文拆成多个 `V*.sql`
3. 为关键表补 `MyBatis Mapper XML`
