# 《心理学空间·自我探索Agent Pro》Node + Java 双后端部署与运维

## 1. 文档定位

本文定义双后端主方案下的部署、日志、审计、CMS、告警与演进路线。

前提环境：

- 腾讯云轻量应用服务器
- 已安装 `git`
- 已安装 `docker`
- 当前资源紧张
- 希望一键部署、一键更新、动态日志、日志归档、空间清理、崩溃预警

---

## 2. 一句话结论

当前正式建议：

- **P0**
- `Docker Compose` 单机生产方案

- **P1**
- `k3s`

- **P2**
- 腾讯云 `TKE + Spring Cloud`

结论重点：

- 现在先把 Compose 打磨到稳
- 文档、镜像、目录、env、日志、脚本一开始就按未来 K8s 对齐

---

## 3. 当前推荐运行拓扑

```text
/opt/phyok/
  node-api-bff-gateway
  node-agent-runtime-langgraph
  node-capability-service
  web-ssr
  java-auth-service
  java-tenant-service
  java-memory-service
  java-knowledge-service
  java-billing-service
  java-payment-service
  java-audit-service
  java-privacy-service
  java-ops-admin-service
  postgres
  qdrant
  redis
  kafka
  reverse-proxy
```

---

## 4. Docker Compose 角色分配

## 4.1 Node 容器

- `node-api-bff-gateway`
- `node-agent-runtime-langgraph`
- `node-capability-service`
- `web-ssr`

## 4.2 Java 容器

- `java-auth-service`
- `java-tenant-service`
- `java-memory-service`
- `java-knowledge-service`
- `java-billing-service`
- `java-payment-service`
- `java-audit-service`
- `java-privacy-service`
- `java-ops-admin-service`

## 4.3 基础设施容器

- `postgres`
- `qdrant`
- `redis`
- `kafka`
- `reverse-proxy`

---

## 5. 资源紧张时的合并策略

P0 单机不建议过度拆容器。

建议：

- `java-auth-service + java-tenant-service` 可先合并成 `java-identity-service`
- `java-billing-service + java-payment-service` 可先合并成 `java-commerce-service`
- `java-audit-service + java-ops-admin-service` 可先合并成 `java-ops-service`

但逻辑边界仍然按最终服务边界写文档和代码。

原则：

- **可以先合并部署**
- **不要先合并职责**

---

## 6. 目录规范

推荐：

```text
/opt/phyok/
  releases/
  shared/
    env/
    logs/
    backups/
    data/
      postgres/
      qdrant/
      redis/
      kafka/
      uploads/
  scripts/
    deploy.sh
    update.sh
    logs.sh
    cleanup.sh
    backup.sh
    healthcheck.sh
    alert.sh
  compose/
    docker-compose.prod.yml
```

---

## 7. 一键部署脚本

## 7.1 `deploy.sh`

职责：

- 拉代码
- 校验 env
- 构建镜像
- 启动 compose
- 健康检查
- 输出日志命令和访问地址

## 7.2 `update.sh`

职责：

- `git pull`
- 构建变更镜像
- 滚动重启
- 健康检查失败则回滚

## 7.3 `logs.sh`

职责：

- 输出某个服务最近日志
- 支持 follow

## 7.4 `cleanup.sh`

职责：

- 清理无用镜像
- 清理 dangling volume
- 清理旧日志归档

## 7.5 `alert.sh`

职责：

- 服务崩溃通知
- 高磁盘占用通知
- 高内存占用通知

建议环境变量：

- `ALERT_EMAIL_TO=simon.wzb@qq.com`

---

## 8. 日志系统

## 8.1 P0 轻量方案

建议：

- 应用全部输出结构化 JSON 到 stdout
- Docker 负责容器日志
- 宿主机脚本按天归档
- 关键审计不依赖普通日志，而是写 Java `audit-service`

## 8.2 日志分层

- `application log`
- `security log`
- `audit event`
- `payment event`

## 8.3 轻量日志技术建议

当前机器资源紧张时：

- 不强推 ELK
- 优先：
  - `stdout + json`
  - 本地归档
  - 必要时补 `Vector` 或 `Fluent Bit`

---

## 9. 审计机制

审计真相统一在 Java：

- `audit-service`

Node 和 Java 都必须发审计事件，但主落库口径只有一套。

最低要求：

- 请求 ID
- 用户 ID
- 租户 ID
- Graph 运行 ID
- Tool 调用
- 模型调用摘要
- RAG 命中结果
- 最终回复摘要

---

## 10. CMS 系统

CMS 正式归属：

- `java-ops-admin-service`

Node 的角色：

- 只提供必要 BFF 或 SSR 支持

CMS 必须包含：

- 用户统计
- 付费统计
- 投诉分页
- 审计分页
- 系统资源指标

---

## 11. 登录鉴权

主鉴权中心：

- Java `auth-service`

Node 角色：

- 校验和透传身份
- 进行前端友好的聚合响应

不建议：

- Node 保留第二套 JWT 主签发

---

## 12. 支付

主支付归属：

- Java `payment-service`
- Java `billing-service`

可以从旧 `phyok-node` 摘取：

- 支付适配经验
- 支付环境变量规范
- 回调处理片段

但正式主账本必须在 Java。

---

## 13. RAG 与向量化

主真相：

- `PostgreSQL`

相似度召回：

- `Qdrant`

消息队列：

- `Kafka`

缓存与运行态：

- `Redis`

原则：

- Node 不直接持有主业务 RAG 真相
- Node Graph 只消费 Java 提供的检索能力

---

## 14. 监控与告警

## 14.1 P0 单机方案

最小要求：

- `healthcheck.sh`
- Docker restart policy
- 邮件告警
- 磁盘、内存、CPU 阈值检测

## 14.2 P1 / P2 演进

进入 `k3s / TKE` 后补齐：

- `Prometheus`
- `Grafana`
- `Alertmanager`

---

## 15. K8s 演进路线

## 15.1 P0

- 单机 `Docker Compose`

## 15.2 P1

- 单机 `k3s`
- 保持和 Compose 镜像、env、volume 结构一致

## 15.3 P2

- 腾讯云 `TKE`
- Java 微服务按 Spring Cloud 体系正式部署
- Node 运行时服务也进入集群，但仍保持独立职责

---

## 16. 环境变量规范

建议：

- Node 和 Java 各自维护 `.env.example`
- 公共变量统一前缀：
  - `PHYOK_`
- Node LLM / SSE / Graph 变量前缀：
  - `NODE_`
- Java 业务域变量前缀：
  - `JAVA_`

不建议：

- 随手复用历史零散变量名
- 在业务代码中直接读取 env

---

## 17. 运维原则

- 先稳后大
- 先 Compose 后 k3s/TKE
- 先日志与审计打通，再谈复杂集群
- 先合并部署，再拆分职责

---

## 18. 一句话结论

当前最现实的上线方案是：

- **Node + Java 双后端**
- **Docker Compose 单机一键部署**
- **日志、审计、支付、CMS、告警全部保留并继续精进**
- **未来平滑演进到 k3s / TKE**
