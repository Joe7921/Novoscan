export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 收割可能需要较长时间（多次 AI 调用）

/**
 * NovoDNA 基因库收割 — Cron 触发端点
 *
 * GET — 由 Vercel Cron Jobs 每周一凌晨 3 点调用
 *       也支持手动触发（带正确密钥）
 *
 * 功能：从 OpenAlex 搜索各领域高引论文 → 提取 DNA 向量 → 入库
 */

import { NextResponse } from 'next/server';
import { harvestAndStore } from '@/lib/services/innovation/dnaHarvester';

export async function GET(request: Request) {
    // 验证调用权限（优先从 Header 读取，兼容 query 参数）
    const secret = request.headers.get('x-cron-secret')
        || request.headers.get('authorization')?.replace('Bearer ', '')
        || new URL(request.url).searchParams.get('secret');

    const validSecret = process.env.CRON_SECRET;

    if (!validSecret || secret !== validSecret) {
        return NextResponse.json(
            { success: false, error: '无效的 Cron 密钥' },
            { status: 401 }
        );
    }

    try {
        console.log('[NovoDNA Cron] 🕐 基因库收割端点被调用');
        const result = await harvestAndStore();

        return NextResponse.json({
            success: true,
            result,
        });
    } catch (e: unknown) {
        console.error('[NovoDNA Cron] 执行失败:', (e instanceof Error ? e.message : String(e)));
        return NextResponse.json(
            { success: false, error: (e instanceof Error ? e.message : String(e)) },
            { status: 500 }
        );
    }
}
