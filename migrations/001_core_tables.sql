-- ============================================================
-- Novoscan 数据库迁移 v001
-- 核心基础表 — 被其他表引用的上游依赖
-- 来源：innovations, search_history, profiles
-- ============================================================

-- ── innovations（被 innovation_dna 引用）──
CREATE TABLE IF NOT EXISTS innovations (
    id SERIAL PRIMARY KEY,
    keyword TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '通用',
    novelty_score REAL NOT NULL DEFAULT 50,
    search_count INT DEFAULT 1,
    source_type TEXT DEFAULT 'search',
    related_fields TEXT[] DEFAULT '{}',
    domain_id TEXT,
    sub_domain_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_innovations_keyword ON innovations(keyword);
CREATE INDEX IF NOT EXISTS idx_innovations_category ON innovations(category);
CREATE INDEX IF NOT EXISTS idx_innovations_domain ON innovations(domain_id);

-- ── search_history（被多处引用）──
CREATE TABLE IF NOT EXISTS search_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    result_json JSONB,
    novelty_score REAL,
    model_used TEXT,
    searched_at TIMESTAMPTZ DEFAULT now(),
    professional_report JSONB DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_time ON search_history(searched_at DESC);

COMMENT ON COLUMN search_history.professional_report IS '后台预生成的专业PDF报告数据(JSON)，搜索完成后自动触发生成';

-- ── profiles（旧表，保留兼容性）──
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE profiles IS '⚠️ DEPRECATED — 已被 user_profiles 替代。';

SELECT '✅ [v001] 核心基础表创建完成' AS status;
