# 《心理学空间·自我探索Agent Pro》前端设计系统架构

## 1. 文档目标

本文定义前端视觉与组件层的工程组织方式。

目标不是先做视觉稿，而是先把：

- tokens
- 基础组件
- chat 组件
- cms 组件

分清楚。

---

## 2. 一句话结论

推荐分三层：

- `tokens`
- `ui primitives`
- `feature components`

---

## 3. 共享包建议

## 3.1 `packages/tokens`

- 颜色
- 字体
- 间距
- 阴影
- 圆角

## 3.2 `packages/ui`

- Button
- Input
- Textarea
- Card
- Dialog
- Drawer
- Table shell
- Empty state

## 3.3 feature 组件

放在具体 app 内：

- ChatMessage
- CitationCard
- AttachmentChip
- MetricCard
- AuditRow

---

## 4. 视觉原则

基调：

- 大厂简约
- 克制
- 强信息焦点
- 不花哨

适配你当前偏好：

- 单聊天框要沉静
- CMS 要信息效率优先

---

## 5. Chat UI 原则

- 气泡样式不要花
- 引用卡片层级要轻
- 附件状态要清晰
- 输入框要稳重，不要像社交 IM

---

## 6. CMS UI 原则

- 指标卡片统一
- 表格边距克制
- 详情抽屉稳定
- 风险态颜色少而准

---

## 7. 组件规范

- `packages/ui` 只做通用组件
- 业务组件不反向沉到 UI 包
- 所有变体通过 props 明确表达
- 禁止一个组件兼顾过多业务语义

---

## 8. CSS 方案建议

推荐：

- `Tailwind CSS`

原因：

- 与 Monorepo 结合成熟
- 与 design token 映射清晰
- 适合快速稳定搭 Chat 和 CMS

---

## 9. 一句话结论

前端设计系统最重要的不是炫，而是：

- **tokens 稳**
- **UI primitives 克制**
- **业务组件不污染共享层**
