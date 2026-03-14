/**
 * Bizscan 多Agent架构 — 专用类型定义
 *
 * 继承并扩展通用 Agent 类型体系，为商业想法评估定制。
 */

import type { ModelProvider } from '@/types';
import type { ParsedBusinessIdea, MarketSignals, CompetitorInfo, MarketInsights, BizscanReport } from '@/types/bizscan';

// ============================================================
//  Agent 输入
// ============================================================

/** Bizscan Agent 通用输入 */
export interface BizscanAgentInput {
    parsedIdea: ParsedBusinessIdea;
    marketSignals: MarketSignals;
    language: 'zh' | 'en';
    modelProvider: ModelProvider;
    onProgress?: (event: 'log' | 'progress' | 'agent_state', data: Record<string, unknown> | string | number) => void;
    _abortSignal?: AbortSignal;
}

// ============================================================
//  Agent 输出
// ============================================================

/** 维度评分 */
export interface BizscanDimensionScore {
    name: string;
    score: number;       // 0-100
    reasoning: string;
}

/** Bizscan Agent 通用输出 */
export interface BizscanAgentOutput {
    agentName: string;
    analysis: string;                         // 完整分析文本
    score: number;                            // 0-100 综合评分
    confidence: 'high' | 'medium' | 'low';
    confidenceReasoning: string;
    keyFindings: string[];
    redFlags: string[];
    evidenceSources: string[];
    reasoning: string;                        // 推理过程
    dimensionScores: BizscanDimensionScore[];
    isFallback?: boolean;
}

/** 市场侦察员专用输出扩展 */
export interface MarketScoutOutput extends BizscanAgentOutput {
    marketInsights: MarketInsights;
    demandSignals: string[];                  // 需求验证信号
}

/** 竞品拆解师专用输出扩展 */
export interface CompetitorProfilerOutput extends BizscanAgentOutput {
    competitors: CompetitorInfo[];
    competitiveMoat: string;                  // 竞争护城河总结
    entryBarriers: string[];                  // 进入壁垒列表
}

/** 交叉验证结果 */
export interface CrossValidationResult {
    divergences: Array<{
        dimension: string;
        agents: string[];
        scoreDelta: number;
        resolution: string;
    }>;
    calibratedScores: {
        semanticNovelty: number;
        competitiveLandscape: number;
        marketGap: number;
        feasibility: number;
    };
    consistencyScore: number;                 // 0-100 内部一致性
    evidenceConflicts: string[];
}

/** 战略仲裁结果 */
export interface StrategicArbiterResult {
    overallBII: number;
    grade: 'S' | 'A' | 'B' | 'C' | 'D';
    verdict: string;
    recommendations: string[];
    riskWarnings: string[];
    strategicAdvice: string;
    weightedBreakdown: {
        semanticNovelty: { raw: number; weight: number; weighted: number };
        competitiveLandscape: { raw: number; weight: number; weighted: number };
        marketGap: { raw: number; weight: number; weighted: number };
        feasibility: { raw: number; weight: number; weighted: number };
    };
    consensusLevel: 'strong' | 'moderate' | 'weak';
    dissent: string[];
}

/** 质量检查结果 */
export interface BizscanQualityResult {
    passed: boolean;
    issues: string[];
    warnings: string[];
    consistencyScore: number;
}

/** 最终编排器报告 */
export interface BizscanOrchestratorReport {
    marketScout: MarketScoutOutput;
    competitorProfiler: CompetitorProfilerOutput;
    noveltyAuditor: BizscanAgentOutput;
    feasibilityExaminer: BizscanAgentOutput;
    crossValidation: CrossValidationResult;
    arbiterResult: StrategicArbiterResult;
    qualityCheck: BizscanQualityResult;
    executionMeta: {
        totalTimeMs: number;
        agentTimings: Record<string, number>;
        timeoutsOccurred: string[];
        modelUsed: string;
    };
}
