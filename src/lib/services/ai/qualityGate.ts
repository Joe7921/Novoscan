/**
 * 创新点入库质量门控模块
 *
 * 三层防护机制：
 *   1. 软拦截：qualityCheck 未通过或一致性评分极低时阻止入库
 *   2. 置信度门槛：超半数 Agent 为低置信度时拦截创新点提取
 *   3. 分级入库：标记质量等级，趋势计算时按等级加权
 */

import type { QualityCheckResult, AgentOutput } from '@/agents/types';

// ==================== 质量等级类型 ====================

export type QualityTier = 'high' | 'medium' | 'low';

// ==================== 阈值配置 ====================

/** 质量门控阈值配置（集中管理，避免魔法数字） */
export const QUALITY_GATE_CONFIG = {
    /** 一致性评分低于此值时阻止入库 */
    blockConsistencyThreshold: 30,
    /** 一致性评分高于此值且质量检查通过时为 high */
    highTierThreshold: 70,
    /** 一致性评分高于此值时为 medium（低于此值为 low） */
    mediumTierThreshold: 40,
    /** 趋势加权系数 */
    trendWeights: {
        high: 1.0,
        medium: 0.6,
        low: 0.3,
    } as Record<QualityTier, number>,
} as const;

// ==================== 核心函数 ====================

/**
 * 判断是否应阻止分析结果入库
 *
 * 拦截条件（任一满足即阻止）：
 *   - qualityCheck.passed === false
 *   - qualityCheck.consistencyScore < 30
 *   - 超过半数 Agent 为 low 置信度
 */
export function shouldBlockStorage(
    qualityCheck: QualityCheckResult,
    agents: AgentOutput[]
): { blocked: boolean; reason: string } {
    // 条件 1：质量检查未通过
    if (!qualityCheck.passed) {
        return {
            blocked: true,
            reason: `质量检查未通过 (issues: ${qualityCheck.issues.join('; ')})`,
        };
    }

    // 条件 2：一致性评分极低
    if (qualityCheck.consistencyScore < QUALITY_GATE_CONFIG.blockConsistencyThreshold) {
        return {
            blocked: true,
            reason: `一致性评分过低 (${qualityCheck.consistencyScore} < ${QUALITY_GATE_CONFIG.blockConsistencyThreshold})`,
        };
    }

    // 条件 3：超过半数 Agent 为低置信度
    const lowConfidenceCount = agents.filter(a => a.confidence === 'low').length;
    if (agents.length > 0 && lowConfidenceCount > agents.length / 2) {
        return {
            blocked: true,
            reason: `${lowConfidenceCount}/${agents.length} 个 Agent 为低置信度，超过半数`,
        };
    }

    return { blocked: false, reason: '' };
}

/**
 * 计算入库数据的质量等级
 *
 *   high:   consistencyScore >= 70 且 passed === true
 *   medium: consistencyScore >= 40
 *   low:    其他（consistencyScore < 40 或 passed === false）
 */
export function computeQualityTier(
    qualityCheck: QualityCheckResult,
    agents: AgentOutput[]
): QualityTier {
    // 如果有 fallback Agent，自动降一级
    const fallbackCount = agents.filter(a => a.isFallback).length;
    const hasFallback = fallbackCount > 0;

    if (
        qualityCheck.passed &&
        qualityCheck.consistencyScore >= QUALITY_GATE_CONFIG.highTierThreshold &&
        !hasFallback
    ) {
        return 'high';
    }

    if (qualityCheck.consistencyScore >= QUALITY_GATE_CONFIG.mediumTierThreshold) {
        return 'medium';
    }

    return 'low';
}

/**
 * 从分析结果中提取 Agent 置信度信息，判断是否可信
 *
 * 当超过半数 Agent 为 low 置信度 且 全部为 fallback 时返回不可信
 * 用于 handleSearchComplete 中的前置过滤
 */
export function computeConfidenceGate(analysisResult: Record<string, unknown>): {
    passed: boolean;
    reason: string;
    lowCount: number;
    totalCount: number;
} {
    // 从分析结果中收集各 Agent 的置信度
    const agentKeys = ['academicReview', 'industryAnalysis', 'innovationEvaluation', 'competitorAnalysis'];
    const agents: Array<{ confidence: string; isFallback: boolean }> = [];

    for (const key of agentKeys) {
        const agent = analysisResult?.[key] as Record<string, unknown> | undefined;
        if (agent && typeof agent.confidence === 'string') {
            agents.push({
                confidence: agent.confidence,
                isFallback: !!agent.isFallback,
            });
        }
    }

    if (agents.length === 0) {
        // 没有 Agent 信息（可能是旧格式），放行
        return { passed: true, reason: '无 Agent 置信度信息，放行', lowCount: 0, totalCount: 0 };
    }

    const lowCount = agents.filter(a => a.confidence === 'low').length;
    const fallbackCount = agents.filter(a => a.isFallback).length;

    // 全部为 fallback → 数据完全不可靠
    if (fallbackCount === agents.length && agents.length > 0) {
        return {
            passed: false,
            reason: `全部 ${agents.length} 个 Agent 为 fallback，数据不可靠`,
            lowCount,
            totalCount: agents.length,
        };
    }

    // 超过半数为低置信度
    if (lowCount > agents.length / 2) {
        return {
            passed: false,
            reason: `${lowCount}/${agents.length} 个 Agent 为低置信度，超过半数`,
            lowCount,
            totalCount: agents.length,
        };
    }

    return { passed: true, reason: '', lowCount, totalCount: agents.length };
}

/**
 * 获取质量等级对应的趋势加权系数
 */
export function getTrendWeight(tier: QualityTier): number {
    return QUALITY_GATE_CONFIG.trendWeights[tier] ?? 1.0;
}
