# 心理自愈 Pro - Node 服务端架构（Step 1）

## 栈选型

- Runtime: Node.js 22 LTS
- Framework: Fastify 5.8.x
- Language: TypeScript 5.9.x
- Database: MongoDB 7.x
- Auth: Email code + JWT (jose 6.x)
- Mail: Nodemailer 8.x (SMTP)
- Validation: Zod 4.x

## 目录

- `src/config`: 环境配置
- `src/db`: Mongo 连接
- `src/modules/auth`: 登录鉴权
- `src/modules/pay`: 订单概览（当前为基础版）
- `src/modules/privacy`: 无痕清理与注销
- `src/modules/rag`: RAG 路由骨架
- `src/modules/vector`: 向量检索骨架

## API 前缀

所有接口统一前缀 `/app`。

## 与 openclaw-memory-bank 对齐点

- 用户模型和 `subscription` 字段结构
- Email 验证码登录流程（send / verify）
- `me / clear-traces / delete-data` 这类账户能力
- 预留 RAG/向量化目录与环境变量
