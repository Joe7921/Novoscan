/**
 * bizscanQualityGuard 单元测试
 *
 * 测试商业分析质量守卫的纯逻辑检查
 */
import { describe, it, expect } from 'vitest';
import { bizscanQualityGuard } from '../quality-guard';
import type {
    MarketScoutOutput,
    CompetitorProfilerOutput,
    BizscanAgentOutput,
    CrossValidationResult,
    StrategicArbiterResult,
} from '../types';

// ==================== 工厂函数 ====================

function makeBizscanAgent(overrides: Partial<BizscanAgentOutput> = {}): BizscanAgentOutput {
    return {
        agentName: 'TestBizscanAgent',
        analysis: '商业分析文本',
        score: 65,
        confidence: 'medium',
        confidenceReasoning: '中等置信度',
        keyFindings: ['发现1'],
        redFlags: [],
        evidenceSources: ['ref1'],
        reasoning: '推理过程',
        dimensionScores: [],
        isFallback: false,
        ...overrides,
    };
}

function makeMarketScout(overrides: Partial<MarketScoutOutput> = {}): MarketScoutOutput {
    return {
        ...makeBizscanAgent({ agentName: '市场侦察员' }),
        marketInsights: {
            marketSize: '100亿',
            growthRate: '15%',
            keyTrends: ['趋势1'],
            targetAudience: '开发者',
        } as any,
        demandSignals: ['信号1'],
        ...overrides,
    };
}

function makeCompetitorProfiler(overrides: Partial<CompetitorProfilerOutput> = {}): CompetitorProfilerOutput {
    return {
        ...makeBizscanAgent({ agentName: '竞品拆解师' }),
        competitors: [],
        competitiveMoat: '技术壁垒',
        entryBarriers: ['壁垒1'],
        ...overrides,
    };
}

function makeCrossValidation(overrides: Partial<CrossValidationResult> = {}): CrossValidationResult {
    return {
        divergences: [],
        calibratedScores: {
            semanticNovelty: 70,
            competitiveLandscape: 65,
            marketGap: 60,
            feasibility: 75,
        },
        consistencyScore: 80,
        evidenceConflicts: [],
        ...overrides,
    };
}

function makeArbiter(overrides: Partial<StrategicArbiterResult> = {}): StrategicArbiterResult {
    return {
        overallBII: 68,
        grade: 'B',
        verdict: '值得探索',
        recommendations: ['建议1'],
        riskWarnings: ['风险1'],
        strategicAdvice: '战略建议',
        weightedBreakdown: {
            semanticNovelty: { raw: 70, weight: 0.3, weighted: 21 },
            competitiveLandscape: { raw: 65, weight: 0.25, weighted: 16.25 },
            marketGap: { raw: 60, weight: 0.25, weighted: 15 },
            feasibility: { raw: 75, weight: 0.2, weighted: 15 },
        },
        consensusLevel: 'moderate',
        dissent: [],
        ...overrides,
    };
}

// ==================== 测试用例 ====================

describe('bizscanQualityGuard', () => {
    it('全部正常时应通过质量检查', () => {
        const result = bizscanQualityGuard(
            makeMarketScout(),
            makeCompetitorProfiler(),
            makeBizscanAgent({ agentName: '新颖度审计师' }),
            makeBizscanAgent({ agentName: '可行性考察师' }),
            makeCrossValidation(),
            makeArbiter(),
        );

        expect(result.passed).toBe(true);
        expect(result.issues).toHaveLength(0);
    });

    it('存在 Fallback Agent 应触发 warning', () => {
        const result = bizscanQualityGuard(
            makeMarketScout({ isFallback: true } as any),
            makeCompetitorProfiler(),
            makeBizscanAgent({ agentName: '新颖度审计师' }),
            makeBizscanAgent({ agentName: '可行性考察师' }),
            makeCrossValidation(),
            makeArbiter(),
        );

        expect(result.warnings.some(w => w.includes('降级'))).toBe(true);
        expect(result.consistencyScore).toBeLessThan(100);
    });

    it('极端评分(< 5 或 > 98)应触发 warning', () => {
        const result = bizscanQualityGuard(
            makeMarketScout({ score: 3 } as any),
            makeCompetitorProfiler(),
            makeBizscanAgent({ agentName: '新颖度审计师', score: 99 }),
            makeBizscanAgent({ agentName: '可行性考察师' }),
            makeCrossValidation(),
            makeArbiter(),
        );

        expect(result.warnings.some(w => w.includes('极端'))).toBe(true);
    });

    it('BII 与维度均分偏差 > 20 应生成 issue', () => {
        const result = bizscanQualityGuard(
            makeMarketScout(),
            makeCompetitorProfiler(),
            makeBizscanAgent({ agentName: '新颖度审计师' }),
            makeBizscanAgent({ agentName: '可行性考察师' }),
            makeCrossValidation({
                calibratedScores: {
                    semanticNovelty: 40,
                    competitiveLandscape: 40,
                    marketGap: 40,
                    feasibility: 40,
                },
            }),
            makeArbiter({ overallBII: 90 }),  // BII=90 vs avg=40，差距50
        );

        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('BII'))).toBe(true);
    });

    it('Agent 间评分分散度过大(> 50)应触发 warning', () => {
        const result = bizscanQualityGuard(
            makeMarketScout({ score: 10 } as any),
            makeCompetitorProfiler({ score: 90 } as any),
            makeBizscanAgent({ agentName: '新颖度', score: 50 }),
            makeBizscanAgent({ agentName: '可行性', score: 50 }),
            makeCrossValidation(),
            makeArbiter(),
        );

        expect(result.warnings.some(w => w.includes('分散度'))).toBe(true);
    });

    it('缺失 verdict 应生成 issue', () => {
        const result = bizscanQualityGuard(
            makeMarketScout(),
            makeCompetitorProfiler(),
            makeBizscanAgent({ agentName: '新颖度审计师' }),
            makeBizscanAgent({ agentName: '可行性考察师' }),
            makeCrossValidation(),
            makeArbiter({ verdict: '' }),
        );

        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('判定'))).toBe(true);
    });

    it('缺失 recommendations 应生成 issue', () => {
        const result = bizscanQualityGuard(
            makeMarketScout(),
            makeCompetitorProfiler(),
            makeBizscanAgent({ agentName: '新颖度审计师' }),
            makeBizscanAgent({ agentName: '可行性考察师' }),
            makeCrossValidation(),
            makeArbiter({ recommendations: [] }),
        );

        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('建议'))).toBe(true);
    });

    it('交叉验证一致性过低(< 50)应触发 warning', () => {
        const result = bizscanQualityGuard(
            makeMarketScout(),
            makeCompetitorProfiler(),
            makeBizscanAgent({ agentName: '新颖度审计师' }),
            makeBizscanAgent({ agentName: '可行性考察师' }),
            makeCrossValidation({ consistencyScore: 30 }),
            makeArbiter(),
        );

        expect(result.warnings.some(w => w.includes('一致性'))).toBe(true);
    });

    it('一致性评分不会低于 0', () => {
        const result = bizscanQualityGuard(
            makeMarketScout({ isFallback: true, score: 1 } as any),
            makeCompetitorProfiler({ isFallback: true, score: 1 } as any),
            makeBizscanAgent({ agentName: '新颖度', isFallback: true, score: 99 }),
            makeBizscanAgent({ agentName: '可行性', isFallback: true, score: 99 }),
            makeCrossValidation({ consistencyScore: 10, evidenceConflicts: ['冲突1', '冲突2', '冲突3'] }),
            makeArbiter({ overallBII: 99, verdict: '', recommendations: [], riskWarnings: [] }),
        );

        expect(result.consistencyScore).toBeGreaterThanOrEqual(0);
    });
});
