export const dynamic = 'force-dynamic';

/**
 * CaseVault — 用户 Idea 入库端点
 *
 * POST — 由 Clawscan 流程异步调用
 *
 * 将用户提交的 Idea 润色后存入案例库
 * 成本：1 次 Gemini Flash 调用
 */

import { NextResponse } from 'next/server';
import { ingestUserIdea } from '@/server/casevault/scheduler';
import { checkRateLimit } from '@/lib/security/apiSecurity';

export async function POST(request: Request) {
    try {
        // 🔒 速率限制
        const rateLimitRes = await checkRateLimit(request, 'casevault-ingest', 3);
        if (rateLimitRes) return rateLimitRes;

        // 🔒 用户认证
        const { data: { user } } = await serverDb.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { success: false, error: '请先登录' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { ideaDescription } = body;

        if (!ideaDescription || typeof ideaDescription !== 'string') {
            return NextResponse.json(
                { success: false, error: '缺少 ideaDescription 参数' },
                { status: 400 }
            );
        }

        if (ideaDescription.length < 10) {
            return NextResponse.json(
                { success: false, error: 'Idea 描述太短（至少 10 个字符）' },
                { status: 400 }
            );
        }

        // 异步执行，不等待完成
        // 使用 waitUntil 模式（Vercel 支持）
        const resultPromise = ingestUserIdea(ideaDescription);

        // 如果在 Vercel 环境中可以用 waitUntil，否则 await
        // 这里采用简单的 fire-and-forget + catch  
        resultPromise.catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[CaseVault/Ingest] 后台入库失败:', msg);
        });

        return NextResponse.json({
            success: true,
            message: '已提交入库处理',
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[CaseVault/Ingest] 请求处理失败:', msg);
        return NextResponse.json(
            { success: false, error: msg },
            { status: 500 }
        );
    }
}
