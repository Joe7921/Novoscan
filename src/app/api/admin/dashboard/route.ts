export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdminAuth, getDashboardData } from '@/server/admin';

/** GET /api/admin/dashboard — 一键总览 */
export async function GET(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const data = await getDashboardData();
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
