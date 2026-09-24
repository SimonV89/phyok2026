# 运维部署

> 涉及 Docker、K3s、部署脚本、环境变量时必须遵守的规范。

## 环境变量管理

- 所有运行时凭据必须维护在根目录 `env2` 文件中
- `env2` 严格排除 Git 版本控制
- 本地调试优先使用 `localhost` + 端口
- 通过 `.local` 覆盖文件区分本地与生产环境配置

## K3s 增量部署

当只有部分服务变更时，使用**定向构建**避免全量重发：

```bash
# 仅构建并导入 chat-web 镜像
./deploy/scripts/k3s-load-images.sh web chat-web

# 仅发布 web 服务（不触发 java/node）
PUBLIC_HOST=www.phyok.com ./deploy/scripts/k3s-deploy.sh web
```

支持的增量分组：`web`、`node`、`java`、`all`

## 一键部署命令

### 宿主机已有 Nginx（推荐）

```bash
./deploy/scripts/k3s-install-host-nginx.sh
PUBLIC_HOST=www.phyok.com ./deploy/scripts/k3s-project-up.sh
```

### 从安装到发布一步完成

```bash
PUBLIC_HOST=www.phyok.com ./deploy/scripts/k3s-all-in-one-host-nginx.sh
```

## 前端缓存清理

在执行部署脚本前，必须**强制清理 Next.js `.next` 缓存**：

- `k3s-load-images.sh` 中的 `build_web_image` 函数已自动执行此操作
- 本地开发如遇缓存问题：手动 `rm -rf phyok-web/apps/chat-web/.next`

## 镜像源策略

- **安装源**：k3s 走国内 Rancher China 镜像
- **Docker Hub 镜像**：优先走腾讯云镜像加速
- **构建参数**：通过 `NPM_REGISTRY` 传入，默认 `https://registry.npmmirror.com`

## 紧急单服务更新

针对 `memory-service` 或 `billing-service` 的紧急更新：

```bash
# 重建并导入镜像
./deploy/scripts/k3s-load-images.sh java memory-service

# 重启对应 deployment
kubectl rollout restart deployment/phyok-memory-service -n phyok
```

## Flyway 状态恢复

当 Flyway 历史记录与业务表冲突导致 500 错误时：

```bash
# 连接数据库，删除历史表和业务表
kubectl exec -it -n phyok deploy/memory-service -- \
  psql -U phyok -d phyok -c "DROP TABLE IF EXISTS flyway_schema_history, memory_fragment CASCADE;"
```

然后重启服务自动触发重新迁移。

## 相关文档

- [doc/1.服务端架构/K3s单节点部署指南.md](../doc/1.服务端架构/K3s单节点部署指南.md)
- [doc/1.服务端架构/K3s与Nginx集成指南.md](../doc/1.服务端架构/K3s与Nginx集成指南.md)
