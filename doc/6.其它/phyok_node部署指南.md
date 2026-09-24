# phyok-node 部署指南（同旧项目服务器）

本指南默认你要把 `phyok-node` 和 `openclaw-memory-bank` 部署在同一台 Linux 服务器。

## 1. 服务器准备

- Docker + Docker Compose 可用
- 已可访问项目代码仓库
- 服务器放行 `80/443`（公网），`43001/27018` 仅建议内网或本机访问

## 2. 环境变量

```bash
cp env.server.example .env
```

重点检查：

- `MONGO_ROOT_PASSWORD`：和旧项目一致（你要求的“密码跟原来一样”）
- `MONGODB_URI`：使用 `mongodb:27017`（容器内网络）
- `AUTH_SECRET`：生产强密钥
- `SILICONFLOW_API_KEY`、`TENCENT_SES_*`、`APPLE_IAP_SHARED_SECRET`

## 3. 一键部署（同旧项目风格）

```bash
./scripts/deploy.sh
```

它会做三件核心事：

- 本地构建 `phyok-node:local` 镜像
- 启动 `phyok-mongo-db`（MongoDB）
- 启动 `phyok-node`（Fastify，容器内端口 `43001`）

## 4. 状态检查

```bash
docker compose ps
curl -fsSL http://127.0.0.1:43001/app/health
```

## 5. Nginx 反代（与旧站统一域名）

如果前端域名仍是 `https://www.phyok.com`，建议沿用旧站 Nginx，在对应 `server` 块里增加：

```nginx
location /app/ {
    proxy_pass http://127.0.0.1:43001/app/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    proxy_buffering off;
}
```

重载：

```bash
nginx -t && sudo systemctl reload nginx
```

## 6. 常用命令

```bash
# 仅起 Mongo（开发）
./scripts/dev-services.sh

# 只重启后端容器
COMPOSE_PROFILES=prod docker compose up -d app

# 看日志
COMPOSE_PROFILES=prod docker compose logs -f --tail 200 app mongodb
```
