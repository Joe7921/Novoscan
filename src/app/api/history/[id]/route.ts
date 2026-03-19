export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/db/factory';

/**
 * GET /api/history/[id]
 *
 * 按 ID 加载单条搜索历史记录。
 * 已登录用户只能查看自己的记录。
 */
export async function GET(
    _request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { data: { user } } = await serverDb.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: '请先登录' },
                { status: 401 }
            );
        }

        const { id } = params;
        if (!id) {
            return NextResponse.json(
                { success: false, error: '缺少记录 ID' },
                { status: 400 }
            );
        }

        // 查询记录（强制 user_id 匹配，防止越权访问）
        const { data, error } = await adminDb
            .from('search_history')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (error || !data) {
            return NextResponse.json(
                { success: false, error: '记录不存在或无权访问' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            record: data,
        });
    } catch (error: unknown) {
        console.error('[API History] GET 异常:', (error instanceof Error ? error.message : String(error)));
        return NextResponse.json(
            { success: false, error: '查询失败' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/history/[id]
 *
 * 删除单条搜索历史记录。
 * 已登录用户只能删除自己的记录。
 */
export async function DELETE(
    _request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { data: { user } } = await serverDb.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: '请先登录' },
                { status: 401 }
            );
        }

        const { id } = params;
        if (!id) {
            return NextResponse.json(
                { success: false, error: '缺少记录 ID' },
                { status: 400 }
            );
        }

        // 删除记录（强制 user_id 匹配，防止越权删除）
        const { error } = await adminDb
            .from('search_history')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error('[API History] DELETE 失败:', error.message);
            return NextResponse.json(
                { success: false, error: '删除失败' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('[API History] DELETE 异常:', (error instanceof Error ? error.message : String(error)));
        return NextResponse.json(
            { success: false, error: '删除失败' },
            { status: 500 }
        );
    }
}
