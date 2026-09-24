# Dify 导入可运行 DSL 指南

这份指南用于把最小可运行版 DSL 先导入到本地 Dify，验证：

- DSL 能导入
- LLM 节点能选到模型
- 对话能正常发布和运行

完成这一步后，再继续替换成《心理学空间·自我探索Agent Pro》的正式大流程。

## 1. 准备文件

先使用这份文件：

- `docs/dify/self_explore_agent_pro.importable.min.yml`

说明：

- 这是“最小可运行版”
- 它只包含 `开始 -> Floyd LLM -> 回复`
- 目的是先确保 Dify 这套环境本身可用

## 2. 打开 Dify

访问：

- `http://localhost/apps`

如果你还没登录，先完成登录。

## 3. 导入 DSL

在 Studio 中选择：

1. `Create from DSL`
2. `Import DSL File`
3. 选择本地文件 `self_explore_agent_pro.importable.min.yml`

如果你的界面文案稍有不同，也通常是在：

- `Studio`
- `Create App`
- `Import DSL`

## 4. 导入后的第一件事

先不要急着测试，先点开 `Floyd 最小回复` 这个 LLM 节点，确认模型配置。

这一步最关键，因为 DSL 文件里写的是一个通用占位模型：

- `provider: openai`
- `name: gpt-4o-mini`

如果你的 Dify 本地并没有配置这个模型提供商，节点会显示未配置或不可运行。

## 5. 手动改成你已配置的模型

在 `Floyd 最小回复` 节点里：

1. 打开模型选择器
2. 选择你在 Dify 里已经配置好的聊天模型
3. 保存节点

建议先选一个最稳的聊天模型，不要先上复杂多模态模型。

## 6. 发布并测试

完成模型选择后：

1. 点击 `Publish`
2. 进入预览或运行页
3. 输入一句测试话术，例如：

```text
我最近总是在亲密关系里感到很不安，我想先聊聊这种感觉。
```

如果能正常输出一段 Floyd 风格回复，说明：

- Dify 实例可用
- DSL 导入成功
- 模型配置可用
- 最小聊天链路跑通

## 7. 如果导入失败，优先检查这几项

### 7.1 版本或 schema 不兼容

现象：

- 导入时报 `invalid dsl`
- 或者导入后画布异常

处理：

- 先在 Dify 中新建一个最简单的 Chatflow
- 只保留 `Start -> LLM -> Answer`
- 导出官方 DSL
- 再把我们这份最小文件与官方导出文件逐字段比对

### 7.2 模型不可用

现象：

- 节点报错
- 运行时报模型未配置

处理：

- 到 Dify `Settings -> Model Provider`
- 确认至少已有一个聊天模型可用

### 7.3 导入成功但运行为空

现象：

- 可以运行，但没有输出

处理：

- 检查 `Answer` 节点是否仍为：
  - `{{#llm-node.text#}}`
- 检查 LLM 节点是否真的返回了文本

## 8. 为什么先导入最小版

因为你当前的大草案包含：

- 多个 conversation variables
- 多模态开关
- 多个 LLM 角色
- 后续还会有 HTTP、RAG、门槛校验和分支路由

这些内容一旦和 Dify 当前版本 schema 有一点点偏差，就会让你误以为“业务设计有问题”，实际上常常只是 DSL 字段兼容问题。

所以正确顺序是：

1. 先跑通最小版
2. 再升级到多节点版
3. 再升级到记忆门槛和探索分支版
4. 最后再接 RAG 和多模态知识入库

## 9. 下一步升级顺序

建议按下面顺序逐步替换：

1. `最小版 Floyd`
2. `输入规范化 + 意图识别`
3. `记忆门槛校验`
4. `探索心理学`
5. `潜意识 / 原生家庭 / 根因探索`
6. `知识库检索`
7. `记忆碎片检索`
8. `记忆新增 / 修改 / 删除`

## 10. 当前文件定位

### 可导入验证用

- `docs/dify/self_explore_agent_pro.importable.min.yml`

### 设计大草案

- `docs/dify/self_explore_agent_pro.bridge.draft.yml`

这两份不要混用：

- `importable.min.yml` 用来先导入跑通
- `bridge.draft.yml` 用来继续打磨完整业务编排
