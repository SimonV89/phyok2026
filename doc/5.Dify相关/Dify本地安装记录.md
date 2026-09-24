# Dify 本地安装记录

## 1. 目标

把 Dify 安装到当前项目根目录下的：

- `/Users/simon.wzb/Desktop/Workbench/mix/phyok/dify-local`

用于：

- 本地调试 Chatflow
- 导入《心理学空间·自我探索Agent Pro》DSL
- 后续做 Bridge Mode 验证

## 2. 当前环境检查

已确认本机具备以下基础能力：

- `docker --version`
  - `Docker version 28.3.2`
- `docker compose version`
  - `Docker Compose version v2.38.2-desktop.1`
- `git --version`
  - `git version 2.54.0`
- `jq --version`
  - `jq-1.7.1-apple`

结论：

- 本机依赖满足 Dify 自托管基本要求
- 当前主要阻塞不在本机，而在外网拉取 GitHub 仓库

## 3. 已执行但失败的命令

### 3.1 动态拉取最新 release

```bash
git clone --branch "$(curl -s https://api.github.com/repos/langgenius/dify/releases/latest | jq -r .tag_name)" https://github.com/langgenius/dify.git dify-local
```

现象：

- 拉取过程长时间卡住

### 3.2 改为 shallow clone

```bash
git clone --depth 1 https://github.com/langgenius/dify.git dify-local
```

报错：

```text
fatal: unable to access 'https://github.com/langgenius/dify.git/': Error in the HTTP2 framing layer
```

### 3.3 强制 HTTP/1.1 再试

```bash
git -c http.version=HTTP/1.1 clone --depth 1 https://github.com/langgenius/dify.git dify-local
```

报错：

```text
fatal: unable to access 'https://github.com/langgenius/dify.git/': Failed to connect to github.com port 443 after 75054 ms: Couldn't connect to server
```

## 4. 当前结论

本次没有完成 Dify 仓库拉取，原因是：

- 当前运行环境到 `github.com:443` 的网络连接失败

这不是项目配置错误，也不是 Docker 问题。

## 5. 建议的继续方案

优先级从高到低如下：

### 方案 A：你提供 GitHub 代理或镜像

适合你本机已有：

- 代理网络
- 公司镜像
- GitHub 镜像域名

我拿到可用地址后可以继续直接安装。

### 方案 B：你本机手动把 Dify 仓库放到 `dify-local/`

你可以在本机终端成功拉下后，保持目录为：

```bash
/Users/simon.wzb/Desktop/Workbench/mix/phyok/dify-local
```

然后我继续做：

1. 复制 `docker/.env`
2. 调整初始化变量
3. 启动 `docker compose`
4. 检查容器健康状态
5. 指导导入 DSL

### 方案 C：后续改为直接使用你已有的 Dify 实例

如果你已经有一套 Dify 环境，也可以直接跳过本地安装，先做：

- DSL 修正
- 节点映射
- Bridge API 对接

## 6. 成功拉到仓库后的标准步骤

以下步骤保留，等网络恢复后直接执行：

### 6.1 进入 docker 目录

```bash
cd /Users/simon.wzb/Desktop/Workbench/mix/phyok/dify-local/docker
```

### 6.2 复制环境文件

```bash
cp .env.example .env
```

### 6.3 生成新的 SECRET_KEY

```bash
openssl rand -base64 42
```

把生成值写入 `.env` 中的 `SECRET_KEY`。

建议同时处理：

- `INIT_PASSWORD`
- `CONSOLE_WEB_URL`
- `CONSOLE_API_URL`
- 如需自定义端口，再检查 Nginx 与暴露端口

### 6.4 启动 Dify

```bash
docker compose up -d
```

### 6.5 检查状态

```bash
docker compose ps
docker compose logs --tail=100
```

### 6.6 首次初始化

浏览器打开：

```text
http://localhost/install
```

完成：

1. 创建管理员
2. 配置模型供应商
3. 新建或导入 Chatflow

## 7. 和本项目的衔接方式

当 Dify 启动后，建议优先做两件事：

1. 新建一个 `Bridge Mode` Chatflow
2. 导入当前仓库内的 DSL 草案：

```text
phyok-node/docs/dify/self_explore_agent_pro.bridge.draft.yml
```

说明：

- 当前草案先表达节点结构与编排意图
- 待本地 Dify 实例可用后，再按实际导出 schema 对齐

## 8. 访问地址说明

### 8.1 当前真实状态

当前没有可访问的 Dify 地址。

原因：

- 项目根目录下没有成功拉下 `dify-local/`
- 当前没有运行中的 Dify 容器

因此此刻不存在一个可实际打开的本地 Dify 页面地址。

### 8.2 安装成功后的默认访问地址

如果后续按默认方式成功启动 Dify，本地首次访问地址通常是：

```text
http://localhost/install
```

完成初始化后，常见访问入口是：

```text
http://localhost
```

### 8.3 如果你使用了自定义端口

那访问地址会变成类似：

```text
http://localhost:端口号/install
http://localhost:端口号
```

具体取决于 `docker/.env` 和反向代理端口配置。
