# AI 与 RAG

> 涉及大模型调用、RAG 召回、意图识别时必须遵守的规范。

## RAG 召回链路（核心）

必须严格遵循以下二段式召回链路：

```
Qdrant Search (召回) → PostgreSQL Enrich (补充详情) → 返回给 Agent
```

- 严禁跳过 PG Enrich 直接返回 Qdrant 结果
- `MemoryQueryService` 回退召回算法需结合**最长共同片段**增强弱线索匹配

## 召回阈值

- RAG 召回 `minScore` 设定为**较低值（0.16）**
- 目的：确保弱语义关联能被命中，例如"羊"与"三只羊"
- 宁低勿高，避免漏召回

## 记忆投影链路

必须采用以下异步架构：

```
PostgreSQL Outbox → Kafka relay → embedding consumer → Qdrant
```

- 使用 Outbox 模式配合 Kafka 实现数据变更与向量数据库投影的解耦
- 确保写入链路的高可用与强一致

## 意图识别分类

涉及以下关键词的输入应归类为 `memory_create` 意图，触发记忆写入与相关背景召回：

- "梦到"
- "想起"
- "回想起"
- "记得"

## 记忆分片与清洗

- **严禁将前端占位模板文案落入记忆正文**
- 必须收紧 Java 侧分片长度阈值：`48 / 180 / 90`
- Fallback 分片中引入多维语义识别词
- 归一化阶段彻底剔除提示词前缀

## 模型配置

| 能力 | 模型 | 来源 |
|------|------|------|
| 文本生成 | DeepSeek-V4-Pro | 硅基流动 |
| 向量嵌入 | BAAI/bge-m3 | 硅基流动 |
| 视觉理解 | Qwen/Qwen3-VL-8B-Instruct | 硅基流动 |
| ASR 语音识别 | Qwen/Qwen3-ASR-1.7B | 硅基流动 |

## 相关文档

- [doc/3.RAG设计/](../doc/3.RAG设计/) — 完整 RAG 设计文档
