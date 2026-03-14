/**
 * Clawscan 多Agent架构 — 专用类型定义
 */

import type { ModelProvider } from '@/types';
import type { ParsedClawIdea, ClawscanSearchSignals } from '@/types/clawscan';

// ============================================================
//  Agent 输入
// ============================================================

export interface ClawscanAgentInput {
    parsedIdea: ParsedClawIdea;
    signals: ClawscanSearchSignals;
    language: 'zh' | 'en';
    modelProvider: ModelProvider;
    onProgress?: (event: 'log' | 'progress' | 'agent_state', data: Record<string, unknown> | string | number) => void;
    _abortSignal?: AbortSignal;
}

// ============================================================
//  Agent 输出
// ============================================================

export interface ClawscanAgentOutput {
    agentName: string;
    analysis: string;
    score: number;                    // 0-100
    confidence: 'high' | 'medium' | 'low';
    keyFindings: string[];
    redFlags: string[];
    evidenceSources: string[];
    reasoning: string;
    isFallback?: boolean;
}

/** Registry 侦察员专用输出 */
export interface RegistryScoutOutput extends ClawscanAgentOutput {
    skillMatches: Array<{
        index: number;
        similarityPercentage: number;
        reason: string;
        matchedFeatures: string[];
        coverageRate: number;
    }>;
}

/** 实战案例分析师专用输出 */
export interface CaseAnalystOutput extends ClawscanAgentOutput {
    caseStudies: Array<{
        title: string;
        url: string;
        relevanceScore: number;
        keyInsight: string;
        technologyUsed?: string;
        deploymentScale?: string;
    }>;
}

/** 创新度审计师输出 */
export interface NoveltyAuditorOutput extends ClawscanAgentOutput {
    innovationHighlights: string[];
    differentiators: string[];
    gapAnalysis: string;
}

/** 战略仲裁官输出 */
export interface StrategicArbiterOutput extends ClawscanAgentOutput {
    overallScore: number;
    grade: 'S' | 'A' | 'B' | 'C' | 'D';
    duplicationLevel: 'high' | 'medium' | 'low' | 'none';
    verdict: string;
    recommendation: {
        type: 'use_existing' | 'differentiate' | 'build_new';
        text: string;
        details: string;
        actionText: string;
    };
    strategicAdvice: string;
    riskWarnings: string[];
}

// ============================================================
//  编排器报告
// ============================================================

export interface ClawscanOrchestratorReport {
    registryScout: RegistryScoutOutput;
    caseAnalyst: CaseAnalystOutput;
    noveltyAuditor: NoveltyAuditorOutput;
    strategicArbiter: StrategicArbiterOutput;
    executionMeta: {
        totalTimeMs: number;
        agentTimings: Record<string, number>;
        timeoutsOccurred: string[];
        modelUsed: string;
    };
}
