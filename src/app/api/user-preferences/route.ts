export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getTopInterests, getUserProfile, getRecentDomains } from '@/lib/services/user/userPreferenceService';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/user-preferences
 *
 * 返回当前登录用户的偏好画像数据：
 * - topInterests: Top 5 学科兴趣
 * - profile: 搜索统计
 * - recentDomains: 最近搜索涉及的领域
 */
export async function GET() {
    try {
        // 验证登录状态
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: '未登录' },
                { status: 401 }
            );
        }

        // 并行查询所有偏好数据
        const [topInterests, profile, recentDomains] = await Promise.all([
            getTopInterests(user.id, 5),
            getUserProfile(user.id),
            getRecentDomains(user.id, 5),
        ]);

        return NextResponse.json({
            success: true,
            topInterests,
            profile: profile ? {
                searchCount: profile.search_count || 0,
                lastSearchAt: profile.last_search_at || null,
                topDomainId: profile.top_domain_id || null,
                topSubDomainId: profile.top_sub_domain_id || null,
                displayName: profile.display_name || null,
                preferredLanguage: profile.preferred_language || null,
                preferredModel: profile.preferred_model || null,
                points: profile.points ?? 0,
            } : null,
            recentDomains,
        });
    } catch (error: any) {
        console.error('[UserPreferences/API] 查询失败:', error.message);
        return NextResponse.json(
            { success: false, error: '查询用户偏好失败' },
            { status: 500 }
        );
    }
}

/** 允许更新的字段白名单 */
const ALLOWED_FIELDS = ['display_name', 'preferred_language', 'preferred_model'] as const;

/**
 * PUT /api/user-preferences
 *
 * 更新当前登录用户的偏好设置。
 * 请求体示例：{ display_name: "新名称", preferred_language: "zh" }
 */
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: '未登录' },
                { status: 401 }
            );
        }

        const body = await request.json();

        // 仅保留白名单字段
        const updates: Record<string, string> = {};
        for (const field of ALLOWED_FIELDS) {
            if (body[field] !== undefined) {
                updates[field] = String(body[field]).slice(0, 100); // 安全截断
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { success: false, error: '无有效更新字段' },
                { status: 400 }
            );
        }

        // 使用 supabaseAdmin 绕过 RLS 进行 upsert
        const { error } = await supabaseAdmin
            .from('user_profiles')
            .upsert({
                id: user.id,
                ...updates,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });

        if (error) {
            console.error('[UserPreferences/API] 更新失败:', error.message);
            return NextResponse.json(
                { success: false, error: '更新偏好失败' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, updated: updates });
    } catch (error: any) {
        console.error('[UserPreferences/API] PUT 异常:', error.message);
        return NextResponse.json(
            { success: false, error: '更新偏好失败' },
            { status: 500 }
        );
    }
}
