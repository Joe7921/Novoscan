export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdminAuth, getCacheStats, clearCache } from '@/server/admin';

/** GET /api/admin/cache — 缓存统计 */
export async function GET(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const data = await getCacheStats();
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/admin/cache — 清除缓存
 *
 * Body:
 *   { all: true }                  清除全部
 *   { olderThanHours: 48 }         清除 48h 前
 */
export async function POST(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const body = await request.json();
        const data = await clearCache({
            all: body.all || false,
            olderThanHours: body.olderThanHours || 24,
        });
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
