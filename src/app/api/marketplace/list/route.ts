/**
 * 插件市场 — 列表代理 API（开源版）
 *
 * GET /api/marketplace/list
 *
 * 将列表查询请求代理到 Pro 中心 Marketplace（公开 API，无需令牌）。
 *
 * Query 参数：page, pageSize, category, verification, search, sort
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketplaceList } from '@/lib/services/marketplaceBridge';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const result = await fetchMarketplaceList({
            page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
            pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined,
            category: searchParams.get('category') || undefined,
            verification: searchParams.get('verification') || undefined,
            search: searchParams.get('search') || undefined,
            sort: (searchParams.get('sort') as 'popular' | 'newest' | 'rating') || undefined,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 502 }
            );
        }

        return NextResponse.json(result.data, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
            },
        });
    } catch (error) {
        console.error('[Marketplace/List] 代理查询异常:', error);
        return NextResponse.json(
            { success: false, error: '查询插件列表失败' },
            { status: 500 }
        );
    }
}
