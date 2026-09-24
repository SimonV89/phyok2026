# 《心理学空间·自我探索Agent Pro》CMS 后台架构说明

## 1. 目标

CMS 后台是内部运营与审计控制台，不追求复杂，而追求：

- 核心指标一眼可看
- 关键数据可分页查询
- 审计与投诉可追踪
- 账号安全可控

---

## 2. 服务定位

后台由 Java 侧 `ops-admin-service` 承担。

原因：

- 需要查主账务
- 需要查主审计
- 需要查主用户表
- 需要多租户与权限控制
- 需要复杂分页与统计 SQL

因此不建议由 Node 承担 CMS 主后台。

---

## 3. 首期功能范围

## 3.1 仪表盘

核心指标：

- 用户总数
- 日活 / 周活 / 月活
- 付费人数
- 付费金额
- 新增投诉数
- 审计事件数
- 风险事件数
- 当前系统健康状态

## 3.2 分页查询

至少支持以下列表页：

- 用户列表
- 订单 / 账单列表
- 投诉列表
- 审计事件列表
- 会话回放列表
- 风险事件列表

## 3.3 操作能力

- 查看用户详情
- 查看账单明细
- 查看审计轨迹
- 查看投诉详情
- 查看会话回放
- 工作流开关/灰度开关

---

## 4. 首个管理员账号

首个管理员账号要求：

- 用户名：`simonwzb`

密码策略：

- 不在仓库中写明文密码
- 部署时通过环境变量注入 bootstrap password
- 第一次登录后强制修改密码
- 数据库存储仅保存加盐哈希

推荐环境变量：

- `CMS_BOOTSTRAP_USERNAME=simonwzb`
- `CMS_BOOTSTRAP_PASSWORD=<首次部署时注入>`

说明：

- 你给出的初始密码可以在首次部署时注入该变量
- 但不建议写入 Git 仓库、Markdown 明文或 Docker 镜像

---

## 5. 后台表设计建议

## 5.1 `admin_operator`

用途：

- CMS 管理员主表

关键字段：

- `id`
- `tenant_id`
- `username`
- `password_hash`
- `display_name`
- `email`
- `status`
- `force_reset_password`
- `last_login_at`
- `created_at`
- `updated_at`

索引：

- `uk_admin_operator_username`
- `idx_admin_operator_status`

## 5.2 `admin_role`

用途：

- 角色表

角色建议：

- `SUPER_ADMIN`
- `AUDIT_ADMIN`
- `OPS_ADMIN`
- `FINANCE_ADMIN`

## 5.3 `admin_operator_role`

用途：

- 管理员与角色关联表

## 5.4 `admin_login_log`

用途：

- 后台登录日志

关键字段：

- `operator_id`
- `login_ip`
- `user_agent`
- `result`
- `created_at`

## 5.5 `user_complaint`

用途：

- 投诉主表

关键字段：

- `id`
- `tenant_id`
- `app_id`
- `user_id`
- `conversation_id`
- `complaint_type`
- `complaint_content`
- `status`
- `handled_by`
- `handled_at`
- `created_at`

索引：

- `idx_user_complaint_status_created_at`
- `idx_user_complaint_user_id`

---

## 6. 仪表盘指标口径

## 6.1 用户指标

- 累计注册用户
- 今日新增用户
- DAU / WAU / MAU

## 6.2 付费指标

- 今日付费金额
- 本月付费金额
- 付费用户数
- 套餐购买次数

## 6.3 投诉指标

- 今日新增投诉
- 待处理投诉
- 已关闭投诉

## 6.4 审计指标

- 今日审计事件量
- 高风险审计条数
- 模型失败次数
- 工具调用失败次数

---

## 7. 分页查询接口建议

统一前缀：

- `/v2/admin/*`

建议接口：

- `GET /v2/admin/dashboard/overview`
- `GET /v2/admin/users`
- `GET /v2/admin/billing/orders`
- `GET /v2/admin/complaints`
- `GET /v2/admin/audit/events`
- `GET /v2/admin/conversations`
- `GET /v2/admin/system/resources`

分页统一参数：

- `pageNo`
- `pageSize`
- `sortBy`
- `sortOrder`
- `keyword`
- `startAt`
- `endAt`

---

## 8. SQL 与 ORM 策略

后台大量是：

- 复杂统计
- 多条件分页
- 汇总分组
- 时间范围过滤

因此统一采用：

- `MyBatis + XML Mapper`

原因：

- SQL 可控
- 统计语句透明
- 方便针对 PostgreSQL 做索引优化
- 方便后续看执行计划和调分页性能

---

## 9. 前端组件建议

后台前端建议用：

- `TanStack Query`
- `TanStack Table`
- `TanStack Virtual`

说明：

- 查询类页面以 server state 为主
- 表格必须支持大数据分页与虚拟滚动

---

## 10. 安全要求

- 仅管理域名或内网开放
- 后台登录必须单独 JWT / Session 域
- 登录失败次数限制
- 操作日志必须审计
- 导出操作必须留痕
- 高风险操作可增加二次确认

---

## 11. 一句话结论

CMS 后台应由 Java `ops-admin-service` 承担，采用 `MyBatis` 做统计和分页查询，首期聚焦：

- 核心指标
- 分页列表
- 审计回放
- 投诉处理
