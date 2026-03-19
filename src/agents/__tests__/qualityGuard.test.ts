/**
 * qualityGuard 单元测试
 *
 * 测试质量守卫的纯逻辑检查：评分一致性、证据覆盖、降级检测、自动修正等
 */
import { describe, it, expect } from 'vitest';
import { qualityGuard } from '../quality-guard';
import type { AgentOutput, ArbitrationResult, DebateRecord } from '../types';

// ==================== 工厂函数 ====================

/** 创建最小可用的 AgentOutput */
function makeAgent(overrides: Partial<AgentOutput> = {}): AgentOutput {
    return {
        agentName: overrides.agentName ?? 'TestAgent',
        analysis: '分析文本',
        score: 70,
        confidence: 'medium',
        confidenceReasoning: '中等置信度',
        keyFindings: ['发现1'],
        redFlags: [],
        evidenceSources: ['ref1', 'ref2', 'ref3'],
        reasoning: '这是一段足够长度的推理过程，用于通过推理留痕检查。',
        dimensionScores: [],
        isFallback: false,
        ...overrides,
    };
}

/** 创建最小可用的 ArbitrationResult */
function makeArbitration(overrides: Partial<ArbitrationResult> = {}): ArbitrationResult {
    return {
        summary: '这是仲裁结果的综合摘要，包含足够长度的文本内容用于通过验证',
        overallScore: 70,
        recommendation: '推荐',
        conflictsResolved: ['冲突1'],
        nextSteps: ['下一步行动1'],
        weightedBreakdown: {
            academic: { raw: 70, weight: 0.30, weighted: 21, confidence: 'medium' },
            industry: { raw: 70, weight: 0.25, weighted: 17.5, confidence: 'medium' },
            innovation: { raw: 70, weight: 0.35, weighted: 24.5, confidence: 'medium' },
            competitor: { raw: 70, weight: 0.10, weighted: 7, confidence: 'medium' },
        },
        consensusLevel: 'moderate',
        dissent: [],
        ...overrides,
    };
}

/** 创建一组正常 Agent 列表 */
function makeNormalAgents(): AgentOutput[] {
    return [
        makeAgent({ agentName: '学术审查员', score: 65 }),
        makeAgent({ agentName: '产业分析师', score: 70 }),
        makeAgent({ agentName: '创新评估师', score: 75 }),
        makeAgent({ agentName: '竞品侦探', score: 68 }),
    ];
}

// ==================== 测试用例 ====================

describe('qualityGuard', () => {
    it('全部 Agent 正常时应通过质量检查', () => {
        const agents = makeNormalAgents();
        const arbitration = makeArbitration();

        const result = qualityGuard(arbitration, agents);

        expect(result.passed).toBe(true);
        expect(result.issues).toHaveLength(0);
        expect(result.consistencyScore).toBeGreaterThanOrEqual(70);
    });

    it('Agent 评分高离散度(stdDev > 25)应触发 warning 并扣分', () => {
        const agents = [
            makeAgent({ agentName: 'A1', score: 10 }),
            makeAgent({ agentName: 'A2', score: 90 }),
            makeAgent({ agentName: 'A3', score: 50 }),
            makeAgent({ agentName: 'A4', score: 60 }),
        ];
        const arbitration = makeArbitration();

        const result = qualityGuard(arbitration, agents);

        // stdDev ≈ 29.15, 应触发高离散度 warning
        expect(result.warnings.some(w => w.includes('离散度'))).toBe(true);
        expect(result.consistencyScore).toBeLessThan(100);
    });

    it('评分极差 > 40 应触发 warning', () => {
        const agents = [
            makeAgent({ agentName: 'A1', score: 20 }),
            makeAgent({ agentName: 'A2', score: 80 }),
            makeAgent({ agentName: 'A3', score: 50 }),
            makeAgent({ agentName: 'A4', score: 55 }),
        ];
        const arbitration = makeArbitration();

        const result = qualityGuard(arbitration, agents);

        expect(result.warnings.some(w => w.includes('极差'))).toBe(true);
    });

    it('高置信度 + 极低评分应触发 warning', () => {
        const agents = [
            makeAgent({ agentName: 'BiasAgent', confidence: 'high', score: 10 }),
            makeAgent({ agentName: 'Normal', score: 60 }),
        ];
        const arbitration = makeArbitration();

        const result = qualityGuard(arbitration, agents);

        expect(result.warnings.some(w => w.includes('BiasAgent') && w.includes('偏差'))).toBe(true);
    });

    it('低置信度 + 极高评分应触发 warning', () => {
        const agents = [
            makeAgent({ agentName: 'SuspectAgent', confidence: 'low', score: 90 }),
            makeAgent({ agentName: 'Normal', score: 60 }),
        ];
        const arbitration = makeArbitration();

        const result = qualityGuard(arbitration, agents);

        expect(result.warnings.some(w => w.includes('SuspectAgent') && w.includes('数据支撑不足'))).toBe(true);
    });

    it('所有 Agent 无证据来源应触发 warning', () => {
        const agents = [
            makeAgent({ agentName: 'A1', evidenceSources: [] }),
            makeAgent({ agentName: 'A2', evidenceSources: [] }),
        ];
        const arbitration = makeArbitration();

        const result = qualityGuard(arbitration, agents);

        expect(result.warnings.some(w => w.includes('证据来源'))).toBe(true);
    });

    it('高分 Agent 无证据 + 高置信度应生成 issue（passed = false）', () => {
        const agents = [
            makeAgent({
                agentName: 'EmptyEvidence',
                score: 90,
                confidence: 'high',
                evidenceSources: [],
            }),
            makeAgent({ agentName: 'Normal', score: 60 }),
        ];
        const arbitration = makeArbitration();

        const result = qualityGuard(arbitration, agents);

        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('EmptyEvidence') && i.includes('高分空口无凭'))).toBe(true);
    });

    it('存在 Fallback Agent 时应 passed = false', () => {
        const agents = [
            makeAgent({ agentName: 'FallbackAgent', isFallback: true }),
            makeAgent({ agentName: 'Normal', score: 60 }),
        ];
        const arbitration = makeArbitration();

        const result = qualityGuard(arbitration, agents);

        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('降级'))).toBe(true);
        // 每个 fallback Agent 扣 15 分一致性评分
        expect(result.consistencyScore).toBeLessThanOrEqual(85);
    });

    it('所有 Agent 无推理过程应触发 warning', () => {
        const agents = [
            makeAgent({ agentName: 'A1', reasoning: '' }),
            makeAgent({ agentName: 'A2', reasoning: '短' }),
        ];
        const arbitration = makeArbitration();

        const result = qualityGuard(arbitration, agents);

        expect(result.warnings.some(w => w.includes('推理过程'))).toBe(true);
    });

    it('加权权重之和 ≠ 1.0 应触发 warning', () => {
        const agents = makeNormalAgents();
        const arbitration = makeArbitration({
            weightedBreakdown: {
                academic: { raw: 70, weight: 0.40, weighted: 28, confidence: 'medium' },
                industry: { raw: 70, weight: 0.40, weighted: 28, confidence: 'medium' },
                innovation: { raw: 70, weight: 0.40, weighted: 28, confidence: 'medium' },
                competitor: { raw: 70, weight: 0.10, weighted: 7, confidence: 'medium' },
            },
        });

        const result = qualityGuard(arbitration, agents);

        expect(result.warnings.some(w => w.includes('权重之和') && w.includes('1.0'))).toBe(true);
    });

    it('缺少加权评分明细应触发 warning', () => {
        const agents = makeNormalAgents();
        const arbitration = makeArbitration({
            weightedBreakdown: undefined as any,
        });

        const result = qualityGuard(arbitration, agents);

        expect(result.warnings.some(w => w.includes('加权评分明细'))).toBe(true);
    });

    it('辩论评分修正幅度过大(> ±15)应触发 warning', () => {
        const agents = makeNormalAgents();
        const arbitration = makeArbitration();
        const debateRecord: DebateRecord = {
            triggered: true,
            triggerReason: '评分分歧大',
            sessions: [{
                sessionId: 'test_session',
                topic: '测试辩论',
                proAgent: 'A1',
                conAgent: 'A2',
                scoreDivergence: 30,
                exchanges: [{
                    round: 1,
                    challenger: 'A1',
                    challengerArgument: '论点',
                    challengerEvidence: [],
                    defender: 'A2',
                    defenderRebuttal: '反驳',
                    defenderEvidence: [],
                    outcome: 'challenger_wins',
                    outcomeReasoning: '理由',
                }],
                verdict: '结论',
                keyInsights: [],
                scoreAdjustment: {
                    proAgentDelta: 20,   // 超过 ±15
                    conAgentDelta: -20,
                },
            }],
            totalDurationMs: 5000,
            dissentReport: [],
            dissentReportText: '',
        };

        const result = qualityGuard(arbitration, agents, debateRecord);

        expect(result.warnings.some(w => w.includes('修正幅度过大'))).toBe(true);
    });

    it('一致性评分不会低于 0', () => {
        // 堆叠大量扣分条件
        const agents = [
            makeAgent({ agentName: 'F1', isFallback: true, score: 10, confidence: 'high', evidenceSources: [], reasoning: '' }),
            makeAgent({ agentName: 'F2', isFallback: true, score: 95, confidence: 'low', evidenceSources: [], reasoning: '' }),
            makeAgent({ agentName: 'F3', isFallback: true, score: 50, evidenceSources: [], reasoning: '' }),
        ];
        const arbitration = makeArbitration({
            weightedBreakdown: undefined as any,
        });

        const result = qualityGuard(arbitration, agents);

        expect(result.consistencyScore).toBeGreaterThanOrEqual(0);
    });
});
