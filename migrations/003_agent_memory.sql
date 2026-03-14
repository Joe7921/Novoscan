-- ============================================================
-- Novoscan 数据库迁移 v003
-- Agent 记忆进化系统
-- 来源：20260305_agent_memory.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_experiences (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    domain_id TEXT,
    sub_domain_id TEXT,
    agent_judgments JSONB NOT NULL DEFAULT '{}',
    final_score REAL NOT NULL DEFAULT 50,
    recommendation TEXT NOT NULL DEFAULT '',
    lessons_learned TEXT[] DEFAULT '{}',
    quality_flags TEXT[] DEFAULT '{}',
    debate_summary TEXT DEFAULT '',
    tags TEXT[] DEFAULT '{}',
    search_vector tsvector,
    usefulness_score REAL DEFAULT 0.5,
    model_provider TEXT DEFAULT 'minimax',
    execution_time_ms INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(query_hash)
);

-- 全文检索向量触发器
CREATE OR REPLACE FUNCTION update_agent_experience_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.query, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.recommendation, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(NEW.debate_summary, '')), 'C') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.lessons_learned, ' '), '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_experience_search_vector ON agent_experiences;
CREATE TRIGGER trg_agent_experience_search_vector
    BEFORE INSERT OR UPDATE ON agent_experiences
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_experience_search_vector();

CREATE INDEX IF NOT EXISTS idx_agent_exp_query_hash ON agent_experiences(query_hash);
CREATE INDEX IF NOT EXISTS idx_agent_exp_domain ON agent_experiences(domain_id);
CREATE INDEX IF NOT EXISTS idx_agent_exp_score ON agent_experiences(final_score);
CREATE INDEX IF NOT EXISTS idx_agent_exp_created ON agent_experiences(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_exp_tags ON agent_experiences USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_agent_exp_search_vector ON agent_experiences USING GIN(search_vector);

SELECT '✅ [v003] Agent 记忆进化系统创建完成' AS status;
