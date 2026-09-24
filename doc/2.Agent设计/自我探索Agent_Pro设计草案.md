# 《心理学空间·自我探索Agent Pro》设计草案

## 1. 目标

在保留《心理自愈Pro》现有 Node 后端心理探索能力的前提下，先完成新 Agent 的业务编排设计，再逐步迁移到后续的 `React Chat UI + Java Backend` 体系。

P0 目标不是做一个“泛化多 Agent 平台”，而是做一个：

- 单聊天框入口
- 支持文本、文档、图片、语音输入
- 具备强领域规则约束
- 可先跑在 Dify Bridge Mode
- 后续可迁移到 Java Native Runtime

的自我探索 Agent。

## 2. 现有 Node 可复用资产

### 2.1 可直接复用的能力

- `src/modules/subconscious/service.ts`
  - Floyd 风格 `system prompt`
  - 多心理学流派分析模板
  - 潜意识/原生家庭/客体关系等探索逻辑
  - 多模态分析入口
- `src/modules/subconscious/routes.ts`
  - 聊天流式输出 SSE 链路
  - 风险识别后的响应收口
- `src/modules/rag/repository.ts`
  - 记忆向量新增、修改、删除
  - 向量文本与元数据更新
- `src/modules/bench/ingest.ts`
  - 文档/文本切块与入库经验
- `src/modules/shared/risk-alert.ts`
  - 自伤风险词识别
- `src/modules/shared/emergency-contact.ts`
  - 风险升级时的安全出口

### 2.2 必须延续的约束

- 探索类问题在正式分析前，先做记忆门槛校验。
- 记忆不足 5 条时，不进入深度探索，先引导用户沉淀记忆。
- `探索心理学` 是唯一例外，不受“至少 5 个记忆碎片”限制。
- 探索输出本身不直接回写主记忆库。
- 记忆库与知识库必须分域，不能混成同一检索池。

## 3. Agent 产品定义

### 3.1 产品名

`心理学空间·自我探索Agent Pro`

### 3.2 交互形态

- 一个主聊天框
- 支持多模态输入：
  - 文档
  - 图片
  - 语音
- 风格接近 `Codex / Trae Work`：
  - 单主线程会话
  - 系统内部做编排
  - 用户只看到统一助手体验

### 3.3 P0 推荐形态

P0 推荐采用：

- 前台单 Agent
- 后台主编排 Agent + 若干内置专家节点

而不是一开始暴露显式多 Agent 对话。

原因：

- 用户只需要一个心理探索入口
- 你的核心复杂度在“规则前置”和“证据召回”
- 后台分工更利于后续迁移到 Java Runtime

## 4. 意图体系

建议先收敛为 5 个一级意图，内部再细分二级意图。

### 4.1 一级意图

1. `memory_create`
   - 沉淀记忆
   - 新增记忆碎片

2. `memory_repair`
   - 修改记忆
   - 删除记忆
   - 合并重复记忆
   - 更正时间、人物、事件描述

3. `psychology_explore`
   - 探索心理学流派
   - 不受 5 条记忆门槛限制

4. `unconscious_explore`
   - 探索潜意识
   - 探索原生家庭
   - 探索关系脚本

5. `root_cause_explore`
   - 探索困扰根因
   - 找触发链路
   - 找重复模式

### 4.2 二级流派标签

`psychology_explore` 下建议增加 `school` 标签：

- `classical_psychoanalysis`
- `object_relations`
- `self_psychology`
- `humanistic_psychology`
- `positive_psychology`
- `mindfulness_psychology`
- `morita_psychology`
- `other_school`

说明：

- 二级流派标签用于 prompt 路由，不等于最终只允许单一流派回答。
- 真正的探索回答可以主次分明，但不应机械堆流派。

## 5. 主编排链路

## 5.1 输入预处理

所有输入先统一进入 `input-normalizer`：

1. 文本直接清洗
2. 图片走视觉解析
3. 语音先转写
4. 文档先抽文本与结构
5. 形成统一 `normalized_input`

输出：

- `plain_text`
- `attachments`
- `modality_summary`

## 5.2 意图识别

意图识别器输出：

- `intent`
- `confidence`
- `school`
- `requires_memory_gate`
- `requires_memory_mutation`
- `requires_knowledge_ingest`

## 5.3 规则分流

### A. 记忆相关意图

进入 `memory-curator` 链路：

1. 解析输入内容
2. 拆分为多个“记忆碎片”
3. 判断每个碎片的：
   - 事件主体
   - 时间线位置
   - 关系对象
   - 情绪色彩
   - 是否与既有记忆冲突
4. 生成新增/修改/删除动作
5. 执行主存储写入
6. 触发 embedding 与向量索引同步

### B. 探索心理学

进入 `psychology-explorer`：

1. 可不经过 5 条门槛
2. 直接围绕流派解释、概念对比、案例映射回答
3. 若用户已有记忆，仍可尝试召回记忆作为例子

### C. 潜意识探索 / 原生家庭 / 困扰根因

进入 `deep-explorer`：

1. 查询记忆碎片数
2. 若 `< 5`，转为“记忆沉淀追问”
3. 若 `>= 5`，先召回相关记忆碎片
4. 必要时补充知识库检索
5. 用 Floyd 风格 system prompt 生成回答

## 6. 多模态与双库策略

## 6.1 双库定义

- `knowledge_base`
  - 存放文档、图片解析、语音转写、附件抽取文本
  - 作用是保留原始知识材料和检索材料

- `memory_fragments`
  - 存放对“用户个人生命经验”有意义的记忆碎片
  - 是心理探索的核心私域依据

## 6.2 多模态入库顺序

当用户上传文档、语音、图片时，统一按以下顺序处理：

1. 多模态解析
2. 解析结果先入 `knowledge_base`
3. 再由 `memory-judge` 判断其中哪些内容构成用户记忆
4. 对记忆部分执行：
   - 新增碎片
   - 修改既有碎片
   - 删除失效碎片
5. 触发 embedding 和向量同步

这是 P0 最关键的链路之一，因为它避免了“附件原文”和“个人记忆”直接混库。

## 6.3 探索时的检索策略

- 探索类回答本身不需要把当轮答案再做 RAG 入库。
- 但在正式探索前，必须优先检索用户的 `memory_fragments`。
- 若用户附带文档上下文，再补充检索 `knowledge_base`。
- 输出时应显式基于“用户已有经历线索”来分析，而不是空泛说教。

## 7. Floyd 人设复刻要求

## 7.1 语气基调

延续现有 Node 后端 Floyd 的气质：

- 温柔
- 克制
- 深切关怀
- 神秘但不装神弄鬼
- 能深入潜意识，但不武断下诊断

## 7.2 系统角色边界

- Floyd 是 AI 自称，不得把用户称为 Floyd。
- 允许在潜意识深描场景中保留少量象征性表达。
- 面对原生家庭、创伤和关系脚本时，必须柔和引导。
- 禁止：
  - 医学诊断
  - 绝对结论
  - 恐吓式表达
  - 伪专业压迫感

## 7.3 回答结构建议

不同意图下的结构不同，但都应满足：

- 有共情承接
- 有基于记忆证据的洞察
- 有可继续深入的问题
- 有明确安全边界

## 8. 推荐的内部专家节点

P0 建议保留以下“内部专家节点”，由主编排流调用：

1. `intent-router`
2. `memory-curator`
3. `memory-judge`
4. `memory-gate`
5. `memory-retriever`
6. `knowledge-retriever`
7. `psychology-school-explorer`
8. `unconscious-explorer`
9. `root-cause-explorer`
10. `risk-guard`
11. `response-polisher`

说明：

- 这些节点在 Dify 中可以映射为分类、条件、HTTP、知识检索、LLM 等节点。
- 到 Java Runtime 阶段，它们可演进为内部原生节点。

## 8.1 P0 角色分层

建议把内部角色再分成三层：

### A. 路由层

- `input-normalizer`
- `intent-router`

职责：

- 统一处理文本与多模态输入
- 决定当前轮到底是在“沉淀记忆”“修复记忆”“探索心理学”还是“深度探索”

### B. 领域层

- `memory-curator`
- `memory-repair-editor`
- `memory-gate-guide`
- `psychology-school-explorer`
- `unconscious-explorer`
- `family-origin-explorer`
- `root-cause-explorer`

职责：

- 真正完成业务内容生成
- 每个角色只处理自己负责的心理任务，不混写

### C. 收口层

- `risk-guard`
- `response-polisher`

职责：

- 风险场景补安全收口
- 统一 Floyd 文风
- 确保 Markdown 可读性与层次感

## 8.2 Prompt 设计原则

后续 prompt 设计统一采用：

- `角色职责`
- `禁止事项`
- `输出结构`
- `证据使用规则`
- `语气规则`

五段式模板。

这样做的价值：

- prompt 更容易 review
- 角色边界更清楚
- Dify 和 Java Runtime 都容易迁移

## 9. Dify 落地策略

## 9.1 运行模式

当前推荐：

- 短期：`Bridge Mode`
- 中期：保留 Dify 作为工作流可视化编排器
- 长期：导入 Java Native Runtime

## 9.2 为什么 P0 不直接把 Dify 当最终运行时

因为你的核心规则并不只是“把节点连起来”，还包括：

- 记忆门槛
- 记忆碎片修复
- 双库隔离
- 审计
- 风险控制
- 计费与运行追踪

这些能力最终都应该收回本地平台统一治理。

## 9.3 Dify 在 P0 的职责

- 用来搭建主聊天工作流
- 用来做意图分类和条件分支
- 用来快速验证 prompt 与节点顺序
- 用来承接未来 DSL 导入/导出

## 9.4 当前这份 DSL 的定位

当前 `docs/dify/self_explore_agent_pro.bridge.draft.yml` 不再以“最小可运行”作为第一目标，而是以“全面编排可视化”作为第一目标。

它的价值在于：

- 让 Dify 画布清楚展示多模态入库、双库分流、记忆门槛、证据拼装、专家分轨和安全收口
- 让后续 Java / Spring AI 迁移时，可以直接把节点职责翻译成 Advisor、Tool 和 Expert Prompt
- 避免在设计阶段被某一版 Dify schema 细节绑死

## 10. P0 工作流建议

建议先做一个主 Chatflow：

`self_explore_agent_pro_bridge`

其主路径如下：

1. `Start`
2. `Intent Classifier`
3. `If memory_create`
4. `If memory_repair`
5. `If psychology_explore`
6. `If unconscious_explore`
7. `If root_cause_explore`
8. `HTTP: memory gate check`
9. `HTTP: memory retrieve`
10. `HTTP: knowledge retrieve`
11. `LLM: Floyd answer`
12. `Answer`

## 11. Java 迁移时的服务映射

建议和现有文档保持一致：

- `agent-orchestrator-service`
  - 一轮编排主入口
- `context-service`
  - 会话上下文
- `memory-service`
  - 记忆碎片主存储与召回
- `knowledge-service`
  - 文档知识库与附件解析结果
- `model-gateway-service`
  - 模型统一路由
- `workflow-runtime-service`
  - Dify DSL 导入、版本管理、执行

## 12. Dify 安装建议

建议把 Dify 放在项目根目录下，例如：

- `dify-local/`

便于：

- 本地调试
- 版本固定
- DSL 文件与工程文档统一管理

推荐步骤：

1. 克隆 Dify 仓库
2. 在 `docker/` 下复制 `.env`
3. 修改 `SECRET_KEY`、初始化密码和端口
4. `docker compose up -d`
5. 打开 `/install`
6. 创建管理员
7. 配置模型供应商
8. 导入本项目 DSL 草案

## 13. 下一步建议

建议按这个顺序推进：

1. 先确认意图体系和规则是否需要调整
2. 再确认 Floyd 的最终人设边界
3. 然后把 `memory-service` 和 `knowledge-service` 的接口先定下来
4. 再继续补全 Dify DSL，使其可导入
5. 最后再决定哪些节点在 Java 侧原生化

## 14. 待你确认的点

以下点一旦确认，我再继续深化：

1. `探索心理学` 是否只做“知识解释”，还是也允许结合用户经历做流派对照分析
2. `记忆碎片` 是否需要增加“置信度/来源类型/时间精度”字段
3. `memory_repair` 是否允许模型直接删除，还是必须二次确认
4. P0 是否先只做一个总工作流，再把“潜意识/原生家庭/困扰根因”作为内部子分支
