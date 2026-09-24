# RAG 设计

> 本目录收录记忆系统 RAG（检索增强生成）的核心架构文档，包括语义分片、向量库设计、PG 表结构。

## 阅读顺序

**推荐按以下顺序阅读：**

1. [记忆语义分片架构](记忆语义分片架构.md) — LLM 结构化分片链路：标准化文本 → semantic-chunk → LLM 分片 → schema 校验 → PG+Qdrant
2. [Qdrant集合与Payload设计](Qdrant集合与Payload设计.md) — collection 划分、point 主键、payload 规范、dense/sparse 向量检索策略
3. [Qdrant初始化脚本](Qdrant初始化脚本.md) — user_memory_fragments 和 knowledge_chunks 两个 collection 的初始化脚本
4. [PostgreSQL表结构设计](PostgreSQL表结构设计.md) — 高并发会话、记忆碎片主数据、知识库、计费账务、审计回放、Outbox 最终一致性
5. [PostgreSQL_DDL初版](PostgreSQL_DDL初版.md) — Flyway/Liquibase 可直接使用的 DDL 初版脚本

## 核心检索链路

```
Qdrant Search (召回) → PG Enrich (补充详情) → 返回给 Agent
```

## 召回阈值

- RAG 召回 minScore 设定为较低值（如 0.16），确保弱语义关联（如"羊"与"三只羊"）能被命中

## 相关文档

- [Node_BFF_LangGraph架构](../1.服务端架构/Node_BFF_LangGraph架构.md) — RAG 召回在 Agent Runtime 中的调用方式
- [Java_SpringCloud业务域架构](../1.服务端架构/Java_SpringCloud业务域架构.md) — memory-service 承担的写入与主数据职责
