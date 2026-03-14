-- ============================================================
-- Novoscan 数据库迁移 v008
-- 创新扩展：DNA 指纹 + IDEA 画像 + 创新评测 + 追问会话
-- 来源：innovation_dna_setup.sql, 20260310_idea_profile.sql,
--       20260309_novomind_assessments.sql, 20260304_followup_sessions.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 创新 DNA 指纹（依赖 innovations 表）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS innovation_dna (
    id SERIAL PRIMARY KEY,
    innovation_id INT REFERENCES innovations(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    tech_principle REAL NOT NULL DEFAULT 0.5,
    app_scenario REAL NOT NULL DEFAULT 0.5,
    target_user REAL NOT NULL DEFAULT 0.5,
    impl_path REAL NOT NULL DEFAULT 0.5,
    biz_model REAL NOT NULL DEFAULT 0.5,
    reasoning JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(query_hash)
);

CREATE INDEX IF NOT EXISTS idx_innovation_dna_query_hash ON innovation_dna(query_hash);
CREATE INDEX IF NOT EXISTS idx_innovation_dna_innovation_id ON innovation_dna(innovation_id);
CREATE INDEX IF NOT EXISTS idx_innovation_dna_vector ON innovation_dna(tech_principle, app_scenario, target_user, impl_path, biz_model);

-- ────────────────────────────────────────────────────────────
-- IDEA 创新人格画像
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_idea_profile (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    stated_v REAL DEFAULT 50,
    stated_d REAL DEFAULT 50,
    stated_p REAL DEFAULT 50,
    stated_s REAL DEFAULT 50,
    stated_archetype VARCHAR(4),
    stated_archetype_name TEXT,
    stated_evidence JSONB,
    stated_at TIMESTAMPTZ,
    behavior_v REAL DEFAULT 50,
    behavior_d REAL DEFAULT 50,
    behavior_p REAL DEFAULT 50,
    behavior_s REAL DEFAULT 50,
    behavior_archetype VARCHAR(4),
    behavior_data_points INT DEFAULT 0,
    final_v REAL DEFAULT 50,
    final_d REAL DEFAULT 50,
    final_p REAL DEFAULT 50,
    final_s REAL DEFAULT 50,
    final_archetype VARCHAR(4),
    final_archetype_name TEXT,
    confidence REAL DEFAULT 0,
    divergence_unlocked BOOLEAN DEFAULT FALSE,
    divergence_report JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idea_profile_archetype ON user_idea_profile(final_archetype);

-- ────────────────────────────────────────────────────────────
-- 创新人格评测
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS novomind_assessments (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    assessment_data JSONB NOT NULL,
    overall_score FLOAT DEFAULT 0,
    conversation_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_novomind_user_id ON novomind_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_novomind_created ON novomind_assessments(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 追问会话
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS followup_sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_search_id BIGINT,
    original_query TEXT NOT NULL,
    followup_questions JSONB NOT NULL DEFAULT '[]',
    selected_questions JSONB DEFAULT '[]',
    user_input TEXT,
    refined_result JSONB,
    round SMALLINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followup_parent ON followup_sessions(parent_search_id);
CREATE INDEX IF NOT EXISTS idx_followup_created ON followup_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_followup_query ON followup_sessions(original_query);

SELECT '✅ [v008] 创新扩展表创建完成' AS status;
