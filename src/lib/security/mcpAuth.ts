/**
 * MCP 服务 API Key 鉴权模块（统一入口）
 *
 * 双层鉴权策略：
 *   1. 优先查 Supabase mcp_api_keys 表（订阅客户）
 *   2. 兜底查环境变量 MCP_API_KEYS（管理员/开发测试）
 *
 * 统一后的 mcp_api_keys 表同时包含 user_id 和 user_email，
 * 支持 feature_access 权限检查（可选）。
 *
 * 环境变量 MCP_API_KEYS 格式：key1:email1,key2:email2
 */

import { supabaseAdmin } from '@/lib/supabase';
import { checkFeatureAccess } from '@/lib/stubs';

// ==================== 环境变量 Key 加载 ====================

function loadEnvApiKeys(): Map<string, string> {
    const map = new Map<string, string>();
    const envKeys = process.env.MCP_API_KEYS;
    if (envKeys) {
        envKeys.split(',').forEach(pair => {
            const [key, email] = pair.trim().split(':');
            if (key && email) {
                map.set(key.trim(), email.trim());
            }
        });
    }
    // ⚠️ 仅在开发环境注入测试密钥，生产环境禁止硬编码
    if (process.env.NODE_ENV === 'development') {
        const devTestKey = 'nvk_test_2026';
        const devTestEmail = 'zhouhaoyu6666@gmail.com';
        if (!map.has(devTestKey)) {
            map.set(devTestKey, devTestEmail);
            console.warn('[MCP Auth] ⚠️ 开发模式：已加载测试密钥');
        }
    }
    return map;
}

let envKeyMap: Map<string, string> | null = null;
function getEnvKeyMap(): Map<string, string> {
    if (!envKeyMap) envKeyMap = loadEnvApiKeys();
    return envKeyMap;
}

// ==================== 公开接口 ====================

export interface McpAuthResult {
    valid: boolean;
    userId?: string;
    email?: string;
    plan?: string;
    dailyLimit?: number;
    usedToday?: number;
    error?: string;
}

/**
 * 校验 MCP API Key（异步，查数据库）
 *
 * 查询优先级：
 *   1. Supabase mcp_api_keys 表（检查有效期、每日限额、启用状态、功能权限）
 *   2. 环境变量 MCP_API_KEYS（管理员兜底）
 */
export async function validateMcpKey(apiKey: string): Promise<McpAuthResult> {
    if (!apiKey || typeof apiKey !== 'string') {
        return { valid: false, error: '缺少 API Key' };
    }

    const trimmedKey = apiKey.trim();

    // ---- 1. 查 Supabase ----
    try {
        const { data: keyRecord, error } = await supabaseAdmin
            .from('mcp_api_keys')
            .select('*')
            .eq('api_key', trimmedKey)
            .eq('is_active', true)
            .single();

        if (!error && keyRecord) {
            // 检查过期
            if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
                return { valid: false, error: 'API Key 已过期，请联系 Novoscan 续费' };
            }

            // 检查 feature_access 权限（如果有 user_id）
            if (keyRecord.user_id) {
                const hasMcpAccess = await checkFeatureAccess(keyRecord.user_id, 'mcp');
                if (!hasMcpAccess) {
                    return { valid: false, error: '用户未被授予 MCP 功能权限' };
                }
            }

            // 检查每日限额
            const today = new Date().toISOString().slice(0, 10);
            if (keyRecord.daily_limit > 0) {
                const { count } = await supabaseAdmin
                    .from('mcp_usage_log')
                    .select('*', { count: 'exact', head: true })
                    .eq('api_key_id', keyRecord.id)
                    .gte('created_at', `${today}T00:00:00Z`);

                const usedToday = count || 0;
                if (usedToday >= keyRecord.daily_limit) {
                    return {
                        valid: false,
                        error: `今日调用次数已达上限 (${keyRecord.daily_limit} 次/天)`,
                        dailyLimit: keyRecord.daily_limit,
                        usedToday,
                    };
                }

                // 记录使用日志
                try {
                    await supabaseAdmin.from('mcp_usage_log').insert({
                        api_key_id: keyRecord.id,
                        user_email: keyRecord.user_email,
                        query_preview: '(logged)',
                    });
                } catch { /* 日志失败不阻塞主流程 */ }

                console.log(`[MCP Auth] ✅ 订阅用户鉴权通过: ${keyRecord.user_email} (${keyRecord.plan}, ${usedToday + 1}/${keyRecord.daily_limit})`);
                return {
                    valid: true,
                    userId: keyRecord.user_id || undefined,
                    email: keyRecord.user_email,
                    plan: keyRecord.plan,
                    dailyLimit: keyRecord.daily_limit,
                    usedToday: usedToday + 1,
                };
            }

            // 无限额
            console.log(`[MCP Auth] ✅ 订阅用户鉴权通过: ${keyRecord.user_email} (${keyRecord.plan}, 无限额)`);
            return {
                valid: true,
                userId: keyRecord.user_id || undefined,
                email: keyRecord.user_email,
                plan: keyRecord.plan,
            };
        }
    } catch {
        // Supabase 查询失败不阻塞，回退到环境变量
        console.warn('[MCP Auth] Supabase 查询失败，回退到环境变量');
    }

    // ---- 2. 兜底：查环境变量 ----
    const map = getEnvKeyMap();
    const email = map.get(trimmedKey);

    if (!email) {
        console.warn(`[MCP Auth] 无效 API Key 尝试: ${trimmedKey.slice(0, 8)}...`);
        return { valid: false, error: 'API Key 无效或已过期' };
    }

    console.log(`[MCP Auth] ✅ 环境变量鉴权通过: ${email}`);
    return { valid: true, email, plan: 'admin' };
}

/**
 * 重新加载环境变量 API Key 映射（热更新）
 */
export function reloadApiKeys(): void {
    envKeyMap = null;
}

