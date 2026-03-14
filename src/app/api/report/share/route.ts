export const dynamic = 'force-dynamic';

/**
 * POST /api/report/share — 将分析报告保存为公开分享链接
 *
 * 请求体:
 *   ideaSummary: string     — 想法摘要
 *   ideaFull?: string       — 完整想法
 *   reportType: string      — 报告类型
 *   overallScore: number    — 总分
 *   noveltyLevel: string    — 创新等级
 *   keyFinding?: string     — 核心发现
 *   reportJson: object      — 完整报告数据
 *
 * 响应:
 *   { shareId: string, shareUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { shareReport } from '@/lib/services/export/shareService';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            ideaSummary,
            ideaFull,
            reportType = 'novoscan',
            overallScore = 0,
            noveltyLevel = 'Medium',
            keyFinding,
            reportJson,
        } = body;

        if (!ideaSummary || !reportJson) {
            return NextResponse.json(
                { error: '缺少必要参数：ideaSummary 和 reportJson' },
                { status: 400 }
            );
        }

        // 获取当前用户（可选）
        let userId: string | undefined;
        try {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            userId = user?.id;
        } catch {
            // 匿名用户也可以分享
        }

        const result = await shareReport({
            ideaSummary,
            ideaFull,
            reportType,
            overallScore,
            noveltyLevel,
            keyFinding,
            reportJson,
            userId,
        });

        if (!result) {
            return NextResponse.json(
                { error: '分享失败，请稍后重试' },
                { status: 500 }
            );
        }

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://novoscan.cn';

        return NextResponse.json({
            shareId: result.id,
            shareUrl: `${baseUrl}/report/${result.id}`,
        });
    } catch (error) {
        console.error('[API/report/share] 错误:', error);
        return NextResponse.json(
            { error: '服务器内部错误' },
            { status: 500 }
        );
    }
}
