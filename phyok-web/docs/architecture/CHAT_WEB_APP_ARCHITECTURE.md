# 《心理学空间·自我探索Agent Pro》Chat Web 应用架构

## 1. 定位

`chat-web` 是用户主产品。

目标：

- 单聊天框
- 多模态输入
- SSE 流式输出
- 引用记忆依据
- 风格接近 Codex / Trae Work

---

## 2. 一句话结论

`chat-web` 不是页面多，而是状态复杂。

核心模块：

- `chat-shell`
- `composer`
- `stream-view`
- `citation-panel`
- `attachments-panel`
- `conversation-history`

---

## 3. 路由结构

```text
/
/chat/[conversationId]
/settings
/profile
```

建议：

- 首页即新建会话入口
- 会话详情页只保留一个主阅读焦点

---

## 4. 推荐目录

```text
apps/chat-web/
  app/
    (chat)/
      page.tsx
      chat/[conversationId]/page.tsx
    settings/
    profile/
  src/
    features/
      chat-shell/
      composer/
      attachments/
      citations/
      history/
      session/
    components/
    hooks/
    lib/
```

---

## 5. 功能分层

## 5.1 `features/chat-shell`

- 页面骨架
- 左右布局
- 消息流容器

## 5.2 `features/composer`

- 文本输入
- 附件接入
- 发送按钮
- 草稿状态

## 5.3 `features/attachments`

- 文件上传队列
- 预览
- 解析状态

## 5.4 `features/citations`

- 记忆依据引用
- 文档引用
- 命中原因说明

## 5.5 `features/history`

- 历史会话切换
- 历史分页

---

## 6. 交互原则

- 只保留一个主输入区
- 消息流优先阅读，不做信息噪声侧栏
- 引用卡片必须可折叠
- 多模态附件状态必须可见

---

## 7. API 对接

主要接口：

- `POST /v2/chat/send`
- `GET /v2/chat/history`
- `POST /v2/media/upload`
- `GET /v2/media/task`
- `GET /v2/memory/list`

前端不直接理解 Java 多微服务，只理解 Node BFF 协议。

---

## 8. 状态重点

Redux 重点：

- 当前会话
- 当前草稿
- 当前 SSE 流
- 附件上传中状态

TanStack Query 重点：

- 会话历史分页
- 附件任务状态
- 用户资料

---

## 9. 组件规范

- 容器组件和展示组件分离
- 消息渲染器与消息数据转换分离
- citation 渲染组件不直接读取全局 store

---

## 10. 一句话结论

`chat-web` 的关键不是堆更多页面，而是让：

- 输入稳定
- 流式稳定
- 引用清楚
- 附件处理透明
