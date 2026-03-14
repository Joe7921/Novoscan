-- ============================================================
-- Novoscan 数据库迁移 v007
-- 社交功能：公开报告 + 邀请裂变 + 推荐追踪 + 合作伙伴
-- 来源：supabase_public_reports.sql, supabase_referrals.sql,
--       20260310_missing_tables.sql, 20260313_partner_applications.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 公开报告
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    idea_summary TEXT NOT NULL,
    idea_full TEXT,
    report_type TEXT NOT NULL DEFAULT 'novoscan',
    overall_score NUMERIC(4,1) DEFAULT 0,
    novelty_level TEXT DEFAULT 'Medium',
    key_finding TEXT,
    report_json JSONB NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    view_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_reports_created_at ON public_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_reports_type ON public_reports (report_type);
CREATE INDEX IF NOT EXISTS idx_public_reports_score ON public_reports (overall_score DESC);

-- ────────────────────────────────────────────────────────────
-- 邀请裂变
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL UNIQUE,
    referred_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    referred_email TEXT,
    referrer_rewarded BOOLEAN DEFAULT FALSE,
    referred_rewarded BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals (referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_id);

-- ────────────────────────────────────────────────────────────
-- 推荐点击追踪
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recommendation_clicks (
    id BIGSERIAL PRIMARY KEY,
    product_id TEXT NOT NULL,
    query TEXT NOT NULL,
    strength TEXT,
    source TEXT DEFAULT 'followup_panel',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_clicks_product ON recommendation_clicks(product_id);
CREATE INDEX IF NOT EXISTS idx_rec_clicks_user ON recommendation_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_rec_clicks_time ON recommendation_clicks(clicked_at DESC);

-- ────────────────────────────────────────────────────────────
-- 合作伙伴申请
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL,
    cooperation_type TEXT NOT NULL DEFAULT 'other',
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications (status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_created ON partner_applications (created_at DESC);

COMMENT ON TABLE partner_applications IS '合作伙伴申请表 — 通过首页表单提交';

SELECT '✅ [v007] 社交功能表创建完成' AS status;
