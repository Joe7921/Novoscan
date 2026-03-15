# 🐳 Novoscan Docker 快速启动指南

通过 Docker Compose 一键启动完整的 Novoscan 开发/自部署环境，包含 PostgreSQL 数据库、Redis 缓存和 Next.js 应用。

## 前置条件

- [Docker](https://docs.docker.com/get-docker/) >= 20.10
- [Docker Compose](https://docs.docker.com/compose/install/) >= 2.0（Docker Desktop 已内置）
- 至少 4GB 可用内存

## 一键启动

```bash
# 1. 克隆项目
git clone https://github.com/Joe7921/Novoscan.git
cd Novoscan

# 2. 复制环境变量模板
cp .env.docker .env

# 3. 启动所有服务（Mock AI 默认开启，无需 API Key！）
docker compose up -d

# 4. 查看启动日志
docker compose logs -f

# 5. 访问应用
# 🌐 http://localhost:3000
```

> 🎉 **零配置即可体验！** Mock AI 模式已在 `.env.docker` 中默认开启。
> 准备接入真实 AI？编辑 `.env`，将 `MOCK_AI` 改为 `false` 并填入至少一个 AI 模型密钥。

## 服务架构

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| **db** | `postgres:16-alpine` | 5432 | PostgreSQL 数据库，自动执行 `migrations/` 初始化 |
| **redis** | `redis:7-alpine` | 6379 | Redis 缓存，AOF 持久化 |
| **app** | 自构建（Dockerfile） | 3000 | Next.js 应用（standalone 模式） |

## 常用命令

```bash
# 启动所有服务（后台运行）
docker compose up -d

# 查看实时日志
docker compose logs -f

# 仅查看应用日志
docker compose logs -f app

# 停止所有服务（保留数据）
docker compose down

# 停止并清除所有数据（⚠️ 会删除数据库数据！）
docker compose down -v

# 重新构建应用镜像（代码更新后）
docker compose build app
docker compose up -d app

# 进入数据库 CLI
docker compose exec db psql -U novoscan -d novoscan

# 进入 Redis CLI
docker compose exec redis redis-cli
```

## 环境变量说明

`.env.docker` 模板中的关键配置项：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `postgresql://novoscan:...@db:5432/novoscan` | 数据库连接 URL |
| `DATABASE_PROVIDER` | `postgres` | 数据库提供者（`postgres` / `supabase`） |
| `REDIS_URL` | `redis://redis:6379` | Redis 连接 URL |
| `AUTH_PROVIDER` | `nextauth` | 认证提供者（`nextauth` / `supabase`） |
| `AUTH_SECRET` | `please-change-me-in-production` | NextAuth 密钥（⚠️ 生产必改） |
| `DEEPSEEK_API_KEY` | 空 | AI 模型密钥（至少配置一个） |

> **⚠️ 安全提示**：生产环境务必修改 `POSTGRES_PASSWORD` 和 `AUTH_SECRET`！

## 数据库初始化

首次启动时，PostgreSQL 容器会自动执行 `migrations/` 目录下的 SQL 文件（按文件名排序）：

```
000_extensions_and_auth.sql  — 扩展 + auth schema
001_core_tables.sql          — 核心表（innovations, search_history）
002_user_system.sql          — 用户系统
003_agent_memory.sql         — Agent 记忆
004_feature_system.sql       — 功能系统
005_tracker.sql              — 跟踪器
006_casevault_mcp.sql        — CaseVault + MCP
007_social.sql               — 社交功能
008_innovation_extras.sql    — 创新附加表
009_seed_data.sql            — 种子数据
```

> **注意**：初始化脚本仅在数据库**首次创建**时执行。如需重新初始化，请先执行 `docker compose down -v` 清除数据卷。

## 故障排除

### 应用启动失败

```bash
# 查看应用日志
docker compose logs app

# 确认数据库已就绪
docker compose exec db pg_isready -U novoscan
```

### 端口被占用

修改 `.env` 中的端口映射：
```env
APP_PORT=3001         # 应用端口改为 3001
POSTGRES_PORT=5433    # 数据库端口改为 5433
REDIS_PORT=6380       # Redis 端口改为 6380
```

### 重新构建镜像

```bash
docker compose build --no-cache app
docker compose up -d
```

### 重置数据库

```bash
docker compose down -v          # 清除所有数据卷
docker compose up -d            # 重新启动（会重新初始化数据库）
```
