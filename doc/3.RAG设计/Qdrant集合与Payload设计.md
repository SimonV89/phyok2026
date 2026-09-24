# 《心理学空间·自我探索Agent Pro》Qdrant Collection 与 Payload 设计

## 1. 文档目标

本文定义系统中 `Qdrant` 的生产设计，包括：

- collection 划分
- point 主键与 payload 规范
- 检索过滤策略
- 与 PostgreSQL 的同步关系
- 性能、扩展与安全建议

本文假设：

- PostgreSQL 是主数据真相源
- Qdrant 是向量检索执行层
- 应用采用“Qdrant 召回 -> PostgreSQL enrich”的二段式查询

---

## 2. 设计原则

### 2.1 Qdrant 的职责边界

Qdrant 只负责：

- 语义召回
- 高并发 ANN 检索
- payload 过滤
- 召回分数排序

Qdrant 不负责：

- 事务真相
- 全量正文主存储
- 复杂关系 Join
- 审计主记录

### 2.2 存储原则

- 存向量
- 存轻量 payload
- 不存大文本正文主副本
- 不把所有业务字段都复制到 payload

### 2.3 隔离原则

每次检索必须带隔离过滤，至少包括：

- `tenant_id`
- `app_id`

用户私域场景必须额外带：

- `user_id`

---

## 3. Collection 划分结论

## 3.1 推荐主方案

至少拆两个 collection：

- `user_memory_fragments`
- `knowledge_chunks`

### 为什么不能混成一个 collection

因为二者在以下方面完全不同：

- 权限模型不同
- 生命周期不同
- payload 过滤条件不同
- 召回目标不同
- 删除与重建节奏不同

如果混在一起，后期问题会非常明显：

- payload 冗余
- 过滤条件复杂
- 检索召回污染
- 权限边界更难保证

## 3.2 可选扩展 collection

按未来演进可增加：

- `conversation_summaries`
- `derived_insights`
- `workflow_examples`

但 P0 阶段不建议一次性做太多 collection。

---

## 4. 向量模型与维度策略

## 4.1 统一原则

同一个 collection 内，不允许混用不同维度的 dense vector。

建议：

- 一个 collection 固定一个主 embedding 维度
- embedding model 变更时采用版本迁移，而不是在线混存

## 4.2 模型选择结论

P0 阶段统一选择：

- `BAAI/bge-m3`

选择原因：

- 中文与多语言兼容性好
- 同一次前向可同时产出 dense 与 sparse 特征
- 适合长文本与短文本混合场景
- 适合记忆碎片检索与文档检索共用一套 embedding 基线

工程约束：

- dense 向量维度固定按 `bge-m3` 主输出维度设计
- sparse 特征作为 hybrid recall 的第二路输入
- rerank 独立于 embedding 模型，不与 Qdrant collection 混层

## 4.3 建议字段

Qdrant point 维度建议包含：

- `dense_vector`
- `sparse_vector`
- `payload`

## 4.4 模型版本策略

payload 中必须保留：

- `embedding_model`
- `embedding_version`

目的：

- 支持分批重建索引
- 支持灰度切换 embedding
- 支持线上回滚

---

## 5. `user_memory_fragments` 设计

## 5.1 业务定位

用于承载：

- 用户记忆碎片召回
- 探索前记忆依据检索
- 记忆修复后的重新检索

## 5.2 point id 设计

推荐 point id 直接使用：

```text
memory_fragment_id
```

原因：

- 便于与 PostgreSQL 主表一一对应
- 回表 enrich 最自然
- 删除、重建、补偿方便

## 5.3 payload 设计

推荐字段：

| 字段 | 类型 | 是否必需 | 说明 |
| --- | --- | --- | --- |
| `tenant_id` | keyword | 是 | 租户隔离 |
| `app_id` | keyword | 是 | 应用隔离 |
| `user_id` | keyword | 是 | 用户隔离 |
| `memory_fragment_id` | keyword | 是 | 主键回表 |
| `fragment_type` | keyword | 是 | `FACT` / `EVENT` / `RELATION` / `EMOTION` |
| `visibility` | keyword | 是 | 可见性 |
| `deleted` | bool | 是 | 软删除同步 |
| `searchable` | bool | 是 | 是否参与检索 |
| `time_bucket` | keyword | 否 | 时间桶，例如 `childhood`、`adolescence` |
| `timeline_root` | keyword | 是 | `EARLY` / `CHILDHOOD` / `STUDENT` / `WORK` / `TODAY` |
| `topic_tags` | keyword[] | 否 | 主题标签 |
| `emotion_tags` | keyword[] | 否 | 情绪标签 |
| `embedding_model` | keyword | 是 | embedding 模型 |
| `embedding_version` | int | 是 | embedding 版本 |
| `created_at` | integer | 是 | 时间戳 |
| `updated_at` | integer | 是 | 时间戳 |

### 不建议放入 payload 的字段

- `content_text` 完整正文
- 大型结构化 JSON
- 审计状态长对象
- 关系网络全量数据

正文应继续放在 PostgreSQL 的 `memory_fragment.content_text` 中。

说明：

- `timeline_root` 用于兼容旧 `star-map` 五根节点展示
- 旧可视化能力保留，但数据来源改为 PG 主表 + Qdrant 检索投影

## 5.4 典型过滤条件

### 用户私域探索召回

```json
{
  "must": [
    { "key": "tenant_id", "match": { "value": "t_001" } },
    { "key": "app_id", "match": { "value": "phyok" } },
    { "key": "user_id", "match": { "value": "u_001" } },
    { "key": "deleted", "match": { "value": false } },
    { "key": "searchable", "match": { "value": true } }
  ]
}
```

### 按主题缩小召回

额外加：

```json
{ "key": "topic_tags", "match": { "any": ["原生家庭", "亲密关系"] } }
```

## 5.5 检索用途

- 探索困扰根因
- 探索潜意识与原生家庭
- 探索特定流派分析前的相关记忆召回

## 5.6 记忆碎片分片策略

记忆域分片不采用“固定字符数硬切”。

主方案：

- 由 `LLM API` 执行自然语义分片
- 服务端再做 schema 校验、token 边界校验、chunk 数量校验

推荐流程：

1. 先清洗文本：去多余空白、统一标点、保留自然段
2. 调用 `LLM API` 输出结构化 chunk 列表
3. 服务端校验 chunk 长度、顺序、边界与字段完整性
4. 对超长 chunk 做 token 边界修正与 overlap 校正
5. 为每个 chunk 生成 `timeline_root`、`topic_tags`、`emotion_tags`
6. 合格 chunk 入 PG，再进入 embedding 阶段

推荐参数：

- 记忆碎片：`220~420 tokens`
- overlap：`40~80 tokens`
- 单个用户输入通常不超过 `6` 个有效碎片

实现建议：

- 继承旧 `phyok-node` 已有的 `splitSemantically()` 思想
- 但升级为“`LLM API 语义边界 + token 校验 + overlap 修正`”正式方案
- 文档与用户一段长叙述走同一套分片框架，不再分裂成两套弱规则
- embedding 模型与分片模型分离：`LLM API` 负责切分，`bge-m3` 负责向量化

---

## 6. `knowledge_chunks` 设计

## 6.1 业务定位

用于承载：

- 文档知识库切片召回
- 私有文档问答
- 资料检索增强

## 6.2 point id 设计

推荐：

```text
knowledge_chunk_id
```

## 6.3 payload 设计

推荐字段：

| 字段 | 类型 | 是否必需 | 说明 |
| --- | --- | --- | --- |
| `tenant_id` | keyword | 是 | 租户隔离 |
| `app_id` | keyword | 是 | 应用隔离 |
| `knowledge_document_id` | keyword | 是 | 文档回表 |
| `knowledge_chunk_id` | keyword | 是 | chunk 回表 |
| `owner_user_id` | keyword | 否 | 私有文档归属人 |
| `knowledge_scope` | keyword | 是 | `USER_PRIVATE` / `APP_SHARED` / `TENANT_SHARED` |
| `doc_type` | keyword | 否 | 文件类型 |
| `visibility` | keyword | 是 | 可见性 |
| `deleted` | bool | 是 | 软删除 |
| `embedding_model` | keyword | 是 | embedding 模型 |
| `embedding_version` | int | 是 | embedding 版本 |
| `created_at` | integer | 是 | 时间戳 |

## 6.4 典型过滤条件

### 用户私有文档检索

```json
{
  "must": [
    { "key": "tenant_id", "match": { "value": "t_001" } },
    { "key": "app_id", "match": { "value": "phyok" } },
    { "key": "knowledge_scope", "match": { "value": "USER_PRIVATE" } },
    { "key": "owner_user_id", "match": { "value": "u_001" } },
    { "key": "deleted", "match": { "value": false } }
  ]
}
```

### 应用共享知识检索

```json
{
  "must": [
    { "key": "tenant_id", "match": { "value": "t_001" } },
    { "key": "app_id", "match": { "value": "phyok" } },
    { "key": "knowledge_scope", "match": { "value": "APP_SHARED" } },
    { "key": "deleted", "match": { "value": false } }
  ]
}
```

---

## 7. 检索模式

## 7.1 标准模式

标准检索采用：

1. 应用层生成 query dense + sparse 表征
2. 发送到 Qdrant 做 hybrid recall
3. Qdrant 返回 `id + score + payload`
4. 应用层批量回表 PostgreSQL
5. reranker 二次排序
6. 合并成最终上下文

## 7.2 记忆检索模式

输入：

- 用户探索问题
- 用户上下文标签

输出：

- 相关记忆碎片 ID 列表
- 相似分数
- 最少必要 payload

推荐流程：

1. `bge-m3` dense recall 取前 `80`
2. sparse recall 取前 `80`
3. Qdrant 融合后保留前 `30`
4. PG 回表 enrich
5. reranker 精排为前 `8~12`

## 7.3 知识检索模式

输入：

- 用户问题
- 文档作用域

输出：

- chunk ID 列表
- 文档 ID
- 相似分数

## 7.4 混合检索模式

当一个问题需要：

- 记忆碎片
- 文档 chunk

则不建议在同一 collection 混检，而应：

1. 分别检索两个 collection
2. 应用层做融合排序
3. 再交给 orchestrator 组装 prompt

---

## 8. Payload 索引建议

Qdrant payload 索引只给高频过滤字段建立，不要全量索引所有字段。

## 8.1 `user_memory_fragments` 推荐索引字段

- `tenant_id`
- `app_id`
- `user_id`
- `deleted`
- `searchable`
- `fragment_type`
- `visibility`
- `time_bucket`
- `timeline_root`

## 8.2 `knowledge_chunks` 推荐索引字段

- `tenant_id`
- `app_id`
- `owner_user_id`
- `knowledge_scope`
- `knowledge_document_id`
- `deleted`
- `visibility`

---

## 9. PostgreSQL 与 Qdrant 的一致性

## 9.1 主从关系

- PostgreSQL：主真相
- Qdrant：检索投影

## 9.2 同步策略

采用：

```text
PG 主事务 -> outbox_event -> Kafka -> Qdrant consumer -> Qdrant upsert/delete
```

## 9.3 新增流程

1. 用户新增记忆碎片
2. 写入 `memory_fragment`
3. 事务内写入 `outbox_event`
4. 发布 `memory.embedding.requested`
5. embedding 完成
6. 发布 `memory.embedding.completed`
7. consumer 写入 Qdrant

## 9.4 更新流程

如果以下字段发生变化，需要重写向量点：

- `content_text`
- `deleted`
- `searchable`
- `visibility`
- `topic_tags`
- `emotion_tags`
- `time_bucket`

## 9.5 删除流程

物理策略上建议：

- PG 软删除
- Qdrant 可直接删除 point，或者更新 `deleted=true`

推荐：

- 在线快速一致：先更新 `deleted=true`
- 离线清理任务再做物理删除

这样可降低误删回滚成本。

---

## 10. 检索返回策略

Qdrant 返回尽量精简：

- `id`
- `score`
- 最小必要 payload

不要把检索结果直接当最终返回体给前端。

## 10.1 推荐 enrich 模式

### 记忆检索

Qdrant 返回：

- `memory_fragment_id`
- `score`

PG 回表获取：

- `content_text`
- `content_structured`
- `emotion_tags`
- `topic_tags`

### 文档检索

Qdrant 返回：

- `knowledge_chunk_id`
- `knowledge_document_id`
- `score`

PG 回表获取：

- `chunk_text`
- `doc_name`
- `metadata_json`

---

## 11. Collection 参数建议

以下为原则性建议，最终以压测结果为准。

## 11.1 memory collection

适合：

- 检索频率高
- 更新频率中等
- payload 过滤频繁

建议：

- 使用 cosine distance
- 关闭无必要的大 payload
- 高优先保证过滤召回性能
- 优先使用 named vectors 方案：`dense_vector` + `sparse_vector`

## 11.2 knowledge collection

适合：

- 文档索引写入多为批量
- 读多写少

建议：

- 可接受更高吞吐导入
- 索引建立偏重检索稳定性

## 11.3 Qdrant 节点设计

P0 推荐：

- 单节点 Docker 部署
- 数据目录独立挂载
- 仅内网访问

P1/P2 推荐：

- 独立状态ful部署
- 查询与导入限流分离
- 定期 snapshot 备份

在你当前“轻量应用服务器 + 资源紧张”的前提下，不建议一开始就追求 Qdrant 多节点集群，先保证：

- payload 轻
- 检索链路稳定
- snapshot 可恢复
- 单机磁盘增长可控

---

## 12. 版本迁移策略

## 12.1 embedding 模型升级

不建议在原点上直接混用多版本 embedding。

推荐两种方案：

### 方案 A：原 collection 全量重建

适合：

- 数据规模可控
- 升级窗口明确

### 方案 B：双版本并存 + 切流

适合：

- 数据量大
- 需要灰度切换

做法：

- 新旧 embedding_version 并存
- 查询端按配置路由到新版本
- 验证通过后删除旧版本

---

## 13. 多租户安全策略

## 13.1 网络级

- Qdrant 不直接暴露公网
- 仅允许内网或服务网格访问

## 13.2 应用级

- 每次检索都由服务端强制补齐过滤条件
- 严禁前端直传原始 filter JSON 到 Qdrant

## 13.3 数据级

- `tenant_id`、`app_id` 过滤不可缺省
- 用户私域记忆必须叠加 `user_id`

---

## 14. 性能建议

## 14.1 控制 payload 大小

payload 要尽量轻：

- 只保留过滤字段
- 保留回表键
- 不复制大正文

## 14.2 批量 upsert

- embedding 完成后批量写入
- 避免单条 point 高频逐条写入

## 14.3 查询限流

在 `memory-service` 和 `knowledge-service` 层做：

- `topK` 上限
- `minScore` 下限
- 用户级 QPS 限流

## 14.4 热点缓存

对高频 query 可缓存：

- embedding 结果
- 检索结果 ID 列表

但缓存必须绑定：

- `tenant_id`
- `app_id`
- `user_id/knowledge_scope`

---

## 15. 监控指标

Qdrant 侧需要重点观测：

- collection point 数量
- 检索 p50/p95/p99
- filter 命中延迟
- upsert 速率
- delete 速率
- segment 数量
- 内存占用
- 磁盘增长速度
- 查询失败率

应用侧要补：

- Qdrant 检索后回表耗时
- enrich 后总耗时
- 召回数量
- 有效命中数量

---

## 16. 推荐查询契约

## 16.1 记忆检索统一请求

```json
{
  "tenantId": "t_001",
  "appId": "phyok",
  "userId": "u_001",
  "query": "我为什么总会在亲密关系里害怕被抛弃",
  "topK": 12,
  "minScore": 0.68,
  "filters": {
    "topicTags": ["亲密关系", "原生家庭"]
  }
}
```

## 16.2 记忆检索统一响应

```json
{
  "hits": [
    {
      "memoryFragmentId": "mf_001",
      "score": 0.92
    }
  ]
}
```

## 16.3 文档检索统一响应

```json
{
  "hits": [
    {
      "knowledgeChunkId": "kc_001",
      "knowledgeDocumentId": "kd_001",
      "score": 0.88
    }
  ]
}
```

---

## 17. 最终推荐

### 17.1 collection 结论

P0 阶段固定两套 collection：

- `user_memory_fragments`
- `knowledge_chunks`

### 17.2 payload 结论

坚持：

- 轻 payload
- 强过滤键
- 大文本回 PG

### 17.3 架构结论

Qdrant 的正确定位是：

- 召回引擎
- 过滤检索层
- 高性能检索投影

而不是第二个业务主数据库。

### 17.4 下一步

建议下一步补：

1. Qdrant collection 初始化脚本
2. payload index 创建脚本
3. PG -> Kafka -> Qdrant consumer 设计
4. 检索压测基准方案
