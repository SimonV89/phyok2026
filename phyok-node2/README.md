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

## 图片理解与存储

- 聊天图片先由 Node 上传至腾讯云 COS 的 `<TENCENT_COS_PATH_PREFIX>/chat-images/`，再由视觉模型通过 20 分钟有效的私有对象签名 URL 读取；不会把 base64 图片发送给模型。
- 在根目录 `env2` 配置 `TENCENT_COS_SECRET_ID`、`TENCENT_COS_SECRET_KEY`、`TENCENT_COS_BUCKET`、`TENCENT_COS_REGION` 和 `TENCENT_COS_PATH_PREFIX`。密钥仅由服务端读取，不能提交至 Git 或返回给前端。`TENCENT_COS_PUBLIC_BASE_URL` 不用于私有图片签名。
- COS 密钥至少需要对应前缀的写入和读取权限；存储桶保持私有，上传时对象 ACL 也设为私有。签名地址仅发送给视觉模型，不写入聊天历史或日志。
- **务必在 COS 控制台为 `chat-images/` 对应前缀设置自动过期清理规则**（例如 1 天）；签名 URL 过期不会删除存储的图片，当前服务端也未实现持久化的对象清理任务。
- 图片识别成功后，最终文本模型只接收视觉模型生成的事实摘要；识别失败会明确提示，不会假装已理解图片。部署前需确认所配置的视觉及最终文本模型均可用。
