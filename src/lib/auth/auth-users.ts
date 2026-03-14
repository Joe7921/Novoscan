/**
 * 认证用户表 CRUD 服务
 *
 * 使用 IDatabase 抽象层（通过 adminDb）管理 auth_users 表。
 * 支持 Supabase 和 PostgreSQL 两种数据库后端。
 *
 * auth_users 表结构：
 *   id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
 *   email         TEXT UNIQUE NOT NULL
 *   password_hash TEXT          -- 邮箱+密码注册时存储 bcrypt hash
 *   name          TEXT
 *   image         TEXT          -- 头像 URL
 *   provider      TEXT          -- 'credentials' | 'github' | 'google'
 *   provider_id   TEXT          -- OAuth 提供者返回的用户 ID
 *   created_at    TIMESTAMPTZ DEFAULT now()
 *   updated_at    TIMESTAMPTZ DEFAULT now()
 */

import { adminDb } from '@/lib/db/factory';

/** auth_users 表记录类型 */
export interface AuthUserRecord {
    id: string;
    email: string;
    password_hash?: string | null;
    name?: string | null;
    image?: string | null;
    provider?: string | null;
    provider_id?: string | null;
    created_at?: string;
    updated_at?: string;
}

/**
 * 通过邮箱查找用户
 */
export async function findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    try {
        const { data, error } = await adminDb
            .from<AuthUserRecord>('auth_users')
            .select('id, email, password_hash, name, image, provider, provider_id')
            .eq('email', email)
            .single();
        if (error || !data) return null;
        return data;
    } catch {
        return null;
    }
}

/**
 * 通过 ID 查找用户
 */
export async function findUserById(id: string): Promise<AuthUserRecord | null> {
    try {
        const { data, error } = await adminDb
            .from<AuthUserRecord>('auth_users')
            .select('id, email, name, image, provider, created_at')
            .eq('id', id)
            .single();
        if (error || !data) return null;
        return data;
    } catch {
        return null;
    }
}

/**
 * 通过 OAuth 提供者和用户 ID 查找用户
 */
export async function findUserByProvider(provider: string, providerId: string): Promise<AuthUserRecord | null> {
    try {
        const { data, error } = await adminDb
            .from<AuthUserRecord>('auth_users')
            .select('id, email, name, image, provider, provider_id')
            .eq('provider', provider)
            .eq('provider_id', providerId)
            .single();
        if (error || !data) return null;
        return data;
    } catch {
        return null;
    }
}

/**
 * 创建新用户（邮箱+密码 注册）
 */
export async function createCredentialsUser(
    email: string,
    passwordHash: string
): Promise<AuthUserRecord | null> {
    try {
        const { data, error } = await adminDb
            .from<AuthUserRecord>('auth_users')
            .insert({
                email,
                password_hash: passwordHash,
                name: email.split('@')[0],
                provider: 'credentials',
            })
            .select('id, email, name, image')
            .single();
        if (error) {
            console.error('[AuthUsers] 创建用户失败:', error.message);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

/**
 * 创建或更新 OAuth 用户
 * OAuth 登录时，如果用户不存在则创建，已存在则更新信息
 */
export async function upsertOAuthUser(
    provider: string,
    providerId: string,
    email: string,
    name?: string | null,
    image?: string | null
): Promise<AuthUserRecord | null> {
    try {
        const { data, error } = await adminDb
            .from<AuthUserRecord>('auth_users')
            .upsert(
                {
                    email,
                    name: name || email.split('@')[0],
                    image,
                    provider,
                    provider_id: providerId,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'email' }
            )
            .select('id, email, name, image, provider')
            .single();
        if (error) {
            console.error('[AuthUsers] upsert OAuth 用户失败:', error.message);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

/**
 * 更新用户信息
 */
export async function updateUser(
    id: string,
    updates: Partial<Pick<AuthUserRecord, 'name' | 'image' | 'password_hash'>>
): Promise<boolean> {
    try {
        const { error } = await adminDb
            .from<AuthUserRecord>('auth_users')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);
        return !error;
    } catch {
        return false;
    }
}
