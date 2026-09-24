# 《心理学空间·自我探索Agent Pro》Node v2 微服务定位说明

> 历史稿说明：本文保留为上一阶段“Node 只做 capability service”的定位参考。当前主方案已切换为“Node 负责 BFF + LangGraph + SSE + SSR，Java 负责稳定业务域”，请优先阅读 [ARCHITECTURE_DOCS_INDEX.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-node/docs/ARCHITECTURE_DOCS_INDEX.md) 与 [NODE_LANGGRAPH_BFF_ARCHITECTURE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/phyok-node/docs/NODE_LANGGRAPH_BFF_ARCHITECTURE.md)。

## 1. 文档目的

本文专门说明 `phyok-node` 在新架构中的目标定位，避免后续在“Node 负责什么、Java 负责什么、`/app` 和 `/v2` 如何并存”上再次产生歧义。

本文结论优先级高于历史遗留描述。

---

## 2. 一句话定位

`phyok-node` 不再作为主后端中枢，而是演进为：

- `node-capability-service`

它专注自己擅长的：

- 多模态输入处理
- 文件处理
- 图片理解
- 语音转写
- 图片格式预处理
- 某些轻量级流式输出/中转
- 现有 `shared` 工具模块

Java Spring Cloud 则作为主控制面，负责主业务控制权。

---

## 3. 角色划分

## 3.1 继续留在 Node 的

- 多模态输入处理
- 文件处理
- 图片理解
- 语音转写
- 图片格式预处理
- 某些轻量级流式输出/中转
- `shared` 工具模块

### 说明

这些能力的共同特点是：

- I/O 密集
- 文件与媒体格式适配多
- 第三方媒体 SDK / 命令行工具耦合多
- 适合做成相对独立的能力服务

Node 在这些场景下继续保留是合理的，不会对新的 Java Spring 体系造成架构性伤害。

---

## 3.2 不继续由 Node 做主控的

- 多租户主鉴权
- JWT 主签发
- 计费主账本
- 审计总控
- 主聊天编排
- 主 RAG 链路
- 用户删除主编排

### 说明

这些能力的共同特点是：

- 强事务
- 强审计
- 强多租户隔离
- 强一致性
- 强编排控制

因此统一收口到 Java Spring Cloud 更合理。

---

## 4. `/app` 与 `/v2` 策略

## 4.1 路由语义

- `/app/*`
  - 旧 `phyok-node` 兼容入口
  - 继续保障现有客户端不受影响

- `/v2/*`
  - 新系统正式入口
  - 由 `Spring Cloud Gateway` 统一对外暴露
  - Node 只承接属于自己职责的那部分 `/v2` 路由

## 4.2 结论

Node 不应该成为 `/v2` 的总入口，只应该成为 `/v2` 体系中的一个微服务节点。

更准确地说：

- `/v2/auth/*` -> Java
- `/v2/chat/*` -> Java
- `/v2/memory/*` -> Java
- `/v2/knowledge/*` -> Java
- `/v2/billing/*` -> Java
- `/v2/admin/*` -> Java
- `/v2/media/*` -> Node 或 Java 调用 Node
- `/v2/stream/*` -> Node 或 Java 调用 Node

---

## 5. 数据库策略

## 5.1 总体结论

Node 的新职责不再依赖旧 Mongo 作为未来架构基座。

新架构中：

- Java 主系统：`PostgreSQL + Qdrant`
- Node v2 能力服务：`PostgreSQL`
- 旧 `/app`：过渡期仍可能保留 `Mongo`

## 5.2 为什么不能一步砍掉 Mongo

因为现有 `/app` 路由深度依赖 Mongo：

- auth
- pay
- bench
- subconscious
- memory vectors

如果要求“旧功能完全不受影响”，就不能在第一阶段直接整体去掉 Mongo。

## 5.3 正确迁移方式

- `legacy /app`：继续依赖旧 Mongo，直到退役
- `new /v2`：只写 PG，不再继续新增 Mongo 依赖

这意味着：

- 过渡期允许同一 Node 仓库同时兼容 Mongo 与 PG
- 但新功能、新路由、新数据模型全部以 PG 为准

---

## 6. Auth 决策

## 6.1 最终结论

- 主认证中心：Java
- JWT 主签发：Java
- 多租户主鉴权：Gateway + Java

## 6.2 Node 可以保留什么

- 邮箱验证码发送
- 邮件模板
- SMTP / SES 发送逻辑
- 某些过渡期登录辅助能力

## 6.3 为什么不建议继续由 Node 主签 JWT

因为后续系统的主控制面在 Java：

- 多租户隔离
- 配额控制
- 审计
- 工作流
- 账务

如果 JWT 主签发还留在 Node，会形成两套安全中心，后面会越来越乱。

---

## 7. SSE 决策

## 7.1 最终结论

- 主聊天 SSE：Java
- 媒体与轻量任务 SSE：Node

## 7.2 解释

主聊天链路会绑定：

- 主上下文
- 主 RAG
- 主模型调用
- 主计费
- 主审计

因此应该放在 Java 主链路里。

而以下场景继续留在 Node 更合理：

- 文件解析进度流
- 音频转写进度流
- 图片理解任务流
- 某些轻量代理流式返回

---

## 8. `shared` 模块决策

## 8.1 继续保留的

- 风险预警
- 隐私脱敏
- 图像预处理
- 文件格式兼容处理

## 8.2 需要升级的

- 进程内并发控制

### 原因

当前 `concurrency` 更偏单实例内存态设计，进入微服务和 K8s 横向扩容后，需要升级为：

- Redis 限流
- 分布式锁
- MQ 任务队列

## 8.3 结论

`shared` 模块整体继续保留在 Node 没问题，但其中涉及分布式状态的部分必须升级。

---

## 9. `privacy` 决策

## 9.1 最终结论

- 用户删除主编排：Java
- Node：删除执行器之一

## 9.2 解释

未来删除链路会跨：

- PostgreSQL
- Qdrant
- COS
- 审计数据
- Node 自己持有的数据

这类跨系统删除必须由 Java 的 `privacy-service` 统一编排。

Node 保留的价值在于：

- 执行自身数据删除
- 复用已有清理逻辑
- 作为合规删除链路的下游节点

---

## 10. Node v2 推荐路由

建议 Node 在新体系里重点暴露：

- `POST /v2/media/upload`
- `POST /v2/media/parse`
- `POST /v2/media/asr`
- `POST /v2/media/vision`
- `GET /v2/media/{assetId}`
- `GET /v2/stream/tasks/{taskId}`

如需保留支付过渡能力，建议只走内部接口，不直接对外：

- `POST /internal/node-capability/pay/apple-verify`

如需保留隐私清理执行器：

- `POST /internal/node-capability/privacy/delete-user`

---

## 11. 演进路线

### 阶段 1

- 保留 `/app`
- 新增 `/v2`
- Java 接管网关、Auth、Billing、Audit、主聊天链路

### 阶段 2

- 把 Node 中保留的多模态与工具能力整理为 `node-capability-service`
- 新能力全部写 PG

### 阶段 3

- 主 RAG 完整迁到 Java
- 主聊天 SSE 迁到 Java
- Node 只保留能力型服务

### 阶段 4

- 当旧客户端退出后，再考虑逐步下线 `/app`
- 最终去除对旧 Mongo 的依赖

---

## 12. 最终结论

`phyok-node` 的未来不是“继续做大而全的主后端”，而是“专注它最擅长的能力型节点服务”。

因此正式结论为：

- Node 保留多模态、文件、媒体、shared 工具与轻流式
- Java 掌控鉴权、编排、RAG、计费、审计、隐私主编排
- `/app` 保留兼容
- `/v2` 作为新系统正式入口
- 新设计优先以 PG 为准
