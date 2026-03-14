/**
 * Bizscan 质量护卫 (Layer 5)
 *
 * 纯逻辑层 — 无 AI 调用。
 * 职责：评分一致性检查、降级标记、异常检测。
 */

import type {
    BizscanAgentOutput,
    MarketScoutOutput,
    CompetitorProfilerOutput,
    CrossValidationResult,
    StrategicArbiterResult,
    BizscanQualityResult,
} from './types';

/**
 * 质量检查 — 验证全部报告的逻辑一致性
 */
export function bizscanQualityGuard(
    marketScout: MarketScoutOutput,
    competitorProfiler: CompetitorProfilerOutput,
    noveltyAuditor: BizscanAgentOutput,
    feasibilityExaminer: BizscanAgentOutput,
    crossValidation: CrossValidationResult,
    arbiter: StrategicArbiterResult,
): BizscanQualityResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    let consistencyScore = 100;

    const agents = [marketScout, competitorProfiler, noveltyAuditor, feasibilityExaminer];

    // 1. 检查是否有 Fallback Agent
    const fallbackAgents = agents.filter(a => a.isFallback);
    if (fallbackAgents.length > 0) {
        const names = fallbackAgents.map(a => a.agentName).join('、');
        warnings.push(`${names} 使用了降级策略，结果仅供参考`);
        consistencyScore -= fallbackAgents.length * 10;
    }

    // 2. 评分极端值检查
    for (const agent of agents) {
        if (agent.score < 5 || agent.score > 98) {
            warnings.push(`${agent.agentName} 评分 ${agent.score} 过于极端`);
            consistencyScore -= 5;
        }
    }

    // 3. BII 与各维度评分一致性
    const { calibratedScores } = crossValidation;
    const avgCalibratedScore = Math.round(
        (calibratedScores.semanticNovelty + calibratedScores.competitiveLandscape +
            calibratedScores.marketGap + calibratedScores.feasibility) / 4
    );
    const biiDelta = Math.abs(arbiter.overallBII - avgCalibratedScore);
    if (biiDelta > 20) {
        issues.push(`BII (${arbiter.overallBII}) 与四维平均分 (${avgCalibratedScore}) 差距过大 (Δ${biiDelta})`);
        consistencyScore -= 15;
    }

    // 4. Agent 间评分分散度
    const scores = agents.map(a => a.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const spread = maxScore - minScore;
    if (spread > 50) {
        warnings.push(`各 Agent 评分分散度过大 (${minScore}-${maxScore}，差值 ${spread})，建议关注报告细节`);
        consistencyScore -= 10;
    }

    // 5. 交叉验证一致性纳入
    if (crossValidation.consistencyScore < 50) {
        warnings.push(`交叉验证一致性较低 (${crossValidation.consistencyScore}/100)`);
        consistencyScore -= 10;
    }
    if (crossValidation.evidenceConflicts.length > 2) {
        warnings.push(`发现 ${crossValidation.evidenceConflicts.length} 处证据冲突`);
        consistencyScore -= 5;
    }

    // 6. 必填字段完整性
    if (!arbiter.verdict) issues.push('缺少最终判定 (verdict)');
    if (arbiter.recommendations.length === 0) issues.push('缺少战略建议');
    if (arbiter.riskWarnings.length === 0) warnings.push('缺少风险提示');

    consistencyScore = Math.max(0, Math.min(100, consistencyScore));
    const passed = issues.length === 0;

    return { passed, issues, warnings, consistencyScore };
}
