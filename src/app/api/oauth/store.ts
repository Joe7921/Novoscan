/**
 * OAuth 授权 code 存储 — Supabase + 内存双层
 *
 * 生产环境使用 Supabase oauth_codes 表（跨实例一致）。
 * 无数据库表时自动回退到内存 Map（开发/初始环境）。
 *
 * 安全措施：
 * - code 5 分钟过期
 * - 一次性消费（消费后立即删除）
 * - 定期自动清理过期 code
 */

import { supabaseAdmin } from '@/lib/supabase';

// ==================== 内存回退 ====================
const memoryStore = new Map<string, { apiKey: string; expiresAt: number }>();

/** 定期清理内存中过期 code（每 2 分钟） */
setInterval(() => {
    const now = Date.now();
    for (const [code, data] of memoryStore) {
        if (now > data.expiresAt) memoryStore.delete(code);
    }
    // 防溢出：最多 1000 条
    if (memoryStore.size > 1000) {
        const entries = Array.from(memoryStore.entries())
            .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        for (const [code] of entries.slice(0, entries.length - 1000)) {
            memoryStore.delete(code);
        }
    }
}, 2 * 60 * 1000);

// ==================== 是否使用 Supabase ====================
let useSupabase: boolean | null = null;

async function canUseSupabase(): Promise<boolean> {
    if (useSupabase !== null) return useSupabase;
    try {
        // 尝试查询 oauth_codes 表是否存在
        const { error } = await supabaseAdmin
            .from('oauth_codes')
            .select('code')
            .limit(0);
        useSupabase = !error;
        if (!useSupabase) {
            console.warn('[OAuth Store] oauth_codes 表不存在，使用内存存储');
        }
    } catch {
        useSupabase = false;
    }
    return useSupabase;
}

// ==================== 公开接口 ====================

export interface CodeEntry {
    apiKey: string;
    expiresAt: number;
}

/**
 * 兼容旧 API 的 codeStore 代理对象
 * 提供 set / get / delete 方法，自动选择 Supabase 或内存
 */
export const codeStore = {
    /** 存储 code */
    async set(code: string, entry: CodeEntry): Promise<void> {
        // 始终写内存（作为回退）
        memoryStore.set(code, entry);

        if (await canUseSupabase()) {
            try {
                await supabaseAdmin.from('oauth_codes').upsert({
                    code,
                    api_key: entry.apiKey,
                    expires_at: new Date(entry.expiresAt).toISOString(),
                });
            } catch {
                // 写入失败不阻塞，内存已有
            }
        }
    },

    /** 查询 code */
    async get(code: string): Promise<CodeEntry | undefined> {
        if (await canUseSupabase()) {
            try {
                const { data } = await supabaseAdmin
                    .from('oauth_codes')
                    .select('api_key, expires_at')
                    .eq('code', code)
                    .single();

                if (data) {
                    return {
                        apiKey: data.api_key,
                        expiresAt: new Date(data.expires_at).getTime(),
                    };
                }
            } catch {
                // 回退到内存
            }
        }
        return memoryStore.get(code);
    },

    /** 删除 code（一次性消费） */
    async delete(code: string): Promise<void> {
        memoryStore.delete(code);

        if (await canUseSupabase()) {
            try {
                await supabaseAdmin.from('oauth_codes').delete().eq('code', code);
            } catch {
                // 静默
            }
        }
    },
};
