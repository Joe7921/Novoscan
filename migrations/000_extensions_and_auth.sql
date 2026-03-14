-- ============================================================
-- Novoscan 数据库迁移 v000
-- 基础扩展 + 模拟 Supabase auth schema
--
-- ⚠️ 此文件仅适用于自建 PostgreSQL 环境。
--    如果使用 Supabase 云，auth schema 已由平台提供，无需执行此文件。
-- ============================================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- 模拟 Supabase auth schema
-- Novoscan 代码中有 REFERENCES auth.users(id) 的外键引用，
-- 此处创建最小兼容的 auth.users 表以满足外键约束。
-- ⚠️ 这不是完整的 Supabase Auth 实现，仅用于表结构兼容。
-- ────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 模拟 Supabase auth 函数（RLS 策略引用）
-- 在自建 PostgreSQL 中，这些函数返回 NULL（RLS 实际不生效）
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    SELECT NULL::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
    SELECT 'service_role'::TEXT;
$$ LANGUAGE sql STABLE;

SELECT '✅ [v000] 扩展和 auth schema 初始化完成' AS status;
