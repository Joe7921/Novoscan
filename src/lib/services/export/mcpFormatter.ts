/**
 * MCP 轻量级结果格式化器
 *
 * 将 FlashReport 完整数据精简为适合 LLM 消费的紧凑格式
 * 目标：输出 token 数控制在 ~500 以内
 */

import type { FlashReport } from '@/agents/flashOrchestrator';

// ==================== 输出类型 ====================

/** MCP 轻量级分析结果 */
export interface McpAnalysisResult {
    /** 综合创新评分 (0-100) */
    score: number;
    /** 行动建议等级 */
    recommendation: string;
    /** 一句话评估摘要 */
    summary: string;
    /** 关键发现 (最多 6 条) */
    keyFindings: string[];
    /** 风险与红旗 (最多 4 条) */
    risks: string[];
    /** 四维 Agent 评分 */
    agentScores: {
        academic: number;
        industry: number;
        innovation: number;
        competitor: number;
    };
    /** 最相似的现有研究 (最多 3 篇) */
    topPapers: Array<{
        title: string;
        similarity: number;
        difference: string;
    }>;
    /** 建议下一步行动 */
    nextSteps: string[];
    /** 分析耗时 (毫秒) */
    executionTimeMs: number;
    /** 数据质量 */
    quality: {
        passed: boolean;
        consistency: number;
        warnings: string[];
    };
}

// ==================== 格式化函数 ====================

/**
 * 将 FlashReport 格式化为 MCP 轻量级结果
 */
export function formatFlashReportForMcp(report: FlashReport): McpAnalysisResult {
    const {
        academicReview,
        industryAnalysis,
        innovationEvaluation,
        competitorAnalysis,
        arbitration,
        qualityCheck,
        executionRecord,
    } = report;

    // 聚合关键发现（每个 Agent 取前 2 条，共 6 条）
    const keyFindings = [
        ...(academicReview?.keyFindings || []).slice(0, 2),
        ...(industryAnalysis?.keyFindings || []).slice(0, 2),
        ...(innovationEvaluation?.keyFindings || []).slice(0, 2),
    ].filter(Boolean).slice(0, 6);

    // 聚合风险提示
    const risks = [
        ...(academicReview?.redFlags || []),
        ...(industryAnalysis?.redFlags || []),
        ...(innovationEvaluation?.redFlags || []),
        ...(competitorAnalysis?.redFlags || []),
    ].filter(Boolean).slice(0, 4);

    // 相似论文（取前 3）
    const topPapers = (academicReview?.similarPapers || [])
        .slice(0, 3)
        .map((p: { title?: string; similarityScore?: number; keyDifference?: string }) => ({
            title: p.title || '',
            similarity: p.similarityScore || 0,
            difference: p.keyDifference || '',
        }));

    return {
        score: arbitration?.overallScore ?? 0,
        recommendation: arbitration?.recommendation ?? '无法评估',
        summary: arbitration?.summary ?? '分析失败',
        keyFindings,
        risks,
        agentScores: {
            academic: academicReview?.score ?? 0,
            industry: industryAnalysis?.score ?? 0,
            innovation: innovationEvaluation?.score ?? 0,
            competitor: competitorAnalysis?.score ?? 0,
        },
        topPapers,
        nextSteps: (arbitration?.nextSteps || []).slice(0, 3),
        executionTimeMs: executionRecord?.metadata?.totalExecutionTimeMs ?? 0,
        quality: {
            passed: qualityCheck?.passed ?? false,
            consistency: qualityCheck?.consistencyScore ?? 0,
            warnings: (qualityCheck?.warnings || []).slice(0, 2),
        },
    };
}
