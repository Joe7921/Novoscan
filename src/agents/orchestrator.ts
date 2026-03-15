import { AgentInput, AgentOutput, FinalReport, ArbitrationResult, DimensionScore, DebateRecord, CrossDomainScoutOutput } from './types';
import { academicReviewer } from './academicReviewer';
import { industryAnalyst } from './industryAnalyst';
import { innovationEvaluator } from './innovationEvaluator';
import { competitorDetective } from './competitorDetective';
import { crossDomainScout, createFallbackCrossDomainOutput } from './crossDomainScout';
import { arbitrator } from './arbitrator';
import { qualityGuard } from './qualityGuard';
import { executeNovoDebate, createFallbackDebateRecord } from './debater';
import { AIAnalysisResult } from '@/lib/ai-client';
import type { AgentExecutionRecord, AgentResult } from '@/lib/db/schema';
import { getActivePluginAgents } from '@/plugins/discovery';

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
const AGENT_TIMEOUT = 120000;

/** 仲裁员超时控制 (90秒，仲裁员需要整合四份报告 + 辩论记录，输出更长) */
const ARBITRATOR_TIMEOUT = 90000;

/** NovoDebate 辩论层超时控制（60秒） */
const _DEBATE_TIMEOUT = 60000;

/** 总流程强制截止时间（380秒，Layer1 120s + Layer2 120s + Debate 60s + Arbiter 90s + 余量） */
const TOTAL_MAX_DURATION = 380000;

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

/**
 * 带超时和取消机制的 Agent 执行器
 * 超时或失败时返回 fallback 值，保证流程不中断
 * 超时后通过 AbortController 立即取消底层 AI 调用，避免资源浪费
 *
 * 修复：将 resultPromise 的异常在 race 内部 catch，避免竞态冒泡导致误判为超时
 */
async function runWithTimeout<T>(
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

            const webTitles = input.industryData.webResults?.slice(0, 3).map((r) => r.title).filter(Boolean);
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
            const highStarCount = (input.industryData.githubRepos || []).filter((r) => (r.stars || 0) > cfg.highStarThreshold).length;

            const matchedTier = cfg.tiers.find(t => githubCount <= t.maxRepos && highStarCount <= t.maxHighStar);
            inferredScore = matchedTier ? matchedTier.score : cfg.defaultScore;

            inferredScore = Math.max(clamp.min, Math.min(clamp.max, inferredScore));

            const repoNames = input.industryData.topProjects?.slice(0, 3).map((p) => `${p.name}(${p.stars}⭐)`).join(', ') || '无';
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

// ==================== 编排器主流程（工业级） ====================

/**
 * 多 Agent 分析编排器（工业级）
 * 
 * 优化后的执行拓扑：
 *   Layer1（并行）：学术审查员 + 产业分析员 + 竞品侦探
 *   Layer2（串行）：创新评估师（综合交叉质疑，依赖全部 Layer1）
 *   Layer3（串行）：仲裁员（整合四份报告）
 *   Layer4（纯逻辑）：质量把关
 * 
 * 对比旧版的改进：
 *   - 竞品侦探从 Layer2 提升到 Layer1（它本身无上游依赖，释放并行度）
 *   - 创新评估师接收全部三份 Layer1 报告（新增竞品报告输入）
 *   - 智能 fallback 替代固定 50 分
 */
export async function analyzeWithMultiAgents(input: AgentInput): Promise<FinalReport> {
    console.log('[Orchestrator] 🚀 启动多 Agent 分析流程（工业级）');
    const startTime = Date.now();

    // 1. 创建内存中的执行记录
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const executionRecord: AgentExecutionRecord = {
        executionId,
        query: input.query,
        queryHash: Array.from(input.query).reduce((hash, char) => 0 | (31 * hash + char.charCodeAt(0)), 0).toString(),
        timestamp: Date.now(),
        sessionId: 'server',
        agents: {},
        metadata: {
            totalExecutionTimeMs: 0,
            timeoutOccurred: false,
            agentsCompleted: 0,
            agentsTimedOut: 0,
            modelProvider: input.modelProvider,
        }
    };

    // 内部帮助函数，更新状态
    const updateAgentStatus = (agentId: keyof AgentExecutionRecord['agents'], update: Partial<AgentResult>) => {
        executionRecord.agents[agentId] = {
            ...(executionRecord.agents[agentId] || { agentId, status: 'pending', startTime: Date.now() }),
            ...update
        } as AgentResult;

        if (input.onProgress) {
            input.onProgress('agent_state', { agentId, update: executionRecord.agents[agentId] });
        }
    };

    const emitLog = (msg: string) => {
        console.log(msg);
        if (input.onProgress) {
            input.onProgress('log', msg);
        }
    };

    const getRemainingTime = () => {
        const elapsed = Date.now() - startTime;
        return Math.max(1000, TOTAL_MAX_DURATION - elapsed);
    };

    // ==================== Agent 记忆进化：RAG 检索历史经验（带超时保护） ====================
    let memoryInsight: FinalReport['memoryInsight'] = undefined;
    try {
        const { retrieveRelevantExperiences } = await import('@/lib/services/agentMemoryService');
        // 超时保护：RAG 检索最多 5 秒，超时不影响主流程
        const MEMORY_RETRIEVAL_TIMEOUT = 5000;
        let memoryTimer: NodeJS.Timeout | undefined;
        const experiences = await Promise.race([
            retrieveRelevantExperiences(input.query, input.domainId),
            new Promise<Awaited<ReturnType<typeof retrieveRelevantExperiences>>>((resolve) =>
                memoryTimer = setTimeout(() => {
                    console.warn('[Orchestrator] 经验检索超时(5s)，跳过');
                    resolve({ count: 0, queries: [], context: '', experiences: [] });
                }, MEMORY_RETRIEVAL_TIMEOUT)
            )
        ]);
        clearTimeout(memoryTimer); // 无论哪个先完成，都清除 timer
        if (experiences.count > 0) {
            input.memoryContext = experiences.context;
            memoryInsight = {
                experiencesUsed: experiences.count,
                relevantQueries: experiences.queries,
                // 传给前端的摘要截短（完整上下文只注入 Prompt，不传前端）
                contextSummary: experiences.context.slice(0, 500),
            };
            emitLog(`[AgentMemory] 🧠 检索到 ${experiences.count} 条相关历史经验 (${experiences.context.length} 字)，已注入 Agent 上下文`);
            if (input.onProgress) {
                input.onProgress('agent_memory', {
                    experiencesUsed: experiences.count,
                    relevantQueries: experiences.queries,
                });
            }
        } else {
            emitLog('[AgentMemory] 经验库暂无相关历史案例');
        }
    } catch (e: unknown) {
        console.warn('[Orchestrator] 经验检索失败(不影响主流程):', e instanceof Error ? e.message : String(e));
    }

    // ==================== Layer 1：流水线重叠架构 ====================
    // 关键路径（学术+产业+竞品）：L2 创新评估师的直接依赖，完成后立即启动 L2
    // 非关键路径（跨域侦察兵）：仅 L3 仲裁员需要，在后台并行运行，L3 前才汇合
    // 动态时间预算：为后续层预留时间，避免前面层耗尽总时长
    const DEBATE_RESERVE = 65000;    // L2.5 辩论预留
    const ARBITER_RESERVE = 95000;   // L3 仲裁员预留
    const L2_RESERVE = 125000;       // L2 创新评估师预留

    emitLog('[Orchestrator] ⏳ Layer1 启动：关键路径(学术+产业+竞品) + 非关键路径(跨域)（流水线重叠）');
    if (input.onProgress) input.onProgress('progress', 8);

    // Layer1 中间进度：每个 Agent 完成时推送递增进度
    let layer1CompletedCount = 0;
    const LAYER1_PROGRESS_STEPS = [13, 18, 23, 28];
    const emitLayer1Progress = () => {
        const idx = layer1CompletedCount;
        layer1CompletedCount++;
        if (idx < LAYER1_PROGRESS_STEPS.length && input.onProgress) {
            input.onProgress('progress', LAYER1_PROGRESS_STEPS[idx]);
        }
    };

    // ---- 非关键路径：跨域侦察兵独立 Promise（后台运行，L3 前才 await） ----
    const crossDomainPromise = (async () => {
        updateAgentStatus('crossDomainScout' as keyof AgentExecutionRecord['agents'], { status: 'running', startTime: Date.now() });
        const sTime = Date.now();
        const res = await runWithTimeout(
            (signal) => crossDomainScout({ ...input, _abortSignal: signal }),
            Math.min(AGENT_TIMEOUT, getRemainingTime()),
            createFallbackCrossDomainOutput(input),
            '跨域侦察兵',
            emitLog
        );
        updateAgentStatus('crossDomainScout' as keyof AgentExecutionRecord['agents'], {
            status: res.isFallback ? 'timeout' : 'completed',
            endTime: Date.now(),
            executionTimeMs: Date.now() - sTime,
            output: { score: res.score, analysis: res.analysis, findings: res.keyFindings, redFlags: res.redFlags }
        });
        emitLayer1Progress();
        return res as CrossDomainScoutOutput;
    })();

    // ---- 关键路径：学术+产业+竞品（完成后立即启动 L2，不等跨域） ----
    const l1Budget = Math.max(30000, Math.min(AGENT_TIMEOUT, getRemainingTime() - L2_RESERVE - DEBATE_RESERVE - ARBITER_RESERVE));
    const [academicReview, industryAnalysis, competitorAnalysis] = await Promise.all([
        (async () => {
            updateAgentStatus('academicReviewer', { status: 'running', startTime: Date.now() });
            const sTime = Date.now();
            const res = await runWithTimeout(
                (signal) => academicReviewer({ ...input, _abortSignal: signal }),
                l1Budget,
                createFallbackAgentOutput('学术审查员', input),
                '学术审查员',
                emitLog
            );
            updateAgentStatus('academicReviewer', {
                status: res.isFallback ? 'timeout' : 'completed',
                endTime: Date.now(),
                executionTimeMs: Date.now() - sTime,
                output: { score: res.score, analysis: res.analysis, findings: res.keyFindings, redFlags: res.redFlags }
            });
            emitLayer1Progress();
            return res;
        })(),
        (async () => {
            updateAgentStatus('industryAnalyst', { status: 'running', startTime: Date.now() });
            const sTime = Date.now();
            const res = await runWithTimeout(
                (signal) => industryAnalyst({ ...input, _abortSignal: signal }),
                l1Budget,
                createFallbackAgentOutput('产业分析员', input),
                '产业分析员',
                emitLog
            );
            updateAgentStatus('industryAnalyst', {
                status: res.isFallback ? 'timeout' : 'completed',
                endTime: Date.now(),
                executionTimeMs: Date.now() - sTime,
                output: { score: res.score, analysis: res.analysis, findings: res.keyFindings, redFlags: res.redFlags }
            });
            emitLayer1Progress();
            return res;
        })(),
        (async () => {
            updateAgentStatus('competitorDetective', { status: 'running', startTime: Date.now() });
            const sTime = Date.now();
            const res = await runWithTimeout(
                (signal) => competitorDetective({ ...input, _abortSignal: signal }),
                l1Budget,
                createFallbackAgentOutput('竞品侦探', input),
                '竞品侦探',
                emitLog
            );
            updateAgentStatus('competitorDetective', {
                status: res.isFallback ? 'timeout' : 'completed',
                endTime: Date.now(),
                executionTimeMs: Date.now() - sTime,
                output: { score: res.score, analysis: res.analysis, findings: res.keyFindings, redFlags: res.redFlags }
            });
            emitLayer1Progress();
            return res;
        })()
    ]);
    emitLog(`[Orchestrator] ✅ Layer1 关键路径完成 — 学术(${academicReview.confidence}/${academicReview.score}) + 产业(${industryAnalysis.confidence}/${industryAnalysis.score}) + 竞品(${competitorAnalysis.confidence}/${competitorAnalysis.score})`);

    // ==================== 插件 Agent 增强（可选，默认关闭） ====================
    // 通过 ENABLE_PLUGIN_AGENTS=true 环境变量控制开关
    // 开启后在 Layer 1 完成后并行执行所有已注册的插件 Agent
    // 单个插件超时 15 秒，失败不影响主流程
    const PLUGIN_AGENT_TIMEOUT = 15000;
    let pluginResults: Array<{ agentId: string; output: AgentOutput; durationMs: number }> | undefined;

    if (process.env.ENABLE_PLUGIN_AGENTS === 'true') {
        try {
            const pluginAgents = getActivePluginAgents();
            if (pluginAgents.length > 0) {
                emitLog(`[Orchestrator] 🧩 插件增强启动：${pluginAgents.length} 个插件 Agent 并行执行（超时 ${PLUGIN_AGENT_TIMEOUT}ms）`);

                const pluginPromises = pluginAgents.map(async (agent) => {
                    const pluginStart = Date.now();
                    try {
                        const output = await runWithTimeout(
                            (_signal) => agent.analyze(input),
                            PLUGIN_AGENT_TIMEOUT,
                            createFallbackAgentOutput(agent.name || agent.id, input),
                            `插件:${agent.id}`,
                            emitLog
                        );
                        return {
                            agentId: agent.id,
                            output,
                            durationMs: Date.now() - pluginStart,
                        };
                    } catch (err: unknown) {
                        const errMsg = err instanceof Error ? err.message : String(err);
                        emitLog(`[Orchestrator] ⚠️ 插件 ${agent.id} 执行异常: ${errMsg}`);
                        return {
                            agentId: agent.id,
                            output: createFallbackAgentOutput(agent.name || agent.id, input),
                            durationMs: Date.now() - pluginStart,
                        };
                    }
                });

                pluginResults = await Promise.all(pluginPromises);
                emitLog(`[Orchestrator] ✅ 插件增强完成：${pluginResults.length} 个插件 Agent 已执行`);
            } else {
                emitLog('[Orchestrator] 🧩 插件增强已开启，但无可用插件 Agent');
            }
        } catch (err: unknown) {
            // 插件系统整体异常不影响主流程
            emitLog(`[Orchestrator] ⚠️ 插件系统异常（不影响主流程）: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    // ==================== 熔断检测 L1：3 个核心 Agent 全部 fallback → AI API 完全不可用 ====================
    const l1Agents = [academicReview, industryAnalysis, competitorAnalysis];
    const l1FallbackCount = l1Agents.filter(a => a.isFallback).length;
    if (l1FallbackCount === l1Agents.length) {
        const failedNames = ['学术审查员', '产业分析员', '竞品侦探'];
        emitLog(`[Orchestrator] 🚨 熔断触发：Layer1 全部 ${l1FallbackCount} 个核心 Agent 返回降级数据，AI API 完全不可用，中止分析`);
        if (input.onProgress) input.onProgress('progress', 100);
        // 异步记录管理员告警
        logCircuitBreakerAlert(input.modelProvider, failedNames, 'L1').catch(() => {});
        throw new AllAgentsFailedError(failedNames, input.modelProvider);
    }

    emitLog(`[Orchestrator] 📡 跨域侦察兵在后台继续运行，L3 仲裁员前汇合`);

    // ==================== Layer 2：创新评估师（综合交叉质疑） ====================
    emitLog('[Orchestrator] ⏳ Layer2 启动：创新评估师（综合交叉质疑）');
    if (input.onProgress) input.onProgress('progress', 30);

    updateAgentStatus('innovationEvaluator', { status: 'running', startTime: Date.now() });
    const innovStartTime = Date.now();

    // 心跳进度推送：Layer2 运行期间 30%→44%，每 5 秒递增
    let layer2HeartbeatProgress = 30;
    const layer2Heartbeat = setInterval(() => {
        if (layer2HeartbeatProgress < 44 && input.onProgress) {
            layer2HeartbeatProgress += 2;
            input.onProgress('progress', layer2HeartbeatProgress);
        }
    }, 5000);

    const innovationEvaluation = await runWithTimeout(
        (signal) => innovationEvaluator({ ...input, _abortSignal: signal }, academicReview, industryAnalysis, competitorAnalysis),
        Math.min(AGENT_TIMEOUT, getRemainingTime()),
        createFallbackAgentOutput('创新评估师', input),
        '创新评估师',
        emitLog
    );
    clearInterval(layer2Heartbeat);

    updateAgentStatus('innovationEvaluator', {
        status: innovationEvaluation.isFallback ? 'timeout' : 'completed',
        endTime: Date.now(),
        executionTimeMs: Date.now() - innovStartTime,
        output: { score: innovationEvaluation.score, analysis: innovationEvaluation.analysis, findings: innovationEvaluation.keyFindings, redFlags: innovationEvaluation.redFlags }
    });

    emitLog(`[Orchestrator] ✅ Layer2 完成 — 创新评估师(${innovationEvaluation.confidence}/${innovationEvaluation.score})`);

    // ==================== 熔断检测 L2：≥3 个核心 Agent fallback → 只剩 1 个正常也视为无效 ====================
    const allCoreAgents = [academicReview, industryAnalysis, competitorAnalysis, innovationEvaluation];
    const allCoreFallbackCount = allCoreAgents.filter(a => a.isFallback).length;
    if (allCoreFallbackCount >= 3) {
        const failedNames = [
            academicReview.isFallback ? '学术审查员' : null,
            industryAnalysis.isFallback ? '产业分析员' : null,
            competitorAnalysis.isFallback ? '竞品侦探' : null,
            innovationEvaluation.isFallback ? '创新评估师' : null,
        ].filter(Boolean) as string[];
        emitLog(`[Orchestrator] 🚨 熔断触发：${allCoreFallbackCount}/4 个核心 Agent 返回降级数据（仅剩 ${4 - allCoreFallbackCount} 个正常），中止分析`);
        if (input.onProgress) input.onProgress('progress', 100);
        // 异步记录管理员告警
        logCircuitBreakerAlert(input.modelProvider, failedNames, 'L2').catch(() => {});
        throw new AllAgentsFailedError(failedNames, input.modelProvider);
    }

    // ==================== Layer 2.5：NovoDebate 对抗辩论 ====================
    // 智能跳过：如果 ≥2 个 Agent 返回 fallback，辩论毫无意义（用假数据辩论浪费时间）
    const fallbackCount = [academicReview, industryAnalysis, innovationEvaluation, competitorAnalysis].filter(a => a.isFallback).length;
    let debateRecord: Awaited<ReturnType<typeof executeNovoDebate>>;

    if (fallbackCount >= 2) {
        emitLog(`[Orchestrator] ⏭️ Layer2.5 跳过 — ${fallbackCount} 个 Agent 返回降级数据，辩论无意义`);
        if (input.onProgress) input.onProgress('progress', 64);
        updateAgentStatus('novoDebate' as keyof AgentExecutionRecord['agents'], {
            status: 'completed', startTime: Date.now(), endTime: Date.now(), executionTimeMs: 0,
            output: { score: 0, analysis: `${fallbackCount} 个 Agent 降级，跳过辩论`, findings: [], redFlags: [] }
        });
        debateRecord = createFallbackDebateRecord(`${fallbackCount} 个 Agent 降级，跳过辩论`);
    } else {
    emitLog('[Orchestrator] ⏳ Layer2.5 启动：NovoDebate 对抗辩论');
    if (input.onProgress) input.onProgress('progress', 45);

    updateAgentStatus('novoDebate' as keyof AgentExecutionRecord['agents'], { status: 'running', startTime: Date.now() });
    const debateStartTime = Date.now();

    // 心跳进度推送：Layer2.5 运行期间 45%→64%，每 4 秒递增
    let debateHeartbeatProgress = 45;
    const debateHeartbeat = setInterval(() => {
        if (debateHeartbeatProgress < 64 && input.onProgress) {
            debateHeartbeatProgress += 2;
            input.onProgress('progress', debateHeartbeatProgress);
        }
    }, 4000);

    // 使用 runWithTimeout 替代裸 try-catch，防止辩论引擎挂起拖垮全流程
    const DEBATE_TIMEOUT = Math.min(45000, getRemainingTime());
    debateRecord = await runWithTimeout(
        (_signal) => executeNovoDebate(
            {
                academic: academicReview,
                industry: industryAnalysis,
                innovation: innovationEvaluation,
                competitor: competitorAnalysis
            },
            input.query,
            input.modelProvider,
            (type, data) => {
                if (input.onProgress) input.onProgress(type as 'log' | 'progress' | 'agent_state' | 'agent_stream' | 'agent_memory', data);
            },
            _signal,
            getRemainingTime()
        ),
        DEBATE_TIMEOUT,
        createFallbackDebateRecord('辩论超时'),
        'NovoDebate',
        emitLog
    );
    clearInterval(debateHeartbeat);

    updateAgentStatus('novoDebate' as keyof AgentExecutionRecord['agents'], {
        status: 'completed',
        endTime: Date.now(),
        executionTimeMs: Date.now() - debateStartTime,
        output: {
            score: 0,
            analysis: debateRecord.triggered ? debateRecord.dissentReportText : '未触发辩论',
            findings: debateRecord.sessions.flatMap(s => s.keyInsights),
            redFlags: []
        }
    });

    if (debateRecord.triggered) {
        emitLog(`[Orchestrator] ✅ Layer2.5 完成 — NovoDebate ${debateRecord.sessions.length} 场辩论，耗时 ${debateRecord.totalDurationMs}ms`);
    } else {
        emitLog(`[Orchestrator] ⏭️ Layer2.5 跳过 — ${debateRecord.triggerReason}`);
    }
    } // else: 正常辩论分支结束

    // ==================== Layer 3：仲裁员（整合辩论记录 + 四份报告 → 法官裁决） ====================
    // 流水线汇合点：此时才 await 跨域侦察兵的后台 Promise
    const crossDomainResult = await crossDomainPromise;
    emitLog(`[Orchestrator] ✅ 跨域侦察兵汇合完成 — (${crossDomainResult.confidence}/${crossDomainResult.score})`);
    emitLog('[Orchestrator] ⏳ Layer3 启动：仲裁员（含辩论裁决）');
    if (input.onProgress) input.onProgress('progress', 65);

    updateAgentStatus('arbitrator', { status: 'running', startTime: Date.now() });
    const arbStartTime = Date.now();

    // 心跳进度推送：Layer3 运行期间 65%→91%，每 4 秒递增
    let arbHeartbeatProgress = 65;
    const arbHeartbeat = setInterval(() => {
        if (arbHeartbeatProgress < 91 && input.onProgress) {
            arbHeartbeatProgress += 3;
            input.onProgress('progress', Math.min(91, arbHeartbeatProgress));
        }
    }, 4000);

    const arbitration = await runWithTimeout(
        (signal) => arbitrator(
            academicReview,
            industryAnalysis,
            innovationEvaluation,
            competitorAnalysis,
            input.language,
            input.modelProvider,
            undefined,
            signal,
            input.domainHint,
            debateRecord,
            crossDomainResult
        ),
        Math.min(ARBITRATOR_TIMEOUT, getRemainingTime()),
        createFallbackArbitration([academicReview, industryAnalysis, innovationEvaluation, competitorAnalysis]),
        '仲裁员',
        emitLog
    );
    clearInterval(arbHeartbeat);

    // 检查是否发生了任何降级
    const agents = [academicReview, industryAnalysis, innovationEvaluation, competitorAnalysis];
    const hasTimeout = agents.some(a => a.isFallback) || arbitration.summary.includes('未能完成');
    const isGlobalTimeout = (Date.now() - startTime) >= TOTAL_MAX_DURATION - 2000;

    if (hasTimeout || isGlobalTimeout) {
        arbitration.isPartial = true;
        if (isGlobalTimeout) {
            arbitration.summary = `分析已达到最大时限，以下为部分专家生成的初步意见。${arbitration.summary}`;
        }
    }

    updateAgentStatus('arbitrator', {
        status: arbitration.summary.includes('未能完成') ? 'timeout' : 'completed',
        endTime: Date.now(),
        executionTimeMs: Date.now() - arbStartTime,
        output: { score: arbitration.overallScore, analysis: arbitration.summary, findings: arbitration.nextSteps, redFlags: arbitration.conflictsResolved }
    });

    emitLog(`[Orchestrator] ✅ Layer3 完成，综合评分: ${arbitration.overallScore}, 共识度: ${arbitration.consensusLevel || 'N/A'}`);

    // ==================== Layer 4：质量把关（纯逻辑） ====================
    emitLog('[Orchestrator] ⏳ Layer4 启动：质量把关');
    if (input.onProgress) input.onProgress('progress', 92);
    const qualityCheck = qualityGuard(arbitration, agents, debateRecord);

    // 应用质量把关自动修正（当存在明确逻辑矛盾时自动纠正）
    if (qualityCheck.corrections && qualityCheck.corrections.length > 0) {
        for (const corr of qualityCheck.corrections) {
            if (corr.field === 'recommendation') {
                arbitration.recommendation = corr.to;
                emitLog(`[QualityGuard] 🔧 自动修正: ${corr.from} → ${corr.to} (${corr.reason})`);
            }
        }
    }

    if (!qualityCheck.passed) {
        console.warn('[Orchestrator] ⚠️ 质量检查未通过:', qualityCheck.issues);
    }
    if (qualityCheck.warnings.length > 0) {
        console.warn('[Orchestrator] ⚠️ 质量警告:', qualityCheck.warnings);
    }
    emitLog(`[Orchestrator] ✅ 质量检查完成，一致性评分: ${qualityCheck.consistencyScore}/100`);

    const duration = Date.now() - startTime;
    emitLog(`[Orchestrator] 🏁 多 Agent 分析完成，耗时 ${duration}ms`);
    if (input.onProgress) input.onProgress('progress', 100);

    // 记录最终结果
    const timedOutCount = agents.filter(a => a.isFallback).length + (arbitration.summary.includes('未能完成') ? 1 : 0);

    executionRecord.finalResult = {
        noveltyScore: arbitration.overallScore,
        internetNoveltyScore: industryAnalysis.score || 0,
        credibilityScore: academicReview.score || 0,
        recommendation: arbitration.recommendation
    };

    executionRecord.metadata = {
        ...executionRecord.metadata,
        totalExecutionTimeMs: duration,
        timeoutOccurred: hasTimeout || isGlobalTimeout,
        agentsCompleted: 5 - timedOutCount,
        agentsTimedOut: timedOutCount
    };

    return {
        academicReview,
        industryAnalysis,
        innovationEvaluation,
        competitorAnalysis,
        crossDomainTransfer: crossDomainResult,
        debate: debateRecord,
        arbitration,
        qualityCheck,
        executionRecord,
        memoryInsight,
        pluginResults,
    };
}

// ==================== 格式转换（保持 API 兼容） ====================

/**
 * 将 FinalReport 转换为旧版 AIAnalysisResult 格式
 * 确保前端无需任何修改
 */
export function transformToLegacyFormat(report: FinalReport): AIAnalysisResult {
    const { academicReview, industryAnalysis, innovationEvaluation, competitorAnalysis, arbitration, qualityCheck, executionRecord } = report;

    // 从各 Agent 的 keyFindings 聚合为 keyPoints
    const keyPoints = [
        ...academicReview.keyFindings.slice(0, 2),
        ...industryAnalysis.keyFindings.slice(0, 2),
        ...innovationEvaluation.keyFindings.slice(0, 2),
    ];

    // 构造学术 subsections
    const academicSubsections = [
        {
            title: '现有技术树',
            content: academicReview.analysis,
            keyHighlight: academicReview.keyFindings[0] || ''
        },
        {
            title: '核心差异辩护',
            content: innovationEvaluation.analysis,
            keyHighlight: innovationEvaluation.keyFindings[0] || ''
        },
        {
            title: '学术裁定',
            content: `学术创新性评分: ${academicReview.score}/100 (置信度: ${academicReview.confidence})。${arbitration.summary}`,
            keyHighlight: arbitration.recommendation
        }
    ];

    // 构造产业 subsections
    const internetSubsections = [
        {
            title: '全网扫描雷达',
            content: industryAnalysis.analysis,
            keyHighlight: industryAnalysis.keyFindings[0] || ''
        },
        {
            title: '工业界现状',
            content: competitorAnalysis.analysis,
            keyHighlight: competitorAnalysis.keyFindings[0] || ''
        },
        {
            title: '工程可行性与重叠度',
            content: `产业可行性评分: ${industryAnalysis.score}/100, 竞品分析评分: ${competitorAnalysis.score}/100。${arbitration.conflictsResolved.length > 0
                ? '冲突解决: ' + arbitration.conflictsResolved.join('; ')
                : ''
                }`,
            keyHighlight: `综合评分 ${arbitration.overallScore}/100 — ${arbitration.recommendation}`
        }
    ];

    // 聚合所有 redFlags 作为 improvementSuggestions
    const allRedFlags = [
        ...(academicReview.redFlags || []),
        ...(industryAnalysis.redFlags || []),
        ...(innovationEvaluation.redFlags || []),
        ...(competitorAnalysis.redFlags || [])
    ];

    const improvementSuggestions = [
        ...(arbitration.nextSteps || []),
        ...allRedFlags
    ].join('\n• ');

    return {
        noveltyScore: academicReview.score ?? arbitration.overallScore,
        internetNoveltyScore: industryAnalysis.score ?? arbitration.overallScore,
        similarPapers: [],       // 保持结构，实际数据由 dualTrackResult 填充
        internetSources: [],     // 同上
        sections: {
            academic: {
                title: '学术界多专家审查',
                subsections: academicSubsections
            },
            internet: {
                title: '全网/产业界多专家审查',
                subsections: internetSubsections
            }
        },
        keyPoints,
        isPartial: arbitration.isPartial,
        keyDifferentiators: innovationEvaluation.keyFindings.join('；'),
        improvementSuggestions: improvementSuggestions ? `• ${improvementSuggestions}` : undefined,
        academicReview,
        industryAnalysis,
        innovationEvaluation,
        competitorAnalysis,
        arbitration,
        qualityCheck,
        executionRecord
    };
}

// ==================== 熔断告警（管理员监控） ====================

/**
 * 熔断触发时异步写入告警记录到 api_call_logs，
 * 便于管理员通过监控面板感知 AI API 大面积故障。
 */
async function logCircuitBreakerAlert(
    modelProvider: string | undefined,
    failedAgents: string[],
    layer: string
): Promise<void> {
    try {
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { getSessionId } = await import('@/lib/db/index');
        await supabaseAdmin.from('api_call_logs').insert({
            provider: modelProvider || 'unknown',
            call_type: 'circuit_breaker',
            response_time_ms: 0,
            is_success: false,
            error_message: `[熔断告警-${layer}] ${failedAgents.length} 个 Agent 失败: ${failedAgents.join(', ')}`,
            session_id: getSessionId(),
            called_at: new Date().toISOString(),
        });
        console.warn(`[Orchestrator] 🔔 熔断告警已写入 api_call_logs (${layer}, provider=${modelProvider})`);
    } catch (e: unknown) {
        console.warn('[Orchestrator] 熔断告警写入失败:', e instanceof Error ? e.message : e);
    }
}
