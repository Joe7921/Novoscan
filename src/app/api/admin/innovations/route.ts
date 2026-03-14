export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdminAuth, getInnovationTrends } from '@/server/admin';

/**
 * GET /api/admin/innovations — 创新趋势
 *
 * 查询参数：?top=20&domain=ai
 */
export async function GET(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const url = new URL(request.url);
        const top = parseInt(url.searchParams.get('top') || '20') || 20;
        const domain = url.searchParams.get('domain') || null;
        const data = await getInnovationTrends({ top, domain });
        return NextResponse.json(data);
    } catch (err: unknown) {
        return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}
