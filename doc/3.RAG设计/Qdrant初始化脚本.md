# 《心理学空间·自我探索Agent Pro》Qdrant 初始化脚本设计 V1

## 1. 目标

本文给出 `Qdrant` 首版初始化脚本设计，目标是：

- 可直接指导初始化 `user_memory_fragments`
- 可直接指导初始化 `knowledge_chunks`
- 支持 `bge-m3` 的 `dense + sparse`
- 支持 payload index
- 兼顾你当前“轻量服务器 + 单机 Docker”环境

本文是脚本设计文档，偏“可直接抄去实现”的粒度。

---

## 2. 总体结论

P0 统一采用：

- 两个 collection
  - `user_memory_fragments`
  - `knowledge_chunks`
- named vectors
  - `dense_vector`
  - `sparse_vector`
- 轻 payload
- 单机 Docker 部署
- 仅内网访问

---

## 3. 向量设计

## 3.1 dense 向量

- 来源：`bge-m3`
- 距离：`COSINE`

## 3.2 sparse 向量

- 来源：`bge-m3` 同次前向
- 用于 hybrid recall

## 3.3 为什么不用只做 dense

因为你的场景是心理问题探索，用户经常会出现：

- 情绪语义表达
- 关系表达
- 特定关键词
- 半口语、半长文本

只做 dense 容易漏掉关键词强相关片段。

所以推荐：

- dense 找语义相近
- sparse 找关键词命中
- rerank 做最终精排

---

## 4. Collection 初始化方案

## 4.1 `user_memory_fragments`

建议参数：

- collection name：`user_memory_fragments`
- dense vector name：`dense_vector`
- sparse vector name：`sparse_vector`

示意 JSON：

```json
{
  "vectors": {
    "dense_vector": {
      "size": 1024,
      "distance": "Cosine"
    }
  },
  "sparse_vectors": {
    "sparse_vector": {}
  }
}
```

## 4.2 `knowledge_chunks`

建议参数：

- collection name：`knowledge_chunks`
- dense vector name：`dense_vector`
- sparse vector name：`sparse_vector`

示意 JSON：

```json
{
  "vectors": {
    "dense_vector": {
      "size": 1024,
      "distance": "Cosine"
    }
  },
  "sparse_vectors": {
    "sparse_vector": {}
  }
}
```

---

## 5. Payload 规范

## 5.1 `user_memory_fragments`

最少字段：

- `tenant_id`
- `app_id`
- `user_id`
- `memory_fragment_id`
- `fragment_type`
- `visibility`
- `deleted`
- `searchable`
- `time_bucket`
- `timeline_root`
- `topic_tags`
- `emotion_tags`
- `embedding_model`
- `embedding_version`
- `created_at`
- `updated_at`

## 5.2 `knowledge_chunks`

最少字段：

- `tenant_id`
- `app_id`
- `knowledge_document_id`
- `knowledge_chunk_id`
- `owner_user_id`
- `knowledge_scope`
- `doc_type`
- `visibility`
- `deleted`
- `embedding_model`
- `embedding_version`
- `created_at`

---

## 6. Payload Index 设计

## 6.1 记忆库索引

为 `user_memory_fragments` 建：

- `tenant_id`
- `app_id`
- `user_id`
- `deleted`
- `searchable`
- `fragment_type`
- `visibility`
- `time_bucket`
- `timeline_root`

## 6.2 知识库索引

为 `knowledge_chunks` 建：

- `tenant_id`
- `app_id`
- `owner_user_id`
- `knowledge_scope`
- `knowledge_document_id`
- `deleted`
- `visibility`

原则：

- 高频过滤字段才建 payload index
- `topic_tags` / `emotion_tags` 先不滥建
- 等真实查询模式稳定后再决定是否补索引

---

## 7. 初始化脚本骨架

## 7.1 Shell 调用风格

建议放在：

```text
deploy/docker/qdrant/
  init-qdrant.sh
```

## 7.2 示例脚本

```bash
#!/usr/bin/env bash
set -euo pipefail

QDRANT_URL="${QDRANT_URL:-http://127.0.0.1:6333}"

create_collection() {
  local name="$1"
  curl -sS -X PUT "${QDRANT_URL}/collections/${name}" \
    -H "Content-Type: application/json" \
    -d '{
      "vectors": {
        "dense_vector": {
          "size": 1024,
          "distance": "Cosine"
        }
      },
      "sparse_vectors": {
        "sparse_vector": {}
      }
    }'
}

create_payload_index() {
  local collection="$1"
  local field="$2"
  local schema="$3"
  curl -sS -X PUT "${QDRANT_URL}/collections/${collection}/index" \
    -H "Content-Type: application/json" \
    -d "{
      \"field_name\": \"${field}\",
      \"field_schema\": \"${schema}\"
    }"
}

create_collection "user_memory_fragments"
create_collection "knowledge_chunks"

create_payload_index "user_memory_fragments" "tenant_id" "keyword"
create_payload_index "user_memory_fragments" "app_id" "keyword"
create_payload_index "user_memory_fragments" "user_id" "keyword"
create_payload_index "user_memory_fragments" "deleted" "bool"
create_payload_index "user_memory_fragments" "searchable" "bool"
create_payload_index "user_memory_fragments" "fragment_type" "keyword"
create_payload_index "user_memory_fragments" "visibility" "keyword"
create_payload_index "user_memory_fragments" "time_bucket" "keyword"
create_payload_index "user_memory_fragments" "timeline_root" "keyword"

create_payload_index "knowledge_chunks" "tenant_id" "keyword"
create_payload_index "knowledge_chunks" "app_id" "keyword"
create_payload_index "knowledge_chunks" "owner_user_id" "keyword"
create_payload_index "knowledge_chunks" "knowledge_scope" "keyword"
create_payload_index "knowledge_chunks" "knowledge_document_id" "keyword"
create_payload_index "knowledge_chunks" "deleted" "bool"
create_payload_index "knowledge_chunks" "visibility" "keyword"
```

---

## 8. 检索请求约定

## 8.1 记忆检索

请求端统一传：

- dense query vector
- sparse query vector
- filter

过滤必须至少包含：

- `tenant_id`
- `app_id`
- `user_id`
- `deleted=false`
- `searchable=true`

## 8.2 文档检索

过滤必须至少包含：

- `tenant_id`
- `app_id`
- `deleted=false`

私有文档必须额外加：

- `owner_user_id`

---

## 9. Upsert 数据契约

## 9.1 记忆点位

point id：

- `memory_fragment_id`

示意：

```json
{
  "id": "mf_001",
  "vector": {
    "dense_vector": [0.1, 0.2],
    "sparse_vector": {
      "indices": [1, 9, 24],
      "values": [0.8, 0.5, 0.2]
    }
  },
  "payload": {
    "tenant_id": "t_001",
    "app_id": "phyok",
    "user_id": "u_001",
    "memory_fragment_id": "mf_001",
    "fragment_type": "EVENT",
    "deleted": false,
    "searchable": true,
    "timeline_root": "CHILDHOOD",
    "embedding_model": "BAAI/bge-m3",
    "embedding_version": 1
  }
}
```

---

## 10. 与 PG 的一致性

严格采用：

```text
PG 主事务 -> outbox_event -> MQ -> Qdrant consumer upsert/delete
```

不允许：

- 应用层直接裸双写 PG + Qdrant

原因：

- 容易不一致
- 不可重放
- 不好补偿

---

## 11. 单机轻量部署建议

当前你的环境下建议：

- Qdrant 单容器
- 独立数据卷
- 不暴露公网
- 仅内网访问

建议 Compose 卷：

```yaml
volumes:
  qdrant_storage:
```

挂载：

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    volumes:
      - qdrant_storage:/qdrant/storage
```

---

## 12. 监控与运维

P0 至少监控：

- collection point 数量
- 检索耗时
- upsert 失败数
- snapshot 大小
- 磁盘占用

建议：

- 每日 snapshot
- snapshot 同步到 COS
- 只保留最近几份

---

## 13. 下一步

基于本文，下一步可以直接做：

1. 写 `init-qdrant.sh`
2. 写 `qdrant-consumer` 的 upsert/delete 契约
3. 写 `memory-service` / `knowledge-service` 的 query DTO

---

## 14. 一句话结论

Qdrant 的正确首版不是“先搭复杂集群”，而是：

- 单机稳定
- 两个 collection
- `bge-m3` dense + sparse
- 轻 payload
- 强过滤
- 用 PG + MQ 保证一致性
