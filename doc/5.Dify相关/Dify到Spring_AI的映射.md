# 《心理学空间·自我探索Agent Pro》Dify 编排到 Spring AI 的映射说明

## 1. 文档目的

这份文档不讨论具体后端代码实现，而是回答一个更关键的问题：

- 你现在在 Dify 里看到的“全面编排画布”
- 将来如何平滑迁移成 `Java + Spring AI` 的原生执行链

核心原则：

- Dify 先承担“编排白板”和“Prompt 试验台”
- Spring AI 最终承担“生产执行器”

## 2. 一句话结论

对于《心理学空间·自我探索Agent Pro》这类强规则、强 RAG 隔离、强审计要求的系统：

- `Dify 节点` 更适合拿来定义“顺序、分支、职责”
- `Spring AI` 更适合拿来定义“Advisor 链、Tool 调用、上下文构建、服务调用与审计”

所以最自然的迁移方式不是“照搬 Dify 节点类型”，而是：

- 把 Dify 节点分成：
  - `Advisor 型节点`
  - `Tool / Service 型节点`
  - `Domain Expert LLM 型节点`
  - `Output Post-Process 型节点`

## 3. 编排分层映射

### 3.1 路由层

| Dify 节点 | Spring AI 目标形态 | 说明 |
| --- | --- | --- |
| `llm_input_normalizer` | `InputNormalizerAdvisor` | 统一文本和附件语义 |
| `llm_intent_router` | `IntentRouterAdvisor` | 产出意图、轨道、门槛规则 |
| `llm_retrieval_planner` | `RetrievalPlanningAdvisor` | 决定本轮要不要调记忆库/知识库 |

说明：

- 这一层最适合落成 `Advisor` 链
- 原因是它们都不直接对用户发最终答案，而是在构建“本轮执行上下文”

### 3.2 多模态预处理层

| Dify 节点 | Spring AI 目标形态 | 说明 |
| --- | --- | --- |
| `http_multimodal_parse` | `MediaParseTool` 或 `media-service client` | OCR / ASR / 文档抽取 |
| `http_knowledge_ingest` | `KnowledgeIngestTool` | 先把解析结果入 `knowledge_base` |
| `llm_memory_judge_from_attachments` | `AttachmentMemoryJudgeAdvisor` | 判断哪些材料应沉淀为记忆 |
| `http_memory_write_from_attachments` | `MemoryUpsertTool` | 对 memory-service 发起变更 |

说明：

- 这里不是单纯“LLM 调工具”
- 而是“先解析，再知识入库，再记忆判定，再记忆写入”的固定顺序
- 这类固定顺序建议在 Java 中由 `agent-orchestrator-service` 显式编排

### 3.3 记忆类编排层

| Dify 节点 | Spring AI 目标形态 | 说明 |
| --- | --- | --- |
| `llm_memory_curator` | `MemoryCuratorExpert` | 拆分记忆碎片 |
| `llm_memory_write_planner` | `MemoryMutationPlannerAdvisor` | 生成 create plan |
| `http_memory_create_plan` | `MemoryUpsertTool` | 调 memory-service |
| `http_memory_retrieve_for_repair` | `MemoryRetrieveTool` | 修复前先召回候选 |
| `llm_memory_repair_editor` | `MemoryRepairExpert` | 理解用户要怎么改 |
| `llm_memory_repair_mutation_planner` | `MemoryMutationPlannerAdvisor` | 生成 update / merge / delete plan |
| `llm_memory_repair_confirm` | `MemoryRepairConfirmExpert` | 发起高影响确认 |

说明：

- 记忆新增与记忆修复都应变成“LLM 规划 + Tool 执行”
- 不建议让 Spring AI 里的单个大模型一步直接完成“理解 + 写库”

### 3.4 检索与证据拼装层

| Dify 节点 | Spring AI 目标形态 | 说明 |
| --- | --- | --- |
| `http_memory_gate` | `MemoryGateTool` | 深度探索前校验 `>= 5` |
| `http_memory_retrieve_optional` | `MemoryRetrieveTool` | 流派探索可选证据 |
| `http_memory_retrieve_required` | `MemoryRetrieveTool` | 深度探索必需证据 |
| `http_knowledge_retrieve` | `KnowledgeRetrieveTool` | 附件或知识材料补充证据 |
| `llm_psychology_evidence_composer` | `EvidenceComposerAdvisor` | 流派探索证据包 |
| `llm_deep_evidence_composer` | `EvidenceComposerAdvisor` | 深度探索证据包 |

说明：

- `EvidenceComposer` 是非常值得保留的一层
- 这样能把“检索结果长什么样”和“专家节点吃什么格式”解耦
- 未来无论你换 Qdrant、换 rerank、换 retrieval schema，专家 prompt 都更稳定

### 3.5 领域专家层

| Dify 节点 | Spring AI 目标形态 | 说明 |
| --- | --- | --- |
| `llm_psychology_school_explorer` | `PsychologySchoolExpert` | 流派讲解 |
| `llm_unconscious_explorer` | `UnconsciousExpert` | 一般潜意识探索 |
| `llm_family_origin_explorer` | `FamilyOriginExpert` | 原生家庭与关系脚本 |
| `llm_root_cause_explorer` | `RootCauseExpert` | 根因链路深挖 |

说明：

- 这一层最像“专家 Agent”，但仍建议保留单一前台人格 Floyd
- 在 Spring AI 里可以做成多个 Prompt 模板 + 不同 advisor 组合

### 3.6 收口层

| Dify 节点 | Spring AI 目标形态 | 说明 |
| --- | --- | --- |
| `llm_risk_guard` | `RiskGuardAdvisor` | 安全收口 |
| `llm_response_polisher_psychology` | `ResponsePolisherAdvisor` | 统一 Floyd 文风 |
| `llm_response_polisher_deep` | `ResponsePolisherAdvisor` | 统一 Floyd 文风 |

说明：

- 这是典型的“后处理 Advisor”
- 生产里非常适合统一挂在最终输出前

## 4. 未来 Java 中的一轮执行顺序

建议一轮请求在 Java 中按以下顺序执行：

```text
Chat Request
-> InputNormalizerAdvisor
-> Optional Media Parse / Knowledge Ingest
-> IntentRouterAdvisor
-> RetrievalPlanningAdvisor
-> Rule Gate
-> Memory / Knowledge Tools
-> EvidenceComposerAdvisor
-> Domain Expert Prompt
-> RiskGuardAdvisor
-> ResponsePolisherAdvisor
-> SSE Output
```

## 5. 建议的 Spring AI 组件切分

### 5.1 Advisors

建议至少保留这些 Advisor：

- `InputNormalizerAdvisor`
- `IntentRouterAdvisor`
- `RetrievalPlanningAdvisor`
- `AttachmentMemoryJudgeAdvisor`
- `EvidenceComposerAdvisor`
- `RiskGuardAdvisor`
- `ResponsePolisherAdvisor`

### 5.2 Tools

建议至少保留这些 Tool / Client：

- `MediaParseTool`
- `KnowledgeIngestTool`
- `KnowledgeRetrieveTool`
- `MemoryGateTool`
- `MemoryRetrieveTool`
- `MemoryUpsertTool`

### 5.3 Experts

建议把专家回答做成独立 Prompt 资产：

- `MemoryCuratorExpert`
- `MemoryRepairExpert`
- `MemoryRepairConfirmExpert`
- `PsychologySchoolExpert`
- `UnconsciousExpert`
- `FamilyOriginExpert`
- `RootCauseExpert`

## 6. 为什么这比“单大 Prompt Agent”更适合你

因为你的系统不是普通聊天机器人，而是：

- 有明确门槛规则
- 有双库隔离
- 有多模态前置
- 有可逆 / 不可逆记忆动作差异
- 有强审计需求

如果做成单大 Prompt：

- prompt 会越来越不可控
- 工程治理会崩
- 未来 Java 落地时边界会非常混乱

如果现在就按 Dify 节点职责拆清：

- 你在 Dify 中看编排更清楚
- 你后续写 Spring AI 时更像“把节点翻译成组件”

## 7. 对你当前最有价值的用法

你现在不急着跑 agent，所以 Dify 的最优用法不是“立即可运行”，而是：

1. 当成编排白板
2. 当成 prompt 结构评审工具
3. 当成 Java Spring AI 迁移前的中间设计层

这也是当前 `docs/dify/self_explore_agent_pro.bridge.draft.yml` 的最佳定位。

## 8. 下一步推荐

建议下一轮继续做两件事：

1. 把 `if-else / http-request / llm` 进一步抽象成“内部节点类型字典”
2. 把每个专家节点的输入 / 输出 schema 固化，方便后续 Java 侧直接建 DTO
