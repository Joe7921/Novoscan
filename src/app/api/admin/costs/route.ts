export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdminAuth, getCostsPricing, getCostsOverview, getCostsByDay, getCostsRealtime } from '@/server/admin';

/**
 * GET /api/admin/costs — FinOps 费用监控
 *
 * 查询参数：
 *   ?view=overview     费用总览（默认）
 *   ?view=daily        按日费用曲线
 *   ?view=realtime     今日实时费用
 *   ?view=pricing      当前费率配置
 *   ?days=7            时间范围
 */
export async function GET(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const url = new URL(request.url);
        const view = url.searchParams.get('view') || 'overview';
        const days = parseInt(url.searchParams.get('days') || '7') || 7;

        switch (view) {
            case 'pricing':
                return NextResponse.json(getCostsPricing());
            case 'daily':
                return NextResponse.json(await getCostsByDay(days));
            case 'realtime':
                return NextResponse.json(await getCostsRealtime());
            case 'overview':
            default:
                return NextResponse.json(await getCostsOverview(days));
        }
    } catch (err: unknown) {
        return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}

/**
 * POST /api/admin/costs — 更新自定义费率
 *
 * Body: { models: [{ name: "deepseek", inputPerMillion: 1.40, outputPerMillion: 2.80 }, ...] }
 *
 * 注：费率通过环境变量 FINOPS_PRICING 持久化，此接口仅返回验证结果。
 * 实际持久化需由用户更新 .env.local 中的 FINOPS_PRICING。
 */
export async function POST(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const body = await request.json();
        const { models } = body;

        if (!Array.isArray(models) || models.length === 0) {
            return NextResponse.json({ error: '请提供 models 数组' }, { status: 400 });
        }

        // 验证格式
        for (const m of models) {
            if (!m.name || typeof m.inputPerMillion !== 'number' || typeof m.outputPerMillion !== 'number') {
                return NextResponse.json({
                    error: `模型 ${m.name || '未知'} 格式错误，需包含 name, inputPerMillion, outputPerMillion`,
                }, { status: 400 });
            }
        }

        // 生成环境变量值给用户复制
        const envValue = JSON.stringify(models);

        return NextResponse.json({
            success: true,
            message: '费率配置已验证。请将以下内容添加到 .env.local 以持久化：',
            envKey: 'FINOPS_PRICING',
            envValue,
            models,
        });
    } catch (err: unknown) {
        return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}
