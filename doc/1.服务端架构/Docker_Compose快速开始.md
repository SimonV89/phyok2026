# Docker Compose Quick Start

## 目标

这套 Compose 以“可完整体验核心功能”为目标，默认覆盖：

- `chat-web` 前端聊天界面
- `phyok-node2` BFF
- `phyok-java` 的 `auth-service` / `billing-service` / `audit-service`
- PostgreSQL / Redis / Kafka / Qdrant

当前不包含 CMS。

## 启动方式

1. 优先使用根目录统一环境文件 `env2`，并确认其中已包含腾讯云 SES 变量：

```bash
grep 'TENCENT_SES_' ../../env2
```

2. 直接通过部署脚本启动，这也是推荐入口：

```bash
../../deploy/scripts/deploy.sh all
```

3. 如果需要手动执行 `docker compose`，同样使用根目录 `env2`：

```bash
docker compose -f docker-compose.prod.yml --env-file ../../env2 up --build
```

4. 仅在你想做一份独立示例配置时，才参考 `../env/.env.example`：

- `TENCENT_SES_SECRET_ID`
- `TENCENT_SES_SECRET_KEY`
- `TENCENT_SES_FROM_EMAIL`
- `TENCENT_SES_TEMPLATE_EN`
- `TENCENT_SES_TEMPLATE_ZH`

## 默认体验入口

- 前端: `http://127.0.0.1:3001`
- Node2 BFF: `http://127.0.0.1:3002`
- Auth Service: `http://127.0.0.1:18081`
- Billing Service: `http://127.0.0.1:18085`
- Audit Service: `http://127.0.0.1:18087`

## 体验顺序

1. 打开首页
2. 进入“邮箱登录”
3. 收验证码并登录
4. 返回聊天页发起一轮对话
5. 在首页左侧查看计费摘要和最近审计事件
