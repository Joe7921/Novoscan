export const dynamic = 'force-dynamic';

/**
 * 推荐点击追踪 API
 * 
 * 记录用户通过跨产品推荐点击跳转的行为数据，
 * 用于分析推荐系统转化率和优化推荐策略。
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            productId,
            query,
            strength,
            source = 'followup_panel',
            timestamp,
        } = body;

        if (!productId || !query) {
            return NextResponse.json({ success: false }, { status: 400 });
        }

        // 获取用户 ID（可选）
        let userId: string | undefined;
        try {
            const supabaseAuth = await createClient();
            const { data: { user } } = await supabaseAuth.auth.getUser();
            userId = user?.id;
        } catch { /* 匿名用户 */ }

        // 写入追踪表（静默失败，不影响用户体验）
        try {
            await supabaseAdmin.from('recommendation_clicks').insert({
                product_id: productId,
                query: query.slice(0, 500),
                strength,
                source,
                user_id: userId || null,
                clicked_at: timestamp || new Date().toISOString(),
            });
        } catch (dbErr: any) {
            // 表可能不存在，只记日志不报错
            console.warn('[TrackRecommendation] 写入失败（表可能不存在）:', dbErr.message);
        }

        // IDEA 行为信号收集（静默、不阻塞）
        if (userId) {
            import('@/lib/services/innovation/ideaBehaviorService').then(({ recordBehaviorSignal }) => {
                recordBehaviorSignal({
                    userId: userId!,
                    type: 'recommendation_click',
                    query,
                    productId,
                    source,
                }).catch(() => { });
            }).catch(() => { });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: true }); // 追踪失败不影响用户
    }
}
