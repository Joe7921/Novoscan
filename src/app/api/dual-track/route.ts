export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { searchDualTrack } from '@/server/search/dual-track'
import { checkRateLimit, safeErrorResponse } from '@/lib/security/apiSecurity'

export async function POST(request: Request) {
    try {
        // 🔒 速率限制（5次/分钟）
        const rateLimitRes = await checkRateLimit(request, 'dual-track', 5);
        if (rateLimitRes) return rateLimitRes;

        const { keywords, domain } = await request.json();

        // 输入验证
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return NextResponse.json(
                { success: false, error: '请提供有效的关键词列表' },
                { status: 400 }
            );
        }

        // 限制关键词数量和长度
        const safeKeywords = keywords.slice(0, 10).map((k: any) =>
            typeof k === 'string' ? k.slice(0, 200) : ''
        ).filter(Boolean);

        const result = await searchDualTrack(safeKeywords, domain);
        return NextResponse.json(result);

    } catch (error: any) {
        return safeErrorResponse(error, '双轨检索失败', 500, '[API DualTrack]');
    }
}
