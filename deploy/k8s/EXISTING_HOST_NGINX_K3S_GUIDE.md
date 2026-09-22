# 宿主机已有 Nginx 时的 K3s 接入说明

## 适用场景

- 宿主机已经有主 Nginx
- `80/443` 和 HTTPS 证书继续由宿主机 Nginx 承担
- `k3s` 只负责运行 `ingress-nginx + phyok` 应用

## 核心原则

- 不让 `ingress-nginx` 抢占宿主机 `80/443`
- 将 `ingress-nginx` 暴露为本机高位端口
- 宿主机 Nginx 继续作为总入口，反代到 `k3s ingress-nginx`
- 主站首页 `/` 也进入 `k3s`，由 `chat-web` 提供
- 新系统正式前缀统一使用 `/v2`
- `/app` 只保留旧链路/兼容语义，不作为新系统主入口

## 推荐端口

- `ingress-nginx` HTTP: `127.0.0.1:30080`
- `ingress-nginx` HTTPS: `127.0.0.1:30443`

通常只需要用到 `30080`，因为 HTTPS 已经在宿主机 Nginx 完成终止。

## 一键安装

推荐直接使用：

```bash
cd /path/to/phyok
./deploy/scripts/k3s-install-host-nginx.sh
```

它等价于：

```bash
cd /path/to/phyok
K3S_INGRESS_EXPOSE_MODE=nodePort \
K3S_INGRESS_HTTP_NODEPORT=30080 \
K3S_INGRESS_HTTPS_NODEPORT=30443 \
./deploy/scripts/k3s-install.sh
```

## 项目一键部署

推荐直接使用：

```bash
cd /path/to/phyok
PUBLIC_HOST=www.phyok.com ./deploy/scripts/k3s-project-up.sh
```

如果你希望从安装到项目发布一步完成：

```bash
cd /path/to/phyok
PUBLIC_HOST=www.phyok.com ./deploy/scripts/k3s-all-in-one-host-nginx.sh
```

## 发布方式

由于你的主站域名是 `www.phyok.com`，部署时建议将 Ingress host 直接 patch 成这个域名：

```bash
PUBLIC_HOST=www.phyok.com ./deploy/scripts/k3s-deploy.sh all
```

## 宿主机 Nginx 改法

推荐直接使用仓库里的完整配置模板：

- [phyok-host-nginx.conf](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/deploy/nginx/phyok-host-nginx.conf)

先新增一个 upstream：

```nginx
upstream phyok_k3s_ingress {
    server 127.0.0.1:30080;
    keepalive 64;
}
```

然后把需要交给 k3s 的新系统路径转发给这个 upstream。基于你当前配置，建议：

```nginx
location / {
    proxy_pass http://phyok_k3s_ingress;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 3600;
    proxy_send_timeout 3600;
}

location ^~ /app/ {
    proxy_pass http://chat_time_legacy_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 3600;
    proxy_send_timeout 3600;
}

location ^~ /v2/ {
    proxy_pass http://phyok_k3s_ingress;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 3600;
    proxy_send_timeout 3600;
}
```

这样：

- `/` 会进入 k3s Ingress，再转发到 `chat-web`
- `/app/*` 继续进入旧链路 `chat_time_legacy_api`
- `/v2/*` 才进入 k3s Ingress，再按具体路径分发到 Java / Node 服务
- `/openclaw/`、`/api/` 等你现有非 k3s 路径可以继续保持原样

## 现有配置里的注意点

- 如果你贴出来的反引号 `` ` `` 就是 Nginx 配置文件原文，需要删掉；`proxy_pass` 和 `return` 语句里不能带反引号。
- 你的主 Nginx 已经处理 HTTPS，所以通常不需要再执行 `deploy/scripts/k3s-apply-tls.sh`。
- 若宿主机启用了防火墙，请确保本机可以访问 `30080/30443`；如果只走本机回环，通常不需要对外开放这两个端口。

## 路由关系

- 宿主机 Nginx：`www.phyok.com:443`
- 反代目标：`127.0.0.1:30080`
- `ingress-nginx`：按 `Host=www.phyok.com` 和 `/`、`/v2/*` 路径规则转发
- `phyok` 应用：`chat-web` / `node2-runtime` / `auth-service` / `memory-service` / `ops-admin-service` 等
