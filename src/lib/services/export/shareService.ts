/**
 * 报告分享服务
 *
 * 负责将分析报告保存为公开可访问的链接，
 * 以及通过 ID 获取公开报告数据。
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:0';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-key-for-build-only';

// 使用 service role key 以绕过 RLS（服务端调用）
function getAdminClient() {
    return createClient(supabaseUrl, supabaseServiceKey);
}

// ============ 类型定义 ============

export interface PublicReport {
    id: string;
    idea_summary: string;
    idea_full: string | null;
    report_type: 'novoscan' | 'bizscan' | 'clawscan' | 'flash';
    overall_score: number;
    novelty_level: string;
    key_finding: string | null;
    report_json: any;
    user_id: string | null;
    view_count: number;
    created_at: string;
}

export interface ShareReportInput {
    ideaSummary: string;
    ideaFull?: string;
    reportType: 'novoscan' | 'bizscan' | 'clawscan' | 'flash';
    overallScore: number;
    noveltyLevel: string;
    keyFinding?: string;
    reportJson: any;
    userId?: string;
}

// ============ 核心方法 ============

/**
 * 保存报告为公开分享
 * @returns 公开报告的 ID（用于构建分享链接）
 */
export async function shareReport(input: ShareReportInput): Promise<{ id: string } | null> {
    const supabase = getAdminClient();

    const { data, error } = await supabase
        .from('public_reports')
        .insert({
            idea_summary: input.ideaSummary.slice(0, 200),
            idea_full: input.ideaFull || null,
            report_type: input.reportType,
            overall_score: input.overallScore || 0,
            novelty_level: input.noveltyLevel || 'Medium',
            key_finding: input.keyFinding?.slice(0, 500) || null,
            report_json: input.reportJson,
            user_id: input.userId || null,
        })
        .select('id')
        .single();

    if (error) {
        console.error('[ShareService] 保存公开报告失败:', error);
        return null;
    }

    return { id: data.id };
}

/**
 * 通过 ID 获取公开报告
 * 同时自增浏览次数
 */
export async function getPublicReport(id: string): Promise<PublicReport | null> {
    const supabase = getAdminClient();

    // 获取报告数据
    const { data, error } = await supabase
        .from('public_reports')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        console.error('[ShareService] 获取公开报告失败:', error);
        return null;
    }

    // 异步自增浏览次数（不阻塞返回）
    supabase
        .from('public_reports')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', id)
        .then(() => { /* 忽略 */ });

    return data as PublicReport;
}

/**
 * 获取最新公开报告列表（用于首页展示）
 */
export async function getRecentPublicReports(limit: number = 10): Promise<PublicReport[]> {
    const supabase = getAdminClient();

    const { data, error } = await supabase
        .from('public_reports')
        .select('id, idea_summary, report_type, overall_score, novelty_level, key_finding, view_count, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[ShareService] 获取最新报告列表失败:', error);
        return [];
    }

    return (data || []) as PublicReport[];
}
