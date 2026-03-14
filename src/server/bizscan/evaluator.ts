/**
 * Bizscan 商业想法创新度查重 — 多维评估引擎
 *
 * V2: 已重构为调用 Bizscan 多Agent编排器。
 * 
 * 职责：
 * 1. 接收 ParsedBusinessIdea + MarketSignals
 * 2. 调用 bizscanOrchestrate() 执行5层6Agent编排
 * 3. 将编排器报告转换为 BizscanReport 格式
 */

import { bizscanOrchestrate } from '@/agents/bizscan/orchestrator';
import type { ModelProvider } from '@/types';
import type {
    ParsedBusinessIdea,
    MarketSignals,
    BizscanReport,
    DimensionAssessment,
    DimensionResults,
    CompetitorInfo,
    MarketInsights,
} from '@/types/bizscan';
import type { BizscanAgentInput } from '@/agents/bizscan/types';

// ============================================================
//  权重配置
// ============================================================

const DIMENSION_WEIGHTS = {
    semanticNovelty: 0.25,
    competitiveLandscape: 0.30,
    marketGap: 0.25,
    feasibility: 0.20,
} as const;

// ============================================================
//  主入口
// ============================================================

/**
 * 执行完整的商业想法多维评估（多Agent版本）
 */
export async function evaluateBusinessIdea(
    parsedIdea: ParsedBusinessIdea,
    marketSignals: MarketSignals,
    modelProvider: ModelProvider = 'minimax',
    onProgress?: (event: 'log' | 'progress' | 'agent_state', data: any) => void,
): Promise<BizscanReport> {
    console.log(`[Bizscan/Evaluator] 启动多Agent评估 (${modelProvider})`);
    const startTime = Date.now();

    // 1. 构建Agent输入
    const agentInput: BizscanAgentInput = {
        parsedIdea,
        marketSignals,
        language: 'zh',
        modelProvider,
        onProgress,
    };

    // 2. 执行5层6Agent编排
    const orchestratorReport = await bizscanOrchestrate(agentInput);

    // 3. 转换为 BizscanReport 格式
    const { arbiterResult, crossValidation, marketScout, competitorProfiler, qualityCheck, executionMeta } = orchestratorReport;
    const { calibratedScores } = crossValidation;

    // 使用交叉验证校准后的评分构建维度详情
    const dimensions: DimensionResults = {
        semanticNovelty: buildDimensionAssessment(
            calibratedScores.semanticNovelty,
            DIMENSION_WEIGHTS.semanticNovelty,
            orchestratorReport.noveltyAuditor,
        ),
        competitiveLandscape: buildDimensionAssessment(
            calibratedScores.competitiveLandscape,
            DIMENSION_WEIGHTS.competitiveLandscape,
            orchestratorReport.competitorProfiler,
        ),
        marketGap: buildDimensionAssessment(
            calibratedScores.marketGap,
            DIMENSION_WEIGHTS.marketGap,
            orchestratorReport.marketScout,
        ),
        feasibility: buildDimensionAssessment(
            calibratedScores.feasibility,
            DIMENSION_WEIGHTS.feasibility,
            orchestratorReport.feasibilityExaminer,
        ),
    };

    // 竞品列表（来自竞品拆解师）
    const competitors: CompetitorInfo[] = competitorProfiler.competitors.slice(0, 8).map(c => ({
        ...c,
        source: c.source || 'AI Analysis',
        threatLevel: (['high', 'medium', 'low'].includes(c.threatLevel) ? c.threatLevel : 'medium') as CompetitorInfo['threatLevel'],
        similarityScore: Math.max(0, Math.min(100, Math.round(c.similarityScore || 0))),
    }));

    // 市场洞察（来自市场侦察员）
    const marketInsights: MarketInsights = normalizeMarketInsights(marketScout.marketInsights);

    const report: BizscanReport = {
        parsedIdea,
        overallBII: arbiterResult.overallBII,
        grade: arbiterResult.grade,
        verdict: arbiterResult.verdict,
        dimensions,
        competitors,
        marketInsights,
        recommendations: arbiterResult.recommendations,
        riskWarnings: arbiterResult.riskWarnings,
        strategicAdvice: arbiterResult.strategicAdvice,
        metadata: {
            searchTimeMs: Date.now() - startTime,
            sourcesScanned: marketSignals.totalSourcesScanned,
            competitorsFound: competitors.length,
            modelUsed: modelProvider,
            dataSourcesUsed: marketSignals.dataSourcesUsed,
        },
        // 新增：传递交叉验证数据以提升前端数据利用率
        crossValidation: {
            divergences: crossValidation.divergences,
            calibratedScores: crossValidation.calibratedScores,
            consistencyScore: crossValidation.consistencyScore,
            evidenceConflicts: crossValidation.evidenceConflicts,
        },
        consensusLevel: arbiterResult.consensusLevel,
        executionMeta: {
            totalTimeMs: executionMeta.totalTimeMs,
            timeoutsOccurred: executionMeta.timeoutsOccurred,
            agentTimings: executionMeta.agentTimings,
        },
    };

    console.log(
        `[Bizscan/Evaluator] 多Agent评估完成: BII=${report.overallBII}, Grade=${report.grade}, ` +
        `6Agent耗时=${executionMeta.totalTimeMs}ms, 一致性=${qualityCheck.consistencyScore}/100`
    );

    return report;
}

// ============================================================
//  辅助函数
// ============================================================

function buildDimensionAssessment(
    calibratedScore: number,
    weight: number,
    agentReport: { analysis: string; keyFindings: string[]; redFlags: string[]; confidence: string },
): DimensionAssessment {
    const score = Math.max(0, Math.min(100, Math.round(calibratedScore)));
    return {
        score,
        weight,
        grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F',
        reasoning: agentReport.analysis.slice(0, 300),
        evidence: agentReport.keyFindings.slice(0, 4),
        risks: agentReport.redFlags.slice(0, 3),
        agentRawText: agentReport.analysis, // 完整 Agent 原始分析文本
    };
}

function normalizeMarketInsights(raw: any): MarketInsights {
    const validTrends = ['explosive', 'growing', 'stable', 'declining'] as const;
    const validSaturation = ['oversaturated', 'crowded', 'moderate', 'emerging', 'blue-ocean'] as const;

    return {
        marketSize: raw?.marketSize,
        growthTrend: validTrends.includes(raw?.growthTrend) ? raw.growthTrend : 'stable',
        saturationLevel: validSaturation.includes(raw?.saturationLevel) ? raw.saturationLevel : 'moderate',
    };
}
