-- ============================================================
-- Novoscan 数据库迁移 v010
-- NextAuth.js 认证用户表
-- 独立于 Supabase auth.users，用于 AUTH_PROVIDER=nextauth 模式
-- ============================================================

-- ── 认证用户表（NextAuth 专用） ──
CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,                    -- 邮箱+密码注册时存储 bcrypt hash
    name TEXT,
    image TEXT,                            -- 头像 URL
    provider TEXT DEFAULT 'credentials',   -- 'credentials' | 'github' | 'google'
    provider_id TEXT,                      -- OAuth 提供者返回的用户 ID
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_provider ON auth_users(provider, provider_id);

-- RLS 策略（Supabase 环境需要）
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;

-- 允许 service_role 完全访问（adminDb 使用 service_role key）
CREATE POLICY "service_role_full_access" ON auth_users
    FOR ALL USING (true) WITH CHECK (true);

SELECT '✅ [v010] NextAuth 认证用户表创建完成' AS status;
