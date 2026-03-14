# OpenClaw 巡检部署指南

## 文件说明

`admin-cli/deploy/` 目录包含部署到 OpenClaw 服务器的文件：

- `inspect.mjs` — 巡检脚本（直连 Supabase → JSON 报告）
- `package.json` — 依赖声明
- `cron-prompt.md` — OpenClaw Cron 任务的 Agent Prompt

## 部署步骤

### 1. 上传脚本到服务器

```bash
# 在服务器上创建目录
mkdir -p /root/.openclaw/workspace/novoscan-inspect

# 复制文件（从本地项目）
scp admin-cli/deploy/inspect.mjs admin-cli/deploy/package.json root@<你的服务器>:/root/.openclaw/workspace/novoscan-inspect/
```

### 2. 创建 .env 文件

```bash
# 在服务器上
cat > /root/.openclaw/workspace/novoscan-inspect/.env << EOF
SUPABASE_URL=<你的 Supabase 项目 URL>
SUPABASE_SERVICE_ROLE_KEY=<你的 Service Role Key>
EOF
```

### 3. 安装依赖

```bash
cd /root/.openclaw/workspace/novoscan-inspect && npm install
```

### 4. 测试运行

```bash
node /root/.openclaw/workspace/novoscan-inspect/inspect.mjs
```

### 5. 创建 OpenClaw Cron 任务

```bash
openclaw cron add
```

使用 `cron-prompt.md` 中的 Prompt 内容。
