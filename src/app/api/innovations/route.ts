export const dynamic = 'force-dynamic';

/**
 * GET /api/innovations — 获取创新趋势数据
 *
 * 查询参数:
 * - sort: novelty | trending | hidden (默认 novelty)
 * - limit: 返回数量 (默认 20，最大 50)
 *
 * 包含 60 秒内存缓存，避免重复查库。
 */

import { NextResponse } from 'next/server';
import { getTrendingInnovations, getHiddenGems } from '@/lib/services/innovation/innovationService';

// 60 秒内存缓存
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { data: unknown[]; ts: number }>();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sort = searchParams.get('sort') || 'novelty';
        const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

        const cacheKey = `${sort}:${limit}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
            return NextResponse.json({ innovations: cached.data, fromCache: true });
        }

        let data: unknown[];

        if (sort === 'hidden') {
            data = await getHiddenGems(limit);
        } else {
            data = await getTrendingInnovations(limit, sort as 'novelty' | 'trending');
        }

        cache.set(cacheKey, { data, ts: Date.now() });

        return NextResponse.json({ innovations: data });
    } catch (error: unknown) {
        console.error('[API/innovations] 错误:', (error instanceof Error ? error.message : String(error)));
        return NextResponse.json({ innovations: [], error: '获取创新数据失败' }, { status: 500 });
    }
}
