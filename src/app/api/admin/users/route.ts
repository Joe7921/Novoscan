export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdminAuth, listUsers, grantAdmin, revokeAdmin } from '@/server/admin';

/** GET /api/admin/users — 用户权限列表 */
export async function GET(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const data = await listUsers();
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/admin/users — 用户权限操作
 *
 * Body:
 *   { action: "grant-admin", userId: "xxx" }
 *   { action: "revoke-admin", userId: "xxx" }
 */
export async function POST(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const body = await request.json();
        const { action, userId } = body;

        if (!action || !userId) {
            return NextResponse.json({ error: '缺少 action 或 userId' }, { status: 400 });
        }

        let result;
        switch (action) {
            case 'grant-admin':
                result = await grantAdmin(userId);
                break;
            case 'revoke-admin':
                result = await revokeAdmin(userId);
                break;
            default:
                return NextResponse.json({ error: `未知操作: ${action}` }, { status: 400 });
        }

        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
