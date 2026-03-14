export const dynamic = 'force-dynamic';

/**
 * CaseVault — Cron 定时采集端点
 *
 * GET — 由 Vercel Cron Jobs 或外部调度器调用
 *
 * 验证密钥：复用 CRON_SECRET 环境变量
 * 也支持手动触发（带正确密钥）
 *
 * 成本：每次调用消耗约 3 次 API 调用
 *   - 搜索 API: 2 次（2 个关键词 × 1 个来源）
 *   - AI 润色: 1 次 Gemini Flash
 */

import { NextResponse } from 'next/server';
import { runCaseVaultPipeline } from '@/server/casevault/scheduler';

export async function GET(request: Request) {
    // 验证调用权限（复用 CRON_SECRET）
    // 开发环境允许无密钥访问
    // 验证调用权限（优先从 Header 读取，兼容 query 参数）
    const secret = request.headers.get('x-cron-secret')
        || request.headers.get('authorization')?.replace('Bearer ', '')
        || new URL(request.url).searchParams.get('secret');

    const validSecret = process.env.CRON_SECRET;
    const isDev = process.env.NODE_ENV === 'development';

    if (!isDev && (!validSecret || secret !== validSecret)) {
        return NextResponse.json(
            { success: false, error: '无效的 Cron 密钥' },
            { status: 401 }
        );
    }

    try {
        console.log('[CaseVault Cron] 🕐 Cron 端点被调用');
        const result = await runCaseVaultPipeline();

        return NextResponse.json({
            success: true,
            result,
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[CaseVault Cron] 执行失败:', msg);
        return NextResponse.json(
            { success: false, error: msg },
            { status: 500 }
        );
    }
}
