# 《心理学空间·自我探索Agent Pro》`phyok-node` `/v2` 最小改造实施方案

## 1. 文档目标

本文把 `phyok-node` 从“当前存量 Node 后端”推进为“新架构中的 `node-capability-service`”。

目标非常明确：

- 不影响现有 `/app` 功能
- 新增 `/v2` 路由体系
- `/v2` 只承接 Node 擅长的能力
- `/v2` 新数据优先接 `PostgreSQL`
- 为后续 Java Spring Cloud 主控制面让路

本文聚焦：

- 代码目录怎么改
- 路由怎么拆
- PG 怎么接
- Mongo 怎么过渡
- 哪些能力先迁，哪些后迁

---

## 2. 改造总原则

## 2.1 目标定位

改造后的 `phyok-node` 不再是总后端，而是：

- `node-capability-service`

主要职责：

- 多模态输入处理
- 文件处理
- 图片理解
- 语音转写
- 图片格式预处理
- 某些轻量级流式输出/中转
- `shared` 工具模块

## 2.2 不做的事

`phyok-node /v2` 不承担：

- 多租户主鉴权
- JWT 主签发
- 主聊天编排
- 主 RAG
- 计费主账本
- 审计总控
- 用户删除主编排

---

## 3. 路由策略

## 3.1 双前缀并存

### 旧前缀

- `/app/*`

定位：

- legacy 兼容入口
- 面向现有客户端
- 暂时维持原逻辑

### 新前缀

- `/v2/*`

定位：

- 新能力入口
- 只承接 Node 保留下来的能力

## 3.2 `/v2` 推荐首批接口

### 对外接口

- `POST /v2/media/upload`
- `POST /v2/media/parse`
- `POST /v2/media/asr`
- `POST /v2/media/vision`
- `GET /v2/media/{assetId}`
- `GET /v2/stream/tasks/{taskId}`

### 内部接口

- `POST /internal/node-capability/media/parse`
- `POST /internal/node-capability/pay/apple-verify`
- `POST /internal/node-capability/privacy/delete-user`

## 3.3 暂不直接对外的旧能力

以下能力建议先不直接对外暴露新 `/v2` 公开 API：

- 支付主链路
- 用户登录主链路
- 主聊天对话
- 潜意识完整业务链

原因：

- 它们未来应被 Java 接管
- 现在只需保留过渡内部能力或 legacy `/app` 能力

---

## 4. 目录改造方案

## 4.1 当前结构问题

当前 `src/modules` 下的能力是按旧业务组织的：

- `auth`
- `bench`
- `pay`
- `rag`
- `subconscious`
- `shared`

问题：

- 业务耦合深
- 路由与实现绑定过重
- Mongo 访问散在各模块里

## 4.2 建议新增目录

在不大拆老代码的前提下，先新增：

```text
src/
  db/
    mongodb.ts
    postgres.ts
  modules/
    v2/
      media/
        routes.ts
        service.ts
        repository.ts
        types.ts
      stream/
        routes.ts
        service.ts
      shared/
        service.ts
    auth/
    bench/
    pay/
    privacy/
    rag/
    shared/
    subconscious/
  infra/
    pg/
      mappers/
      sql/
```

## 4.3 为什么先新增 `v2/`

原因：

- 对旧 `/app` 改动最小
- 不会强迫你一次性重构旧模块
- 能让新旧逻辑明确分层

---

## 5. 数据库接入方案

## 5.1 现实约束

旧 `/app` 大量依赖 Mongo。

所以第一阶段不能做成：

- 全仓库统一切 PG

正确做法是：

- `/app`：仍允许走 Mongo
- `/v2`：只写 PG

## 5.2 代码层做法

### 保留

- `src/db/mongodb.ts`

用途：

- 只服务 legacy `/app`

### 新增

- `src/db/postgres.ts`

用途：

- 统一封装 PG 连接池
- 供 `/v2` 模块使用

### Repository 原则

- legacy repository 继续依赖 Mongo
- v2 repository 全部依赖 PG

---

## 6. `/v2` 首批能力拆分

## 6.1 `v2/media`

职责：

- 文件上传
- 文档解析
- 图片理解
- 语音转写
- 资产元数据入 PG

复用来源：

- `bench/ingest.ts`
- `bench/siliconflow.ts`
- `shared/vision-image.ts`
- `subconscious/service.ts` 中的图片分析能力

需要抽出的核心函数：

- `parseDocument()`
- `analyzeImage()`
- `transcribeAudio()`
- `normalizeImageFormat()`
- `buildMediaAssetRecord()`

## 6.2 `v2/stream`

职责：

- 轻量任务状态查询
- 非主聊天链路的 SSE / 轮询状态

说明：

- 不接主聊天 SSE
- 只接媒体解析进度与轻任务进度

## 6.3 `v2/shared`

职责：

- 封装 `shared` 现有能力作为服务层

复用：

- 风险预警
- 隐私脱敏
- 图像预处理
- 文件格式兼容

---

## 7. PG 表最小需求

`phyok-node /v2` 首批最少需要这些表：

- `media_asset`
- `media_parse_job`
- `node_task_projection`
- `node_payment_projection`

说明：

- 主账务仍在 Java
- Node 只保留过渡投影，不做账务真相源

---

## 8. 代码改造步骤

## 8.1 第一步：加 PG 基础设施

- 新增 `src/db/postgres.ts`
- 增加 PG 环境变量
- 引入连接池与健康检查

## 8.2 第二步：新增 `/v2` 路由注册

在 `src/index.ts` 中：

- 保留 `/app` 原注册
- 新增 `/v2` 外层前缀
- 首期只挂 `v2/media`、`v2/stream`

## 8.3 第三步：抽媒体服务

从旧模块中提取：

- 文档解析
- ASR
- 图片理解
- 图像格式预处理

做法：

- 先抽函数
- 再抽 service
- 最后在 `v2/media/routes.ts` 组接口

## 8.4 第四步：把结果写 PG

媒体解析结果不再直接沉淀到旧 Mongo：

- 先写 `media_asset`
- 再写 `media_parse_job`
- 再由 Java 决定是否沉淀为正式记忆碎片

## 8.5 第五步：改并发控制

当前 `shared/concurrency.ts` 是进程内方案。

第一阶段最小可行升级：

- 使用 Redis 记录任务占用
- 任务状态落 `node_task_projection`

---

## 9. `src/index.ts` 改造建议

## 9.1 保持现有

- `/health`
- `/app/*`

## 9.2 新增

- `/v2/health`
- `/v2/media/*`
- `/v2/stream/*`

## 9.3 注册顺序建议

先注册基础中间件，再注册：

1. root routes
2. `/app`
3. `/v2`

这样兼容逻辑最清晰。

---

## 10. 环境变量新增建议

新增：

```text
PG_HOST=
PG_PORT=
PG_DB=
PG_USER=
PG_PASSWORD=
PG_POOL_MAX=
NODE_CAPABILITY_APP_CODE=phyok
NODE_CAPABILITY_SERVICE_NAME=node-capability-service
MEDIA_TMP_DIR=
CMS_BOOTSTRAP_USERNAME=
CMS_BOOTSTRAP_PASSWORD=
```

保留：

- Mongo 相关变量

但标记为：

- `legacy only`

---

## 11. 与 Java 的调用关系

## 11.1 Java -> Node

未来主链路中：

- Java 先做鉴权
- Java 做主编排
- Java 调用 Node 的媒体能力

## 11.2 Node -> Java

原则上不建议让 Node 反向驱动 Java 主控制面。

如果需要：

- 仅允许事件或回调式通知

例如：

- 媒体解析完成后投递事件

---

## 12. 最小上线顺序

### P0

- 加 PG
- 加 `/v2`
- 抽 `media`
- 抽 `stream`
- 接入 `media_asset` / `media_parse_job`

### P1

- Redis 化任务并发控制
- 接入内部支付投影接口
- 接入内部隐私删除执行器

### P2

- legacy `/app` 中可复用能力继续迁出
- 最终淡化 Mongo 依赖

---

## 13. 一句话结论

`phyok-node` 的最小正确改造路线不是“整体重写”，而是：

- 保留 `/app`
- 新增 `/v2`
- 新增 PG 基础设施
- 先把媒体与轻流式能力抽出来
- 让 Java 成为主控制面，Node 成为能力节点
