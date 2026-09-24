# Agent 设计

> 本目录收录 Agent 编排与角色定义相关文档，包括 Prompt 库、DSL 设计、Agent 与 Java 的协作架构。

## 核心设计

1. [自我探索Agent_Pro设计草案](自我探索Agent_Pro设计草案.md) — 单聊天框、多模态输入、强领域规则的设计方案
2. [Agent_Prompt库](Agent_Prompt库.md) — 角色职责定义、input-normalizer、intent-router、memory-curator、repair-editor 等角色模板
3. [Agent_DSL设计说明](Agent_DSL设计说明.md) — canonical/adapters/exports 三层结构，保证 DSL 语义准确
4. [Agent_Java架构方案](Agent_Java架构方案.md) — 历史参考稿：Java 主控方案、PostgreSQL+Qdrant 选型、上下文管理

## 实施路线

- [Node_v2实施计划](../1.服务端架构/Node_v2实施计划.md) — 从存量 Node 后端改造为 node-capability-service 的最小改造方案

## 技术背景

- [Node_Java双后端架构总览](../1.服务端架构/Node_Java双后端架构总览.md) — Agent 编排与 Node BFF、Java 领域服务的整体关系
