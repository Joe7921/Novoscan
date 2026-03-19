# 环境变量完整参考

本文档包含 Novoscan 所有可用的环境变量及其说明。

> **快速上手**：大多数用户只需复制 `.env.example` 为 `.env.local`，无需修改任何配置即可运行。

---

## Mock AI 模式

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MOCK_AI` | `true` | `true` 使用内置仿真数据；`record` 调用真实 API 并录制；`false` 正常模式 |
| `MOCK_AI_DELAY` | - | 模拟延迟（毫秒），用于测试 loading 状态 |
| `MOCK_AI_ERROR_RATE` | - | 模拟随机错误率（0~1），测试降级逻辑 |

## AI 模型密钥

| 变量 | 说明 | 获取地址 |
|------|------|----------|
| `DEEPSEEK_API_KEY` | DeepSeek V3 / R1（推荐） | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| `DEEPSEEK_BASE_URL` | 默认 `https://api.deepseek.com` | |
| `MINIMAX_API_KEY` | MiniMax 高速推理 | [platform.minimaxi.com](https://platform.minimaxi.com/) |
| `MINIMAX_BASE_URL` | 默认 `https://api.minimax.chat` | |
| `MINIMAX_MODEL` | 默认 `minimax-text-01` | |
| `MOONSHOT_API_KEY` | Moonshot / Kimi 备选 | [platform.moonshot.cn](https://platform.moonshot.cn/console/api-keys) |
| `OLLAMA_BASE_URL` | 本地 Ollama 地址 | [ollama.com](https://ollama.com) |
| `OLLAMA_MODEL` | 默认 `qwen2.5:14b` | |
| `OLLAMA_API_KEY` | 通常留空 | |

## 数据源

### 产业检索

| 变量 | 说明 | 获取地址 |
|------|------|----------|
| `BRAVE_API_KEY` | Brave Search API | [brave.com/search/api](https://brave.com/search/api/) |
| `SERPAPI_KEY` | Google 搜索结构化 API | [serpapi.com](https://serpapi.com/dashboard) |
| `GITHUB_TOKEN` | 开源项目发现 | [github.com/settings/tokens](https://github.com/settings/tokens) |

### 学术检索

| 变量 | 说明 | 获取地址 |
|------|------|----------|
| `CORE_API_KEY` | CORE 开放获取论文 | [core.ac.uk](https://core.ac.uk/services/api) |
| `OPENALEX_EMAIL` | OpenAlex 高速通道 | 填入任意邮箱 |
| `CROSSREF_EMAIL` | CrossRef 高速通道 | 填入任意邮箱 |

> 所有数据源均可通过 `*_BASE_URL` 覆盖默认地址（支持自建镜像/代理）。

## 认证

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AUTH_ENABLED` | `false` | 认证开关，自托管无需登录 |
| `NEXT_PUBLIC_AUTH_ENABLED` | `false` | 前端认证开关（需与 `AUTH_ENABLED` 同步） |
| `AUTH_PROVIDER` | `nextauth` | `nextauth` 或 `supabase` |
| `NEXT_PUBLIC_AUTH_PROVIDER` | `nextauth` | 前端认证提供者 |
| `NEXTAUTH_URL` | `http://localhost:3000` | NextAuth 回调地址 |
| `NEXTAUTH_SECRET` | - | JWT 签名密钥（`openssl rand -base64 32`） |
| `GITHUB_CLIENT_ID` | - | GitHub OAuth App ID |
| `GITHUB_CLIENT_SECRET` | - | GitHub OAuth App Secret |
| `GOOGLE_CLIENT_ID` | - | Google OAuth ID |
| `GOOGLE_CLIENT_SECRET` | - | Google OAuth Secret |

## 数据库

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_PROVIDER` | `postgres` | `postgres` 或 `supabase` |
| `DATABASE_URL` | - | PostgreSQL 连接串 |
| `NEXT_PUBLIC_SUPABASE_URL` | - | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | - | Supabase 匿名 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | - | Supabase 服务角色 Key |

## Redis & 速率限制

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `UPSTASH_REDIS_REST_URL` | - | Upstash Redis URL（不配置则内存回退） |
| `UPSTASH_REDIS_REST_TOKEN` | - | Upstash Redis Token |

## 其他服务

| 变量 | 说明 |
|------|------|
| `CRON_SECRET` | Cron 定时任务鉴权密钥 |
| `CRON_WEBHOOK_URL` | Cron 通知推送（飞书/Slack/企业微信） |
| `MCP_API_KEYS` | MCP 服务鉴权（格式：`key:email,key2:email2`） |
| `RESEND_API_KEY` | 邮件推送（Resend） |
| `ADMIN_SECRET` | Admin API 鉴权密钥 |
| `FINOPS_PRICING` | 自定义 AI 费率（JSON 格式） |
| `NEXT_PUBLIC_SITE_URL` | 站点公开域名 |
| `NEXT_PUBLIC_MARKETPLACE_API` | 插件市场 API 地址 |
| `CORS_ALLOWED_ORIGINS` | CORS 允许的域名列表 |

## Docker 专用

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `POSTGRES_DB` | `novoscan` | PostgreSQL 数据库名 |
| `POSTGRES_USER` | `novoscan` | PostgreSQL 用户名 |
| `POSTGRES_PASSWORD` | `novoscan_secret_2026` | PostgreSQL 密码 |
| `POSTGRES_PORT` | `5432` | PostgreSQL 映射端口 |
| `REDIS_PORT` | `6379` | Redis 映射端口 |
| `APP_PORT` | `3000` | 应用映射端口 |
