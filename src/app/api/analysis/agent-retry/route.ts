export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 完全重试需要更长时间

import { NextResponse } from 'next/server';
import { academicReviewer } from '@/agents/academic-reviewer';
import { industryAnalyst } from '@/agents/industry-analyst';
import { competitorDetective } from '@/agents/competitor-detective';
import { innovationEvaluator } from '@/agents/innovation-evaluator';
import { arbitrator } from '@/agents/arbitration';
import { qualityGuard } from '@/agents/quality-guard';
import { crossDomainScout, createFallbackCrossDomainOutput } from '@/agents/cross-domain-scout';
import { executeNovoDebate, createFallbackDebateRecord } from '@/agents/debate';
import { RECOMMENDATION_THRESHOLDS, mapScoreToRecommendation } from '@/agents/orchestrator';
import type { AgentInput, AgentOutput, ArbitrationResult, CrossDomainScoutOutput } from '@/agents/types';
import type { ModelProvider } from '@/types';
import { safeErrorResponse } from '@/lib/security/apiSecurity';
import { checkFeatureAccess } from '@/lib/stubs';

// Agent ID → 执行函数映射（Layer1 独立 Agent）
const LAYER1_AGENT_MAP: Record<string, (input: AgentInput) => Promise<unknown>> = {
    academicReviewer,
    industryAnalyst,
    competitorDetective,
};

// 可重试的全部 Agent ID 列表（包括 Layer2 的 innovationEvaluator）
const ALL_RETRYABLE_IDS = new Set([
    'academicReviewer', 'industryAnalyst', 'competitorDetective', 'innovationEvaluator'
]);

// Agent 重试的独立超时（默认 120 秒，可通过环境变量覆盖）
const RETRY_TIMEOUT = parseInt(process.env.AGENT_RETRY_TIMEOUT_MS || '120000', 10);

// ==================== Fallback 工具函数 ====================

/** 创建 Agent 降级输出 */
function createFallbackAgentOutput(agentName: string, _input: AgentInput): AgentOutput {
    return {
        score: 50,
        confidence: 'low',
        keyFindings: [],
        redFlags: [],
        analysis: `${agentName}完全重试时执行失败，使用降级数据`,
        agentName,
        confidenceReasoning: '降级数据',
        evidenceSources: [],
        reasoning: '',
        dimensionScores: [],
        isFallback: true,
    };
}

/** 创建仲裁员降级输出 */
function createFallbackArbitration(agents: AgentOutput[]): ArbitrationResult {
    const scores = agents.map(a => a.score ?? 50);
    const weights = [0.30, 0.25, 0.35, 0.10];
    const overallScore = Math.round(
        scores.reduce((sum, s, i) => sum + s * (weights[i] || 0.25), 0)
    );
    return {
        overallScore,
        summary: `加权综合评分 ${overallScore}/100（仲裁员执行失败，使用统计推断）`,
        recommendation: mapScoreToRecommendation(overallScore),
        consensusLevel: 'weak' as const,
        dissent: [],
        conflictsResolved: [],
        nextSteps: [],
        weightedBreakdown: {
            academic: { raw: scores[0], weight: weights[0], weighted: Math.round(scores[0] * weights[0]), confidence: agents[0]?.confidence || 'low' },
            industry: { raw: scores[1], weight: weights[1], weighted: Math.round(scores[1] * weights[1]), confidence: agents[1]?.confidence || 'low' },
            innovation: { raw: scores[2], weight: weights[2], weighted: Math.round(scores[2] * weights[2]), confidence: agents[2]?.confidence || 'low' },
            competitor: { raw: scores[3], weight: weights[3], weighted: Math.round(scores[3] * weights[3]), confidence: agents[3]?.confidence || 'low' },
        },
    };
}

/**
 * 分级重试 API — 单独重跑失败的 Agent / 完全重试 / 动态计费部分重试
 *
 * mode === 'full-retry'：完全重试（重跑全部 4 Agent + 跨域 + 辩论 + 仲裁 + 质量检查），扣 8 点
 * mode === 'partial-retry'：部分重试 + 重算仲裁（按 Agent 数量动态计费）
 * mode === undefined：默认单 Agent 重试，不扣费
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            agentIds,
            query,
            academicData,
            industryData,
            modelProvider = 'minimax',
            language = 'zh',
            domainHint,
            domainId,
            subDomainId,
            existingAgentResults,
            mode,
        } = body;

        // ==================== 完全重试模式 ====================
        if (mode === 'full-retry') {
            return handleFullRetry({
                query, academicData, industryData, modelProvider, language,
                domainHint, domainId, subDomainId,
            }, request);
        }

        // ==================== 部分重试（动态计费）模式 ====================
        if (mode === 'partial-retry') {
            return handlePartialRetry({
                agentIds, query, academicData, industryData, modelProvider, language,
                domainHint, domainId, subDomainId, existingAgentResults,
            }, request);
        }

        // ==================== 原有单 Agent 重试模式 ====================
        if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'agentIds 参数缺失或为空' },
                { status: 400 }
            );
        }

        if (!query || !academicData || !industryData) {
            return NextResponse.json(
                { success: false, error: '缺少必要参数：query, academicData, industryData' },
                { status: 400 }
            );
        }

        // 验证 agentIds 合法性
        const validIds = agentIds.filter((id: string) => ALL_RETRYABLE_IDS.has(id));
        if (validIds.length === 0) {
            return NextResponse.json(
                { success: false, error: `无效的 agentIds: ${agentIds.join(', ')}` },
                { status: 400 }
            );
        }

        console.log(`[Agent Retry] 开始重试 ${validIds.length} 个 Agent: ${validIds.join(', ')}`);

        // 构建 Agent 输入
        const input: AgentInput = {
            query,
            academicData,
            industryData,
            language,
            modelProvider,
            domainId,
            subDomainId,
            domainHint,
        };

        // 分离 Layer1 和 Layer2 Agent
        const layer1Ids = validIds.filter((id: string) => LAYER1_AGENT_MAP[id]);
        const hasInnovationEvaluator = validIds.includes('innovationEvaluator');

        // 并行执行所有需要重试的 Layer1 Agent（每个独立超时）
        const retryResults = await Promise.all(
            layer1Ids.map(async (agentId: string) => {
                const agentFn = LAYER1_AGENT_MAP[agentId];
                const startTime = Date.now();
                console.log(`[Agent Retry] ▶ ${agentId} 开始执行`);

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), RETRY_TIMEOUT);

                    const result = await agentFn({
                        ...input,
                        _abortSignal: controller.signal,
                    });

                    clearTimeout(timeoutId);
                    const duration = Date.now() - startTime;
                    console.log(`[Agent Retry] ✅ ${agentId} 完成 (${duration}ms), score=${result.score}`);

                    return { agentId, success: true, result };
                } catch (err: unknown) {
                    const duration = Date.now() - startTime;
                    console.error(`[Agent Retry] ❌ ${agentId} 失败 (${duration}ms):`, (err instanceof Error ? err.message : String(err)));
                    return { agentId, success: false, error: (err instanceof Error ? err.message : String(err)) };
                }
            })
        );

        // 组装 Layer1 结果
        const results: Record<string, unknown> = {};
        const failureDetails: Record<string, string> = {};
        let successCount = 0;

        for (const item of retryResults) {
            if (item.success) {
                results[item.agentId] = item.result;
                successCount++;
            } else {
                results[item.agentId] = null;
                failureDetails[item.agentId] = item.error || '未知错误';
            }
        }

        // Layer2: innovationEvaluator 重试（依赖 Layer1 输出）
        if (hasInnovationEvaluator) {
            const startTime = Date.now();
            console.log(`[Agent Retry] ▶ innovationEvaluator 开始执行（Layer2）`);

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), RETRY_TIMEOUT);

                const existing = existingAgentResults || {};

                const academicReview: AgentOutput = results.academicReviewer || existing.academicReview || { score: 50, confidence: 'low', keyFindings: [], redFlags: [], analysis: '', agentName: 'Academic Reviewer', confidenceReasoning: '', evidenceSources: [], reasoning: '', dimensionScores: [] };
                const industryAnalysisResult: AgentOutput = results.industryAnalyst || existing.industryAnalysis || { score: 50, confidence: 'low', keyFindings: [], redFlags: [], analysis: '', agentName: 'Industry Analyst', confidenceReasoning: '', evidenceSources: [], reasoning: '', dimensionScores: [] };
                const competitorAnalysisResult: AgentOutput = results.competitorDetective || existing.competitorAnalysis || { score: 50, confidence: 'low', keyFindings: [], redFlags: [], analysis: '', agentName: 'Competitor Detective', confidenceReasoning: '', evidenceSources: [], reasoning: '', dimensionScores: [] };

                const result = await innovationEvaluator(
                    { ...input, _abortSignal: controller.signal },
                    academicReview,
                    industryAnalysisResult,
                    competitorAnalysisResult
                );

                clearTimeout(timeoutId);
                const duration = Date.now() - startTime;
                console.log(`[Agent Retry] ✅ innovationEvaluator 完成 (${duration}ms), score=${result.score}`);

                results.innovationEvaluator = result;
                successCount++;
            } catch (err: unknown) {
                const duration = Date.now() - startTime;
                console.error(`[Agent Retry] ❌ innovationEvaluator 失败 (${duration}ms):`, (err instanceof Error ? err.message : String(err)));
                results.innovationEvaluator = null;
                failureDetails.innovationEvaluator = (err instanceof Error ? err.message : String(err)) || '未知错误';
            }
        }

        const failedCount = validIds.length - successCount;
        console.log(`[Agent Retry] 完成: ${successCount}/${validIds.length} 成功${failedCount > 0 ? `，失败详情: ${JSON.stringify(failureDetails)}` : ''}`);

        return NextResponse.json({
            success: successCount > 0,
            results,
            retryCount: validIds.length,
            successCount,
            failureDetails: failedCount > 0 ? failureDetails : undefined,
        });
    } catch (error: unknown) {
        return safeErrorResponse(error, 'Agent 重试失败', 500, '[Agent Retry]');
    }
}

// ==================== 完全重试处理函数 ====================

/**
 * 完全重试：重跑全部 4 Agent + 仲裁员 + 质量把关
 * 复用已有检索数据，消耗半价点数（8点）
 */
async function handleFullRetry(
    params: {
        query: string;
        academicData: unknown;
        industryData: unknown;
        modelProvider: string;
        language: string;
        domainHint?: string;
        domainId?: string;
        subDomainId?: string;
    },
    _request: Request
) {
    const { query, academicData, industryData, modelProvider, language, domainHint, domainId, subDomainId } = params;

    if (!query || !academicData || !industryData) {
        return NextResponse.json(
            { success: false, error: '缺少必要参数：query, academicData, industryData' },
            { status: 400 }
        );
    }

    // ==================== 获取用户 ID（可选） ====================
    let currentUserId: string | undefined;
    try {
        const { data: { user } } = await supabaseAuth.auth.getUser();
        currentUserId = user?.id;
    } catch { /* 未登录 */ }

    // 开源版所有功能免费，无需扣费

    console.log(`[Full Retry] 🚀 开始完全重试 (用户=${currentUserId}, 模型=${modelProvider})`);
    const startTime = Date.now();

    const input: AgentInput = {
        query, academicData, industryData,
        language: (language === 'en' ? 'en' : 'zh') as 'zh' | 'en',
        modelProvider: modelProvider as unknown,
        domainId, subDomainId, domainHint,
    };

    // ==================== Layer1.5: 跨域侦察兵（与 Layer1 并行启动，Layer3 前 await） ====================
    const crossDomainPromise = (async (): Promise<CrossDomainScoutOutput> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), RETRY_TIMEOUT);
            const result = await crossDomainScout({ ...input, _abortSignal: controller.signal });
            clearTimeout(timeoutId);
            console.log(`[Full Retry] ✅ crossDomainScout 完成`);
            return result;
        } catch (err: unknown) {
            console.warn(`[Full Retry] ⚠️ crossDomainScout 失败 (non-blocking):`, (err instanceof Error ? err.message : String(err)));
            return createFallbackCrossDomainOutput(input);
        }
    })();

    // ==================== Layer1: 学术 + 产业 + 竞品（并行） ====================
    const [academicResult, industryResult, competitorResult] = await Promise.all(
        (['academicReviewer', 'industryAnalyst', 'competitorDetective'] as const).map(async (agentId) => {
            const agentFn = LAYER1_AGENT_MAP[agentId];
            const sTime = Date.now();
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), RETRY_TIMEOUT);
                const result = await agentFn({ ...input, _abortSignal: controller.signal });
                clearTimeout(timeoutId);
                console.log(`[Full Retry] ✅ ${agentId} 完成 (${Date.now() - sTime}ms)`);
                return result as AgentOutput;
            } catch (err: unknown) {
                console.error(`[Full Retry] ❌ ${agentId} 失败 (${Date.now() - sTime}ms):`, (err instanceof Error ? err.message : String(err)));
                return null;
            }
        })
    );

    // 检查 Layer1 是否全部失败
    const l1Results = [academicResult, industryResult, competitorResult];
    const l1FailCount = l1Results.filter(r => r === null).length;
    if (l1FailCount === 3) {
        // 退费
        // 开源版无积分系统，跳过退费
        console.log(`[Full Retry] 开源版跳过退费逻辑`);
        return NextResponse.json({
            success: false,
            error: 'Layer1 全部 Agent 失败，AI 服务可能暂时不可用',
        });
    }

    // 用 fallback 填充失败的 Layer1 Agent
    const academicReview = academicResult || createFallbackAgentOutput('学术审查员', input);
    const industryAnalysisOut = industryResult || createFallbackAgentOutput('产业分析员', input);
    const competitorAnalysisOut = competitorResult || createFallbackAgentOutput('竞品侦探', input);

    // ==================== Layer2: 创新评估师（串行） ====================
    let innovationResult: AgentOutput;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), RETRY_TIMEOUT);
        innovationResult = await innovationEvaluator(
            { ...input, _abortSignal: controller.signal },
            academicReview, industryAnalysisOut, competitorAnalysisOut
        );
        clearTimeout(timeoutId);
        console.log(`[Full Retry] ✅ innovationEvaluator 完成`);
    } catch (err: unknown) {
        console.error(`[Full Retry] ❌ innovationEvaluator 失败:`, (err instanceof Error ? err.message : String(err)));
        innovationResult = createFallbackAgentOutput('创新评估师', input);
    }

    // ==================== Layer2.5: NovoDebate 对抗辩论 ====================
    const allAgents = [academicReview, industryAnalysisOut, innovationResult, competitorAnalysisOut];
    const fallbackCount = allAgents.filter(a => a.isFallback).length;
    let debateRecord;

    if (fallbackCount >= 2) {
        console.log(`[Full Retry] ⏭️ 跳过辩论 — ${fallbackCount} 个 Agent 降级`);
        debateRecord = createFallbackDebateRecord(`${fallbackCount} 个 Agent 降级，跳过辩论`);
    } else {
        try {
            debateRecord = await executeNovoDebate(
                {
                    academic: academicReview,
                    industry: industryAnalysisOut,
                    innovation: innovationResult,
                    competitor: competitorAnalysisOut
                },
                query,
                modelProvider as ModelProvider,
                undefined,
                undefined,
                45000
            );
            console.log(`[Full Retry] ✅ NovoDebate 完成 — ${debateRecord.sessions.length} 场辩论`);
        } catch (err: unknown) {
            console.warn(`[Full Retry] ⚠️ NovoDebate 失败 (non-blocking):`, (err instanceof Error ? err.message : String(err)));
            debateRecord = createFallbackDebateRecord('辩论执行失败');
        }
    }

    // ==================== Layer3: 仲裁员（含辩论 + 跨域） ====================
    const crossDomainResult = await crossDomainPromise;
    console.log(`[Full Retry] 🔗 跨域侦察兵汇合完成`);

    let arbitrationResult: ArbitrationResult;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        arbitrationResult = await arbitrator(
            academicReview, industryAnalysisOut, innovationResult, competitorAnalysisOut,
            (language === 'en' ? 'en' : 'zh') as 'zh' | 'en',
            modelProvider as ModelProvider,
            undefined,
            controller.signal,
            domainHint,
            debateRecord,
            crossDomainResult,
        );
        clearTimeout(timeoutId);
        console.log(`[Full Retry] ✅ 仲裁员完成，综合评分: ${arbitrationResult.overallScore}`);
    } catch (err: unknown) {
        console.error(`[Full Retry] ❌ 仲裁员失败:`, (err instanceof Error ? err.message : String(err)));
        arbitrationResult = createFallbackArbitration(allAgents);
    }

    // 检查是否发生了降级
    const hasAnyFallback = allAgents.some(a => a.isFallback);
    if (hasAnyFallback) {
        arbitrationResult.isPartial = true;
    }

    // ==================== Layer4: 质量把关 ====================
    const qualityCheckResult = qualityGuard(arbitrationResult, allAgents);

    // 应用质量把关自动修正
    if (qualityCheckResult.corrections && qualityCheckResult.corrections.length > 0) {
        for (const corr of qualityCheckResult.corrections) {
            if (corr.field === 'recommendation') {
                arbitrationResult.recommendation = corr.to;
            }
        }
    }

    const duration = Date.now() - startTime;
    console.log(`[Full Retry] 🏁 完全重试完成，耗时 ${duration}ms`);

    return NextResponse.json({
        success: true,
        mode: 'full-retry',
        // 4 个 Agent 结果
        academicReview,
        industryAnalysis: industryAnalysisOut,
        innovationEvaluation: innovationResult,
        competitorAnalysis: competitorAnalysisOut,
        // 跨域侦察兵结果
        crossDomainTransfer: crossDomainResult,
        // 仲裁 + 质量检查
        arbitration: arbitrationResult,
        qualityCheck: qualityCheckResult,
        // NovoStarchart 雷达图数据
        innovationRadar: (innovationResult as unknown)?.innovationRadar || null,
        // 元数据
        isPartial: !!arbitrationResult.isPartial,
        retryDurationMs: duration,
    });
}

// ==================== 部分重试处理函数（动态计费） ====================

/** 按 Agent 数量动态计费 — 1个=3点，2个=5点，3个=7点，4个=8点 */
function calculatePartialRetryCost(agentCount: number): number {
    const costs = [0, 3, 5, 7, 8]; // costs[n] = n 个 Agent 的费用
    return costs[Math.min(agentCount, 4)] || 3;
}

async function handlePartialRetry(
    params: {
        agentIds: string[];
        query: string;
        academicData: unknown;
        industryData: unknown;
        modelProvider: string;
        language: string;
        domainHint?: string;
        domainId?: string;
        subDomainId?: string;
        existingAgentResults?: Record<string, unknown>;
    },
    _request: Request
) {
    const { agentIds, query, academicData, industryData, modelProvider, language, domainHint, domainId, subDomainId, existingAgentResults } = params;

    if (!agentIds || agentIds.length === 0 || !query || !academicData || !industryData) {
        return NextResponse.json(
            { success: false, error: '缺少必要参数' },
            { status: 400 }
        );
    }

    // 验证 agentIds 合法性
    const validIds = agentIds.filter((id: string) => ALL_RETRYABLE_IDS.has(id));
    if (validIds.length === 0) {
        return NextResponse.json(
            { success: false, error: `无效的 agentIds: ${agentIds.join(', ')}` },
            { status: 400 }
        );
    }

    // ==================== 获取用户 ID（可选） ====================
    let currentUserId: string | undefined;
    try {
        const { data: { user } } = await supabaseAuth.auth.getUser();
        currentUserId = user?.id;
    } catch { /* 未登录 */ }

    const cost = calculatePartialRetryCost(validIds.length);

    // 检查 unlimited/admin 权限
    const isUnlimited = await checkFeatureAccess(currentUserId, 'unlimited');
    const isAdmin = await checkFeatureAccess(currentUserId, 'admin');
    const skipCharge = isUnlimited || isAdmin;

    // 开源版所有功能免费，跳过扣费检查

    console.log(`[Partial Retry] 🚀 开始 (${validIds.length} Agent, ${cost}点, 用户=${currentUserId})`);

    const input: AgentInput = {
        query, academicData, industryData,
        language: (language === 'en' ? 'en' : 'zh') as 'zh' | 'en',
        modelProvider: modelProvider as unknown,
        domainId, subDomainId, domainHint,
    };

    // 分离 Layer1 和 Layer2
    const layer1Ids = validIds.filter((id: string) => LAYER1_AGENT_MAP[id]);
    const hasInnovation = validIds.includes('innovationEvaluator');

    // 并行执行 Layer1
    const retryResults = await Promise.all(
        layer1Ids.map(async (agentId: string) => {
            const agentFn = LAYER1_AGENT_MAP[agentId];
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), RETRY_TIMEOUT);
                const result = await agentFn({ ...input, _abortSignal: controller.signal });
                clearTimeout(timeoutId);
                return { agentId, success: true, result };
            } catch (err: unknown) {
                return { agentId, success: false, error: (err instanceof Error ? err.message : String(err)) };
            }
        })
    );

    const results: Record<string, unknown> = {};
    const failureDetails: Record<string, string> = {};
    let successCount = 0;

    for (const item of retryResults) {
        if (item.success) {
            results[item.agentId] = item.result;
            successCount++;
        } else {
            results[item.agentId] = null;
            failureDetails[item.agentId] = item.error || '未知错误';
        }
    }

    // Layer2: innovationEvaluator
    if (hasInnovation) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), RETRY_TIMEOUT);
            const existing = existingAgentResults || {};
            const ar = results.academicReviewer || existing.academicReview || createFallbackAgentOutput('学术审查员', input);
            const ir = results.industryAnalyst || existing.industryAnalysis || createFallbackAgentOutput('产业分析员', input);
            const cr = results.competitorDetective || existing.competitorAnalysis || createFallbackAgentOutput('竞品侦探', input);
            const result = await innovationEvaluator({ ...input, _abortSignal: controller.signal }, ar, ir, cr);
            clearTimeout(timeoutId);
            results.innovationEvaluator = result;
            successCount++;
        } catch (err: unknown) {
            results.innovationEvaluator = null;
            failureDetails.innovationEvaluator = (err instanceof Error ? err.message : String(err)) || '未知错误';
        }
    }

    // 如果全部失败，退费
    // 开源版无需退费

    console.log(`[Partial Retry] 完成: ${successCount}/${validIds.length} 成功, 扣费 ${skipCharge ? '0 (免费)' : cost} 点`);

    return NextResponse.json({
        success: successCount > 0,
        mode: 'partial-retry',
        results,
        retryCount: validIds.length,
        successCount,
        cost: skipCharge ? 0 : cost,
        failureDetails: Object.keys(failureDetails).length > 0 ? failureDetails : undefined,
        refunded: successCount === 0 && !skipCharge,
    });
}
