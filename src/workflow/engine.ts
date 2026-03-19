/**
 * Novoscan 工作流引擎 — Schema 驱动执行器
 *
 * 读取 WorkflowDefinition JSON，按拓扑顺序调度 Agent 节点，
 * 支持并行、条件分支、辩论、仲裁、质量检查。
 *
 * 替代原 orchestrator.ts 的 971 行硬编码逻辑。
 *
 * 设计原则：
 * - 完全由 JSON 驱动，换 JSON = 换管线
 * - API 签名完全向后兼容（analyzeWithMultiAgents 不变）
 * - 复用现有 runWithTimeout / FALLBACK_CONFIG / 熔断逻辑
 *
 * @module workflow/engine
 */

import type {
    WorkflowDefinition,
    WorkflowNode,
    AgentNode,
    ParallelNode,
    ConditionNode,
    DebateNode,
    QualityNode,
    RetryNode,
    WorkflowCondition,
} from './types';
import type {
    StandardAgentFn,
    CrossAgentFn,
    ArbitratorFn,
    DebateFn,
    QualityGuardFn,
} from './agent-registry';
import { ensureAgentRegistryReady, getAgentRegistry } from './agent-registry';
import type {
    AgentInput,
    AgentOutput,
    FinalReport,
    ArbitrationResult,
    DebateRecord,
    CrossDomainScoutOutput,
    QualityCheckResult,
} from '@/agents/types';
import type { AgentExecutionRecord } from '@/lib/db/schema';
import { getActivePluginAgents } from '@/plugins/discovery';

// 复用现有的 fallback / 熔断（从原 orchestrator 导出）
import {
    createFallbackAgentOutput,
    createFallbackArbitration,
    AllAgentsFailedError,
} from '@/agents/orchestrator';

import { createFallbackDebateRecord } from '@/agents/debate';
import { createFallbackCrossDomainOutput } from '@/agents/cross-domain-scout';

// ==================== 超时工具（从原 orchestrator 提取） ====================

// 默认超时常量（由节点配置或注册表默认值覆盖）
// const DEFAULT_AGENT_TIMEOUT = 120000;
// const DEFAULT_ARBITRATOR_TIMEOUT = 90000;
/** 插件 Agent 超时 */
const PLUGIN_AGENT_TIMEOUT = 15000;

/**
 * 带超时和取消机制的执行器（从原 orchestrator 移植）
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
                abortController.abort();
                resolve({ type: 'timeout' });
            }, timeoutMs);
        });

        const resultPromise = fn(abortController.signal)
            .then(data => ({ type: 'success' as const, data }))
            .catch((err: unknown) => ({ type: 'error' as const, error: err }));

        const result = await Promise.race([resultPromise, timeoutPromise]);
        clearTimeout(timer);
        const duration = Date.now() - startTime;

        if (result.type === 'timeout') {
            emitLog?.(`[Engine] ⚠️ ${agentName} 超时 (上限 ${timeoutMs}ms)，耗时 ${duration}ms → 降级`);
            return fallback;
        }
        if (result.type === 'error') {
            const errMsg = result.error instanceof Error ? result.error.message : String(result.error);
            emitLog?.(`[Engine] ⚠️ ${agentName} 异常 (${duration}ms): ${errMsg} → 降级`);
            abortController.abort();
            return fallback;
        }
        emitLog?.(`[Engine] ${agentName} 完成 (${duration}ms)`);
        return result.data;
    } catch (err: unknown) {
        clearTimeout(timer!);
        abortController.abort();
        return fallback;
    }
}

// ==================== 条件表达式求值器 ====================

/**
 * 安全的条件表达式求值（不使用 eval）
 */
function evaluateCondition(condition: WorkflowCondition, context: Record<string, unknown>): boolean {
    const fieldValue = context[condition.field];
    const compareValue = condition.value;

    switch (condition.operator) {
        case '==': return fieldValue === compareValue;
        case '!=': return fieldValue !== compareValue;
        case '>': return (fieldValue as number) > (compareValue as number);
        case '<': return (fieldValue as number) < (compareValue as number);
        case '>=': return (fieldValue as number) >= (compareValue as number);
        case '<=': return (fieldValue as number) <= (compareValue as number);
        default: return false;
    }
}

// ==================== 工作流执行引擎 ====================

/**
 * 执行工作流的主入口
 *
 * @param definition - 工作流 JSON 定义
 * @param input - 标准 AgentInput
 * @returns FinalReport（与原 orchestrator 完全兼容）
 */
export async function executeWorkflow(
    definition: WorkflowDefinition,
    input: AgentInput
): Promise<FinalReport> {
    const startTime = Date.now();
    const totalTimeout = definition.config.totalTimeout || 380000;
    const circuitBreakerThreshold = definition.config.circuitBreakerThreshold ?? 3;

    // 确保 Agent 注册表已初始化
    await ensureAgentRegistryReady();
    const registry = getAgentRegistry();

    // 构建节点索引
    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of definition.nodes) {
        nodeMap.set(node.id, node);
    }

    // 构建邻接表（用于拓扑遍历）
    const adj = new Map<string, string[]>();
    for (const node of definition.nodes) {
        adj.set(node.id, []);
    }
    for (const edge of definition.edges) {
        adj.get(edge.source)?.push(edge.target);
    }

    // ---- 运行时状态 ----
    const outputs: Record<string, unknown> = {};   // nodeId → 执行输出
    const agentOutputs: Record<string, AgentOutput> = {}; // agentId → AgentOutput
    let fallbackCount = 0;
    const executed = new Set<string>();                // 已执行的节点
    const retryCounters: Record<string, number> = {};  // 重试计数器
    let debateRecord: DebateRecord | undefined;
    let arbitrationResult: ArbitrationResult | undefined;
    let qualityResult: QualityCheckResult | undefined;
    let crossDomainResult: CrossDomainScoutOutput | undefined;

    // 执行记录
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            modelProvider: input.modelProvider as any,
        },
    };

    const emitLog = (msg: string) => {
        console.log(msg);
        if (input.onProgress) input.onProgress('log', msg);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentsRecord = executionRecord.agents as Record<string, any>;
    const updateAgentStatus = (agentId: string, update: Record<string, unknown>) => {
        agentsRecord[agentId] = {
            ...(agentsRecord[agentId] || { agentId, status: 'pending', startTime: Date.now() }),
            ...update,
        };
        if (input.onProgress) {
            input.onProgress('agent_state', { agentId, update: agentsRecord[agentId] });
        }
    };

    const getRemainingTime = () => Math.max(1000, totalTimeout - (Date.now() - startTime));

    // ---- Agent 记忆进化（复用原逻辑） ----
    let memoryInsight: FinalReport['memoryInsight'] = undefined;
    try {
        const { retrieveRelevantExperiences } = await import('@/lib/services/agentMemoryService');
        const MEMORY_RETRIEVAL_TIMEOUT = 5000;
        let memoryTimer: NodeJS.Timeout | undefined;
        const experiences = await Promise.race([
            retrieveRelevantExperiences(input.query, input.domainId),
            new Promise<Awaited<ReturnType<typeof retrieveRelevantExperiences>>>(resolve =>
                memoryTimer = setTimeout(() => {
                    console.warn('[Engine] 经验检索超时(5s)，跳过');
                    resolve({ count: 0, queries: [], context: '', experiences: [] });
                }, MEMORY_RETRIEVAL_TIMEOUT)
            ),
        ]);
        clearTimeout(memoryTimer);
        if (experiences.count > 0) {
            input.memoryContext = experiences.context;
            memoryInsight = {
                experiencesUsed: experiences.count,
                relevantQueries: experiences.queries,
                contextSummary: experiences.context.slice(0, 500),
            };
            emitLog(`[AgentMemory] 🧠 检索到 ${experiences.count} 条相关历史经验`);
            if (input.onProgress) {
                input.onProgress('agent_memory', {
                    experiencesUsed: experiences.count,
                    relevantQueries: experiences.queries,
                });
            }
        }
    } catch (e: unknown) {
        console.warn('[Engine] 经验检索失败:', e instanceof Error ? e.message : String(e));
    }

    // ---- 进度管理 ----
    let progressBase = 5;
    const emitProgress = (value: number) => {
        if (input.onProgress) input.onProgress('progress', value);
    };

    // ==================== 节点执行调度器 ====================

    /**
     * 执行单个节点（递归拓扑遍历）
     */
    async function executeNode(nodeId: string): Promise<void> {
        if (executed.has(nodeId)) return;
        executed.add(nodeId);

        const node = nodeMap.get(nodeId);
        if (!node) {
            emitLog(`[Engine] ⚠️ 节点 "${nodeId}" 不存在，跳过`);
            return;
        }

        switch (node.type) {
            case 'agent':
                await executeAgentNode(node);
                break;
            case 'parallel':
                await executeParallelNode(node);
                break;
            case 'condition':
                await executeConditionNode(node);
                break;
            case 'debate':
                await executeDebateNode(node);
                break;
            case 'quality':
                await executeQualityNode(node);
                break;
            case 'retry':
                await executeRetryNode(node as RetryNode);
                break;
        }

        // 执行后续节点（按边遍历），条件节点和重试节点已在内部处理分支
        if (node.type !== 'condition' && node.type !== 'retry') {
            const nextNodes = adj.get(nodeId) || [];
            for (const nextId of nextNodes) {
                await executeNode(nextId);
            }
        }
    }

    // ---- Agent 节点执行器 ----
    async function executeAgentNode(node: AgentNode): Promise<void> {
        const entry = registry.get(node.agentId);
        if (!entry) {
            emitLog(`[Engine] ⚠️ Agent "${node.agentId}" 未在注册表中找到，跳过`);
            return;
        }

        const timeout = node.timeout || entry.defaultTimeout;
        const agentId = node.agentId;

        updateAgentStatus(agentId, { status: 'running', startTime: Date.now() });
        const sTime = Date.now();

        progressBase += 5;
        emitProgress(Math.min(progressBase, 90));

        let result: unknown;

        if (entry.role === 'standard') {
            // 标准型 Agent
            const fn = entry.fn as StandardAgentFn;
            const fallback = node.agentId === 'cross-domain-scout'
                ? createFallbackCrossDomainOutput(input)
                : createFallbackAgentOutput(entry.name, input);

            result = await runWithTimeout(
                (signal) => fn({ ...input, _abortSignal: signal }),
                Math.min(timeout, getRemainingTime()),
                fallback,
                entry.name,
                emitLog
            );

            const agentResult = result as AgentOutput;
            agentOutputs[agentId] = agentResult;
            outputs[node.id] = agentResult;

            if (agentResult.isFallback) fallbackCount++;

            // 跨域侦察兵特殊处理
            if (agentId === 'cross-domain-scout') {
                crossDomainResult = agentResult as CrossDomainScoutOutput;
            }

            updateAgentStatus(agentId, {
                status: agentResult.isFallback ? 'timeout' : 'completed',
                endTime: Date.now(),
                executionTimeMs: Date.now() - sTime,
                output: { score: agentResult.score, analysis: agentResult.analysis, findings: agentResult.keyFindings, redFlags: agentResult.redFlags },
            });

        } else if (entry.role === 'cross') {
            // 交叉型 Agent（创新评估师）
            const fn = entry.fn as CrossAgentFn;
            const academic = agentOutputs['academic-reviewer'] || createFallbackAgentOutput('学术审查员', input);
            const industry = agentOutputs['industry-analyst'] || createFallbackAgentOutput('产业分析员', input);
            const competitor = agentOutputs['competitor-detective'] || createFallbackAgentOutput('竞品侦探', input);

            result = await runWithTimeout(
                (signal) => fn({ ...input, _abortSignal: signal }, academic, industry, competitor),
                Math.min(timeout, getRemainingTime()),
                createFallbackAgentOutput(entry.name, input),
                entry.name,
                emitLog
            );

            const agentResult = result as AgentOutput;
            agentOutputs[agentId] = agentResult;
            outputs[node.id] = agentResult;

            if (agentResult.isFallback) fallbackCount++;

            updateAgentStatus(agentId, {
                status: agentResult.isFallback ? 'timeout' : 'completed',
                endTime: Date.now(),
                executionTimeMs: Date.now() - sTime,
                output: { score: agentResult.score, analysis: agentResult.analysis, findings: agentResult.keyFindings, redFlags: agentResult.redFlags },
            });

        } else if (entry.role === 'arbitrator') {
            // 仲裁型 Agent
            const fn = entry.fn as ArbitratorFn;
            const academic = agentOutputs['academic-reviewer'] || createFallbackAgentOutput('学术审查员', input);
            const industry = agentOutputs['industry-analyst'] || createFallbackAgentOutput('产业分析员', input);
            const innovation = agentOutputs['innovation-evaluator'] || createFallbackAgentOutput('创新评估师', input);
            const competitor = agentOutputs['competitor-detective'] || createFallbackAgentOutput('竞品侦探', input);

            result = await runWithTimeout(
                (signal) => fn(
                    academic, industry, innovation, competitor,
                    input.language as 'zh' | 'en', input.modelProvider as Parameters<ArbitratorFn>[5],
                    undefined, signal,
                    input.domainHint,
                    debateRecord,
                    crossDomainResult
                ),
                Math.min(timeout, getRemainingTime()),
                createFallbackArbitration([academic, industry, innovation, competitor]),
                entry.name,
                emitLog
            );

            arbitrationResult = result as ArbitrationResult;
            outputs[node.id] = arbitrationResult;

            // 检查降级
            const agents = [academic, industry, innovation, competitor];
            const hasTimeout = agents.some(a => a.isFallback) || arbitrationResult.summary.includes('未能完成');
            const isGlobalTimeout = (Date.now() - startTime) >= totalTimeout - 2000;

            if (hasTimeout || isGlobalTimeout) {
                arbitrationResult.isPartial = true;
                if (isGlobalTimeout) {
                    arbitrationResult.summary = `分析已达到最大时限，以下为部分专家生成的初步意见。${arbitrationResult.summary}`;
                }
            }

            updateAgentStatus(agentId, {
                status: arbitrationResult.summary.includes('未能完成') ? 'timeout' : 'completed',
                endTime: Date.now(),
                executionTimeMs: Date.now() - sTime,
                output: { score: arbitrationResult.overallScore, analysis: arbitrationResult.summary, findings: arbitrationResult.nextSteps, redFlags: arbitrationResult.conflictsResolved },
            });
        }

        emitLog(`[Engine] ✅ ${entry.icon} ${entry.name} 完成`);
    }

    // ---- 并行节点执行器 ----
    async function executeParallelNode(node: ParallelNode): Promise<void> {
        emitLog(`[Engine] ⏳ 并行执行 ${node.childNodeIds.length} 个节点`);
        emitProgress(8);

        await Promise.all(
            node.childNodeIds.map(childId => executeNode(childId))
        );

        emitLog(`[Engine] ✅ 并行层完成`);

        // ---- L1 熔断检测 ----
        const l1AgentIds = ['academic-reviewer', 'industry-analyst', 'competitor-detective'];
        const l1Fallbacks = l1AgentIds.filter(id => agentOutputs[id]?.isFallback);

        if (l1Fallbacks.length >= circuitBreakerThreshold) {
            const failedNames = l1Fallbacks.map(id => registry.get(id)?.name || id);
            emitLog(`[Engine] 🚨 熔断触发：${l1Fallbacks.length} 个核心 Agent fallback`);
            emitProgress(100);
            logCircuitBreakerAlert(input.modelProvider, failedNames, 'L1').catch(() => {});
            throw new AllAgentsFailedError(failedNames, input.modelProvider);
        }

        // ---- 插件 Agent 增强 ----
        if (process.env.ENABLE_PLUGIN_AGENTS === 'true') {
            try {
                const pluginAgents = getActivePluginAgents();
                if (pluginAgents.length > 0) {
                    emitLog(`[Engine] 🧩 插件增强：${pluginAgents.length} 个插件 Agent`);
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
                            return { agentId: agent.id, output, durationMs: Date.now() - pluginStart };
                        } catch {
                            return {
                                agentId: agent.id,
                                output: createFallbackAgentOutput(agent.name || agent.id, input),
                                durationMs: Date.now() - pluginStart,
                            };
                        }
                    });
                    pluginResults = await Promise.all(pluginPromises);
                }
            } catch (err: unknown) {
                emitLog(`[Engine] ⚠️ 插件系统异常: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }

    // ---- 条件节点执行器 ----
    async function executeConditionNode(node: ConditionNode): Promise<void> {
        const context: Record<string, unknown> = {
            fallbackCount,
            agentCount: Object.keys(agentOutputs).length,
            elapsedMs: Date.now() - startTime,
        };

        const met = evaluateCondition(node.condition, context);
        const targetId = met ? node.trueTarget : node.falseTarget;
        emitLog(`[Engine] 🔀 条件 "${node.label || node.id}": ${node.condition.field} ${node.condition.operator} ${node.condition.value} → ${met ? 'true' : 'false'} → ${targetId}`);

        await executeNode(targetId);

        // 条件分支执行完后，继续到条件节点的后续节点（排除已通过分支到达的）
        const nextNodes = adj.get(node.id) || [];
        for (const nextId of nextNodes) {
            if (nextId !== node.trueTarget && nextId !== node.falseTarget) {
                await executeNode(nextId);
            }
        }
    }

    // ---- 辩论节点执行器 ----
    async function executeDebateNode(node: DebateNode): Promise<void> {
        const debateEntry = registry.get('novo-debate');
        if (!debateEntry) {
            emitLog('[Engine] ⚠️ 辩论引擎未注册，跳过');
            debateRecord = createFallbackDebateRecord('辩论引擎未注册');
            return;
        }

        // L2 熔断检测（≥3 个核心 Agent fallback）
        const allCoreAgents = ['academic-reviewer', 'industry-analyst', 'competitor-detective', 'innovation-evaluator'];
        const coreFallbacks = allCoreAgents.filter(id => agentOutputs[id]?.isFallback);
        if (coreFallbacks.length >= 3) {
            const failedNames = coreFallbacks.map(id => registry.get(id)?.name || id);
            emitLog(`[Engine] 🚨 L2 熔断触发：${coreFallbacks.length}/4 核心 Agent fallback`);
            emitProgress(100);
            logCircuitBreakerAlert(input.modelProvider, failedNames, 'L2').catch(() => {});
            throw new AllAgentsFailedError(failedNames, input.modelProvider);
        }

        const academic = agentOutputs['academic-reviewer'] || createFallbackAgentOutput('学术审查员', input);
        const industry = agentOutputs['industry-analyst'] || createFallbackAgentOutput('产业分析员', input);
        const innovation = agentOutputs['innovation-evaluator'] || createFallbackAgentOutput('创新评估师', input);
        const competitor = agentOutputs['competitor-detective'] || createFallbackAgentOutput('竞品侦探', input);

        emitLog('[Engine] ⏳ NovoDebate 辩论启动');
        emitProgress(45);

        updateAgentStatus('novoDebate', { status: 'running', startTime: Date.now() });
        const debateStart = Date.now();
        const debateTimeout = node.timeout || 45000;

        const fn = debateEntry.fn as DebateFn;
        // 构建辩论自定义选项（从节点配置传入）
        const debateOptions = {
            maxRounds: node.maxRounds,
            participants: node.participants,
            debateMode: node.debateMode,
            customPrompt: node.customPrompt,
            autoSwapRoles: node.autoSwapRoles,
            convergenceEnabled: node.convergenceEnabled,
            minScoreDivergence: node.minScoreDivergence,
        };
        debateRecord = await runWithTimeout(
            (_signal) => fn(
                { academic, industry, innovation, competitor },
                input.query,
                input.modelProvider,
                (type: string, data: unknown) => { if (input.onProgress) input.onProgress(type as 'log', data as string | number | Record<string, unknown>); },
                _signal,
                getRemainingTime() as number,
                debateOptions
            ),
            Math.min(debateTimeout, getRemainingTime()),
            createFallbackDebateRecord('辩论超时'),
            'NovoDebate',
            emitLog
        );

        updateAgentStatus('novoDebate', {
            status: 'completed',
            endTime: Date.now(),
            executionTimeMs: Date.now() - debateStart,
            output: {
                score: 0,
                analysis: debateRecord.triggered ? debateRecord.dissentReportText : '未触发辩论',
                findings: debateRecord.sessions.flatMap(s => s.keyInsights),
                redFlags: [],
            },
        });

        outputs[node.id] = debateRecord;

        if (debateRecord.triggered) {
            emitLog(`[Engine] ✅ 辩论完成：${debateRecord.sessions.length} 场`);
        } else {
            emitLog(`[Engine] ⏭️ 辩论跳过：${debateRecord.triggerReason}`);
        }
    }

    // ---- 质量检查节点执行器 ----
    async function executeQualityNode(_node: QualityNode): Promise<void> {
        const qualityEntry = registry.get('quality-guard');
        if (!qualityEntry || !arbitrationResult) {
            emitLog('[Engine] ⚠️ 质量检查跳过（缺少仲裁结果或质量模块）');
            return;
        }

        emitProgress(92);
        emitLog('[Engine] ⏳ 质量检查启动');

        const fn = qualityEntry.fn as QualityGuardFn;
        const agents = Object.values(agentOutputs);

        qualityResult = fn(arbitrationResult, agents, debateRecord);

        // 应用自动修正
        if (qualityResult.corrections?.length > 0) {
            for (const corr of qualityResult.corrections) {
                if (corr.field === 'recommendation' && arbitrationResult) {
                    arbitrationResult.recommendation = corr.to;
                    emitLog(`[QualityGuard] 🔧 自动修正: ${corr.from} → ${corr.to} (${corr.reason})`);
                }
            }
        }

        if (!qualityResult.passed) {
            console.warn('[Engine] ⚠️ 质量检查未通过:', qualityResult.issues);
        }
        emitLog(`[Engine] ✅ 质量检查完成，一致性: ${qualityResult.consistencyScore}/100`);
    }

    // ---- 重试节点执行器 ----
    async function executeRetryNode(node: RetryNode): Promise<void> {
        const currentCount = retryCounters[node.id] || 0;
        const maxRetries = node.maxRetries || 2;

        // 构建条件求值上下文
        const condContext: Record<string, unknown> = {
            fallbackCount,
            ...agentOutputs,
            qualityPassed: qualityResult?.passed ?? true,
            consistencyScore: qualityResult?.consistencyScore ?? 100,
            retryCount: currentCount,
        };

        const shouldRetry = evaluateCondition(node.retryCondition, condContext);

        if (shouldRetry && currentCount < maxRetries) {
            retryCounters[node.id] = currentCount + 1;
            emitLog(`[Engine] 🔁 重试节点 "${node.label || node.id}": 条件成立，第 ${currentCount + 1}/${maxRetries} 次重试 → 目标: ${node.targetNodeId}`);

            // 清除目标节点及其下游的 executed 标记
            clearExecutedDownstream(node.targetNodeId);

            // 重新执行目标节点（会自动遍历下游）
            await executeNode(node.targetNodeId);
        } else {
            if (!shouldRetry) {
                emitLog(`[Engine] ✅ 重试节点 "${node.label || node.id}": 条件不成立，放行`);
            } else {
                emitLog(`[Engine] ⚠️ 重试节点 "${node.label || node.id}": 已达最大重试 ${maxRetries} 次，停止重试`);
            }

            // 放行：执行后续节点（排除指向 targetNodeId 的回环边）
            const nextNodes = (adj.get(node.id) || []).filter(id => id !== node.targetNodeId);
            for (const nextId of nextNodes) {
                await executeNode(nextId);
            }
        }
    }

    /** 清除指定节点及其下游的 executed 标记（让它们可以被重新执行） */
    function clearExecutedDownstream(startId: string): void {
        const queue = [startId];
        const visited = new Set<string>();
        while (queue.length > 0) {
            const id = queue.shift()!;
            if (visited.has(id)) continue;
            visited.add(id);
            executed.delete(id);
            // 遍历下游，但不越过重试节点（避免无限清除）
            const node = nodeMap.get(id);
            if (node?.type === 'retry') continue;
            for (const nextId of (adj.get(id) || [])) {
                queue.push(nextId);
            }
        }
    }

    // ==================== 主执行流程 ====================

    let pluginResults: FinalReport['pluginResults'] | undefined;

    emitLog(`[Engine] 🚀 工作流 "${definition.name}" 启动 (${definition.nodes.length} 节点)`);

    // 找到入口节点（无入边的节点）
    const incomingEdges = new Set<string>();
    for (const edge of definition.edges) {
        incomingEdges.add(edge.target);
    }
    // 条件节点的 target 也算入边
    for (const node of definition.nodes) {
        if (node.type === 'condition') {
            incomingEdges.add(node.trueTarget);
            incomingEdges.add(node.falseTarget);
        }
    }
    // 并行节点的子节点不算独立入口
    for (const node of definition.nodes) {
        if (node.type === 'parallel') {
            for (const childId of node.childNodeIds) {
                incomingEdges.add(childId);
            }
        }
        // 重试节点的 targetNodeId 不算独立入口（它是回环边）
        if (node.type === 'retry') {
            // targetNodeId 已经有前向边，不需要额外处理
        }
    }

    const entryNodes = definition.nodes.filter(n => !incomingEdges.has(n.id));
    if (entryNodes.length === 0) {
        throw new Error('[Engine] 工作流没有入口节点（所有节点都有入边）');
    }

    // 按顺序执行入口节点
    for (const entry of entryNodes) {
        await executeNode(entry.id);
    }

    // ==================== 组装 FinalReport ====================

    const academic = agentOutputs['academic-reviewer'] || createFallbackAgentOutput('学术审查员', input);
    const industry = agentOutputs['industry-analyst'] || createFallbackAgentOutput('产业分析员', input);
    const innovation = agentOutputs['innovation-evaluator'] || createFallbackAgentOutput('创新评估师', input);
    const competitor = agentOutputs['competitor-detective'] || createFallbackAgentOutput('竞品侦探', input);

    const finalDebate = debateRecord || createFallbackDebateRecord('工作流未包含辩论节点');
    const finalArbitration = arbitrationResult || createFallbackArbitration([academic, industry, innovation, competitor]);
    const finalQuality = qualityResult || {
        passed: true,
        issues: [],
        warnings: ['工作流未包含质量检查节点'],
        consistencyScore: 0,
        corrections: [],
    };

    const duration = Date.now() - startTime;
    emitLog(`[Engine] 🏁 工作流完成，耗时 ${duration}ms`);
    emitProgress(100);

    // 更新执行记录
    const allAgents = Object.values(agentOutputs);
    const timedOutCount = allAgents.filter(a => a.isFallback).length;

    executionRecord.finalResult = {
        noveltyScore: finalArbitration.overallScore,
        internetNoveltyScore: industry.score || 0,
        credibilityScore: academic.score || 0,
        recommendation: finalArbitration.recommendation,
    };
    executionRecord.metadata = {
        ...executionRecord.metadata,
        totalExecutionTimeMs: duration,
        timeoutOccurred: allAgents.some(a => a.isFallback),
        agentsCompleted: allAgents.length - timedOutCount,
        agentsTimedOut: timedOutCount,
    };

    return {
        academicReview: academic,
        industryAnalysis: industry,
        innovationEvaluation: innovation,
        competitorAnalysis: competitor,
        crossDomainTransfer: crossDomainResult,
        debate: finalDebate,
        arbitration: finalArbitration,
        qualityCheck: finalQuality,
        executionRecord,
        memoryInsight,
        pluginResults,
    };
}

// ==================== 熔断告警 ====================

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
    } catch (e: unknown) {
        console.warn('[Engine] 熔断告警写入失败:', e instanceof Error ? e.message : e);
    }
}
