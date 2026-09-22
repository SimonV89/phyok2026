# 单台腾讯云轻量服务器 K3s 部署说明

## 适用场景

- 单台腾讯云轻量应用服务器或 CVM
- 不使用 TKE
- 目标是先把 `phyok-java + phyok-node2` 以单机 K8s 方式跑起来

## 为什么选 K3s

- 比标准 Kubernetes 更轻，适合单机和资源受限环境
- 自带 `containerd`、`kubectl`
- 运维复杂度低于自建完整 K8s

## 单机方案特点

- 运行时：`k3s + containerd`
- Ingress：使用 `ingress-nginx`
- 镜像来源：先用 `Docker` 构建，再导入 `k3s containerd`
- 发布方式：`kubectl apply`
- 环境变量来源：统一读取根目录 `env2`，部署时自动同步到 K8s `Secret`
- 默认建议：`ingress-nginx` 使用 `NodePort`，宿主机已有 Nginx 时由宿主机继续处理 `80/443`
- 主站首页 `/` 推荐也接入 `k3s`，由 `chat-web` 提供
- 新系统正式对外接口前缀统一为 `/v2`
- `/app` 仅保留旧链路兼容，不作为新系统主入口

## 服务器建议

- Ubuntu 22.04 LTS
- 至少 4C 8G，建议 8C 16G
- 系统盘建议 80G+
- 腾讯云安全组开放：
  - `80`
  - `443`
  - `6443`

## 部署步骤

1. 安装单机 K3s

```bash
cd /path/to/phyok
chmod +x deploy/scripts/k3s-install.sh
./deploy/scripts/k3s-install.sh
```

如果宿主机已经有主 Nginx 占用 `80/443`，保持默认即可；脚本会把 `ingress-nginx` 暴露到本机 `30080/30443`。

如果你明确希望 `k3s ingress-nginx` 直接占用宿主机 `80/443`，再改用：

```bash
K3S_INGRESS_EXPOSE_MODE=hostNetwork ./deploy/scripts/k3s-install.sh
```

如果宿主机已经有主 Nginx，推荐直接使用：

```bash
./deploy/scripts/k3s-install-host-nginx.sh
```

2. 构建并导入项目镜像

```bash
chmod +x deploy/scripts/k3s-load-images.sh
./deploy/scripts/k3s-load-images.sh node
./deploy/scripts/k3s-load-images.sh java
```

3. 发布到单机 K3s

```bash
chmod +x deploy/scripts/k3s-deploy.sh
PUBLIC_HOST=api.your-domain.com ./deploy/scripts/k3s-deploy.sh all
```

如果你是“宿主机已有主 Nginx”的场景，推荐直接使用：

```bash
PUBLIC_HOST=www.phyok.com ./deploy/scripts/k3s-project-up.sh
```

如果你希望从安装到项目部署一步完成：

```bash
PUBLIC_HOST=www.phyok.com ./deploy/scripts/k3s-all-in-one-host-nginx.sh
```

说明：
- `k3s-deploy.sh` 会先执行 `deploy/scripts/k8s-apply-env.sh`
- 该脚本会把根目录 `env2` 中的最终变量值去重后写入 `phyok-platform-secret`
- Deployment 现在统一通过 `envFrom` 同时注入 `phyok-platform-config` 和 `phyok-platform-secret`

4. 配置 HTTPS 证书

```bash
chmod +x deploy/scripts/k3s-apply-tls.sh
./deploy/scripts/k3s-apply-tls.sh api.your-domain.com /path/to/fullchain.pem /path/to/privkey.pem
```

如果 HTTPS 已由宿主机主 Nginx 处理，这一步通常可以跳过。

5. 查看运行状态

```bash
kubectl get pods -n phyok
kubectl get svc -n phyok
kubectl get ingress -n phyok
```

6. 执行数据库备份

```bash
chmod +x deploy/scripts/k3s-backup-postgres.sh
./deploy/scripts/k3s-backup-postgres.sh
```

7. 安装定时备份与巡检

```bash
chmod +x deploy/scripts/k3s-install-cron.sh deploy/scripts/k3s-healthcheck.sh
BACKUP_CRON="0 3 * * *" HEALTHCHECK_CRON="*/10 * * * *" ./deploy/scripts/k3s-install-cron.sh all
```

## 脚本说明

- `deploy/scripts/k3s-install.sh`
  - 安装 K3s
  - 禁用默认 `traefik`
  - 安装 `ingress-nginx`
  - 默认以 `NodePort` 暴露 `ingress-nginx`
  - 可通过 `K3S_INGRESS_EXPOSE_MODE=hostNetwork` 切换成宿主机直绑 `80/443`

- `deploy/scripts/k3s-load-images.sh`
  - Java 服务通过 `bootBuildImage` 构建镜像
  - Node/Web 通过 `docker build` 构建镜像
  - 构建后自动导入 `k3s containerd`

- `deploy/scripts/k3s-install-host-nginx.sh`
  - 宿主机已有主 Nginx 时的一键安装入口
  - 默认将 `ingress-nginx` 暴露到 `30080/30443`

- `deploy/scripts/k3s-project-up.sh`
  - 一键构建镜像、导入 k3s、发布项目
  - 默认以 `www.phyok.com` 作为 Ingress host

- `deploy/scripts/k3s-all-in-one-host-nginx.sh`
  - 一次完成 `k3s` 安装和项目发布

- `deploy/scripts/k3s-deploy.sh`
  - 按 `node/java/all` 发布 K8s 资源
  - 部署前自动同步根目录 `env2` 到 K8s Secret
  - 单机模式统一缩容到 `1` 个副本
  - 自动 patch Ingress host

- `deploy/scripts/k8s-apply-env.sh`
  - 统一读取根目录 `env2`
  - 按 `env2` 最后一次定义去重
  - 应用 `phyok-platform-config` 与 `phyok-platform-secret`

- `deploy/scripts/k3s-apply-tls.sh`
  - 创建或更新 TLS Secret
  - patch `phyok-platform-ingress` 的 `tls` 配置

- `deploy/scripts/k3s-backup-postgres.sh`
  - 从 `postgres-0` 执行 `pg_dump`
  - 自动压缩并按保留天数清理旧备份

- `deploy/scripts/k3s-healthcheck.sh`
  - 检查 `Deployment` ready 状态
  - 检查 Pod 重启次数
  - 检查服务器磁盘和内存压力
  - 异常时调用 `deploy/scripts/alert.sh`

- `deploy/scripts/k3s-install-cron.sh`
  - 为备份脚本和健康巡检安装 `crontab`
  - 默认每天凌晨 3 点备份、每 10 分钟巡检

- `deploy/scripts/alert.sh`
  - 作为统一告警入口
  - 优先使用本机 `mail` 或 `sendmail`
  - 若未配置邮件发送器，则保底输出告警内容到终端/日志

## 注意事项

- 当前单机 K3s 脚本更适合 `node/java/all`，`web/cms` 还没有完整 K8s 清单。
- 当前项目镜像名沿用 `ghcr.io/your-org/...` 形式，但实际镜像由本地脚本构建并导入，不依赖远端仓库。
- 单机模式下不建议启用 HPA/PDB；本次脚本也没有使用这两类资源。
- 数据库类组件当前仍是单副本，单机故障时不可用，生产期需要配合备份。
- `alert.sh` 是否能真正发邮件，取决于服务器是否装有 `mail`/`sendmail` 以及是否配置了 `ALERT_EMAIL_TO`、`ALERT_EMAIL_FROM`。
- 如果宿主机已经有主 Nginx，请优先参考 [EXISTING_HOST_NGINX_K3S_GUIDE.md](file:///Users/simon.wzb/Desktop/Workbench/mix/phyok/deploy/k8s/EXISTING_HOST_NGINX_K3S_GUIDE.md)。
