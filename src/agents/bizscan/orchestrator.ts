/**
 * Bizscan 多Agent编排器
 *
 * 5层执行拓扑（工业级）：
 *   Layer1（并行）：市场侦察员 + 竞品拆解师
 *   Layer2（并行）：创新度审计师 + 可行性检验师（依赖 L1）
 *   Layer3（串行）：交叉验证引擎（依赖 L1+L2）
 *   Layer4（串行）：战略仲裁官（依赖全部）
 *   Layer5（纯逻辑）：质量护卫
 *
 * 效率设计：L1 和 L2 各内部并行，总串行等待仅 3 次。
 */

import { marketScout } from './market-scout';
import { competitorProfiler } from './competitor-profiler';
import { noveltyAuditor } from './novelty-auditor';
import { feasibilityExaminer } from './feasibility-examiner';
import { crossValidator } from './cross-validator';
import { strategicArbiter } from './strategic-arbiter';
import { bizscanQualityGuard } from './quality-guard';
import type {
    BizscanAgentInput,
    BizscanAgentOutput,
    MarketScoutOutput,
    CompetitorProfilerOutput,
    CrossValidationResult,
    StrategicArbiterResult,
    BizscanQualityResult,
    BizscanOrchestratorReport,
} from './types';

// ============================================================
//  超时与降级工具
// ============================================================

const AGENT_TIMEOUT = 70000;      // 单个Agent超时（70s，MiniMax M2.5 长 Prompt 需要 30-50s）
const TOTAL_MAX_DURATION = 230000; // 总流程强制截止（230s = L1 70s + L2 70s + L3 70s + L4 85s + 余量）

/** 带超时和取消机制的 Agent 执行器 */
async function runWithTimeout<T>(
    fn: (abortSignal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    fallback: T,
    agentName: string,
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
            console.error(`[Bizscan/Orchestrator] ${agentName} 超时 (${timeoutMs}ms)，实际耗时 ${duration}ms`);
            return fallback;
        }

        console.log(`[Bizscan/Orchestrator] ${agentName} 完成，耗时 ${duration}ms`);
        return result.data;
    } catch (err: any) {
        const duration = Date.now() - startTime;
        console.error(`[Bizscan/Orchestrator] ${agentName} 异常 (${duration}ms):`, err.message || err);
        abortController.abort();
        return fallback;
    }
}

// ============================================================
//  智能 Fallback 生成器
// ============================================================

function createFallbackAgentOutput(agentName: string, score: number = 50): BizscanAgentOutput {
    return {
        agentName,
        analysis: `${agentName} 超时或异常，以下为统计推断。`,
        score,
        confidence: 'low',
        confidenceReasoning: 'Agent 超时或异常，此评分为降级推断',
        keyFindings: [`${agentName}未能完成分析`],
        redFlags: [`${agentName}服务异常，结果仅供参考`],
        evidenceSources: [],
        reasoning: '降级推断',
        dimensionScores: [],
        isFallback: true,
    };
}

function createFallbackMarketScout(input: BizscanAgentInput): MarketScoutOutput {
    const webCount = input.marketSignals.webResults.length;
    const score = webCount === 0 ? 70 : Math.max(20, 75 - webCount * 2);
    return {
        ...createFallbackAgentOutput('市场侦察员', score),
        marketInsights: {
            growthTrend: 'stable',
            saturationLevel: webCount > 15 ? 'crowded' : 'moderate',
        },
        demandSignals: [],
    };
}

function createFallbackCompetitorProfiler(input: BizscanAgentInput): CompetitorProfilerOutput {
    const totalCompetitors = input.marketSignals.webResults.length + input.marketSignals.productHuntItems.length;
    const score = totalCompetitors === 0 ? 80 : Math.max(15, 80 - totalCompetitors * 3);
    return {
        ...createFallbackAgentOutput('竞品拆解师', score),
        competitors: [],
        competitiveMoat: '降级策略，无竞品深度分析',
        entryBarriers: [],
    };
}

// ============================================================
//  编排器主流程
// ============================================================

export async function bizscanOrchestrate(input: BizscanAgentInput): Promise<BizscanOrchestratorReport> {
    console.log('[Bizscan/Orchestrator] 🚀 启动 5层6Agent 编排流程');
    const startTime = Date.now();
    const agentTimings: Record<string, number> = {};
    const timeoutsOccurred: string[] = [];

    const emitLog = (msg: string, meta?: Record<string, any>) => {
        console.log(msg);
        if (input.onProgress) input.onProgress('log', msg);
        // 结构化指标追踪（写入 meta）
        if (meta) {
            console.log('[Bizscan/Metric]', JSON.stringify(meta));
        }
    };

    const emitProgress = (pct: number) => {
        if (input.onProgress) input.onProgress('progress', pct);
    };

    const getRemainingTime = () => Math.max(1000, TOTAL_MAX_DURATION - (Date.now() - startTime));

    // ==================== Layer 1: 并行 — 市场侦察员 + 竞品拆解师 ====================
    emitLog('[Bizscan/Orchestrator] ⏳ Layer1 并行启动：市场侦察员 + 竞品拆解师');
    emitProgress(5);

    const l1Start = Date.now();
    const [marketScoutResult, competitorResult] = await Promise.all([
        (async () => {
            const s = Date.now();
            const res = await runWithTimeout(
                (signal) => marketScout({ ...input, _abortSignal: signal }),
                Math.min(AGENT_TIMEOUT, getRemainingTime()),
                createFallbackMarketScout(input),
                '市场侦察员',
            );
            agentTimings['marketScout'] = Date.now() - s;
            if (res.isFallback) timeoutsOccurred.push('市场侦察员');
            return res;
        })(),
        (async () => {
            const s = Date.now();
            const res = await runWithTimeout(
                (signal) => competitorProfiler({ ...input, _abortSignal: signal }),
                Math.min(AGENT_TIMEOUT, getRemainingTime()),
                createFallbackCompetitorProfiler(input),
                '竞品拆解师',
            );
            agentTimings['competitorProfiler'] = Date.now() - s;
            if (res.isFallback) timeoutsOccurred.push('竞品拆解师');
            return res;
        })(),
    ]);

    emitLog(`[Bizscan/Orchestrator] ✅ Layer1 完成 (${Date.now() - l1Start}ms) — 市场(${marketScoutResult.score}) + 竞品(${competitorResult.score})`);
    emitProgress(25);

    // ==================== Layer 2: 并行 — 创新度审计师 + 可行性检验师 ====================
    emitLog('[Bizscan/Orchestrator] ⏳ Layer2 并行启动：创新度审计师 + 可行性检验师');

    const l2Start = Date.now();
    const [noveltyResult, feasibilityResult] = await Promise.all([
        (async () => {
            const s = Date.now();
            const res = await runWithTimeout(
                (signal) => noveltyAuditor({ ...input, _abortSignal: signal }, marketScoutResult, competitorResult),
                Math.min(AGENT_TIMEOUT, getRemainingTime()),
                { ...createFallbackAgentOutput('创新度审计师', marketScoutResult.score), agentName: '创新度审计师' },
                '创新度审计师',
            );
            agentTimings['noveltyAuditor'] = Date.now() - s;
            if (res.isFallback) timeoutsOccurred.push('创新度审计师');
            return res;
        })(),
        (async () => {
            const s = Date.now();
            const res = await runWithTimeout(
                (signal) => feasibilityExaminer({ ...input, _abortSignal: signal }, marketScoutResult, competitorResult),
                Math.min(AGENT_TIMEOUT, getRemainingTime()),
                { ...createFallbackAgentOutput('可行性检验师', 55), agentName: '可行性检验师' },
                '可行性检验师',
            );
            agentTimings['feasibilityExaminer'] = Date.now() - s;
            if (res.isFallback) timeoutsOccurred.push('可行性检验师');
            return res;
        })(),
    ]);

    emitLog(`[Bizscan/Orchestrator] ✅ Layer2 完成 (${Date.now() - l2Start}ms) — 创新(${noveltyResult.score}) + 可行(${feasibilityResult.score})`);
    emitProgress(50);

    // ==================== Layer 3: 串行 — 交叉验证引擎 ====================
    emitLog('[Bizscan/Orchestrator] ⏳ Layer3 启动：交叉验证引擎');

    const l3Start = Date.now();
    const crossValidationResult = await runWithTimeout(
        (signal) => crossValidator(
            { ...input, _abortSignal: signal },
            marketScoutResult, competitorResult, noveltyResult, feasibilityResult,
        ),
        Math.min(AGENT_TIMEOUT, getRemainingTime()),
        // 降级：直接取各Agent评分
        {
            divergences: [],
            calibratedScores: {
                semanticNovelty: noveltyResult.score,
                competitiveLandscape: competitorResult.score,
                marketGap: marketScoutResult.score,
                feasibility: feasibilityResult.score,
            },
            consistencyScore: 50,
            evidenceConflicts: ['交叉验证引擎异常'],
        } as CrossValidationResult,
        '交叉验证引擎',
    );
    agentTimings['crossValidator'] = Date.now() - l3Start;

    emitLog(`[Bizscan/Orchestrator] ✅ Layer3 完成 (${Date.now() - l3Start}ms) — 一致性: ${crossValidationResult.consistencyScore}`);
    emitProgress(70);

    // ==================== Layer 4: 串行 — 战略仲裁官 ====================
    emitLog('[Bizscan/Orchestrator] ⏳ Layer4 启动：战略仲裁官');

    const l4Start = Date.now();
    const arbiterResult = await runWithTimeout(
        (signal) => strategicArbiter(
            { ...input, _abortSignal: signal },
            marketScoutResult, competitorResult, noveltyResult, feasibilityResult, crossValidationResult,
        ),
        Math.min(AGENT_TIMEOUT + 15000, getRemainingTime()), // 仲裁官多给 15s（需整合全部上游报告）
        // 降级
        (() => {
            const { calibratedScores: cs } = crossValidationResult;
            const bii = Math.round(cs.semanticNovelty * 0.25 + cs.competitiveLandscape * 0.30 + cs.marketGap * 0.25 + cs.feasibility * 0.20);
            return {
                overallBII: bii,
                grade: (bii >= 90 ? 'S' : bii >= 75 ? 'A' : bii >= 55 ? 'B' : bii >= 35 ? 'C' : 'D') as StrategicArbiterResult['grade'],
                verdict: '基于校准评分的初步评估',
                recommendations: ['进行更深入的用户访谈', '研究头部竞品模式'],
                riskWarnings: ['仲裁官异常，结果仅供参考'],
                strategicAdvice: '仲裁官异常，请稍后重试。',
                weightedBreakdown: {
                    semanticNovelty: { raw: cs.semanticNovelty, weight: 0.25, weighted: Math.round(cs.semanticNovelty * 0.25) },
                    competitiveLandscape: { raw: cs.competitiveLandscape, weight: 0.30, weighted: Math.round(cs.competitiveLandscape * 0.30) },
                    marketGap: { raw: cs.marketGap, weight: 0.25, weighted: Math.round(cs.marketGap * 0.25) },
                    feasibility: { raw: cs.feasibility, weight: 0.20, weighted: Math.round(cs.feasibility * 0.20) },
                },
                consensusLevel: 'weak' as const,
                dissent: ['仲裁官异常'],
            };
        })(),
        '战略仲裁官',
    );
    agentTimings['strategicArbiter'] = Date.now() - l4Start;

    emitLog(`[Bizscan/Orchestrator] ✅ Layer4 完成 (${Date.now() - l4Start}ms) — BII: ${arbiterResult.overallBII}, Grade: ${arbiterResult.grade}`);
    emitProgress(90);

    // ==================== Layer 5: 纯逻辑 — 质量护卫 ====================
    emitLog('[Bizscan/Orchestrator] ⏳ Layer5 启动：质量护卫');
    const qualityCheck = bizscanQualityGuard(
        marketScoutResult, competitorResult, noveltyResult, feasibilityResult,
        crossValidationResult, arbiterResult,
    );

    if (!qualityCheck.passed) {
        console.warn('[Bizscan/Orchestrator] ⚠️ 质量检查未通过:', qualityCheck.issues);
    }

    const totalTime = Date.now() - startTime;
    const fallbackRate = Math.round((timeoutsOccurred.length / 6) * 100);
    emitLog(`[Bizscan/Orchestrator] 🏁 5层6Agent 编排完成，总耗时 ${totalTime}ms, 一致性 ${qualityCheck.consistencyScore}/100`, {
        event: 'orchestration_complete',
        totalTimeMs: totalTime,
        agentTimings,
        timeoutsOccurred,
        fallbackRate,
        consistencyScore: qualityCheck.consistencyScore,
        qualityPassed: qualityCheck.passed,
        bii: arbiterResult.overallBII,
        grade: arbiterResult.grade,
    });
    emitProgress(100);

    return {
        marketScout: marketScoutResult,
        competitorProfiler: competitorResult,
        noveltyAuditor: noveltyResult,
        feasibilityExaminer: feasibilityResult,
        crossValidation: crossValidationResult,
        arbiterResult,
        qualityCheck,
        executionMeta: {
            totalTimeMs: totalTime,
            agentTimings,
            timeoutsOccurred,
            modelUsed: input.modelProvider,
        },
    };
}
