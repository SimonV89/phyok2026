# 《心理学空间·自我探索Agent Pro》Dify DSL 导入映射设计

## 1. 文档目标

本文定义如何把 `Dify DSL` 导入到新 Java 后端体系中，并支持两种运行模式：

- `Bridge Mode`：继续由 Dify 执行
- `Native Runtime Mode`：导入后由 Java 原生工作流运行时执行

本文重点解决：

- DSL 文件如何进入系统
- Dify 概念如何映射为内部工作流模型
- 哪些节点可原生执行，哪些节点必须桥接
- 如何做版本管理、兼容性校验与回滚

---

## 2. 设计结论

### 2.1 总体路线

**短期采用 `Bridge Mode`，中长期演进为 `Native Runtime Mode`。**

### 2.2 为什么不是直接把 Dify 当最终运行时

因为正式生产系统还需要统一：

- 审计
- 计费
- 上下文构建
- RAG 隔离
- 风控
- 微服务治理

如果长期强依赖 Dify 运行时，会出现：

- 核心链路分散在两个控制平面
- 审计与计费不统一
- 复杂节点兼容受限
- 运行时能力被 Dify 节点体系约束

因此正确做法是：

- **把 Dify 当作工作流来源**
- **把 Java Runtime 当作正式生产执行器**

---

## 3. Dify DSL 基础理解

基于 Dify 的公开文档，Dify 应用可以导出为 YAML 格式 DSL，用于：

- 跨环境迁移
- 应用复制
- 版本管理

因此本系统将 Dify DSL 视为一种“外部工作流定义格式”。

---

## 4. 两种运行模式

## 4.1 Bridge Mode

### 定义

- DSL 导入系统后，仅保存元数据与版本信息
- 真正执行时由 Java 系统调用 Dify 已发布 API

### 适用场景

- 复用已有 Dify 应用
- 快速验证流程
- 迁移初期

### 执行链路

```text
客户端 -> Gateway -> Orchestrator -> Workflow Runtime
-> Dify Bridge Adapter -> Dify API
-> 返回结果 -> Billing/Audit/Context 统一入本地系统
```

### 优点

- 上线快
- 风险低
- 可先承接既有 Dify 成果

### 缺点

- 运行时仍受 Dify 限制
- Debug 和治理跨系统
- 节点能力难深度定制

## 4.2 Native Runtime Mode

### 定义

- DSL 导入后编译成内部工作流定义
- 执行完全由 `workflow-runtime-service` 负责

### 适用场景

- 正式生产
- 统一治理
- 统一计费审计
- 需要深度定制节点能力

### 执行链路

```text
客户端 -> Gateway -> Orchestrator -> Workflow Runtime
-> Internal Nodes / Model Gateway / Memory / Knowledge / Tools
-> 返回结果
```

### 优点

- 执行完全可控
- 审计与计费天然统一
- 节点能力可按领域不断扩展

### 缺点

- 需要实现节点映射和兼容层
- 初期建设成本更高

---

## 5. 导入流程设计

## 5.1 标准导入流程

```text
上传 DSL YAML
-> 语法校验
-> DSL Schema 校验
-> 元数据抽取
-> 节点兼容性分析
-> 生成 compatibility report
-> 保存 workflow_definition / workflow_version
-> 选择 Bridge 或 Native 发布方式
```

## 5.2 导入入口

建议由 `workflow-runtime-service` 提供内部/管理接口：

### `POST /internal/workflow/import-dify-dsl`

请求体：

```json
{
  "tenantId": "t_001",
  "appId": "phyok",
  "workflowCode": "self_explore_flow",
  "sourceType": "DIFY_DSL",
  "executionMode": "BRIDGE",
  "dslContent": "app:\\n  mode: chatflow\\n..."
}
```

返回：

```json
{
  "workflowDefinitionId": "wf_001",
  "workflowVersionId": "wfv_001",
  "compatibilityReport": {
    "compatible": true,
    "warnings": [],
    "unsupportedNodes": []
  }
}
```

---

## 6. 内部工作流模型

## 6.1 核心表映射

导入后的核心落点：

- `workflow_definition`
- `workflow_version`
- `workflow_run_record`

## 6.2 `workflow_definition`

表示：

- 一个稳定的工作流身份

建议核心字段：

- `workflow_code`
- `workflow_name`
- `source_type`
- `source_ref`
- `current_version_no`
- `status`

## 6.3 `workflow_version`

表示：

- 某次导入后的具体版本

建议核心字段：

- `version_no`
- `dsl_source`
- `compiled_definition_json`
- `compatibility_report_json`
- `execution_mode`
- `published`

## 6.4 `compiled_definition_json`

这是 Java Runtime 真正执行的中间表示 IR。

建议结构：

```json
{
  "workflowCode": "self_explore_flow",
  "workflowType": "CHATFLOW",
  "entry": "start_1",
  "nodes": [],
  "edges": [],
  "variables": [],
  "runtimePolicies": {
    "memoryEnabled": true,
    "billingEnabled": true,
    "auditEnabled": true
  }
}
```

---

## 7. 概念映射

## 7.1 应用类型映射

| Dify 概念 | 内部概念 | 说明 |
| --- | --- | --- |
| `Workflow` | `WORKFLOW` | 单次执行工作流 |
| `Chatflow` | `CHATFLOW` | 多轮对话工作流 |
| `Agent` | `CHATFLOW + Agent Policy` | 统一映射为 Chatflow 派生形态 |
| `App` | `workflow_definition` | 工作流定义载体 |

## 7.2 变量映射

| Dify 变量 | 内部映射 | 说明 |
| --- | --- | --- |
| `sys.user_id` | `runtime.userId` | 用户 ID |
| `sys.app_id` | `runtime.appId` | 应用 ID |
| `sys.conversation_id` | `runtime.conversationId` | 会话 ID |
| `sys.workflow_run_id` | `runtime.workflowRunId` | 运行 ID |
| 会话变量 | `runtime.conversationVars` | 会话级变量 |
| 节点输出变量 | `runtime.nodeOutputs` | 节点输出 |

## 7.3 图结构映射

| Dify 元素 | 内部映射 |
| --- | --- |
| `graph.nodes` | `workflow_node` 逻辑对象 |
| `graph.edges` | `workflow_edge` 逻辑对象 |
| start node | `ENTRY` |
| LLM node | `MODEL_CALL` |
| Code node | `SCRIPT` |
| HTTP node | `HTTP_CALL` |
| Knowledge node | `RAG_RETRIEVE` |
| If/Else | `CONDITION_BRANCH` |

---

## 8. 节点映射矩阵

## 8.1 可原生映射节点

这类节点可直接进入 `Native Runtime Mode`：

| Dify 节点 | 内部节点 | P0 支持级别 | 说明 |
| --- | --- | --- | --- |
| `start` | `ENTRY` | 支持 | 工作流入口 |
| `llm` | `MODEL_CALL` | 支持 | 调用 `model-gateway-service` |
| `if-else` | `CONDITION_BRANCH` | 支持 | 条件分支 |
| `http-request` | `HTTP_CALL` | 支持 | 外部或内部 HTTP 调用 |
| `knowledge-retrieval` | `RAG_RETRIEVE` | 支持 | 映射到 `knowledge-service` |
| `template-transform` | `TEMPLATE_RENDER` | 支持 | 变量替换与模板拼接 |
| `variable-assign` | `SET_VARIABLE` | 支持 | 变量赋值 |
| `answer` | `OUTPUT` | 支持 | 最终输出 |

## 8.2 需桥接节点

这类节点 P0 先支持 `Bridge Mode`：

| Dify 节点 | 原因 | 处理策略 |
| --- | --- | --- |
| 插件专属节点 | 强依赖 Dify 插件运行时 | 标记 `BRIDGE_ONLY` |
| Dify 专有 Agent Node | 内部行为复杂 | 先调用 Dify API |
| 复杂多模态专有节点 | 平台耦合高 | 先桥接 |
| Dify Code Sandbox 特性 | Java 侧未实现等价沙箱 | 先桥接 |

## 8.3 不支持节点

P0 导入时遇到以下类型，应拒绝发布为 Native：

- 依赖未知第三方插件
- 依赖 Dify 内部私有能力
- 缺少必要 schema 的自定义节点

---

## 9. Internal Runtime IR 设计

## 9.1 节点通用结构

```json
{
  "id": "node_001",
  "type": "MODEL_CALL",
  "name": "intent-classifier",
  "config": {},
  "inputs": [],
  "outputs": [],
  "retryPolicy": {
    "maxAttempts": 2
  },
  "timeoutMs": 15000
}
```

## 9.2 边通用结构

```json
{
  "from": "node_001",
  "to": "node_002",
  "condition": {
    "type": "EXPR",
    "expr": "vars.intent == 'EXPLORE'"
  }
}
```

## 9.3 Runtime Context 结构

```json
{
  "runtime": {
    "tenantId": "t_001",
    "appId": "phyok",
    "userId": "u_001",
    "conversationId": "conv_001",
    "workflowRunId": "run_001"
  },
  "input": {},
  "conversationVars": {},
  "nodeOutputs": {},
  "systemPolicies": {}
}
```

---

## 10. 导入兼容性校验

## 10.1 校验阶段

### 第一层：语法校验

- YAML 是否可解析
- 基本字段是否存在

### 第二层：DSL Schema 校验

- `app.mode`
- `graph.nodes`
- `graph.edges`

### 第三层：节点兼容性校验

- 每个节点是否可映射
- 节点配置是否完整
- 是否包含桥接节点

### 第四层：运行时策略校验

- 是否要求 memory
- 是否要求流式输出
- 是否包含知识检索
- 是否需要外部 secrets

## 10.2 compatibility report 结构

```json
{
  "compatible": false,
  "recommendedMode": "BRIDGE",
  "warnings": [
    "Node plugin_xxx currently bridge only"
  ],
  "unsupportedNodes": [
    {
      "nodeId": "node_8",
      "nodeType": "plugin_xxx",
      "reason": "No internal runtime adapter"
    }
  ]
}
```

---

## 11. Bridge Mode 设计细节

## 11.1 适配器职责

新增 `dify-bridge-adapter` 模块，负责：

- 调用 Dify 已发布应用 API
- 组装 Dify 所需 input variables
- 将 Dify 输出映射为内部标准响应
- 将 token/trace/billing/audit 统一回灌本地系统

## 11.2 Bridge Mode 运行时字段

在 `workflow_version` 中保留：

- `bridge_endpoint`
- `bridge_app_id`
- `bridge_api_key_ref`
- `bridge_timeout_ms`

## 11.3 Bridge Mode 的局限

- 无法完全统一节点级 tracing
- 部分 token/中间变量获取受限
- 审计粒度低于 Native

因此只作为过渡模式，不作为终局。

---

## 12. Native Runtime Mode 设计细节

## 12.1 执行器职责

由 `workflow-runtime-service` 执行：

- DAG 解析
- 变量绑定
- 节点调度
- 重试与超时
- 与 `model-gateway-service`、`memory-service`、`knowledge-service` 交互

## 12.2 执行器约束

- 单工作流版本 immutable
- 发布后不可原地修改，只能发新版本
- 每次运行必须记录 `workflow_version_id`

## 12.3 节点执行超时建议

| 节点类型 | 默认超时 |
| --- | --- |
| `MODEL_CALL` | 15s |
| `HTTP_CALL` | 8s |
| `RAG_RETRIEVE` | 3s |
| `SCRIPT` | 3s |
| `CONDITION_BRANCH` | 1s |

---

## 13. 版本管理

## 13.1 版本策略

每次导入 DSL 都生成新版本：

- `workflow_definition` 保持稳定
- `workflow_version` 递增

## 13.2 发布策略

支持：

- 草稿
- 测试
- 生产发布
- 回滚

建议字段：

- `published`
- `release_channel`
- `rollback_from_version`

## 13.3 回滚策略

回滚时不修改老版本内容，只调整：

- `workflow_definition.current_version_no`

---

## 14. 变量与上下文注入

## 14.1 Java 侧统一注入

无论来源是不是 Dify，运行前统一补齐：

- `tenantId`
- `appId`
- `userId`
- `conversationId`
- `workflowRunId`
- `requestId`

## 14.2 安全策略注入

所有 Native Runtime 工作流在执行前统一注入：

- 审计开关
- 计费开关
- 数据隔离策略
- Prompt 安全策略

这一步不依赖 DSL 原文配置。

---

## 15. 与领域规则的结合

本项目并不是“通用 Agent 平台”，而是心理探索场景，所以即使导入 Dify DSL，也必须服从本地领域规则。

## 15.1 本地高优先级规则

- 探索前先做记忆门槛校验
- 记忆不足 5 条时必须转为追问
- 探索前先召回相关记忆碎片
- 探索输出不回写主记忆库

## 15.2 规则插入位置

建议在 `workflow-runtime-service` 编译或执行期强制插入以下节点：

- `MEMORY_GATE_CHECK`
- `MEMORY_RETRIEVE`
- `AUDIT_RECORD`
- `BILLING_RECORD`

这类节点即使 Dify DSL 中未显式配置，也可由平台策略自动注入。

---

## 16. 导入失败处理

导入失败时必须返回结构化错误：

```json
{
  "code": "DIFY_DSL_IMPORT_FAILED",
  "message": "当前 DSL 包含不支持的插件节点",
  "data": {
    "unsupportedNodes": [
      {
        "nodeId": "n_8",
        "nodeType": "plugin_custom_x"
      }
    ]
  }
}
```

并保留失败记录，便于后台查看。

---

## 17. 审计与计费绑定

## 17.1 审计

每次工作流执行都必须记录：

- `workflow_definition_id`
- `workflow_version_id`
- `execution_mode`
- `source_type`

## 17.2 计费

每次工作流执行都必须能关联到：

- 运行时模型调用
- token 使用
- 最终账务流水

即使在 Bridge Mode 下，也必须至少做到：

- workflow_run_record 有本地记录
- token 与账单有本地投影记录

---

## 18. 推荐实施顺序

### Phase 1

- 支持 DSL 文件上传
- 支持元数据保存
- 支持 compatibility report
- 支持 Bridge Mode 执行

### Phase 2

- 支持基础节点 Native Runtime
- 支持 `llm`、`if-else`、`http-request`、`knowledge-retrieval`

### Phase 3

- 支持平台策略节点自动注入
- 支持版本回滚
- 支持节点级 tracing

### Phase 4

- 支持更复杂插件节点适配
- 完整替代 Dify 生产执行

---

## 19. 最终结论

### 19.1 结论一

**Dify DSL 应被当作“外部工作流描述格式”，而不是最终生产运行时。**

### 19.2 结论二

**Bridge Mode 是迁移手段，Native Runtime Mode 才是正式目标。**

### 19.3 结论三

本项目在导入 DSL 后，仍必须服从本地平台规则：

- 记忆门槛
- 数据隔离
- 审计记录
- 计费记录

### 19.4 下一步

建议下一步继续补：

1. Internal Runtime IR JSON Schema
2. 节点执行器 SPI 设计
3. Dify Bridge Adapter 接口契约
4. DSL 导入压测与回滚方案
