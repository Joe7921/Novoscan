/**
 * fallback.ts 单元测试
 *
 * 测试 createFallbackAgentOutput / createFallbackArbitration / mapScoreToRecommendation
 */

import { describe, it, expect } from 'vitest';
import {
    createFallbackAgentOutput,
    createFallbackArbitration,
    mapScoreToRecommendation,
    RECOMMENDATION_THRESHOLDS,
    FALLBACK_CONFIG,
    AllAgentsFailedError,
} from '../fallback';

// ==================== mapScoreToRecommendation ====================

describe('mapScoreToRecommendation', () => {
    it('≥80 → 强烈推荐', () => {
        expect(mapScoreToRecommendation(80)).toBe('强烈推荐');
        expect(mapScoreToRecommendation(95)).toBe('强烈推荐');
    });

    it('65-79 → 推荐', () => {
        expect(mapScoreToRecommendation(65)).toBe('推荐');
        expect(mapScoreToRecommendation(79)).toBe('推荐');
    });

    it('45-64 → 谨慎考虑', () => {
        expect(mapScoreToRecommendation(45)).toBe('谨慎考虑');
        expect(mapScoreToRecommendation(64)).toBe('谨慎考虑');
    });

    it('<45 → 不推荐', () => {
        expect(mapScoreToRecommendation(44)).toBe('不推荐');
        expect(mapScoreToRecommendation(0)).toBe('不推荐');
    });
});

// ==================== AllAgentsFailedError ====================

describe('AllAgentsFailedError', () => {
    it('应包含失败的 Agent 列表', () => {
        const err = new AllAgentsFailedError(['学术审查员', '产业分析员', '竞品侦探'], 'deepseek');
        expect(err.name).toBe('AllAgentsFailedError');
        expect(err.failedAgents).toEqual(['学术审查员', '产业分析员', '竞品侦探']);
        expect(err.modelProvider).toBe('deepseek');
        expect(err.message).toContain('学术审查员');
    });
});

// ==================== createFallbackAgentOutput ====================

describe('createFallbackAgentOutput', () => {
    it('无 input 时应返回默认 50 分 fallback', () => {
        const result = createFallbackAgentOutput('测试Agent');
        expect(result.agentName).toBe('测试Agent');
        expect(result.score).toBe(50);
        expect(result.confidence).toBe('low');
        expect(result.isFallback).toBe(true);
    });

    it('学术审查员：零论文应生成高分（学术空白大）', () => {
        const input = {
            query: '测试',
            academicData: { results: [], stats: { totalCitations: 0, avgCitation: 0 } },
            industryData: { webResults: [], githubRepos: [], sentiment: 'cold' },
        } as any;

        const result = createFallbackAgentOutput('学术审查员', input);
        expect(result.score).toBe(FALLBACK_CONFIG.academic.tiers[0].score); // 85
        expect(result.isFallback).toBe(true);
    });

    it('学术审查员：大量论文应生成低分（已有研究）', () => {
        const input = {
            query: '测试',
            academicData: {
                results: new Array(25).fill({ title: '论文' }),
                stats: { totalCitations: 500, avgCitation: 20 },
            },
            industryData: { webResults: [], githubRepos: [], sentiment: 'cold' },
        } as any;

        const result = createFallbackAgentOutput('学术审查员', input);
        expect(result.score).toBe(FALLBACK_CONFIG.academic.defaultScore); // 30
    });

    it('产业分析员：零市场信号应生成高分（蓝海）', () => {
        const input = {
            query: '测试',
            academicData: { results: [] },
            industryData: { webResults: [], githubRepos: [], sentiment: 'cold' },
        } as any;

        const result = createFallbackAgentOutput('产业分析员', input);
        expect(result.score).toBe(FALLBACK_CONFIG.industry.tiers[0].score); // 80
    });

    it('创新评估师应包含 innovationRadar 六维数据', () => {
        const result = createFallbackAgentOutput('创新评估师');
        expect(result.innovationRadar).toBeDefined();
        expect(result.innovationRadar).toHaveLength(6);
    });

    it('分数应在 clamp 范围内', () => {
        const result = createFallbackAgentOutput('学术审查员', {
            query: '测试',
            academicData: { results: [], stats: { totalCitations: 0, avgCitation: 0 } },
            industryData: { webResults: [], githubRepos: [], sentiment: 'cold' },
        } as any);

        expect(result.score).toBeGreaterThanOrEqual(FALLBACK_CONFIG.clamp.min);
        expect(result.score).toBeLessThanOrEqual(FALLBACK_CONFIG.clamp.max);
    });
});

// ==================== createFallbackArbitration ====================

describe('createFallbackArbitration', () => {
    it('应返回各 Agent 评分的加权平均', () => {
        const agents = [
            { score: 80, confidence: 'high' },
            { score: 60, confidence: 'medium' },
            { score: 70, confidence: 'high' },
            { score: 50, confidence: 'low' },
        ] as any[];

        const result = createFallbackArbitration(agents);
        expect(result.overallScore).toBe(65); // (80+60+70+50)/4
        expect(result.recommendation).toBe('推荐');
        expect(result.consensusLevel).toBe('weak');
    });

    it('无有效 Agent 时应返回 50 分', () => {
        const result = createFallbackArbitration([]);
        expect(result.overallScore).toBe(50);
    });
});
