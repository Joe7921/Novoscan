export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdminAuth, injectTestData, cleanTestData } from '@/server/admin';

/**
 * POST /api/admin/seed — 测试数据管理
 *
 * Body:
 *   { action: "inject" }    注入测试数据
 *   { action: "clean" }     清除测试数据
 */
export async function POST(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const body = await request.json();
        const { action } = body;

        switch (action) {
            case 'inject':
                return NextResponse.json(await injectTestData());
            case 'clean':
                return NextResponse.json(await cleanTestData());
            default:
                return NextResponse.json(
                    { error: '未知 action，可选: inject, clean' },
                    { status: 400 }
                );
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
