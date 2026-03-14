-- ============================================================
-- Novoscan 数据库迁移 v004
-- 功能权限 + 兑换码 + 通知 + 签到配额 + 订阅
-- 来源：20260305_feature_access.sql, 20260308_redeem_codes.sql,
--       20260305_notification_settings.sql, 20260313_checkin_quota.sql,
--       20260312_subscriptions.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 功能权限管理
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_access (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    granted_by TEXT DEFAULT 'admin',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, feature)
);

CREATE INDEX IF NOT EXISTS idx_fa_user ON feature_access(user_id);
CREATE INDEX IF NOT EXISTS idx_fa_feature ON feature_access(feature);

-- 便捷函数：通过邮箱授权
CREATE OR REPLACE FUNCTION grant_feature(user_email TEXT, feat TEXT, granter TEXT DEFAULT 'admin')
RETURNS TEXT AS $$
DECLARE
    uid UUID;
BEGIN
    SELECT id INTO uid FROM auth.users WHERE email = user_email LIMIT 1;
    IF uid IS NULL THEN
        RETURN '❌ 未找到邮箱为 ' || user_email || ' 的用户';
    END IF;
    INSERT INTO feature_access (user_id, feature, granted_by)
    VALUES (uid, feat, granter)
    ON CONFLICT (user_id, feature) DO NOTHING;
    RETURN '✅ 已授予 ' || user_email || ' 的 ' || feat || ' 权限';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION revoke_feature(user_email TEXT, feat TEXT)
RETURNS TEXT AS $$
DECLARE
    uid UUID;
BEGIN
    SELECT id INTO uid FROM auth.users WHERE email = user_email LIMIT 1;
    IF uid IS NULL THEN
        RETURN '❌ 未找到邮箱为 ' || user_email || ' 的用户';
    END IF;
    DELETE FROM feature_access WHERE user_id = uid AND feature = feat;
    RETURN '✅ 已撤销 ' || user_email || ' 的 ' || feat || ' 权限';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- 兑换码系统
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS redeem_codes (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    points INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER NOT NULL DEFAULT 1,
    used_count INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_redeem_codes_code_active ON redeem_codes (code, active);

CREATE TABLE IF NOT EXISTS redeem_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_redeem_history_user_code ON redeem_history (user_id, code);

-- ────────────────────────────────────────────────────────────
-- 通知设置
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    serverchan_key TEXT,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings (user_id);

-- ────────────────────────────────────────────────────────────
-- 签到 + 月度配额
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_checkins (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    streak_day INT NOT NULL DEFAULT 1,
    reward INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_checkin_user ON user_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_date ON user_checkins(user_id, checkin_date DESC);

CREATE TABLE IF NOT EXISTS user_monthly_usage (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year_month TEXT NOT NULL,
    feature TEXT NOT NULL,
    used_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, year_month, feature)
);

CREATE INDEX IF NOT EXISTS idx_monthly_usage ON user_monthly_usage(user_id, year_month);

-- ────────────────────────────────────────────────────────────
-- 用户订阅
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ls_subscription_id TEXT NOT NULL UNIQUE,
    ls_customer_id TEXT,
    ls_variant_id TEXT NOT NULL,
    plan_name TEXT NOT NULL DEFAULT 'starter',
    status TEXT NOT NULL DEFAULT 'active',
    current_period_end TIMESTAMPTZ,
    cancel_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usub_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_usub_status ON user_subscriptions(status);

SELECT '✅ [v004] 功能权限 + 兑换码 + 通知 + 签到 + 订阅创建完成' AS status;
