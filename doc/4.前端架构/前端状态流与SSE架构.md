# 《心理学空间·自我探索Agent Pro》前端状态流与 SSE 架构

## 1. 文档目标

本文专门定义前端最容易失控的部分：

- Redux
- TanStack Query
- SSE 流式状态
- 附件任务状态

---

## 2. 一句话结论

前端统一分三层状态：

- `UI State`
- `App State`
- `Server State`

并且：

- `SSE` 放 Redux
- `分页/列表/指标` 放 TanStack Query
- `局部交互` 放组件 state

---

## 3. 三层状态划分

## 3.1 UI State

组件本地处理：

- 弹窗开关
- tab 激活
- hover / focus

## 3.2 App State

Redux 处理：

- 当前会话
- 当前输入草稿
- 当前流式消息
- 当前附件上传状态
- UI 偏好

## 3.3 Server State

TanStack Query 处理：

- 历史分页
- dashboard 指标
- 用户列表
- 审计列表
- 媒体解析任务状态

---

## 4. Redux slice 建议

- `chatSessionsSlice`
- `chatComposerSlice`
- `chatStreamSlice`
- `attachmentsSlice`
- `uiPreferenceSlice`
- `adminFilterSlice`

---

## 5. SSE 事件流规范

推荐前端消费：

- `message.delta`
- `tool.started`
- `tool.completed`
- `citation.appended`
- `warning.raised`
- `message.completed`
- `usage.reported`

处理原则：

- 每种事件单独 reducer
- 不在组件里直接解析原始 event text

---

## 6. SSE 生命周期

1. 用户点击发送
2. 建立 SSE
3. 写入 `chatStreamSlice`
4. 累积 `message.delta`
5. 监听 `message.completed`
6. 关闭连接或转为 idle

异常场景：

- 网络断开
- 服务端中断
- 取消生成

都要落成显式状态，而不是隐式失败。

---

## 7. Query Key 规范

- `['dashboard', 'overview']`
- `['users', pageNo, filters]`
- `['billing-orders', pageNo, filters]`
- `['complaints', pageNo, filters]`
- `['audit-events', pageNo, filters]`
- `['conversation-history', conversationId, cursor]`
- `['media-task', taskId]`

---

## 8. 附件状态规范

附件状态建议：

- `queued`
- `uploading`
- `uploaded`
- `parsing`
- `ready`
- `failed`

附件状态放 Redux，附件详情查询可放 Query。

---

## 9. DevTools 策略

因为你明确要求：

- 可观测单向数据流
- 时间漫游调试

所以必须：

- `Redux DevTools` 默认接入
- 所有关键 reducer 命名可读
- 避免在 reducer 内做隐式副作用

---

## 10. 一句话结论

前端状态一旦失控，聊天产品会立刻变脆。

最稳的路线就是：

- **Redux 管运行态**
- **TanStack Query 管服务端态**
- **SSE 单独建模**
