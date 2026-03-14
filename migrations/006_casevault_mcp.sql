-- ============================================================
-- Novoscan 数据库迁移 v006
-- CaseVault 案例库 + MCP API Key 管理
-- 来源：docker/init-db/03-casevault.sql, supabase/mcp_setup.sql,
--       20260310_unify_mcp_api_keys.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- CaseVault 案例库
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS case_library (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    original_content TEXT NOT NULL,
    source_url TEXT,
    source_type TEXT NOT NULL CHECK (source_type IN ('wechat', 'web', 'github', 'clawhub', 'user_idea')),
    industry TEXT NOT NULL DEFAULT '通用',
    tags TEXT[] DEFAULT '{}',
    capabilities TEXT[] DEFAULT '{}',
    technology_stack TEXT[] DEFAULT '{}',
    deployment_scale TEXT,
    maturity TEXT NOT NULL DEFAULT 'concept' CHECK (maturity IN ('concept', 'poc', 'production', 'scale')),
    quality_score INTEGER NOT NULL DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
    content_hash TEXT NOT NULL,
    author TEXT,
    publish_date TEXT,
    harvested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_library_content_hash ON case_library (content_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_library_source_url ON case_library (source_url) WHERE source_url IS NOT NULL AND source_url != '';
CREATE INDEX IF NOT EXISTS idx_case_library_industry_quality ON case_library (industry, quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_case_library_source_type ON case_library (source_type);
CREATE INDEX IF NOT EXISTS idx_case_library_fulltext ON case_library USING GIN (to_tsvector('simple', title || ' ' || summary));

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_case_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_case_library_updated_at ON case_library;
CREATE TRIGGER trigger_case_library_updated_at
    BEFORE UPDATE ON case_library
    FOR EACH ROW
    EXECUTE FUNCTION update_case_library_updated_at();

-- ────────────────────────────────────────────────────────────
-- MCP API Key 管理
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mcp_api_keys (
    id BIGSERIAL PRIMARY KEY,
    api_key TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    user_name TEXT,
    label TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    daily_limit INT NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_key ON mcp_api_keys (api_key);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_user_id ON mcp_api_keys(user_id);

CREATE TABLE IF NOT EXISTS mcp_usage_log (
    id BIGSERIAL PRIMARY KEY,
    api_key_id BIGINT NOT NULL REFERENCES mcp_api_keys(id),
    user_email TEXT NOT NULL,
    query_preview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_usage_log_daily ON mcp_usage_log (api_key_id, created_at);

-- 便捷函数：授予 MCP Key
CREATE OR REPLACE FUNCTION grant_mcp_key(user_email TEXT, key TEXT, key_label TEXT DEFAULT '开发密钥')
RETURNS TEXT AS $$
DECLARE
    uid UUID;
BEGIN
    SELECT id INTO uid FROM auth.users WHERE email = user_email LIMIT 1;
    IF uid IS NULL THEN
        RETURN '❌ 未找到邮箱为 ' || user_email || ' 的用户';
    END IF;
    INSERT INTO mcp_api_keys (api_key, user_id, label)
    VALUES (key, uid, key_label)
    ON CONFLICT (api_key) DO NOTHING;
    RETURN '✅ 已为 ' || user_email || ' 创建 MCP Key';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT '✅ [v006] CaseVault 案例库 + MCP 密钥管理创建完成' AS status;
