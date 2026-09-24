# 《心理学空间·自我探索Agent Pro》DSL 项目说明

## 1. 目标

这个目录不再把“一份 Dify YAML”同时当成：

- 业务真相源
- Dify 导入文件
- Spring AI 导出源

而是拆成 3 层：

1. `canonical`
2. `adapters`
3. `exports`

这样做的目的只有一个：

- **保证 DSL 语义准确，不被单一运行时格式绑架**

## 2. 目录结构

### 2.1 `canonical/`

这里放“唯一业务真相源”。

特点：

- 不为某个特定平台让步
- 保留业务语义、规则、角色、检索策略、双库分流、专家轨道
- 后续无论导出 Dify、Spring AI 还是自研 Runtime，都以这里为准

当前文件：

- `canonical/self_explore_agent_pro.canonical.yml`

### 2.2 `adapters/dify/`

这里放 Dify 适配层。

特点：

- 只关心 Dify 的 DSL schema
- 只负责把 canonical 语义映射成 Dify 能接受的节点、边、变量和字段
- 不负责定义业务真相

当前文件：

- `adapters/dify/self_explore_agent_pro.dify.adapter.yml`
- `adapters/dify/self_explore_agent_pro.dify.importable.full.yml`

说明：

- 这是 Dify 适配规范稿
- 它不是最终业务真相源
- `self_explore_agent_pro.dify.importable.full.yml` 是第一版“可导入展示版”候选文件
- 它用于在 Dify 中查看完整编排，不等于 canonical 真相源

### 2.3 `exports/spring-ai/`

这里放 Spring AI 目标结构说明。

特点：

- 不要求照搬 Dify 节点
- 直接面向 Java Runtime、Advisor、Tool、Expert Prompt
- 未来真正给 Spring AI 用的导出物应该从 canonical 生成

当前文件：

- `exports/spring-ai/self_explore_agent_pro.spring-ai.target.yml`

## 3. 三层职责边界

### 3.1 Canonical 层负责什么

- 产品语义
- 领域规则
- 意图体系
- 双库策略
- 角色边界
- 检索与证据拼装
- 安全与收口

### 3.2 Dify Adapter 层负责什么

- 变量类型适配
- if-else 节点结构适配
- edge 元数据适配
- structured output schema 适配
- 平台字段兼容

### 3.3 Spring AI Export 层负责什么

- 把 canonical 节点映射成：
  - `Advisor`
  - `Tool`
  - `Expert`
  - `Response Post Processor`
- 输出 Java 侧更稳定的目标结构

## 4. 为什么不能直接用 Dify DSL 当唯一源

因为 Dify DSL 是“平台导入格式”，不是“领域语义建模格式”。

在你的项目里，真正长期需要稳定的是：

- 记忆门槛规则
- 双库隔离规则
- 多模态先知识后记忆的顺序
- 记忆新增 / 修复 / 删除 / 合并语义
- 流派探索与深度探索的专家边界

这些都不应该被 Dify 某一版 schema 反向定义。

## 5. 当前工作方式

当前建议这样协作：

1. 先改 `canonical`
2. 再决定是否同步更新 `dify adapter`
3. 最后再看是否需要更新 `spring-ai target`

顺序不能反过来。

## 6. 与旧文件的关系

原有文件：

- `docs/dify/self_explore_agent_pro.bridge.draft.yml`

仍然保留，定位是：

- Dify 可视化编排蓝图稿

但从现在开始，它不再承担“唯一 DSL 真相源”的职责。

新的唯一语义源应迁移到：

- `docs/agent-dsl/canonical/self_explore_agent_pro.canonical.yml`
