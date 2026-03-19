import { AgentInput, AgentOutput, FinalReport, ArbitrationResult, DimensionScore, DebateRecord, CrossDomainScoutOutput } from './types';
import { academicReviewer } from './academic-reviewer';
import { industryAnalyst } from './industry-analyst';
import { innovationEvaluator } from './innovation-evaluator';
import { competitorDetective } from './competitor-detective';
import { crossDomainScout, createFallbackCrossDomainOutput } from './cross-domain-scout';
import { arbitrator } from './arbitration';
import { qualityGuard } from './quality-guard';
import { executeNovoDebate, createFallbackDebateRecord } from './debate';
import { AIAnalysisResult } from '@/lib/ai';
import type { AgentExecutionRecord, AgentResult } from '@/lib/db/schema';
import { getActivePluginAgents } from '@/plugins/discovery';

// ==================== 工具函数（从 fallback.ts 导入并 re-export） ====================

export {
    AllAgentsFailedError,
    RECOMMENDATION_THRESHOLDS,
    mapScoreToRecommendation,
    FALLBACK_CONFIG,
    createFallbackAgentOutput,
    createFallbackArbitration,
    runWithTimeout,
    AGENT_TIMEOUT,
    ARBITRATOR_TIMEOUT,
    DEBATE_TIMEOUT,
    TOTAL_MAX_DURATION,
} from './fallback';

import {
    AllAgentsFailedError,
    RECOMMENDATION_THRESHOLDS,
    mapScoreToRecommendation,
    FALLBACK_CONFIG,
    createFallbackAgentOutput,
    createFallbackArbitration,
    runWithTimeout,
    AGENT_TIMEOUT,
    ARBITRATOR_TIMEOUT,
    DEBATE_TIMEOUT as _DEBATE_TIMEOUT,
    TOTAL_MAX_DURATION,
} from './fallback';


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
        const { adminDb } = await import('@/lib/db/factory');
        const { getSessionId } = await import('@/lib/db/index');
        await adminDb.from('api_call_logs').insert({
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
