/**
 * orchestrator 纯函数单元测试
 *
 * 测试 mapScoreToRecommendation / createFallbackAgentOutput /
 * createFallbackArbitration / transformToLegacyFormat
 */
import { describe, it, expect } from 'vitest';
import {
    mapScoreToRecommendation,
    RECOMMENDATION_THRESHOLDS,
    createFallbackAgentOutput,
    createFallbackArbitration,
    transformToLegacyFormat,
} from '../orchestrator';
import type { AgentOutput, FinalReport, DebateRecord, QualityCheckResult } from '../types';

// ==================== 工厂函数 ====================

function makeAgent(overrides: Partial<AgentOutput> = {}): AgentOutput {
    return {
        agentName: 'TestAgent',
        analysis: '分析文本',
        score: 70,
        confidence: 'medium',
        confidenceReasoning: '中等置信度',
        keyFindings: ['发现1'],
        redFlags: [],
        evidenceSources: ['ref1'],
        reasoning: '推理过程文本',
        dimensionScores: [],
        isFallback: false,
        ...overrides,
    };
}

function makeMinimalFinalReport(): FinalReport {
    const agent = makeAgent;
    const debateRecord: DebateRecord = {
        triggered: false,
        triggerReason: '未触发',
        sessions: [],
        totalDurationMs: 0,
        dissentReport: [],
        dissentReportText: '',
    };
    const qualityCheck: QualityCheckResult = {
        passed: true,
        issues: [],
        warnings: [],
        consistencyScore: 90,
        corrections: [],
    };

    return {
        academicReview: agent({ agentName: '学术审查员', score: 65, keyFindings: ['学术发现1'] }),
        industryAnalysis: agent({ agentName: '产业分析师', score: 70, keyFindings: ['产业发现1'] }),
        innovationEvaluation: agent({ agentName: '创新评估师', score: 75, keyFindings: ['创新发现1'] }),
        competitorAnalysis: agent({ agentName: '竞品侦探', score: 68, keyFindings: ['竞品发现1'] }),
        debate: debateRecord,
        arbitration: {
            summary: '测试总结',
            overallScore: 70,
            recommendation: '推荐',
            conflictsResolved: [],
            nextSteps: ['下一步1'],
            weightedBreakdown: {
                academic: { raw: 65, weight: 0.30, weighted: 19.5, confidence: 'medium' },
                industry: { raw: 70, weight: 0.25, weighted: 17.5, confidence: 'medium' },
                innovation: { raw: 75, weight: 0.35, weighted: 26.25, confidence: 'medium' },
                competitor: { raw: 68, weight: 0.10, weighted: 6.8, confidence: 'medium' },
            },
            consensusLevel: 'moderate',
            dissent: [],
        },
        qualityCheck,
    };
}

// ==================== mapScoreToRecommendation ====================

describe('mapScoreToRecommendation', () => {
    it('高分(≥80)应返回"强烈推荐"', () => {
        const result = mapScoreToRecommendation(85);
        expect(result).toBe('强烈推荐');
    });

    it('中高分(≥60, <80)应返回"推荐"', () => {
        const result = mapScoreToRecommendation(70);
        expect(result).toBe('推荐');
    });

    it('中分(≥40, <60)应返回"谨慎考虑"', () => {
        const result = mapScoreToRecommendation(50);
        expect(result).toBe('谨慎考虑');
    });

    it('低分(<40)应返回"不推荐"', () => {
        const result = mapScoreToRecommendation(20);
        expect(result).toBe('不推荐');
    });

    it('边界值测试：刚好等于阈值', () => {
        expect(mapScoreToRecommendation(RECOMMENDATION_THRESHOLDS.stronglyRecommend)).toBe('强烈推荐');
        expect(mapScoreToRecommendation(RECOMMENDATION_THRESHOLDS.recommend)).toBe('推荐');
        expect(mapScoreToRecommendation(RECOMMENDATION_THRESHOLDS.caution)).toBe('谨慎考虑');
    });

    it('极端值测试', () => {
        expect(mapScoreToRecommendation(100)).toBe('强烈推荐');
        expect(mapScoreToRecommendation(0)).toBe('不推荐');
    });
});

// ==================== createFallbackAgentOutput ====================

describe('createFallbackAgentOutput', () => {
    it('无 input 时应返回默认降级结构', () => {
        const result = createFallbackAgentOutput('学术审查员');

        expect(result.agentName).toBe('学术审查员');
        expect(result.isFallback).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.confidence).toBe('low');
        expect(result.keyFindings.length).toBeGreaterThan(0);
        expect(result.redFlags.length).toBeGreaterThan(0);
    });

    it('有 input 时应基于实际数据计算降级评分', () => {
        const input = {
            query: '量子计算创新',
            academicData: {
                source: 'test',
                results: Array(15).fill({ title: '论文', year: 2024 }),
                stats: {
                    totalPapers: 15,
                    totalCitations: 500,
                    openAccessCount: 5,
                    avgCitation: 33,
                    bySource: { openAlex: 10, arxiv: 3, crossref: 2, core: 0 },
                    topCategories: ['quantum'],
                },
                topConcepts: ['quantum computing'],
            },
            industryData: {
                webResults: Array(10).fill({ title: '网页', url: 'http://test.com' }),
                githubRepos: Array(5).fill({ name: 'repo', stars: 100 }),
                topProjects: [{ name: 'project1', stars: 1000 }],
            },
            language: 'zh' as const,
            modelProvider: 'deepseek' as const,
        };

        const result = createFallbackAgentOutput('学术审查员', input as any);

        expect(result.agentName).toBe('学术审查员');
        expect(result.isFallback).toBe(true);
        expect(result.score).toBeGreaterThan(0);
        expect(result.evidenceSources.length).toBeGreaterThan(0);
    });

    it('降级输出的 score 应在 [0, 100] 范围内', () => {
        const result = createFallbackAgentOutput('竞品侦探');
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
    });
});

// ==================== createFallbackArbitration ====================

describe('createFallbackArbitration', () => {
    it('有效 Agent 数组应返回降级仲裁结果', () => {
        const agents = [
            makeAgent({ agentName: '学术', score: 60 }),
            makeAgent({ agentName: '产业', score: 70 }),
            makeAgent({ agentName: '创新', score: 80 }),
            makeAgent({ agentName: '竞品', score: 65 }),
        ];

        const result = createFallbackArbitration(agents);

        expect(result.overallScore).toBeGreaterThan(0);
        expect(result.overallScore).toBeLessThanOrEqual(100);
        expect(result.summary).toBeTruthy();
        expect(result.recommendation).toBeTruthy();
        expect(result.weightedBreakdown).toBeDefined();
        expect(result.consensusLevel).toBeDefined();
    });

    it('空 Agent 数组应返回默认分数', () => {
        const result = createFallbackArbitration([]);

        expect(result.overallScore).toBe(50);
    });

    it('加权权重之和应接近 1.0', () => {
        const agents = [
            makeAgent({ agentName: '学术', score: 60 }),
            makeAgent({ agentName: '产业', score: 70 }),
            makeAgent({ agentName: '创新', score: 80 }),
            makeAgent({ agentName: '竞品', score: 65 }),
        ];

        const result = createFallbackArbitration(agents);
        const wb = result.weightedBreakdown;
        const totalWeight = wb.academic.weight + wb.industry.weight + wb.innovation.weight + wb.competitor.weight;

        expect(Math.abs(totalWeight - 1.0)).toBeLessThan(0.05);
    });
});

// ==================== transformToLegacyFormat ====================

describe('transformToLegacyFormat', () => {
    it('应将 FinalReport 转换为 AIAnalysisResult 格式', () => {
        const report = makeMinimalFinalReport();

        const result = transformToLegacyFormat(report);

        // 核心字段应存在
        expect(result.noveltyScore).toBeDefined();
        expect(typeof result.noveltyScore).toBe('number');
        expect(result.sections).toBeDefined();
        expect(result.sections.academic).toBeDefined();
        expect(result.sections.internet).toBeDefined();
        expect(result.keyPoints).toBeDefined();
        expect(Array.isArray(result.keyPoints)).toBe(true);
    });

    it('应透传 Agent 原始数据给前端', () => {
        const report = makeMinimalFinalReport();

        const result = transformToLegacyFormat(report);

        expect(result.academicReview).toBeDefined();
        expect(result.industryAnalysis).toBeDefined();
        expect(result.innovationEvaluation).toBeDefined();
        expect(result.competitorAnalysis).toBeDefined();
        expect(result.arbitration).toBeDefined();
        expect(result.qualityCheck).toBeDefined();
    });

    it('noveltyScore 应在合理范围 [0, 100]', () => {
        const report = makeMinimalFinalReport();

        const result = transformToLegacyFormat(report);

        expect(result.noveltyScore).toBeGreaterThanOrEqual(0);
        expect(result.noveltyScore).toBeLessThanOrEqual(100);
    });
});
