# 《心理学空间·自我探索Agent Pro》Node Monorepo 骨架说明

## 1. 文档目标

本文把 Node 侧从“职责描述”推进到“可直接建仓”的骨架设计。

Node 在当前主方案中承担：

- `api-bff-gateway`
- `agent-runtime-langgraph`
- `node-capability-service`
- `web-ssr`

因此 Node 侧必须采用 Monorepo，而不是把所有逻辑塞进一个服务目录。

---

## 2. 一句话结论

推荐：

- `pnpm workspace`
- `Turborepo`
- `apps + packages`

核心原则：

- App 只负责运行
- Package 只负责复用
- Graph、Tool、Client、Config 必须拆开

---

## 3. 推荐目录

```text
phyok-node-next/
  apps/
    api-bff-gateway/
    agent-runtime-langgraph/
    node-capability-service/
    web-ssr/
  packages/
    config/
    contracts/
    domain-clients/
    graph-core/
    graph-flows/
    model-adapters/
    tool-adapters/
    runtime-events/
    shared/
    logger/
    test-kit/
    eslint-config/
    tsconfig/
  docs/
    architecture/
```

---

## 4. apps 分工

## 4.1 `apps/api-bff-gateway`

职责：

- `/v2/*` 对外入口
- 聚合前端协议
- SSE 外层响应
- 身份透传

不做：

- Graph 业务定义
- 复杂领域规则

## 4.2 `apps/agent-runtime-langgraph`

职责：

- Graph runtime
- LangGraph.js 图执行
- graph state 管理
- tool 调度

不做：

- 直接写 Java 主业务库
- 持有业务主真相

## 4.3 `apps/node-capability-service`

职责：

- 文件解析
- 图片理解
- 语音处理
- 复用旧 `phyok-node` 中摘出的 I/O 逻辑

## 4.4 `apps/web-ssr`

职责：

- Next.js Node Runtime
- App Router SSR
- 前端服务端逻辑

---

## 5. packages 分工

## 5.1 `packages/config`

- env schema
- 配置加载
- 配置分层

要求：

- 所有环境变量统一从这里导出

## 5.2 `packages/contracts`

- Node 内部 DTO
- Node <-> Java DTO
- SSE 事件结构
- Graph tool 入参出参 schema

## 5.3 `packages/domain-clients`

- Java 领域服务调用器
- 按服务拆 client：
  - `auth-client`
  - `memory-client`
  - `knowledge-client`
  - `billing-client`
  - `audit-client`
  - `payment-client`
  - `ops-client`

## 5.4 `packages/graph-core`

- Graph runtime 基础抽象
- graph context
- node executor
- checkpoint 接口

## 5.5 `packages/graph-flows`

- 具体图定义
- 单图单目录

建议：

- `self-explore-graph`
- `memory-ingest-graph`
- `admin-replay-graph`

## 5.6 `packages/model-adapters`

- LLM provider 适配
- embedding 调用适配
- rerank 调用适配

## 5.7 `packages/tool-adapters`

- 对 Java API 的工具适配
- 对 Node capability 的工具适配

要求：

- 一工具一文件
- 不要做巨型 tool registry 文件

## 5.8 `packages/runtime-events`

- SSE event 类型
- Kafka event 发射器
- 审计事件组装器

## 5.9 `packages/logger`

- `pino` 配置
- request logger
- trace logger

## 5.10 `packages/test-kit`

- mock provider
- mock Java client
- graph 节点测试夹具

---

## 6. 依赖规则

```text
apps -> packages
packages/domain-clients -> packages/contracts + packages/config
packages/graph-flows -> packages/graph-core + packages/tool-adapters + packages/contracts
packages/tool-adapters -> packages/domain-clients + packages/contracts
packages/model-adapters -> packages/config + packages/contracts
```

禁止：

- `apps` 互相直接依赖
- `graph-flows` 直接访问数据库
- `web-ssr` 直接依赖 `node-capability-service` 内部实现

---

## 7. Graph 目录规范

推荐：

```text
packages/graph-flows/
  self-explore-graph/
    index.ts
    state.ts
    nodes/
      intent-router.ts
      memory-gate-checker.ts
      memory-retriever.ts
      reasoner.ts
      responder.ts
    edges.ts
    tests/
```

原则：

- 一个 graph 一套 state
- 一个 node 一份职责
- Graph 不直接知道 HTTP

---

## 8. Node Review 规则

- 一个 app 不超过一种主要职责
- 一个 package 不做跨领域万能封装
- 所有外部调用都必须有 schema 校验
- 所有 env 都必须有默认值说明和校验规则
- 不允许在 Graph 节点里偷偷发 HTTP 到未知服务
- 不允许把 Java 业务规则复制进 Node

---

## 9. 从 `phyok-node` 摘取策略

建议摘取的东西放入这些包：

- 文件与媒体逻辑 -> `apps/node-capability-service`
- 风险预警 / 脱敏 -> `packages/shared`
- 邮件适配 / 某些环境变量习惯 -> `packages/config`
- Prompt 与模板 -> `packages/graph-flows`

不建议直接整体搬迁旧目录。

---

## 10. 一句话结论

Node 侧真正可维护的前提不是“用 LangGraph”，而是：

- **Monorepo 分层清楚**
- **Graph / Tool / Client / Config 解耦**
- **从旧 `phyok-node` 摘资产，不摘耦合**
