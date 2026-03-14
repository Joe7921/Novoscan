-- ============================================================
-- Novoscan 数据库迁移 v002
-- 用户画像系统 + 注册触发器
-- 来源：20260303_user_preferences.sql, 20260310_merge_profiles.sql
-- ============================================================

-- ── 用户画像主表 ──
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    preferred_language TEXT DEFAULT 'zh',
    preferred_model TEXT DEFAULT 'deepseek',
    top_domain_id TEXT,
    top_sub_domain_id TEXT,
    search_count INT DEFAULT 0,
    last_search_at TIMESTAMPTZ,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 学科兴趣权重表 ──
CREATE TABLE IF NOT EXISTS user_domain_interests (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    domain_id TEXT NOT NULL,
    sub_domain_id TEXT,
    weight REAL DEFAULT 1.0,
    last_hit_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, domain_id, sub_domain_id)
);

CREATE INDEX IF NOT EXISTS idx_udi_user ON user_domain_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_udi_domain ON user_domain_interests(domain_id);

-- ── 搜索行为事件流 ──
CREATE TABLE IF NOT EXISTS user_search_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    anonymous_id TEXT,
    query TEXT NOT NULL,
    domain_id TEXT,
    sub_domain_id TEXT,
    model_used TEXT,
    novelty_score REAL,
    practical_score REAL,
    searched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_use_user ON user_search_events(user_id);
CREATE INDEX IF NOT EXISTS idx_use_anon ON user_search_events(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_use_domain ON user_search_events(domain_id);
CREATE INDEX IF NOT EXISTS idx_use_time ON user_search_events(searched_at DESC);

-- ── 新用户注册触发器 ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(user_profiles.email, EXCLUDED.email),
        display_name = COALESCE(user_profiles.display_name, EXCLUDED.display_name),
        avatar_url = COALESCE(user_profiles.avatar_url, EXCLUDED.avatar_url),
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 在 auth.users 上创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

SELECT '✅ [v002] 用户画像系统创建完成' AS status;
