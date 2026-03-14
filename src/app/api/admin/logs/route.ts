export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdminAuth, getExecutionLogs, getApiFailures } from '@/server/admin';

/**
 * GET /api/admin/logs — 执行日志
 *
 * 查询参数：
 *   ?limit=15     每页条数
 *   ?page=1       页码
 *   ?failures=1   仅 API 失败记录
 */
export async function GET(request: Request) {
    const authError = verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const url = new URL(request.url);
        const failures = url.searchParams.get('failures');

        if (failures) {
            const limit = parseInt(url.searchParams.get('limit') || '15') || 15;
            const data = await getApiFailures(limit);
            return NextResponse.json({ failures: data });
        }

        const limit = parseInt(url.searchParams.get('limit') || '15') || 15;
        const page = parseInt(url.searchParams.get('page') || '1') || 1;
        const data = await getExecutionLogs({ limit, page });
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
