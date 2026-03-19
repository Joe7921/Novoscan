/**
 * 学术审查员 Prompt 模板测试
 */

import { describe, it, expect } from 'vitest';
import { buildAcademicReviewerPrompt } from '../prompt';
import type { AgentInput } from '@/types/agent';

const mockInput: AgentInput = {
    query: '基于量子退火的蛋白质折叠优化算法',
    academicData: {
        results: [
            { title: '论文A: 量子退火在组合优化中的应用', year: 2023, citationCount: 45, venue: 'Nature', authors: ['Alice', 'Bob'] },
            { title: '论文B: 蛋白质折叠的深度学习方法', year: 2024, citationCount: 120, venue: 'Science', authors: ['Charlie'] },
            { title: '论文C: 量子计算与生物信息学', year: 2022, citationCount: 8, venue: 'arXiv', authors: ['Dave'] },
        ],
        stats: {
            totalPapers: 3,
            totalCitations: 173,
            avgCitation: 57.67,
            openAccessCount: 2,
            bySource: { openAlex: 1, arxiv: 1, crossref: 1, core: 0 },
        },
        topConcepts: ['量子计算', '蛋白质折叠', '组合优化'],
    },
    industryData: {
        webResults: [],
        githubRepos: [],
        sentiment: 'neutral',
    },
} as any;

describe('buildAcademicReviewerPrompt', () => {
    it('应包含用户创新点', () => {
        const prompt = buildAcademicReviewerPrompt(mockInput);
        expect(prompt).toContain('基于量子退火的蛋白质折叠优化算法');
    });

    it('应包含论文统计数据', () => {
        const prompt = buildAcademicReviewerPrompt(mockInput);
        expect(prompt).toContain('总论文数：3');
        expect(prompt).toContain('总引用量：173');
    });

    it('应包含高引论文标题', () => {
        const prompt = buildAcademicReviewerPrompt(mockInput);
        expect(prompt).toContain('蛋白质折叠的深度学习方法');
    });

    it('应包含评分维度', () => {
        const prompt = buildAcademicReviewerPrompt(mockInput);
        expect(prompt).toContain('技术成熟度');
        expect(prompt).toContain('论文覆盖度');
        expect(prompt).toContain('学术空白');
    });

    it('应包含顶级概念', () => {
        const prompt = buildAcademicReviewerPrompt(mockInput);
        expect(prompt).toContain('量子计算');
        expect(prompt).toContain('蛋白质折叠');
    });

    it('Prompt 长度应合理（< 8000 字符）', () => {
        const prompt = buildAcademicReviewerPrompt(mockInput);
        expect(prompt.length).toBeLessThan(8000);
        expect(prompt.length).toBeGreaterThan(500);
    });

    it('有 domainHint 时应包含领域引导', () => {
        const inputWithDomain = { ...mockInput, domainHint: '生物信息学' } as any;
        const prompt = buildAcademicReviewerPrompt(inputWithDomain);
        expect(prompt).toContain('生物信息学');
        expect(prompt).toContain('用户指定学科领域');
    });
});
