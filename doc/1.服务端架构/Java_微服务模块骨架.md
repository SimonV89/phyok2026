# 《心理学空间·自我探索Agent Pro》Java Spring Cloud 模块骨架说明

## 1. 文档目标

本文把 Java 侧从“服务清单”推进到“仓库和模块怎么落”的层级。

目标：

- 保证服务边界清晰
- 保证 MyBatis 分层清晰
- 保证 shared 模块不过度膨胀
- 便于 review 和后续微服务拆分

---

## 2. 一句话结论

Java 侧推荐采用：

- `Gradle Kotlin DSL` 或 `Maven` 多模块
- `apps + libs`
- 业务服务独立模块
- 公共能力下沉到少量共享模块

原则：

- 共享的是协议和基础设施，不共享业务规则

---

## 3. 推荐目录

```text
phyok-java/
  apps/
    auth-service/
    tenant-service/
    memory-service/
    knowledge-service/
    billing-service/
    payment-service/
    audit-service/
    privacy-service/
    ops-admin-service/
  libs/
    boot-common/
    web-common/
    security-common/
    mybatis-common/
    kafka-common/
    redis-common/
    postgres-common/
    qdrant-common/
    contracts/
    test-common/
  docs/
    architecture/
```

---

## 4. apps 分工

## 4.1 `auth-service`

- 登录
- JWT 主签发
- refresh token

## 4.2 `tenant-service`

- 租户
- app
- plan
- role

## 4.3 `memory-service`

- 记忆碎片主表
- 关系表
- embedding 任务发起
- Qdrant 回表 enrich

## 4.4 `knowledge-service`

- 文档主表
- chunk 主表
- 索引任务

## 4.5 `billing-service`

- token 计量
- 套餐
- 配额
- 账务

## 4.6 `payment-service`

- 订单
- 支付回调
- 对账

## 4.7 `audit-service`

- 审计事件
- 回放
- 投诉证据链

## 4.8 `privacy-service`

- 删除任务主编排
- 补偿

## 4.9 `ops-admin-service`

- CMS
- 指标
- 审计列表
- 投诉列表

---

## 5. libs 分工

## 5.1 `boot-common`

- Spring Boot 自动配置
- 基础异常
- 全局响应包装

## 5.2 `web-common`

- MVC 公共配置
- request id
- trace 透传

## 5.3 `security-common`

- JWT 解析
- 鉴权过滤器
- 多租户上下文

## 5.4 `mybatis-common`

- MyBatis 基础配置
- 分页插件
- 类型处理器

## 5.5 `kafka-common`

- topic 常量
- producer / consumer 基础封装

## 5.6 `redis-common`

- RedisTemplate 配置
- key 规范
- 分布式锁工具

## 5.7 `postgres-common`

- datasource
- Flyway
- 审计字段基类约定

## 5.8 `qdrant-common`

- Qdrant client
- collection 约定
- payload filter builder

## 5.9 `contracts`

- 服务间 DTO
- command / query / event
- 错误码

## 5.10 `test-common`

- integration test 基础设施
- mock kafka / redis / pg fixture

---

## 6. 服务内部结构

每个 `apps/*-service` 推荐统一结构：

```text
src/main/java/.../
  interfaces/
    controller/
    dto/
  application/
    service/
    command/
    query/
  domain/
    model/
    service/
    repository/
  infrastructure/
    mybatis/
      mapper/
      entity/
    redis/
    kafka/
    qdrant/
  support/
```

---

## 7. MyBatis 分层规范

## 7.1 基本原则

- `Mapper XML` 只写数据访问
- `Application Service` 组合流程
- `Domain Service` 写业务规则

## 7.2 命名建议

- `*Command`
- `*Query`
- `*DTO`
- `*DO`
- `*Mapper`

## 7.3 Mapper 规范

- 一表一主 Mapper
- 复杂报表允许独立 report mapper
- XML 文件按用途拆分，不要一个 XML 上千行

---

## 8. 依赖规则

```text
apps -> libs
apps 不互相依赖 implementation
跨服务调用只通过 contracts + HTTP/gRPC
domain 不依赖 controller
mybatis mapper 不反向依赖 application
```

禁止：

- `memory-service` 直接 import `billing-service` 实现类
- `ops-admin-service` 直接访问其他服务数据库

---

## 9. Review 规则

- 一个服务只持有一类主数据写权
- 共享模块不得承载业务规则
- Mapper XML 需要索引说明
- 复杂查询要注明用途与调用频率
- 禁止“万能 BaseService”
- 禁止“万能 BaseMapper”吞掉语义

---

## 10. 初始开工顺序

1. `libs/contracts`
2. `libs/boot-common`
3. `libs/security-common`
4. `apps/auth-service`
5. `apps/tenant-service`
6. `apps/memory-service`
7. `apps/knowledge-service`
8. `apps/billing-service`
9. `apps/audit-service`
10. `apps/ops-admin-service`

---

## 11. 一句话结论

Java 侧真正能长期维护，不靠“框架越多越好”，而靠：

- **服务边界稳定**
- **MyBatis 分层清晰**
- **共享模块克制**
- **跨服务只共享契约，不共享实现**
