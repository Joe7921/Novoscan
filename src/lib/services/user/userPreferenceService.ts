import { supabaseAdmin } from '@/lib/supabase';
import type { UserDomainInterest } from '@/lib/supabase';

/**
 * 用户偏好服务
 *
 * 负责：
 * 1. 记录搜索事件（user_search_events）
 * 2. 递增学科兴趣权重（user_domain_interests）
 * 3. 更新用户画像统计（user_profiles）
 * 4. 查询用户 Top N 兴趣（供广告定投使用）
 *
 * 所有写入操作使用 supabaseAdmin（service_role），绕过 RLS。
 */

// ==================== 记录搜索事件 ====================

interface SearchEventInput {
    userId?: string;         // 已登录用户的 auth.users.id
    anonymousId?: string;    // 未登录用户的 localStorage UUID
    query: string;
    domainId?: string;
    subDomainId?: string;
    modelUsed?: string;
    noveltyScore?: number;
    practicalScore?: number;
}

/**
 * 分析完成后调用：写入搜索事件 → 更新兴趣权重 → 更新画像
 * 全部异步执行，不阻塞主流程
 */
export async function recordSearchEvent(input: SearchEventInput): Promise<void> {
    try {
        // 1. 写入事件日志
        const { error: eventErr } = await supabaseAdmin.from('user_search_events').insert({
            user_id: input.userId || null,
            anonymous_id: input.anonymousId || null,
            query: input.query,
            domain_id: input.domainId || null,
            sub_domain_id: input.subDomainId || null,
            model_used: input.modelUsed || null,
            novelty_score: input.noveltyScore ?? null,
            practical_score: input.practicalScore ?? null,
        });

        if (eventErr) {
            console.error('[UserPref] 写入搜索事件失败:', eventErr.message);
            return;
        }

        // 2. 更新学科兴趣权重（仅当有 userId 且有 domainId 时）
        if (input.userId && input.domainId) {
            await upsertDomainInterest(input.userId, input.domainId, input.subDomainId);
        }

        // 3. 更新用户画像汇总（仅登录用户）
        if (input.userId) {
            await updateProfileStats(input.userId);
        }

        console.log(`[UserPref] 搜索事件已记录: user=${input.userId || input.anonymousId}, domain=${input.domainId}`);
    } catch (err: any) {
        // 偏好记录失败不应影响主流程
        console.error('[UserPref] recordSearchEvent 异常:', err.message);
    }
}

// ==================== 兴趣权重递增 ====================

/**
 * 递增某用户对某学科的兴趣权重（upsert + weight +1）
 */
async function upsertDomainInterest(userId: string, domainId: string, subDomainId?: string): Promise<void> {
    // 尝试查询已有记录
    const { data: existing } = await supabaseAdmin
        .from('user_domain_interests')
        .select('id, weight')
        .eq('user_id', userId)
        .eq('domain_id', domainId)
        .eq('sub_domain_id', subDomainId || '')
        .maybeSingle();

    if (existing) {
        // 已有 → 权重 +1，更新 last_hit_at
        await supabaseAdmin
            .from('user_domain_interests')
            .update({
                weight: (existing.weight || 1) + 1,
                last_hit_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
    } else {
        // 新建
        await supabaseAdmin.from('user_domain_interests').insert({
            user_id: userId,
            domain_id: domainId,
            sub_domain_id: subDomainId || null,
            weight: 1,
        });
    }
}

// ==================== 用户画像更新 ====================

/**
 * 根据兴趣权重表更新用户画像的 top_domain / search_count
 */
async function updateProfileStats(userId: string): Promise<void> {
    // 查询该用户权重最高的学科
    const { data: topInterest } = await supabaseAdmin
        .from('user_domain_interests')
        .select('domain_id, sub_domain_id, weight')
        .eq('user_id', userId)
        .order('weight', { ascending: false })
        .limit(1)
        .maybeSingle();

    // upsert 用户画像
    const { error } = await supabaseAdmin.from('user_profiles').upsert({
        id: userId,
        top_domain_id: topInterest?.domain_id || null,
        top_sub_domain_id: topInterest?.sub_domain_id || null,
        search_count: undefined, // 下面单独递增
        last_search_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (error) {
        console.error('[UserPref] upsert user_profiles 失败:', error.message);
        return;
    }

    // 递增 search_count（RPC 或 raw SQL 更安全，这里用 read-then-write 简化）
    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('search_count')
        .eq('id', userId)
        .single();

    if (profile) {
        await supabaseAdmin
            .from('user_profiles')
            .update({ search_count: (profile.search_count || 0) + 1 })
            .eq('id', userId);
    }
}

// ==================== 查询接口（供广告定投使用） ====================

/**
 * 获取用户 Top N 学科兴趣（按权重排序）
 */
export async function getTopInterests(userId: string, limit = 5): Promise<UserDomainInterest[]> {
    const { data } = await supabaseAdmin
        .from('user_domain_interests')
        .select('*')
        .eq('user_id', userId)
        .order('weight', { ascending: false })
        .limit(limit);

    return data || [];
}

/**
 * 获取用户画像
 */
export async function getUserProfile(userId: string) {
    const { data } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

    return data;
}

/**
 * 获取用户最近搜索涉及的不重复领域（按最近时间排序）
 */
export async function getRecentDomains(userId: string, limit = 5): Promise<string[]> {
    const { data } = await supabaseAdmin
        .from('user_search_events')
        .select('domain_id')
        .eq('user_id', userId)
        .not('domain_id', 'is', null)
        .order('searched_at', { ascending: false })
        .limit(50); // 取最近 50 条，去重后截取

    if (!data) return [];

    const seen = new Set<string>();
    const result: string[] = [];
    for (const row of data) {
        if (row.domain_id && !seen.has(row.domain_id)) {
            seen.add(row.domain_id);
            result.push(row.domain_id);
            if (result.length >= limit) break;
        }
    }
    return result;
}
