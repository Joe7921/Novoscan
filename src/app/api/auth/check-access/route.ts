/**
 * 权限检查 API 端点
 *
 * GET /api/auth/check-access?feature=tracker
 *
 * 供前端查询当前登录用户是否拥有指定功能的权限。
 * 通过 getCurrentUser() 自动适配 NextAuth / Supabase 认证模式。
 * 返回 { hasAccess: boolean }
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/stubs';

// 此路由依赖 cookies/auth，不能在构建时预渲染
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const feature = searchParams.get('feature');

        if (!feature) {
            return NextResponse.json(
                { hasAccess: false, error: '缺少 feature 参数' },
                { status: 400 }
            );
        }

        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ hasAccess: false }, { status: 401 });
        }

        const hasAccess = await checkFeatureAccess(user.id, feature);

        return NextResponse.json({ hasAccess });
    } catch {
        return NextResponse.json({ hasAccess: false }, { status: 500 });
    }
}

