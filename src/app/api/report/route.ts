export const dynamic = 'force-dynamic';

/**
 * POST /api/report
 * 专业报告生成 API — 优先从缓存读取预生成报告，降级为同步 AI 生成
 */
import { NextResponse } from 'next/server';
import { generateProfessionalReport } from '@/server/report/reportWriter';
import { checkRateLimit, safeErrorResponse } from '@/lib/security/apiSecurity';
import { supabaseAdmin } from '@/lib/supabase';

// Vercel 超时配置：降级同步生成仍需要 120 秒
export const maxDuration = 120;

export async function POST(request: Request) {
    try {
        // 🔒 速率限制（3次/分钟，报告生成资源消耗高）
        const rateLimitRes = await checkRateLimit(request, 'report', 3);
        if (rateLimitRes) return rateLimitRes;

        const body = await request.json();
        const { query, report, dualResult, language = 'zh', modelProvider = 'minimax' } = body;

        if (!query || !report) {
            return NextResponse.json(
                { error: 'Missing required fields: query, report' },
                { status: 400 }
            );
        }

        // 1. 优先从数据库缓存中获取预生成的报告
        try {
            const { data: cached } = await supabaseAdmin
                .from('search_history')
                .select('professional_report')
                .eq('query', query)
                .not('professional_report', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (cached?.professional_report) {
                console.log(`[Report API] ✅ 命中预生成报告缓存: "${query.slice(0, 50)}..."`);
                return NextResponse.json({
                    success: true,
                    report: cached.professional_report,
                    fromCache: true,
                });
            }
        } catch {
            // 缓存未命中，降级到同步生成
        }

        // 2. 降级：同步生成（兼容旧数据 / 缓存未命中）
        console.log(`[Report API] ⏳ 缓存未命中，降级同步生成: "${query.slice(0, 50)}..." (${language})`);

        const professionalReport = await generateProfessionalReport(
            query,
            report,
            dualResult,
            language,
            modelProvider,
        );

        console.log(`[Report API] 报告生成完成，使用模型: ${professionalReport.usedModel}`);

        // 3. 异步回写缓存（不阻塞响应）
        supabaseAdmin
            .from('search_history')
            .update({ professional_report: professionalReport })
            .eq('query', query)
            .order('created_at', { ascending: false })
            .limit(1)
            .then(({ error }) => {
                if (error) console.warn('[Report API] 回写缓存失败:', error.message);
                else console.log('[Report API] 📄 报告已回写到缓存');
            });

        return NextResponse.json({
            success: true,
            report: professionalReport,
        });

    } catch (err: unknown) {
        return safeErrorResponse(err, '报告生成失败，请稍后重试', 500, '[Report API]');
    }
}