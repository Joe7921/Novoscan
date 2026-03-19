/**
 * Agent 降级与兜底工具集
 *
 * 从 orchestrator.ts 提取的工具函数模块，包含：
 * - AllAgentsFailedError 熔断错误类
 * - 推荐等级映射
 * - 智能 Fallback 评分生成器
 * - 超时执行器
 *
 * @module agents/fallback
 */

import { AgentInput, AgentOutput, ArbitrationResult, DimensionScore } from './types';

// ==================== 全员失败熔断错误 ====================

/**
 * 当 ≥3 个核心 Agent 都返回 fallback（AI API 几乎完全不可用）时抛出此错误，
 * 阻止系统用纯统计推断的降级数据生成无意义的报告。
 */
export class AllAgentsFailedError extends Error {
    public readonly failedAgents: string[];
    public readonly modelProvider?: string;
    constructor(failedAgents: string[], modelProvider?: string) {
        super(`AI 专家几乎全部失败（${failedAgents.join('、')}），AI 服务可能暂时不可用`);
        this.name = 'AllAgentsFailedError';
        this.failedAgents = failedAgents;
        this.modelProvider = modelProvider;
    }
}

// ==================== 超时与降级工具 ====================

/** 单个专家 Agent 超时控制 (120秒，MiniMax 长 prompt 可能 40-50s + 重试/降级余量) */
export const AGENT_TIMEOUT = 120000;

/** 仲裁员超时控制 (90秒，仲裁员需要整合四份报告 + 辩论记录，输出更长) */
export const ARBITRATOR_TIMEOUT = 90000;

/** NovoDebate 辩论层超时控制（60秒） */
export const DEBATE_TIMEOUT = 60000;

/** 总流程强制截止时间（380秒，Layer1 120s + Layer2 120s + Debate 60s + Arbiter 90s + 余量） */
export const TOTAL_MAX_DURATION = 380000;

// ==================== 统一推荐等级映射 ====================

/** 推荐等级阈值（统一全局使用，避免不同模块映射不一致） */
export const RECOMMENDATION_THRESHOLDS = {
    stronglyRecommend: 80,
    recommend: 65,
    caution: 45,
} as const;

/** 根据评分映射到统一推荐等级 */
export function mapScoreToRecommendation(score: number): string {
    if (score >= RECOMMENDATION_THRESHOLDS.stronglyRecommend) return '强烈推荐';
    if (score >= RECOMMENDATION_THRESHOLDS.recommend) return '推荐';
    if (score >= RECOMMENDATION_THRESHOLDS.caution) return '谨慎考虑';
    return '不推荐';
}

// ==================== Fallback 阈值配置（消除魔法数字） ====================

/** Fallback 评分推断配置 — 可按领域动态调整，不再硬编码 */
export const FALLBACK_CONFIG = {
    /** 学术审查员：论文数量 → 创新性分数映射 */
    academic: {
        tiers: [
            { maxPapers: 0, score: 85 },  // 零论文 → 学术空白大
            { maxPapers: 3, score: 75 },
            { maxPapers: 10, score: 60 },
            { maxPapers: 20, score: 45 },
        ],
        defaultScore: 30,                   // 超过最大阈值的默认分
        highCitationPenalty: 10,             // 高引修正扣分
        lowCitationBonus: 5,                // 低引修正加分
        citationHighThreshold: 100,          // 高引判定阈值
        citationLowThreshold: 5,             // 低引判定阈值
    },
    /** 产业分析员：市场信号 → 创新性分数映射 */
    industry: {
        tiers: [
            { maxWeb: 0, maxGithub: 0, score: 80 },
            { maxWeb: 5, maxGithub: 1, score: 70 },
            { maxWeb: 10, maxGithub: 3, score: 55 },
            { maxWeb: 20, maxGithub: 5, score: 40 },
        ],
        defaultScore: 25,
    },
    /** 竞品侦探：GitHub 竞品 → 创新性分数映射 */
    competitor: {
        tiers: [
            { maxRepos: 0, maxHighStar: Infinity, score: 85 },
            { maxRepos: 3, maxHighStar: 0, score: 70 },
            { maxRepos: Infinity, maxHighStar: 1, score: 55 },
        ],
        defaultScore: 30,
        highStarThreshold: 5000,              // 高星判定阈值
    },
    /** 全局分数钳制范围 */
    clamp: { min: 10, max: 95 },
} as const;

// ==================== 超时执行器 ====================

/**
 * 带超时和取消机制的 Agent 执行器
 * 超时或失败时返回 fallback 值，保证流程不中断
 * 超时后通过 AbortController 立即取消底层 AI 调用，避免资源浪费
 */
export async function runWithTimeout<T>(
    fn: (abortSignal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    fallback: T,
    agentName: string,
    emitLog?: (msg: string) => void
): Promise<T> {
    const startTime = Date.now();
    const abortController = new AbortController();

    let timer: NodeJS.Timeout | undefined;
    try {
        const timeoutPromise = new Promise<{ type: 'timeout' }>(resolve => {
            timer = setTimeout(() => {
                abortController.abort(); // 超时时立即取消底层 fetch
                resolve({ type: 'timeout' });
            }, timeoutMs);
        });

        // 关键修复：在 .then() 链内 catch 异常，将其转为 error 类型
        // 而非让 rejected promise 冒泡到 Promise.race 外层
        const resultPromise = fn(abortController.signal)
            .then(data => ({ type: 'success' as const, data }))
            .catch((err: unknown) => ({ type: 'error' as const, error: err }));

        const result = await Promise.race([resultPromise, timeoutPromise]);

        clearTimeout(timer);

        const duration = Date.now() - startTime;

        if (result.type === 'timeout') {
            const msg = `[Orchestrator] ⚠️ ${agentName} 超时 (上限 ${timeoutMs}ms)，实际耗时 ${duration}ms → 使用降级评分`;
            console.error(msg);
            emitLog?.(msg);
            return fallback;
        }

        if (result.type === 'error') {
            const errMsg = result.error instanceof Error ? result.error.message : String(result.error);
            const msg = `[Orchestrator] ⚠️ ${agentName} 异常 (${duration}ms): ${errMsg} → 使用降级评分`;
            console.error(msg);
            emitLog?.(msg);
            abortController.abort();
            return fallback;
        }

        console.log(`[Orchestrator] ${agentName} 完成，耗时 ${duration}ms`);
        return result.data;

    } catch (err: unknown) {
        // 此处仅捕获 Promise.race 自身的异常（极少见）
        clearTimeout(timer!);
        const duration = Date.now() - startTime;
        console.error(`[Orchestrator] ${agentName} 未预期异常 (${duration}ms):`, err instanceof Error ? err.message : err);
        abortController.abort();
        return fallback;
    }
}

// ==================== 智能 Fallback 生成器（工业级） ====================

/**
 * 基于原始检索数据的统计特征生成有信息量的降级评估
 * 不再使用固定 50 分，而是通过数据统计推断合理的评分范围
 */
export function createFallbackAgentOutput(agentName: string, input?: AgentInput): AgentOutput {
    let inferredScore = 50;
    let analysis = `${agentName}分析暂不可用（超时或服务异常），以下为基于原始数据的统计推断。`;
    const evidenceSources: string[] = [];
    const keyFindings: string[] = [`${agentName}未能完成 AI 分析，以下为统计推断`];
    const redFlags: string[] = [`${agentName}服务异常，结果仅供参考`];
    const dimensionScores: DimensionScore[] = [];

    if (input) {
        const { clamp } = FALLBACK_CONFIG;

        // 学术审查员智能 fallback（配置驱动）
        if (agentName === '学术审查员') {
            const cfg = FALLBACK_CONFIG.academic;
            const paperCount = input.academicData.results?.length || 0;
            const totalCitations = input.academicData.stats?.totalCitations || 0;
            const avgCitation = input.academicData.stats?.avgCitation || 0;

            // 论文越少→学术空白越大→对创新有利→分数越高（配置驱动）
            const matchedTier = cfg.tiers.find(t => paperCount <= t.maxPapers);
            inferredScore = matchedTier ? matchedTier.score : cfg.defaultScore;

            // 引用密度修正（配置驱动）
            if (avgCitation > cfg.citationHighThreshold) inferredScore -= cfg.highCitationPenalty;
            if (avgCitation < cfg.citationLowThreshold && paperCount > 0) inferredScore += cfg.lowCitationBonus;

            inferredScore = Math.max(clamp.min, Math.min(clamp.max, inferredScore));

            analysis = `基于统计推断：检索到 ${paperCount} 篇相关论文，总引用 ${totalCitations} 次，平均引用 ${Math.round(avgCitation)} 次。`;
            if (paperCount <= 3) analysis += ' 论文数量极少，表明该方向学术空白较大。';
            else if (paperCount > 15) analysis += ' 论文数量充足，表明该方向已有较多研究。';

            evidenceSources.push(`检索到 ${paperCount} 篇论文`);
            const topPapers = input.academicData.results?.slice(0, 3).map(p => p.title).filter(Boolean);
            if (topPapers?.length) {
                keyFindings.push(`Top 论文: ${topPapers.join('、')}`);
                evidenceSources.push(...topPapers.map(t => `论文: ${t}`));
            }

            dimensionScores.push(
                { name: '技术成熟度', score: 100 - inferredScore, reasoning: `基于 ${paperCount} 篇论文统计推断` },
                { name: '论文覆盖度', score: 100 - inferredScore, reasoning: '统计推断' },
                { name: '学术空白', score: inferredScore, reasoning: '统计推断' },
                { name: '引用密度', score: Math.min(100, Math.round(avgCitation)), reasoning: '统计推断' },
                { name: '发展趋势', score: 50, reasoning: '无法推断，默认中等' }
            );
        }

        // 产业分析员智能 fallback（配置驱动）
        if (agentName === '产业分析员') {
            const cfg = FALLBACK_CONFIG.industry;
            const webCount = input.industryData.webResults?.length || 0;
            const githubCount = input.industryData.githubRepos?.length || 0;

            // 市场信号越少→蓝海→对创新有利→分数越高（配置驱动）
            const matchedTier = cfg.tiers.find(t => webCount <= t.maxWeb && githubCount <= t.maxGithub);
            inferredScore = matchedTier ? matchedTier.score : cfg.defaultScore;

            inferredScore = Math.max(clamp.min, Math.min(clamp.max, inferredScore));

            analysis = `基于统计推断：网页搜索 ${webCount} 条结果，GitHub ${githubCount} 个相关项目，市场热度 ${input.industryData.sentiment}。`;
            evidenceSources.push(`Brave/SerpAPI: ${webCount} 条`, `GitHub: ${githubCount} 个项目`);

            const webTitles = input.industryData.webResults?.slice(0, 3).map((r: { title?: string }) => r.title).filter(Boolean);
            if (webTitles?.length) {
                keyFindings.push(`相关网页: ${webTitles.join('、')}`);
            }

            dimensionScores.push(
                { name: '市场验证度', score: Math.min(100, webCount * 5 + githubCount * 10), reasoning: '统计推断' },
                { name: '竞争烈度', score: inferredScore, reasoning: '统计推断' },
                { name: '商业化可行性', score: 50, reasoning: '无法推断，默认中等' },
                { name: '时机评估', score: 50, reasoning: '无法推断，默认中等' }
            );
        }

        // 竞品侦探智能 fallback（配置驱动）
        if (agentName === '竞品侦探') {
            const cfg = FALLBACK_CONFIG.competitor;
            const githubCount = input.industryData.githubRepos?.length || 0;
            const highStarCount = (input.industryData.githubRepos || []).filter((r: { stars?: number }) => (r.stars || 0) > cfg.highStarThreshold).length;

            const matchedTier = cfg.tiers.find(t => githubCount <= t.maxRepos && highStarCount <= t.maxHighStar);
            inferredScore = matchedTier ? matchedTier.score : cfg.defaultScore;

            inferredScore = Math.max(clamp.min, Math.min(clamp.max, inferredScore));

            const repoNames = input.industryData.topProjects?.slice(0, 3).map((p: { name?: string; stars?: number }) => `${p.name}(${p.stars}⭐)`).join(', ') || '无';
            analysis = `基于统计推断：${githubCount} 个 GitHub 竞品（${highStarCount} 个高星），Top 项目: ${repoNames}`;
            evidenceSources.push(`GitHub: ${githubCount} 个竞品项目`);
            if (highStarCount > 0) keyFindings.push(`${highStarCount} 个高星竞品项目 (>5000⭐)`);

            dimensionScores.push(
                { name: '竞争密度', score: inferredScore, reasoning: '统计推断' },
                { name: '技术护城河', score: 50, reasoning: '无法推断，默认中等' },
                { name: '差异化空间', score: inferredScore, reasoning: '统计推断' },
                { name: '进入壁垒', score: 50, reasoning: '无法推断，默认中等' }
            );
        }
    }

    return {
        agentName,
        analysis,
        score: inferredScore,
        confidence: 'low',
        confidenceReasoning: 'Agent 超时或异常，此评分基于原始数据统计推断，仅供参考',
        keyFindings,
        redFlags,
        evidenceSources,
        reasoning: '该 Agent 未能完成 AI 分析，评分基于检索数据的统计特征推断',
        dimensionScores,
        isFallback: true,
        // NovoStarchart 六维降级默认值（仅创新评估师）
        ...(agentName === '创新评估师' ? {
            innovationRadar: [
                { key: 'techBreakthrough', nameZh: '技术突破与性能跨越', nameEn: 'Technical Breakthrough', score: Math.round(inferredScore * 0.9), reasoning: '统计推断，仅供参考' },
                { key: 'businessModel', nameZh: '商业模式与获利逻辑', nameEn: 'Business Model', score: 50, reasoning: '无法推断，默认中等' },
                { key: 'userExperience', nameZh: '用户期望与交互体验', nameEn: 'User Experience', score: 50, reasoning: '无法推断，默认中等' },
                { key: 'orgCapability', nameZh: '组织能力与流程效能', nameEn: 'Org Capability', score: 50, reasoning: '无法推断，默认中等' },
                { key: 'networkEcosystem', nameZh: '网络协同与生态效应', nameEn: 'Network & Ecosystem', score: 40, reasoning: '无法推断，默认偏低' },
                { key: 'socialImpact', nameZh: '社会贡献与环境可持续', nameEn: 'Social Impact', score: 40, reasoning: '无法推断，默认偏低' },
            ]
        } : {})
    };
}

/** 生成降级兜底的 ArbitrationResult */
export function createFallbackArbitration(agents: AgentOutput[]): ArbitrationResult {
    const validAgents = agents.filter(a => typeof a.score === 'number');
    const avgScore = validAgents.length > 0
        ? Math.round(validAgents.reduce((s, a) => s + a.score, 0) / validAgents.length)
        : 50;

    return {
        summary: '仲裁员未能完成分析，以下为各专家评分的简单平均。',
        overallScore: avgScore,
        recommendation: mapScoreToRecommendation(avgScore),
        conflictsResolved: [],
        nextSteps: ['建议重新运行分析以获取完整结果'],
        weightedBreakdown: {
            academic: { raw: agents[0]?.score ?? 50, weight: 0.30, weighted: Math.round((agents[0]?.score ?? 50) * 0.30), confidence: agents[0]?.confidence || 'low' },
            industry: { raw: agents[1]?.score ?? 50, weight: 0.25, weighted: Math.round((agents[1]?.score ?? 50) * 0.25), confidence: agents[1]?.confidence || 'low' },
            innovation: { raw: agents[2]?.score ?? 50, weight: 0.35, weighted: Math.round((agents[2]?.score ?? 50) * 0.35), confidence: agents[2]?.confidence || 'low' },
            competitor: { raw: agents[3]?.score ?? 50, weight: 0.10, weighted: Math.round((agents[3]?.score ?? 50) * 0.10), confidence: agents[3]?.confidence || 'low' }
        },
        consensusLevel: 'weak',
        dissent: ['仲裁员超时，无法分析分歧']
    };
}
