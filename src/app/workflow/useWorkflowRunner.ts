/**
 * useWorkflowRunner — 工作流运行 Hook
 *
 * 支持两种运行模式：
 * 1. 模拟运行 (startRun)：本地 setTimeout 模拟节点执行
 * 2. 真实运行 (startRealRun)：调用 /api/workflow/run SSE 端点
 *
 * 节点状态流转：idle → running → completed / failed / fallback
 *
 * @module workflow/useWorkflowRunner
 */

import { useState, useCallback, useRef } from 'react';

// ==================== 节点运行状态 ====================

/** 节点运行状态 */
export type NodeRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'fallback';

/** 单个节点的运行信息 */
export interface NodeRunInfo {
    status: NodeRunStatus;
    startTime?: number;
    endTime?: number;
    /** 耗时（ms） */
    durationMs?: number;
    /** 错误信息 */
    error?: string;
}

/** 整体运行状态 */
export type RunnerState = 'idle' | 'running' | 'completed' | 'aborted';

/** 运行结果摘要 */
export interface RunSummary {
    state: RunnerState;
    totalDurationMs: number;
    nodeCount: number;
    completedCount: number;
    failedCount: number;
    fallbackCount: number;
    steps: string[];
    /** 真实运行时的评分结果 */
    overallScore?: number;
    /** 真实运行时的摘要 */
    resultSummary?: string;
}

// ==================== 模拟执行参数 ====================

interface SimulatedNode {
    id: string;
    label: string;
    icon: string;
    type: string;
    /** 模拟耗时范围 (ms) */
    minDuration?: number;
    maxDuration?: number;
    /** 失败概率 (0-1, 默认 0.05) */
    failRate?: number;
    /** 降级概率 (0-1, 默认 0.08) */
    fallbackRate?: number;
}

// ==================== Hook 主体 ====================

export function useWorkflowRunner() {
    /** 各节点状态 Map: nodeId → NodeRunInfo */
    const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeRunInfo>>({});
    /** 整体运行状态 */
    const [runnerState, setRunnerState] = useState<RunnerState>('idle');
    /** 运行摘要 */
    const [summary, setSummary] = useState<RunSummary | null>(null);
    /** 运行日志 */
    const [logs, setLogs] = useState<string[]>([]);
    /** 中止标志 */
    const abortRef = useRef(false);
    /** AbortController（真实运行用） */
    const abortControllerRef = useRef<AbortController | null>(null);

    /** 添加日志 */
    const addLog = useCallback((msg: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    }, []);

    /** 更新单个节点状态 */
    const updateNodeStatus = useCallback((nodeId: string, info: Partial<NodeRunInfo>) => {
        setNodeStatuses(prev => ({
            ...prev,
            [nodeId]: { ...prev[nodeId], ...info },
        }));
    }, []);

    // ==================== 模拟运行 ====================

    /** 模拟单个节点执行 */
    const simulateNode = useCallback(async (node: SimulatedNode): Promise<NodeRunStatus> => {
        if (abortRef.current) return 'failed';

        const startTime = Date.now();
        updateNodeStatus(node.id, { status: 'running', startTime });
        addLog(`⏳ ${node.icon} ${node.label} 开始执行...`);

        // 模拟耗时
        const min = node.minDuration ?? 400;
        const max = node.maxDuration ?? 1500;
        const duration = min + Math.random() * (max - min);
        await new Promise(r => setTimeout(r, duration));

        if (abortRef.current) {
            updateNodeStatus(node.id, { status: 'failed', endTime: Date.now(), durationMs: Date.now() - startTime, error: '已中止' });
            addLog(`🛑 ${node.icon} ${node.label} 已中止`);
            return 'failed';
        }

        // 模拟成功/失败/降级
        const rand = Math.random();
        const failRate = node.failRate ?? 0.05;
        const fallbackRate = node.fallbackRate ?? 0.08;

        let status: NodeRunStatus;
        if (rand < failRate) {
            status = 'failed';
            updateNodeStatus(node.id, { status: 'failed', endTime: Date.now(), durationMs: Date.now() - startTime, error: '模拟失败' });
            addLog(`🔴 ${node.icon} ${node.label} 执行失败 (${Math.round(Date.now() - startTime)}ms)`);
        } else if (rand < failRate + fallbackRate) {
            status = 'fallback';
            updateNodeStatus(node.id, { status: 'fallback', endTime: Date.now(), durationMs: Date.now() - startTime });
            addLog(`🟠 ${node.icon} ${node.label} 降级完成 (${Math.round(Date.now() - startTime)}ms)`);
        } else {
            status = 'completed';
            updateNodeStatus(node.id, { status: 'completed', endTime: Date.now(), durationMs: Date.now() - startTime });
            addLog(`🟢 ${node.icon} ${node.label} 执行完成 (${Math.round(Date.now() - startTime)}ms)`);
        }

        return status;
    }, [updateNodeStatus, addLog]);

    /**
     * 启动模拟运行
     */
    const startRun = useCallback(async (
        simulatedNodes: SimulatedNode[],
        parallelGroups?: string[][]
    ) => {
        abortRef.current = false;
        setRunnerState('running');
        setLogs([]);
        setSummary(null);

        const initialStatuses: Record<string, NodeRunInfo> = {};
        for (const node of simulatedNodes) {
            initialStatuses[node.id] = { status: 'idle' };
        }
        setNodeStatuses(initialStatuses);

        const totalStart = Date.now();
        const steps: string[] = [];
        let completedCount = 0;
        let failedCount = 0;
        let fallbackCount = 0;

        addLog('🚀 工作流模拟运行开始');

        if (parallelGroups && parallelGroups.length > 0) {
            for (const group of parallelGroups) {
                if (abortRef.current) break;
                const groupNodes = group
                    .map(id => simulatedNodes.find(n => n.id === id))
                    .filter((n): n is SimulatedNode => !!n);

                if (groupNodes.length > 1) {
                    addLog(`⚡ 并行执行 ${groupNodes.length} 个节点...`);
                }

                const results = await Promise.all(groupNodes.map(n => simulateNode(n)));
                results.forEach((status, i) => {
                    const node = groupNodes[i];
                    steps.push(`${node.icon} ${node.label} → ${status}`);
                    if (status === 'completed') completedCount++;
                    else if (status === 'failed') failedCount++;
                    else if (status === 'fallback') fallbackCount++;
                });
            }
        } else {
            for (const node of simulatedNodes) {
                if (abortRef.current) break;
                const status = await simulateNode(node);
                steps.push(`${node.icon} ${node.label} → ${status}`);
                if (status === 'completed') completedCount++;
                else if (status === 'failed') failedCount++;
                else if (status === 'fallback') fallbackCount++;
            }
        }

        const totalDuration = Date.now() - totalStart;
        const finalState: RunnerState = abortRef.current ? 'aborted' : 'completed';
        setRunnerState(finalState);

        const runSummary: RunSummary = {
            state: finalState,
            totalDurationMs: totalDuration,
            nodeCount: simulatedNodes.length,
            completedCount,
            failedCount,
            fallbackCount,
            steps,
        };
        setSummary(runSummary);
        addLog(`${finalState === 'completed' ? '✅' : '🛑'} 运行${finalState === 'completed' ? '完成' : '已中止'} — 总耗时 ${(totalDuration / 1000).toFixed(1)}s`);

        return runSummary;
    }, [simulateNode, addLog]);

    // ==================== 真实运行 ====================

    /**
     * 启动真实工作流运行
     *
     * @param workflow - 工作流完整 JSON 定义
     * @param query - 测试查询文本
     * @param nodeIds - 画布上的节点 ID 列表（用于初始化状态灯）
     */
    const startRealRun = useCallback(async (
        workflow: Record<string, unknown>,
        query: string,
        nodeIds: string[]
    ) => {
        // 重置
        abortRef.current = false;
        const ac = new AbortController();
        abortControllerRef.current = ac;
        setRunnerState('running');
        setLogs([]);
        setSummary(null);

        // 初始化所有节点为 idle
        const initialStatuses: Record<string, NodeRunInfo> = {};
        for (const id of nodeIds) {
            initialStatuses[id] = { status: 'idle' };
        }
        setNodeStatuses(initialStatuses);

        addLog('🚀 真实工作流运行开始');
        const totalStart = Date.now();
        let completedCount = 0;
        let failedCount = 0;
        let fallbackCount = 0;

        try {
            const response = await fetch('/api/workflow/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflow, query }),
                signal: ac.signal,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error((errData as Record<string, string>).error || `HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('无法读取响应流');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保留不完整的行

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const event = JSON.parse(line);
                        const { type, data } = event;

                        switch (type) {
                            case 'log':
                                if (typeof data === 'string') {
                                    addLog(data);
                                }
                                break;

                            case 'node_start': {
                                const { nodeId } = data as { nodeId: string };
                                updateNodeStatus(nodeId, {
                                    status: 'running',
                                    startTime: Date.now(),
                                });
                                break;
                            }

                            case 'node_done': {
                                const { nodeId, status, durationMs, error } = data as {
                                    nodeId: string;
                                    status: 'completed' | 'failed' | 'fallback';
                                    durationMs?: number;
                                    error?: string;
                                };
                                updateNodeStatus(nodeId, {
                                    status,
                                    endTime: Date.now(),
                                    durationMs,
                                    error,
                                });
                                if (status === 'completed') completedCount++;
                                else if (status === 'failed') failedCount++;
                                else if (status === 'fallback') fallbackCount++;
                                break;
                            }

                            case 'agent_state': {
                                // 从 agent_state 事件映射到节点状态
                                const { agentId, update } = data as {
                                    agentId: string;
                                    update: Record<string, unknown>;
                                };
                                const agentStatus = update?.status as string;
                                if (agentStatus === 'running' || agentStatus === 'pending') {
                                    updateNodeStatus(agentId, {
                                        status: 'running',
                                        startTime: Date.now(),
                                    });
                                } else if (agentStatus === 'completed') {
                                    updateNodeStatus(agentId, {
                                        status: 'completed',
                                        endTime: Date.now(),
                                        durationMs: update?.endTime && update?.startTime
                                            ? (update.endTime as number) - (update.startTime as number)
                                            : undefined,
                                    });
                                    completedCount++;
                                } else if (agentStatus === 'failed' || agentStatus === 'timeout') {
                                    updateNodeStatus(agentId, {
                                        status: agentStatus === 'timeout' ? 'fallback' : 'failed',
                                        endTime: Date.now(),
                                        error: update?.error as string | undefined,
                                    });
                                    if (agentStatus === 'timeout') fallbackCount++;
                                    else failedCount++;
                                }
                                break;
                            }

                            case 'done': {
                                const doneData = data as Record<string, unknown>;
                                const totalDuration = Date.now() - totalStart;
                                setRunnerState('completed');
                                setSummary({
                                    state: 'completed',
                                    totalDurationMs: totalDuration,
                                    nodeCount: nodeIds.length,
                                    completedCount,
                                    failedCount,
                                    fallbackCount,
                                    steps: [],
                                    overallScore: doneData.overallScore as number | undefined,
                                    resultSummary: doneData.summary as string | undefined,
                                });
                                addLog(`✅ 真实运行完成 — 总耗时 ${(totalDuration / 1000).toFixed(1)}s`);
                                if (doneData.overallScore !== undefined) {
                                    addLog(`📊 综合评分: ${doneData.overallScore}`);
                                }
                                break;
                            }

                            case 'error': {
                                const errData = data as { message: string };
                                addLog(`🔴 错误: ${errData.message}`);
                                break;
                            }

                            case 'ping':
                                // 忽略心跳
                                break;

                            default:
                                // 其他事件类型也记录日志
                                if (typeof data === 'string') {
                                    addLog(data);
                                }
                                break;
                        }
                    } catch {
                        // 解析失败，跳过该行
                    }
                }
            }
        } catch (err: unknown) {
            if (abortRef.current || (err instanceof Error && err.name === 'AbortError')) {
                setRunnerState('aborted');
                addLog('🛑 运行已中止');
                setSummary({
                    state: 'aborted',
                    totalDurationMs: Date.now() - totalStart,
                    nodeCount: nodeIds.length,
                    completedCount,
                    failedCount,
                    fallbackCount,
                    steps: [],
                });
            } else {
                setRunnerState('completed');
                addLog(`🔴 运行失败: ${err instanceof Error ? err.message : String(err)}`);
                setSummary({
                    state: 'completed',
                    totalDurationMs: Date.now() - totalStart,
                    nodeCount: nodeIds.length,
                    completedCount,
                    failedCount: failedCount + 1,
                    fallbackCount,
                    steps: [],
                });
            }
        } finally {
            abortControllerRef.current = null;
        }
    }, [addLog, updateNodeStatus]);

    /** 中止运行 */
    const abort = useCallback(() => {
        abortRef.current = true;
        abortControllerRef.current?.abort();
        addLog('⚠️ 正在中止...');
    }, [addLog]);

    /** 重置所有状态 */
    const reset = useCallback(() => {
        abortRef.current = false;
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setNodeStatuses({});
        setRunnerState('idle');
        setSummary(null);
        setLogs([]);
    }, []);

    return {
        nodeStatuses,
        runnerState,
        summary,
        logs,
        startRun,
        startRealRun,
        abort,
        reset,
    };
}
