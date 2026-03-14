#!/usr/bin/env bash
# ============================================================
# Novoscan — 数据库迁移运行器
#
# 用法：
#   bash scripts/migrate.sh [--dry-run]
#
# 依赖：psql 客户端
# 环境变量（可选，未设置时使用默认值）：
#   PGHOST     — 数据库主机（默认 localhost）
#   PGPORT     — 数据库端口（默认 5432）
#   PGUSER     — 数据库用户（默认 novoscan）
#   PGPASSWORD — 数据库密码（默认 novoscan_secret_2026）
#   PGDATABASE — 数据库名（默认 novoscan）
# ============================================================

set -euo pipefail

# ── 配置 ──
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-novoscan}"
PGPASSWORD="${PGPASSWORD:-novoscan_secret_2026}"
PGDATABASE="${PGDATABASE:-novoscan}"
export PGPASSWORD

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "🔍 Dry-run 模式 — 仅显示待执行迁移，不实际执行"
    echo ""
fi

# ── 创建版本跟踪表 ──
if [[ "$DRY_RUN" == false ]]; then
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -q <<'EOF'
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
EOF
fi

# ── 获取已执行版本 ──
if [[ "$DRY_RUN" == false ]]; then
    EXECUTED=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        -t -A -c "SELECT version FROM schema_migrations ORDER BY version;")
else
    EXECUTED=""
fi

# ── 遍历迁移文件 ──
PENDING=0
APPLIED=0

for file in "$MIGRATIONS_DIR"/*.sql; do
    filename=$(basename "$file")
    # 提取版本号（文件名开头的数字部分）
    version=$(echo "$filename" | grep -oP '^\d+')

    if echo "$EXECUTED" | grep -qx "$version" 2>/dev/null; then
        echo "  ✓ [v${version}] ${filename} — 已执行，跳过"
        continue
    fi

    PENDING=$((PENDING + 1))

    if [[ "$DRY_RUN" == true ]]; then
        echo "  ⏳ [v${version}] ${filename} — 待执行"
    else
        echo "  ▶ [v${version}] ${filename} — 执行中..."
        psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
            -v ON_ERROR_STOP=1 -f "$file"

        # 记录版本
        psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -q \
            -c "INSERT INTO schema_migrations (version, filename) VALUES ('$version', '$filename') ON CONFLICT (version) DO NOTHING;"

        APPLIED=$((APPLIED + 1))
        echo "  ✅ [v${version}] ${filename} — 完成"
    fi
done

echo ""
if [[ "$DRY_RUN" == true ]]; then
    echo "📊 共 ${PENDING} 个迁移待执行。使用不带 --dry-run 执行。"
else
    if [[ $APPLIED -eq 0 ]]; then
        echo "📊 数据库已是最新，无需迁移。"
    else
        echo "📊 成功执行 ${APPLIED} 个迁移。"
    fi
fi
