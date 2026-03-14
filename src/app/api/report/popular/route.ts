export const dynamic = 'force-dynamic';

/**
 * GET /api/report/popular — 获取最新公开报告列表
 *
 * 返回最多 10 条最新公开报告（精简数据，不含完整 report_json）。
 * 用于首页 PopularReports 组件展示。
 * 包含 60 秒内存缓存，避免重复查库。
 */

import { NextResponse } from 'next/server';
import { getRecentPublicReports } from '@/lib/services/export/shareService';

// 60 秒内存缓存
const CACHE_TTL_MS = 60_000;
let popularCache: { data: any[]; ts: number } | null = null;

export async function GET() {
    try {
        // 检查内存缓存
        if (popularCache && Date.now() - popularCache.ts < CACHE_TTL_MS) {
            const response = NextResponse.json({ reports: popularCache.data, fromCache: true });
            response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
            return response;
        }

        const reports = await getRecentPublicReports(10);
        popularCache = { data: reports, ts: Date.now() };

        const response = NextResponse.json({ reports });
        response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        return response;
    } catch (error) {
        console.error('[API/report/popular] 错误:', error);
        return NextResponse.json({ reports: [] });
    }
}
