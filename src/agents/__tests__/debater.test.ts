/**
 * debater 纯函数单元测试
 *
 * 测试 shouldTriggerDebate / calculateScoreAdjustment / createFallbackDebateRecord
 */
import { describe, it, expect } from 'vitest';
import {
    shouldTriggerDebate,
    calculateScoreAdjustment,
    createFallbackDebateRecord,
} from '../debater';
import type { AgentOutput, DebateExchange } from '../types';

// ==================== 工厂函数 ====================

function makeAgentForDebate(name: string, score: number): AgentOutput {
    return {
        agentName: name,
        analysis: '分析',
        score,
        confidence: 'medium',
        confidenceReasoning: '理由',
        keyFindings: [],
        redFlags: [],
        evidenceSources: [],
        reasoning: '推理',
        dimensionScores: [],
    };
}

function makeExchange(overrides: Partial<DebateExchange> = {}): DebateExchange {
    return {
        round: 1,
        challenger: 'AgentA',
        challengerArgument: '挑战论点',
        challengerEvidence: ['证据1'],
        defender: 'AgentB',
        defenderRebuttal: '反驳论点',
        defenderEvidence: ['证据2'],
        outcome: 'draw',
        outcomeReasoning: '理由',
        ...overrides,
    };
}

// ==================== shouldTriggerDebate ====================

describe('shouldTriggerDebate', () => {
    it('评分分歧大(> 15)应触发辩论', () => {
        const agents = {
            academic: makeAgentForDebate('学术审查员', 30),
            industry: makeAgentForDebate('产业分析师', 80),
            innovation: makeAgentForDebate('创新评估师', 50),
            competitor: makeAgentForDebate('竞品侦探', 55),
        };

        const result = shouldTriggerDebate(agents);

        expect(result.trigger).toBe(true);
        expect(result.pairs.length).toBeGreaterThan(0);
        expect(result.reason).toBeTruthy();
    });

    it('评分一致(差异 ≤ 15)不应触发辩论', () => {
        const agents = {
            academic: makeAgentForDebate('学术审查员', 60),
            industry: makeAgentForDebate('产业分析师', 65),
            innovation: makeAgentForDebate('创新评估师', 70),
            competitor: makeAgentForDebate('竞品侦探', 68),
        };

        const result = shouldTriggerDebate(agents);

        expect(result.trigger).toBe(false);
        expect(result.pairs).toHaveLength(0);
    });

    it('仅两个 Agent 有大分歧应只返回一对辩论', () => {
        const agents = {
            academic: makeAgentForDebate('学术审查员', 20),
            industry: makeAgentForDebate('产业分析师', 70),
            innovation: makeAgentForDebate('创新评估师', 50),
            competitor: makeAgentForDebate('竞品侦探', 50),
        };

        const result = shouldTriggerDebate(agents);

        expect(result.trigger).toBe(true);
        expect(result.pairs.length).toBeGreaterThanOrEqual(1);
    });
});

// ==================== calculateScoreAdjustment ====================

describe('calculateScoreAdjustment', () => {
    it('挑战者全胜应给正方加分、反方减分', () => {
        const exchanges: DebateExchange[] = [
            makeExchange({
                round: 1,
                challenger: 'ProAgent',
                defender: 'ConAgent',
                outcome: 'challenger_wins',
            }),
            makeExchange({
                round: 2,
                challenger: 'ProAgent',
                defender: 'ConAgent',
                outcome: 'challenger_wins',
            }),
        ];

        const result = calculateScoreAdjustment(exchanges, 'ProAgent', 'ConAgent');

        // 正方（proAgent）作为 challenger 获胜应加分
        expect(result.proAgentDelta).toBeGreaterThan(0);
        expect(result.conAgentDelta).toBeLessThan(0);
    });

    it('防守方全胜应给反方加分', () => {
        const exchanges: DebateExchange[] = [
            makeExchange({
                round: 1,
                challenger: 'ProAgent',
                defender: 'ConAgent',
                outcome: 'defender_wins',
            }),
        ];

        const result = calculateScoreAdjustment(exchanges, 'ProAgent', 'ConAgent');

        expect(result.conAgentDelta).toBeGreaterThan(0);
        expect(result.proAgentDelta).toBeLessThan(0);
    });

    it('全平局应返回 0 修正', () => {
        const exchanges: DebateExchange[] = [
            makeExchange({ outcome: 'draw' }),
            makeExchange({ round: 2, outcome: 'draw' }),
        ];

        const result = calculateScoreAdjustment(exchanges, 'AgentA', 'AgentB');

        expect(result.proAgentDelta).toBe(0);
        expect(result.conAgentDelta).toBe(0);
    });

    it('修正值上限不超过 ±15（SCORE_ADJUSTMENT_CAP）', () => {
        // 模拟 3 轮全胜
        const exchanges: DebateExchange[] = Array.from({ length: 10 }, (_, i) =>
            makeExchange({
                round: i + 1,
                challenger: 'ProAgent',
                defender: 'ConAgent',
                outcome: 'challenger_wins',
            })
        );

        const result = calculateScoreAdjustment(exchanges, 'ProAgent', 'ConAgent');

        expect(result.proAgentDelta).toBeLessThanOrEqual(15);
        expect(result.proAgentDelta).toBeGreaterThanOrEqual(-15);
        expect(result.conAgentDelta).toBeLessThanOrEqual(15);
        expect(result.conAgentDelta).toBeGreaterThanOrEqual(-15);
    });

    it('空交锋列表应返回 0 修正', () => {
        const result = calculateScoreAdjustment([], 'ProAgent', 'ConAgent');

        expect(result.proAgentDelta).toBe(0);
        expect(result.conAgentDelta).toBe(0);
    });
});

// ==================== createFallbackDebateRecord ====================

describe('createFallbackDebateRecord', () => {
    it('应返回默认辩论记录结构', () => {
        const result = createFallbackDebateRecord();

        expect(result.sessions).toHaveLength(0);
        expect(result.totalDurationMs).toBe(0);
        expect(result.dissentReport).toHaveLength(0);
        expect(result.triggerReason).toBeTruthy();
    });

    it('自定义原因应体现在 triggerReason 中', () => {
        const result = createFallbackDebateRecord('自定义跳过原因');

        expect(result.triggerReason).toContain('自定义跳过原因');
    });
});
