# `cms-admin` 架构说明

## 1. 定位

这是《心理学空间·自我探索Agent Pro》的内部后台。

目标：

- 看核心指标
- 查用户、付费、投诉、审计
- 支持分页、筛选、回放

---

## 2. 路由建议

- `/dashboard`
- `/users`
- `/billing/orders`
- `/complaints`
- `/audit/events`
- `/conversations/[conversationId]`

---

## 3. 页面层级

```text
apps/cms-admin/
  app/
  src/
    features/
      dashboard/
      users/
      billing/
      complaints/
      audit/
      conversations/
```

---

## 4. 技术重点

- 指标卡片用 `TanStack Query`
- 分页表格用 `TanStack Table + Virtual`
- 全局筛选条件可放 Redux

---

## 5. 结论

`cms-admin` 的重点不是炫 UI，而是：

- 指标可信
- 分页稳定
- 审计回放清晰
