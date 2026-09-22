# phyok-node2

《心理学空间·自我探索Agent Pro》新的 Node.js 运行时目录。

当前阶段只保留最小可运行主链路：

- `POST /v2/chat/send`
- `GET /v2/chat/stream/:runId`
- `GET /v2/chat/state`
- `POST /v2/chat/stop`
- `POST /v2/auth/email/send-code`
- `POST /v2/auth/email/verify`
- `GET /v2/billing/account`
- `GET /v2/audits/events/search`
- `GET /health`

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

默认监听 `http://127.0.0.1:3002`。

如果要联通 `phyok-java`，请确保 `.env` 至少包含：

```env
DOMAIN_CLIENT_MODE=http
JAVA_AUTH_BASE_URL=http://127.0.0.1:18081
JAVA_BILLING_BASE_URL=http://127.0.0.1:18085
JAVA_AUDIT_BASE_URL=http://127.0.0.1:18087
```

## 说明

- 当前实现是为前端体验联调准备的独立 BFF runtime
- 重点验证 SSE、停止、断线恢复、thinking 展示、交互动作
- 邮箱登录、计费预检、审计查询已可通过 `phyok-java` 体验
- `/app/*` 仅保留历史兼容
