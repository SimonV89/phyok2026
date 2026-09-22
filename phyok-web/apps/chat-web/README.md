# `chat-web` 架构说明

## 1. 定位

这是《心理学空间·自我探索Agent Pro》的用户聊天端。

目标：

- 单聊天框
- 多模态输入
- 流式输出
- 记忆依据引用

---

## 2. 路由建议

- `/`
- `/chat/[conversationId]`
- `/settings`
- `/profile`

---

## 3. 模块建议

```text
apps/chat-web/
  app/
  src/
    features/
      chat/
      attachments/
      memory-citations/
      session/
      profile/
    components/
    hooks/
    lib/
```

---

## 4. 状态建议

Redux 管：

- 会话运行态
- composer 输入态
- SSE 流式状态
- 附件上传态

TanStack Query 管：

- 会话历史
- 媒体任务状态
- 用户资料

---

## 5. 结论

`chat-web` 的核心不是页面多，而是：

- 聊天流稳定
- 附件状态清晰
- 依据引用好读
- 邮箱登录、计费摘要、审计证据可直接体验
