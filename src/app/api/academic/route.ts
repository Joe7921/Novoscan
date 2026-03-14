export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { searchAcademic } from '@/server/search/academic'
import { checkRateLimit, safeErrorResponse } from '@/lib/security/apiSecurity'

export async function POST(request: Request) {
    try {
        // 🔒 速率限制（10次/分钟）
        const rateLimitRes = await checkRateLimit(request, 'academic', 10);
        if (rateLimitRes) return rateLimitRes;

        const { keywords, domain } = await request.json()

        // 输入验证
        if (!keywords || (Array.isArray(keywords) && keywords.length === 0)) {
            return NextResponse.json(
                { success: false, error: '请提供有效的关键词' },
                { status: 400 }
            );
        }

        console.log('[API Academic] 搜索:', keywords)

        const result = await searchAcademic(keywords, domain)
        return NextResponse.json(result)

    } catch (error: unknown) {
        return safeErrorResponse(error, '学术搜索失败', 500, '[API Academic]');
    }
}
