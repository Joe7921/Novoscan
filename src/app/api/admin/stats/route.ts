export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdminAuth, getKpiStats } from '@/server/admin';

/** GET /api/admin/stats — KPI 总览 */
export async function GET(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const data = await getKpiStats();
        return NextResponse.json(data);
    } catch (err: unknown) {
        return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}
