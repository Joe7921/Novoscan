/**
 * GET /api/report/[id] — 获取公开报告数据
 *
 * 返回完整的报告 JSON 数据，前端页面用于渲染。
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPublicReport } from '@/lib/services/export/shareService';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        if (!id) {
            return NextResponse.json(
                { error: '缺少报告 ID' },
                { status: 400 }
            );
        }

        const report = await getPublicReport(id);

        if (!report) {
            return NextResponse.json(
                { error: '报告不存在或已被删除' },
                { status: 404 }
            );
        }

        return NextResponse.json(report);
    } catch (error) {
        console.error('[API/report/[id]] 错误:', error);
        return NextResponse.json(
            { error: '服务器内部错误' },
            { status: 500 }
        );
    }
}
