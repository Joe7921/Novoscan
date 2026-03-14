export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdminAuth, getCleanupPreview, executeCleanup } from '@/server/admin';

/**
 * GET /api/admin/cleanup — 清理预览
 *
 * 查询参数：?days=90
 */
export async function GET(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const url = new URL(request.url);
        const days = parseInt(url.searchParams.get('days') || '90') || 90;
        const data = await getCleanupPreview(days);
        return NextResponse.json({ preview: data, days });
    } catch (err: unknown) {
        return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}

/**
 * POST /api/admin/cleanup — 执行清理
 *
 * Body: { days: 90 }
 */
export async function POST(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const body = await request.json();
        const days = body.days || 90;
        const data = await executeCleanup(days);
        return NextResponse.json(data);
    } catch (err: unknown) {
        return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}
