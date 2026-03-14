/**
 * 权限检查 API 端点
 *
 * GET /api/auth/check-access?feature=tracker
 *
 * 供前端查询当前登录用户是否拥有指定功能的权限。
 * 返回 { hasAccess: boolean }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { checkFeatureAccess } from '@/lib/services/featureAccessService';

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

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ hasAccess: false }, { status: 401 });
        }

        const hasAccess = await checkFeatureAccess(user.id, feature);

        return NextResponse.json({ hasAccess });
    } catch {
        return NextResponse.json({ hasAccess: false }, { status: 500 });
    }
}
