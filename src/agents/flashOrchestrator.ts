/**
 * Novoscan Flash 极速编排器
 *
 * 核心优化策略：
 *   - 全并行执行所有 Agent（Promise.all），无串行依赖
 *   - 跳过 NovoDebate 辩论层
 *   - 跳过跨域侦察兵
 *   - 轻量仲裁（纯计算加权，无 AI 调用）
 *   - 简化质量检查
 *
 * 预计耗时：~70s（对比常规模式 ~230s）
 */
import { AgentInput, AgentOutput, ArbitrationResult, QualityCheckResult, DebateRecord } from './types';
import { academicReviewer } from './academic-reviewer';
import { industryAnalyst } from './industry-analyst';
import { competitorDetective } from './competitor-detective';
import { innovationEvaluator } from './innovation-evaluator';
import {
    createFallbackAgentOutput,
    mapScoreToRecommendation,
    RECOMMENDATION_THRESHOLDS,
} from './orchestrator';
import type { AgentExecutionRecord, AgentResult } from '@/lib/db/schema';

// ==================== 超时配置 ====================

/** 单个 Agent 超时（保持与常规模式一致） */
const AGENT_TIMEOUT = 70000;

/** Flash 总流程强制截止（120s，四 Agent 并行 70s + 余量） */
const FLASH_MAX_DURATION = 120000;

// ==================== Flash 报告类型 ====================

export interface FlashReport {
    academicReview: AgentOutput;
    industryAnalysis: AgentOutput;
    innovationEvaluation: AgentOutput;
    competitorAnalysis: AgentOutput;
    arbitration: ArbitrationResult;
    qualityCheck: QualityCheckResult;
    executionRecord?: AgentExecutionRecord;
}

// ==================== 超时执行器（复用常规模式逻辑） ====================

async function runWithTimeout<T>(
    fn: (abortSignal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    fallback: T,
    agentName: string
): Promise<T> {
    const startTime = Date.now();
    const abortController = new AbortController();

    try {
        let timer: NodeJS.Timeout;
        const timeoutPromise = new Promise<{ type: 'timeout' }>(resolve => {
            timer = setTimeout(() => {
                abortController.abort();
                resolve({ type: 'timeout' });
            }, timeoutMs);
        });

        const resultPromise = fn(abortController.signal).then(data => ({ type: 'success' as const, data }));
        const result = await Promise.race([resultPromise, timeoutPromise]);

        if (timer!) clearTimeout(timer);

        const duration = Date.now() - startTime;

        if (result.type === 'timeout') {
            console.error(`[Flash] ${agentName} 超时 (${timeoutMs}ms)，实际耗时 ${duration}ms`);
            return fallback;
        }

        console.log(`[Flash] ${agentName} 完成，耗时 ${duration}ms`);
        return result.data;

    } catch (err: any) {
        const duration = Date.now() - startTime;
        console.error(`[Flash] ${agentName} 异常 (${duration}ms):`, err.message || err);
        abortController.abort();
        return fallback;
    }
}

// ==================== 轻量仲裁（纯计算） ====================

function flashArbitrate(agents: {
    academic: AgentOutput;
    industry: AgentOutput;
    innovation: AgentOutput;
    competitor: AgentOutput;
}): ArbitrationResult {
    const weights = {
        academic: 0.30,
        industry: 0.25,
        innovation: 0.35,
        competitor: 0.10,
    };

    const weightedBreakdown = {
        academic: {
            raw: agents.academic.score,
            weight: weights.academic,
            weighted: Math.round(agents.academic.score * weights.academic),
            confidence: agents.academic.confidence,
        },
        industry: {
            raw: agents.industry.score,
            weight: weights.industry,
            weighted: Math.round(agents.industry.score * weights.industry),
            confidence: agents.industry.confidence,
        },
        innovation: {
            raw: agents.innovation.score,
            weight: weights.innovation,
            weighted: Math.round(agents.innovation.score * weights.innovation),
            confidence: agents.innovation.confidence,
        },
        competitor: {
            raw: agents.competitor.score,
            weight: weights.competitor,
            weighted: Math.round(agents.competitor.score * weights.competitor),
            confidence: agents.competitor.confidence,
        },
    };

    const overallScore = Math.round(
        weightedBreakdown.academic.weighted +
        weightedBreakdown.industry.weighted +
        weightedBreakdown.innovation.weighted +
        weightedBreakdown.competitor.weighted
    );

    // 判断共识度
    const scores = [agents.academic.score, agents.industry.score, agents.innovation.score, agents.competitor.score];
    const maxDiff = Math.max(...scores) - Math.min(...scores);
    const consensusLevel: 'strong' | 'moderate' | 'weak' =
        maxDiff <= 15 ? 'strong' : maxDiff <= 30 ? 'moderate' : 'weak';

    // 聚合关键信息
    const allFindings = [
        ...agents.academic.keyFindings.slice(0, 2),
        ...agents.industry.keyFindings.slice(0, 2),
        ...agents.innovation.keyFindings.slice(0, 2),
    ];

    const allRedFlags = [
        ...(agents.academic.redFlags || []),
        ...(agents.industry.redFlags || []),
        ...(agents.innovation.redFlags || []),
        ...(agents.competitor.redFlags || []),
    ].filter(Boolean);

    // 生成 summary（基于评分和共识度）
    const recommendation = mapScoreToRecommendation(overallScore);
    let summary: string;
    if (overallScore >= RECOMMENDATION_THRESHOLDS.stronglyRecommend) {
        summary = `Flash 极速评估完成。该创新方向综合评分 ${overallScore}/100，专家共识度${consensusLevel === 'strong' ? '强' : consensusLevel === 'moderate' ? '中等' : '弱'}。多维度评估显示该方向具有显著创新潜力。`;
    } else if (overallScore >= RECOMMENDATION_THRESHOLDS.recommend) {
        summary = `Flash 极速评估完成。该创新方向综合评分 ${overallScore}/100，具备一定创新价值，建议进一步深入调研。`;
    } else if (overallScore >= RECOMMENDATION_THRESHOLDS.caution) {
        summary = `Flash 极速评估完成。该创新方向综合评分 ${overallScore}/100，存在一定风险和挑战，建议谨慎评估。`;
    } else {
        summary = `Flash 极速评估完成。该创新方向综合评分 ${overallScore}/100，现有竞争较激烈或创新性不足，建议重新审视方向。`;
    }

    return {
        summary,
        overallScore,
        recommendation,
        conflictsResolved: [],
        nextSteps: allRedFlags.length > 0
            ? ['建议使用常规模式获取更详细的分析和辩论记录', ...allRedFlags.slice(0, 3)]
            : ['建议使用常规模式获取更详细的分析和辩论记录'],
        weightedBreakdown,
        consensusLevel,
        dissent: maxDiff > 20
            ? [`专家评分差异较大 (${maxDiff}分)，建议使用常规模式进行深度辩论`]
            : [],
    };
}

// ==================== 简化质检 ====================

function flashQualityCheck(
    arbitration: ArbitrationResult,
    agents: AgentOutput[]
): QualityCheckResult {
    const issues: string[] = [];
    const warnings: string[] = [];

    // 检查分数范围
    for (const agent of agents) {
        if (agent.score < 0 || agent.score > 100) {
            issues.push(`${agent.agentName} 评分越界: ${agent.score}`);
        }
    }

    // 检查 fallback 数量
    const fallbackCount = agents.filter(a => a.isFallback).length;
    if (fallbackCount >= 3) {
        issues.push(`${fallbackCount} 个 Agent 降级，结果可靠性不足`);
    } else if (fallbackCount > 0) {
        warnings.push(`${fallbackCount} 个 Agent 使用了降级结果`);
    }

    // 分数一致性
    const scores = agents.map(a => a.score);
    const maxDiff = Math.max(...scores) - Math.min(...scores);
    const consistencyScore = Math.max(0, 100 - maxDiff);

    if (maxDiff > 40) {
        warnings.push(`专家评分差异过大 (${maxDiff}分)，建议使用常规深度模式`);
    }

    return {
        passed: issues.length === 0,
        issues,
        warnings,
        consistencyScore,
        corrections: [],
    };
}

// ==================== Flash 编排器主流程 ====================

export async function analyzeFlash(input: AgentInput): Promise<FlashReport> {
    console.log('[Flash] ⚡ 启动 Novoscan Flash 极速分析');
    const startTime = Date.now();

    const executionId = `flash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

    const emitLog = (msg: string) => {
        console.log(msg);
        if (input.onProgress) input.onProgress('log', msg);
    };

    const updateAgentStatus = (agentId: string, update: Partial<AgentResult>) => {
        (executionRecord.agents as any)[agentId] = {
            ...((executionRecord.agents as any)[agentId] || { agentId, status: 'pending', startTime: Date.now() }),
            ...update
        } as AgentResult;
        if (input.onProgress) {
            input.onProgress('agent_state', { agentId, update: (executionRecord.agents as any)[agentId] });
        }
    };

    const getRemainingTime = () => Math.max(1000, FLASH_MAX_DURATION - (Date.now() - startTime));

    // ==================== 全并行：4 个 Agent 同时启动 ====================
    emitLog('[Flash] ⚡ 全并行启动：学术审查员 + 产业分析员 + 竞品侦探 + 创新评估师');
    if (input.onProgress) input.onProgress('progress', 5);

    // 创新评估师在 Flash 模式中不等待上游 Agent，使用空壳 fallback 作为输入
    const emptyAgentOutput: AgentOutput = {
        agentName: '待定',
        analysis: '（Flash 模式：创新评估师独立运行，不接收上游报告）',
        score: 50,
        confidence: 'low',
        confidenceReasoning: 'Flash 模式独立运行',
        keyFindings: [],
        redFlags: [],
        evidenceSources: [],
        reasoning: '',
        dimensionScores: [],
    };

    const [academicReview, industryAnalysis, competitorAnalysis, innovationEvaluation] = await Promise.all([
        // 学术审查员
        (async () => {
            updateAgentStatus('academicReviewer', { status: 'running', startTime: Date.now() });
            const sTime = Date.now();
            const res = await runWithTimeout(
                (signal) => academicReviewer({ ...input, _abortSignal: signal }),
                Math.min(AGENT_TIMEOUT, getRemainingTime()),
                createFallbackAgentOutput('学术审查员', input),
                '学术审查员'
            );
            updateAgentStatus('academicReviewer', {
                status: res.isFallback ? 'timeout' : 'completed',
                endTime: Date.now(),
                executionTimeMs: Date.now() - sTime,
                output: { score: res.score, analysis: res.analysis, findings: res.keyFindings, redFlags: res.redFlags }
            });
            return res;
        })(),
        // 产业分析员
        (async () => {
            updateAgentStatus('industryAnalyst', { status: 'running', startTime: Date.now() });
            const sTime = Date.now();
            const res = await runWithTimeout(
                (signal) => industryAnalyst({ ...input, _abortSignal: signal }),
                Math.min(AGENT_TIMEOUT, getRemainingTime()),
                createFallbackAgentOutput('产业分析员', input),
                '产业分析员'
            );
            updateAgentStatus('industryAnalyst', {
                status: res.isFallback ? 'timeout' : 'completed',
                endTime: Date.now(),
                executionTimeMs: Date.now() - sTime,
                output: { score: res.score, analysis: res.analysis, findings: res.keyFindings, redFlags: res.redFlags }
            });
            return res;
        })(),
        // 竞品侦探
        (async () => {
            updateAgentStatus('competitorDetective', { status: 'running', startTime: Date.now() });
            const sTime = Date.now();
            const res = await runWithTimeout(
                (signal) => competitorDetective({ ...input, _abortSignal: signal }),
                Math.min(AGENT_TIMEOUT, getRemainingTime()),
                createFallbackAgentOutput('竞品侦探', input),
                '竞品侦探'
            );
            updateAgentStatus('competitorDetective', {
                status: res.isFallback ? 'timeout' : 'completed',
                endTime: Date.now(),
                executionTimeMs: Date.now() - sTime,
                output: { score: res.score, analysis: res.analysis, findings: res.keyFindings, redFlags: res.redFlags }
            });
            return res;
        })(),
        // 创新评估师（Flash 模式：独立运行，使用空壳上游数据）
        (async () => {
            updateAgentStatus('innovationEvaluator', { status: 'running', startTime: Date.now() });
            const sTime = Date.now();
            const res = await runWithTimeout(
                (signal) => innovationEvaluator(
                    { ...input, _abortSignal: signal } as any,
                    emptyAgentOutput,
                    emptyAgentOutput,
                    emptyAgentOutput
                ),
                Math.min(AGENT_TIMEOUT, getRemainingTime()),
                createFallbackAgentOutput('创新评估师', input),
                '创新评估师'
            );
            updateAgentStatus('innovationEvaluator', {
                status: res.isFallback ? 'timeout' : 'completed',
                endTime: Date.now(),
                executionTimeMs: Date.now() - sTime,
                output: { score: res.score, analysis: res.analysis, findings: res.keyFindings, redFlags: res.redFlags }
            });
            return res;
        })(),
    ]);

    emitLog(`[Flash] ✅ 全并行完成 — 学术(${academicReview.score}) 产业(${industryAnalysis.score}) 竞品(${competitorAnalysis.score}) 创新(${innovationEvaluation.score})`);
    if (input.onProgress) input.onProgress('progress', 70);

    // ==================== 轻量仲裁（纯计算） ====================
    emitLog('[Flash] ⚡ 轻量仲裁（加权计算）');
    const arbitration = flashArbitrate({
        academic: academicReview,
        industry: industryAnalysis,
        innovation: innovationEvaluation,
        competitor: competitorAnalysis,
    });

    // 检查降级
    const agents = [academicReview, industryAnalysis, innovationEvaluation, competitorAnalysis];
    const hasTimeout = agents.some(a => a.isFallback);
    if (hasTimeout) {
        arbitration.isPartial = true;
    }

    if (input.onProgress) input.onProgress('progress', 85);

    // ==================== 简化质检 ====================
    emitLog('[Flash] ⚡ 简化质检');
    const qualityCheck = flashQualityCheck(arbitration, agents);

    const duration = Date.now() - startTime;
    emitLog(`[Flash] 🏁 Flash 极速分析完成，耗时 ${duration}ms，综合评分: ${arbitration.overallScore}`);
    if (input.onProgress) input.onProgress('progress', 100);

    // 更新执行记录
    const timedOutCount = agents.filter(a => a.isFallback).length;
    executionRecord.finalResult = {
        noveltyScore: arbitration.overallScore,
        internetNoveltyScore: industryAnalysis.score || 0,
        credibilityScore: academicReview.score || 0,
        recommendation: arbitration.recommendation,
    };
    executionRecord.metadata = {
        ...executionRecord.metadata,
        totalExecutionTimeMs: duration,
        timeoutOccurred: hasTimeout,
        agentsCompleted: 4 - timedOutCount,
        agentsTimedOut: timedOutCount,
    };

    return {
        academicReview,
        industryAnalysis,
        innovationEvaluation,
        competitorAnalysis,
        arbitration,
        qualityCheck,
        executionRecord,
    };
}
