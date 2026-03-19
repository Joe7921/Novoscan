import { ArbitrationResult, AgentOutput, QualityCheckResult, DebateRecord } from '../types';
import { RECOMMENDATION_THRESHOLDS, mapScoreToRecommendation } from '../orchestrator';

/**
 * 质量把关（工业级，纯逻辑，不调用 AI）
 * 
 * 检查维度：
 * 1. 基础字段完整性
 * 2. 评分范围合法性
 * 3. 逻辑一致性（评分 vs 置信度、评分 vs 建议等级）
 * 4. 各 Agent 评分离散度（共识度）
 * 5. 证据覆盖率
 */
export function qualityGuard(
    arbitration: ArbitrationResult,
    agents: AgentOutput[],
    debateRecord?: DebateRecord
): QualityCheckResult {
    const issues: string[] = [];
    const warnings: string[] = [];

    // ==================== 1. 基础字段检查 ====================

    if (typeof arbitration.overallScore !== 'number' || arbitration.overallScore < 0 || arbitration.overallScore > 100) {
        issues.push(`综合评分超出有效范围 (0-100): ${arbitration.overallScore}`);
    }

    if (!arbitration.summary || arbitration.summary.trim().length < 10) {
        issues.push('综合摘要缺失或过短（至少10字符）');
    }

    if (!arbitration.recommendation || arbitration.recommendation.trim().length === 0) {
        issues.push('缺少最终建议');
    }

    const validRecommendations = ['强烈推荐', '推荐', '谨慎考虑', '不推荐',
        'Strongly Recommended', 'Recommended', 'Proceed with Caution', 'Not Recommended'];
    if (arbitration.recommendation && !validRecommendations.some(v =>
        arbitration.recommendation.includes(v)
    )) {
        warnings.push(`建议值不在预期范围内: "${arbitration.recommendation}"`);
    }

    if (!arbitration.nextSteps || !Array.isArray(arbitration.nextSteps) || arbitration.nextSteps.length === 0) {
        issues.push('缺少下一步行动建议');
    }

    if (!arbitration.conflictsResolved || !Array.isArray(arbitration.conflictsResolved)) {
        warnings.push('缺少冲突解决记录');
    }

    // ==================== 2. 评分 vs 建议等级一致性 ====================

    const score = arbitration.overallScore;
    const rec = arbitration.recommendation || '';
    if (typeof score === 'number') {
        if (score >= RECOMMENDATION_THRESHOLDS.stronglyRecommend && rec.includes('不推荐')) {
            issues.push(`逻辑矛盾：综合评分 ${score} ≥ ${RECOMMENDATION_THRESHOLDS.stronglyRecommend} 但建议为"不推荐"`);
        }
        if (score < RECOMMENDATION_THRESHOLDS.caution && (rec.includes('强烈推荐') || rec === '推荐' || rec === 'Recommended')) {
            issues.push(`逻辑矛盾：综合评分 ${score} < ${RECOMMENDATION_THRESHOLDS.caution} 但建议为"${rec}"`);
        }
    }

    // ==================== 3. 各 Agent 评分离散度检查 ====================

    const agentScores = agents
        .filter(a => typeof a.score === 'number' && a.confidence !== 'low')
        .map(a => a.score);

    let consistencyScore = 100; // 满分开始，扣分制

    if (agentScores.length >= 2) {
        const avg = agentScores.reduce((a, b) => a + b, 0) / agentScores.length;
        const variance = agentScores.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / agentScores.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev > 25) {
            warnings.push(`专家评分离散度极高（标准差 ${Math.round(stdDev)}），共识度低`);
            consistencyScore -= 30;
        } else if (stdDev > 15) {
            warnings.push(`专家评分存在较大分歧（标准差 ${Math.round(stdDev)}）`);
            consistencyScore -= 15;
        }

        // 检查极端评分对
        const maxScore = Math.max(...agentScores);
        const minScore = Math.min(...agentScores);
        if (maxScore - minScore > 40) {
            warnings.push(`评分极差达 ${maxScore - minScore} 分，建议关注分歧原因`);
            consistencyScore -= 10;
        }
    }

    // ==================== 4. 置信度 vs 评分一致性 ====================

    for (const agent of agents) {
        if (agent.confidence === 'high' && typeof agent.score === 'number' && agent.score < 20) {
            warnings.push(`${agent.agentName}：高置信度但评分极低 (${agent.score})，可能存在评判偏差`);
            consistencyScore -= 5;
        }
        if (agent.confidence === 'low' && typeof agent.score === 'number' && agent.score > 80) {
            warnings.push(`${agent.agentName}：低置信度但评分极高 (${agent.score})，数据支撑不足`);
            consistencyScore -= 10;
        }
    }

    // ==================== 5. 证据覆盖率检查 ====================

    const agentsWithEvidence = agents.filter(a =>
        a.evidenceSources && Array.isArray(a.evidenceSources) && a.evidenceSources.length > 0
    ).length;

    if (agentsWithEvidence === 0) {
        warnings.push('所有 Agent 均未提供证据来源引用');
        consistencyScore -= 15;
    } else if (agentsWithEvidence < agents.length) {
        warnings.push(`${agents.length - agentsWithEvidence} 个 Agent 未提供证据来源引用`);
        consistencyScore -= 5;
    }

    // ==================== 5.5 评分-证据一致性动态检查 ====================

    for (const agent of agents) {
        if (typeof agent.score === 'number' && agent.score > 80) {
            const evidenceCount = agent.evidenceSources?.length || 0;
            if (evidenceCount === 0 && agent.confidence === 'high') {
                // 高分 + 高置信度 + 零证据 = 严重失信，升级为 issue
                issues.push(`${agent.agentName}：评分 ${agent.score} 且置信度高，但未提供任何证据来源（高分空口无凭）`);
                consistencyScore -= 15;
            } else if (evidenceCount < 2) {
                // 高分但证据不足，生成 warning
                warnings.push(`${agent.agentName}：评分 ${agent.score} > 80 但仅有 ${evidenceCount} 条证据来源，数据支撑不足`);
                consistencyScore -= 5;
            }
        }
    }

    // ==================== 5.6 Fallback Agent 降级检测 ====================

    const fallbackAgents = agents.filter(a => a.isFallback);
    if (fallbackAgents.length > 0) {
        const fallbackNames = fallbackAgents.map(a => a.agentName).join('、');
        // 有 fallback Agent 时标记为 issue（passed = false）
        issues.push(`${fallbackAgents.length} 个 Agent 使用了降级数据（${fallbackNames}），报告可靠性受限`);
        // 每个 fallback Agent 扣 15 分一致性评分
        consistencyScore -= fallbackAgents.length * 15;
    }

    // ==================== 6. 推理留痕检查 ====================

    const agentsWithReasoning = agents.filter(a =>
        a.reasoning && a.reasoning.trim().length > 20
    ).length;

    if (agentsWithReasoning === 0) {
        warnings.push('所有 Agent 均未提供推理过程');
        consistencyScore -= 10;
    }

    // ==================== 7. 加权明细检查 ====================

    if (arbitration.weightedBreakdown) {
        const wb = arbitration.weightedBreakdown;
        const totalWeight = wb.academic.weight + wb.industry.weight + wb.innovation.weight + wb.competitor.weight;
        if (Math.abs(totalWeight - 1.0) > 0.05) {
            warnings.push(`加权权重之和 ${totalWeight.toFixed(2)} 不等于 1.0`);
        }
    } else {
        warnings.push('仲裁结果缺少加权评分明细');
    }

    consistencyScore = Math.max(0, Math.min(100, consistencyScore));

    // ==================== 8. NovoDebate 辩论质量检查 ====================

    if (debateRecord) {
        // 高分歧应触发辩论
        const agentScoresAll = agents
            .filter(a => typeof a.score === 'number')
            .map(a => a.score);
        if (agentScoresAll.length >= 2) {
            const maxS = Math.max(...agentScoresAll);
            const minS = Math.min(...agentScoresAll);
            const maxDiff = maxS - minS;

            if (maxDiff > 30 && !debateRecord.triggered) {
                warnings.push(`专家评分极差达 ${maxDiff} 分但未触发 NovoDebate 辩论`);
            }
        }

        // 辩论评分修正幅度合理性
        if (debateRecord.triggered) {
            for (const session of debateRecord.sessions) {
                const adj = session.scoreAdjustment;
                if (Math.abs(adj.proAgentDelta) > 15 || Math.abs(adj.conAgentDelta) > 15) {
                    warnings.push(`辩论场次 ${session.sessionId} 评分修正幅度过大（超过 ±15）`);
                    consistencyScore -= 5;
                }
            }

            // 辩论是否产出了有效内容
            const emptyDebates = debateRecord.sessions.filter(s => s.exchanges.length === 0);
            if (emptyDebates.length > 0) {
                warnings.push(`${emptyDebates.length} 场辩论未产出有效交锋记录`);
            }
        }
    }

    consistencyScore = Math.max(0, Math.min(100, consistencyScore));

    // ==================== 9. 自动修正（当检测到明确逻辑矛盾时自动纠正） ====================

    const corrections: QualityCheckResult['corrections'] = [];

    // 修正 1：评分 vs 推荐等级矛盾——自动重新映射
    if (typeof score === 'number' && arbitration.recommendation) {
        const expectedRec = mapScoreToRecommendation(score);
        const currentRec = arbitration.recommendation;
        // 检查是否存在严重矛盾（如高分但建议“不推荐”，或低分但建议“强烈推荐”）
        const isContradiction = (
            (score >= RECOMMENDATION_THRESHOLDS.stronglyRecommend && currentRec.includes('不推荐')) ||
            (score < RECOMMENDATION_THRESHOLDS.caution && (currentRec.includes('强烈推荐') || currentRec === '推荐'))
        );
        if (isContradiction) {
            corrections.push({
                field: 'recommendation',
                from: currentRec,
                to: expectedRec,
                reason: `评分 ${score} 与推荐等级“${currentRec}”矛盾，按阈值重新映射为“${expectedRec}”`
            });
        }
    }

    return {
        passed: issues.length === 0,
        issues,
        warnings,
        consistencyScore,
        corrections
    };
}
