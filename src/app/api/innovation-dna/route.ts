export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { checkRateLimit, sanitizeInput, isValidModelProvider, safeErrorResponse } from '@/lib/security/apiSecurity';
import { buildInnovationMap } from '@/lib/services/innovation/innovationDNA';
import type { ModelProvider } from '@/types';

/**
 * POST /api/innovation-dna
 *
 * NovoDNA 创新基因图谱 API
 *
 * Body: { query: string, analysisContext?: string, modelProvider?: string }
 * Returns: InnovationDNAMap
 */
export async function POST(request: Request) {
    try {
        // 速率限制（10 次/分钟）
        const rateLimitRes = await checkRateLimit(request, 'innovation-dna', 10);
        if (rateLimitRes) return rateLimitRes;

        const body = await request.json();
        const query = sanitizeInput(body.query, 2000);

        if (!query || query.length < 2) {
            return NextResponse.json(
                { success: false, error: '查询内容不能为空且至少 2 个字符' },
                { status: 400 }
            );
        }

        const modelProvider: ModelProvider = isValidModelProvider(body.modelProvider)
            ? body.modelProvider
            : 'minimax';

        const analysisContext = typeof body.analysisContext === 'string'
            ? body.analysisContext.slice(0, 3000)
            : undefined;

        console.log(`[API InnovationDNA] 开始构建 Innovation Map: "${query.slice(0, 40)}..."`);

        const map = await buildInnovationMap(query, analysisContext, modelProvider);

        return NextResponse.json({
            success: true,
            data: map,
        });
    } catch (error: unknown) {
        return safeErrorResponse(error, 'NovoDNA 分析失败', 500, '[API NovoDNA]');
    }
}
