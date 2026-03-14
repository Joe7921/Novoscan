# Novoscan 数据库迁移

## 目录结构

所有 SQL 迁移文件按版本号排序，依次执行。

| 版本号 | 文件名 | 说明 |
|--------|--------|------|
| 000 | `000_extensions_and_auth.sql` | PostgreSQL 扩展 + 模拟 auth schema |
| 001 | `001_core_tables.sql` | 核心基础表（innovations, search_history） |
| 002 | `002_user_system.sql` | 用户画像 + 注册触发器 |
| 003 | `003_agent_memory.sql` | Agent 记忆进化系统 |
| 004 | `004_feature_system.sql` | 功能权限 + 兑换码 + 签到 + 订阅 |
| 005 | `005_tracker.sql` | NovoTracker 持续监控 |
| 006 | `006_casevault_mcp.sql` | CaseVault 案例库 + MCP 密钥 |
| 007 | `007_social.sql` | 公开报告 + 邀请裂变 + 合作伙伴 |
| 008 | `008_innovation_extras.sql` | 创新 DNA + IDEA 画像 + 评测 + 追问 |
| 009 | `009_seed_data.sql` | 种子数据（兑换码、测试密钥） |

## 使用方式

### Docker（推荐）

`docker-compose.yml` 已将 `./migrations` 挂载到 PostgreSQL 的 `/docker-entrypoint-initdb.d/`，
**首次启动时自动按文件名排序依次执行**。

```bash
# 首次启动（自动执行所有迁移）
docker compose up -d

# 重置数据库并重新执行迁移
docker compose down -v
docker compose up -d
```

### 手动执行

```bash
# 使用 psql 逐个执行
psql -h localhost -U novoscan -d novoscan -f migrations/000_extensions_and_auth.sql
psql -h localhost -U novoscan -d novoscan -f migrations/001_core_tables.sql
# ... 依次执行

# 或使用迁移脚本（需要 psql）
bash scripts/migrate.sh
```

## 添加新迁移

1. 取当前最大版本号 +1，格式为三位数：`010_xxx.sql`
2. 文件名使用小写字母 + 下划线，简要描述改动内容
3. **必须**使用 `CREATE ... IF NOT EXISTS` 保证幂等
4. **必须**在文件顶部注释中说明来源和用途
5. 将新文件添加到上方表格中

## 设计原则

- **幂等**：所有语句使用 `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`，可安全重复执行
- **顺序**：按版本号决定执行顺序，低版本不得依赖高版本的表
- **单一职责**：每个文件围绕一个功能模块，而非一个日期
