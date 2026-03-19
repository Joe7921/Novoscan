/**
 * 编排层类型 — 仲裁结果、辩论记录、质量检查、最终报告
 *
 * @module types/orchestration
 */

import type { AgentOutput, InnovationRadarDimension } from './agent';
import type { CrossDomainScoutOutput } from './cross-domain';
import type { AgentExecutionRecord } from '@/lib/db/schema';

/** 加权评分明细项 */
export interface WeightedScoreItem {
    raw: number;
    weight: number;
    weighted: number;
    confidence: 'high' | 'medium' | 'low';
}

/** 仲裁结果（工业级） */
export interface ArbitrationResult {
    summary: string;
    overallScore: number;
    recommendation: string;
    conflictsResolved: string[];
    nextSteps: string[];
    isPartial?: boolean;
    reasoningContent?: string;           // DeepSeek R1 思维链（推理过程）
    usedModel?: string;                  // 仲裁员实际使用的模型
    weightedBreakdown: {                 // 加权评分明细
        academic: WeightedScoreItem;
        industry: WeightedScoreItem;
        innovation: WeightedScoreItem;
        competitor: WeightedScoreItem;
    };
    consensusLevel: 'strong' | 'moderate' | 'weak';  // 专家共识度
    dissent: string[];                   // 少数派异议
    crossDomainVerification?: {          // 仲裁员对跨域建议的后处理验证
        overallAssessment: string;       // 总体评价
        verifiedBridges: string[];       // 验证通过的桥梁
        questionableClaims: string[];    // 存疑的案例引用
        enhancedSuggestions: string[];   // 增强的迁移建议
    };
}

export interface QualityCheckResult {
    passed: boolean;
    issues: string[];
    warnings: string[];                  // 非致命警告
    consistencyScore: number;            // 逻辑一致性评分 0-100
    /** 自动修正记录：当检测到明确逻辑矛盾时自动纠正 */
    corrections: Array<{ field: string; from: string; to: string; reason: string }>;
}

// ==================== NovoDebate 对抗辩论架构类型 ====================

/** NovoDebate 单轮辩论交锋记录 */
export interface DebateExchange {
    round: number;                    // 第几轮（1 or 2）
    challenger: string;               // 挑战方 Agent 名称
    challengerArgument: string;       // 挑战论点
    challengerEvidence: string[];     // 引用的证据
    defender: string;                 // 防守方 Agent 名称
    defenderRebuttal: string;         // 反驳论点
    defenderEvidence: string[];       // 引用的反驳证据
    outcome: 'challenger_wins' | 'defender_wins' | 'draw'; // 本轮裁判判定
    outcomeReasoning: string;         // 判定理由
}

/** NovoDebate 单场辩论结果 */
export interface DebateSession {
    sessionId: string;                // 辩论场次标识（如 'academic_vs_competitor'）
    topic: string;                    // 辩论主题
    proAgent: string;                 // 正方 Agent
    conAgent: string;                 // 反方 Agent
    scoreDivergence: number;          // 触发辩论的评分差异
    exchanges: DebateExchange[];      // 交锋记录
    verdict: string;                  // 辩论结论
    keyInsights: string[];            // 辩论过程中发现的新洞察
    scoreAdjustment: {                // 辩论后的评分修正建议
        proAgentDelta: number;        // 正方评分修正（-15 ~ +15）
        conAgentDelta: number;        // 反方评分修正（-15 ~ +15）
    };
}

/** NovoDebate 结构化分歧项 */
export interface DissentItem {
    dimension: string;                // 分歧维度（如"学术空白 vs 市场已有实现"）
    proAgent: string;                 // 正方 Agent
    proPosition: string;              // 正方立场摘要
    conAgent: string;                 // 反方 Agent
    conPosition: string;              // 反方立场摘要
    severity: 'high' | 'medium' | 'low';  // 分歧程度
    resolution: string;               // 裁决结论
    roundsDebated: number;            // 辩论了几轮
    winner: 'pro' | 'con' | 'draw';   // 最终胜方
}

/** NovoDebate 完整辩论记录 */
export interface DebateRecord {
    triggered: boolean;               // 是否触发了辩论
    triggerReason: string;            // 触发/跳过原因
    sessions: DebateSession[];        // 辩论场次列表
    totalDurationMs: number;          // 辩论总耗时
    dissentReport: DissentItem[];     // 结构化分歧报告（核心产出）
    dissentReportText: string;        // 文本版分歧报告（供仲裁员 prompt）
}

export interface FinalReport {
    academicReview: AgentOutput;
    industryAnalysis: AgentOutput;
    innovationEvaluation: AgentOutput;
    competitorAnalysis: AgentOutput;
    crossDomainTransfer?: CrossDomainScoutOutput;  // 跨域创新迁移引擎
    debate: DebateRecord;             // NovoDebate 对抗辩论记录
    arbitration: ArbitrationResult;
    qualityCheck: QualityCheckResult;
    executionRecord?: AgentExecutionRecord;
    /** Agent 记忆进化 — 本次分析使用的历史经验参考 */
    memoryInsight?: {
        experiencesUsed: number;
        relevantQueries: string[];
        contextSummary: string;
    };
    /** 插件 Agent 增强结果（仅 ENABLE_PLUGIN_AGENTS=true 时填充） */
    pluginResults?: Array<{
        /** 插件 Agent ID */
        agentId: string;
        /** 插件 Agent 输出 */
        output: AgentOutput;
        /** 执行耗时（毫秒） */
        durationMs: number;
    }>;
}

// Re-export for convenience
export type { InnovationRadarDimension } from './agent';
