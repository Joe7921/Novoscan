export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdminAuth, getSystemHealth } from '@/server/admin';

/** GET /api/admin/system — 系统健康检查 */
export async function GET(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const data = await getSystemHealth();
        return NextResponse.json(data);
    } catch (err: unknown) {
        return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
}
