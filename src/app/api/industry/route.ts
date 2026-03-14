export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { searchIndustry } from '@/server/search/industry'
import { checkRateLimit, safeErrorResponse } from '@/lib/security/apiSecurity'

export async function POST(request: Request) {
    try {
        // 🔒 速率限制（10次/分钟）
        const rateLimitRes = await checkRateLimit(request, 'industry', 10);
        if (rateLimitRes) return rateLimitRes;

        const { keywords } = await request.json()

        // 输入验证
        if (!keywords) {
            return NextResponse.json(
                { success: false, error: '请提供有效的关键词' },
                { status: 400 }
            );
        }

        console.log('[API Industry] 搜索:', keywords)

        const result = await searchIndustry(keywords)
        return NextResponse.json(result)

    } catch (error: any) {
        return safeErrorResponse(error, '产业搜索失败', 500, '[API Industry]');
    }
}
