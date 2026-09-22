# 《心理学空间·自我探索Agent Pro》CMS Admin 应用架构

## 1. 定位

`cms-admin` 是内部运营与审计后台。

核心目标：

- 用户统计
- 付费统计
- 投诉处理
- 审计分页与回放
- 系统资源可见

---

## 2. 一句话结论

`cms-admin` 的本质是：

- 重列表
- 重筛选
- 重分页
- 重详情抽屉

而不是复杂互动式前台。

---

## 3. 路由结构

```text
/dashboard
/users
/billing/orders
/complaints
/audit/events
/conversations/[conversationId]
```

---

## 4. 推荐目录

```text
apps/cms-admin/
  app/
    dashboard/
    users/
    billing/orders/
    complaints/
    audit/events/
    conversations/[conversationId]/
  src/
    features/
      dashboard/
      users/
      billing/
      complaints/
      audit/
      conversations/
    components/
    hooks/
    lib/
```

---

## 5. 页面类型

## 5.1 仪表盘

- 核心指标卡
- 趋势图
- 风险提醒

## 5.2 列表页

- 分页
- 筛选
- 排序
- 行详情抽屉

## 5.3 详情页

- 会话详情
- 审计回放
- 投诉上下文

---

## 6. 技术重点

- 表格：`TanStack Table`
- 虚拟滚动：`TanStack Virtual`
- 数据查询：`TanStack Query`
- 全局筛选条件：Redux

---

## 7. 状态重点

Redux：

- 全局筛选条件
- 列表列显示偏好
- 运营侧 UI 偏好

TanStack Query：

- 仪表盘指标
- 列表分页数据
- 行详情数据

---

## 8. UI 原则

- 极简
- 信息密度高但不拥挤
- 支持大表格稳定浏览
- 所有高风险操作二次确认

---

## 9. 一句话结论

`cms-admin` 的好坏不在于花哨，而在于：

- 指标准
- 分页稳
- 审计回放清楚
- 搜索和筛选不拧巴
