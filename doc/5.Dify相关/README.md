# Dify 相关

> 本目录收录 Dify 安装、DSL 导入及与 Spring AI / LangGraph 映射的相关文档。

## 核心文档

1. [Dify本地安装记录](Dify本地安装记录.md) — dify-local 安装到项目根目录，docker / docker compose / git / jq 环境检查
2. [Dify_DSL导入指南](Dify_DSL导入指南.md) — 最小可运行版 DSL 导入步骤，验证 Dify 环境可用
3. [Dify_DSL导入映射设计](Dify_DSL导入映射设计.md) — DSL 导入 Java 后端体系，支持 Bridge Mode 和 Native Runtime Mode 两种运行模式
4. [Dify到Spring_AI的映射](Dify到Spring_AI的映射.md) — Dify 节点分四类（Advisor / Tool / Domain Expert LLM / Output Post-Process）映射到 Spring AI

## 设计背景

- [Agent_DSL设计说明](../2.Agent设计/Agent_DSL设计说明.md) — canonical/adapters/exports 三层结构，保证 DSL 语义准确不被单一运行时格式绑架
- [Agent_Java架构方案](../2.Agent设计/Agent_Java架构方案.md) — Java 主控方案中的 Dify 导入策略

## 技术说明

- 本项目最终采用 **Node LangGraph** 作为 Agent Runtime，Dify 主要用于 **Agent 编排的设计与讨论**，DSL 可导出给 LangGraph 使用
- Spring AI DSL 映射仅作为历史参考方案
