/**
 * Clawscan 多Agent编排器
 *
 * 3层执行拓扑：
 *   Layer 1（并行）：Registry 侦察员 + 实战案例分析师
 *   Layer 2（依赖 L1）：创新度审计师
 *   Layer 3（依赖 L1+L2）：战略仲裁官
 */

import { registryScout } from './registry-scout';
import { caseAnalyst } from './case-analyst';
import { noveltyAuditor } from './novelty-auditor';
import { strategicArbiter } from './strategic-arbiter';
import type { ClawscanAgentInput, ClawscanOrchestratorReport } from './types';

const AGENT_TIMEOUT = 35000;
const TOTAL_MAX_DURATION = 120000;

async function runWithTimeout<T>(
    fn: (abortSignal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    fallback: T,
    agentName: string,
): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        console.warn(`[Clawscan/Orch] ${agentName} 超时 (${timeoutMs}ms)，执行降级`);
        controller.abort();
    }, timeoutMs);

    try {
        const result = await fn(controller.signal);
        clearTimeout(timer);
        return result;
    } catch (err: any) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            console.warn(`[Clawscan/Orch] ${agentName} 已中止`);
        } else {
            console.error(`[Clawscan/Orch] ${agentName} 错误:`, err.message);
        }
        return fallback;
    }
}

export async function clawscanOrchestrate(input: ClawscanAgentInput): Promise<ClawscanOrchestratorReport> {
    const startTime = Date.now();
    const agentTimings: Record<string, number> = {};
    const timeoutsOccurred: string[] = [];

    const emitLog = (msg: string) => input.onProgress?.('log', msg);
    const emitProgress = (pct: number) => input.onProgress?.('progress', pct);

    const getRemainingTime = () => Math.max(5000, TOTAL_MAX_DURATION - (Date.now() - startTime));

    emitLog('[编排器] Clawscan 4-Agent 编排启动');
    emitProgress(0);

    // ========== Layer 1: 并行 — Registry 侦察员 + 实战案例分析师 ==========
    emitLog('[编排器] Layer 1: 并行执行 Registry 侦察员 + 实战案例分析师');
    emitProgress(10);

    const l1Start = Date.now();
    const l1Timeout = Math.min(AGENT_TIMEOUT, getRemainingTime());

    // 创建默认降级输出（用浅引用避免重复定义）
    const fallbackRegistryScout = {
        agentName: 'Registry 侦察员', analysis: '超时降级', score: 30, confidence: 'low' as const,
        keyFindings: ['超时'], redFlags: [], evidenceSources: [], reasoning: '超时', isFallback: true,
        skillMatches: [],
    };
    const fallbackCaseAnalyst = {
        agentName: '实战案例分析师', analysis: '超时降级', score: 20, confidence: 'low' as const,
        keyFindings: ['超时'], redFlags: [], evidenceSources: [], reasoning: '超时', isFallback: true,
        caseStudies: [],
    };

    const [registryResult, caseResult] = await Promise.all([
        runWithTimeout(
            (sig) => registryScout({ ...input, _abortSignal: sig }),
            l1Timeout, fallbackRegistryScout, 'Registry 侦察员'
        ),
        runWithTimeout(
            (sig) => caseAnalyst({ ...input, _abortSignal: sig }),
            l1Timeout, fallbackCaseAnalyst, '实战案例分析师'
        ),
    ]);

    agentTimings['registryScout'] = Date.now() - l1Start;
    agentTimings['caseAnalyst'] = Date.now() - l1Start;
    if (registryResult.isFallback) timeoutsOccurred.push('registryScout');
    if (caseResult.isFallback) timeoutsOccurred.push('caseAnalyst');

    emitLog(`[编排器] Layer 1 完成 (${Date.now() - l1Start}ms)`);
    emitProgress(50);

    // ========== Layer 2: 创新度审计师 ==========
    emitLog('[编排器] Layer 2: 创新度审计师（交叉验证）');

    const l2Start = Date.now();
    const l2Timeout = Math.min(AGENT_TIMEOUT, getRemainingTime());

    const fallbackNoveltyAuditor = {
        agentName: '创新度审计师', analysis: '超时降级', score: 50, confidence: 'low' as const,
        keyFindings: ['超时'], redFlags: [], evidenceSources: [], reasoning: '超时', isFallback: true,
        innovationHighlights: [], differentiators: [], gapAnalysis: '超时',
    };

    const noveltyResult = await runWithTimeout(
        (sig) => noveltyAuditor({ ...input, _abortSignal: sig }, registryResult, caseResult),
        l2Timeout, fallbackNoveltyAuditor, '创新度审计师'
    );

    agentTimings['noveltyAuditor'] = Date.now() - l2Start;
    if (noveltyResult.isFallback) timeoutsOccurred.push('noveltyAuditor');

    emitLog(`[编排器] Layer 2 完成 (${Date.now() - l2Start}ms)`);
    emitProgress(75);

    // ========== Layer 3: 战略仲裁官 ==========
    emitLog('[编排器] Layer 3: 战略仲裁官（最终裁定）');

    const l3Start = Date.now();
    const l3Timeout = Math.min(AGENT_TIMEOUT, getRemainingTime());

    const fallbackArbiter = {
        agentName: '战略仲裁官', analysis: '超时降级', score: 50, confidence: 'low' as const,
        keyFindings: ['超时'], redFlags: ['评估降级'], evidenceSources: [], reasoning: '超时', isFallback: true,
        overallScore: 50, grade: 'C' as const, duplicationLevel: 'medium' as const,
        verdict: '评估降级', recommendation: { type: 'differentiate' as const, text: '建议重试', details: '超时', actionText: '重新分析' },
        strategicAdvice: '请重新运行分析', riskWarnings: ['评估降级'],
    };

    const arbiterResult = await runWithTimeout(
        (sig) => strategicArbiter({ ...input, _abortSignal: sig }, registryResult, caseResult, noveltyResult),
        l3Timeout, fallbackArbiter, '战略仲裁官'
    );

    agentTimings['strategicArbiter'] = Date.now() - l3Start;
    if (arbiterResult.isFallback) timeoutsOccurred.push('strategicArbiter');

    const totalTimeMs = Date.now() - startTime;
    emitLog(`[编排器] 全部完成 (${totalTimeMs}ms, 超时=${timeoutsOccurred.length})`);
    emitProgress(100);

    return {
        registryScout: registryResult,
        caseAnalyst: caseResult,
        noveltyAuditor: noveltyResult,
        strategicArbiter: arbiterResult,
        executionMeta: {
            totalTimeMs,
            agentTimings,
            timeoutsOccurred,
            modelUsed: input.modelProvider,
        },
    };
}
