export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * /api/workflow/run — 工作流真实运行 SSE API
 *
 * 接收工作流 JSON + 测试查询，调用 executeWorkflow 引擎，
 * 通过 NDJSON 流式推送节点级执行进度事件。
 *
 * 事件类型：
 * - node_start   { nodeId, agentId }          — 节点开始执行
 * - node_done    { nodeId, agentId, status }   — 节点执行完成/失败/降级
 * - log          string                        — 日志消息
 * - progress     number                        — 总体进度 (0-100)
 * - agent_state  { agentId, update }           — Agent 状态变更
 * - done         { success, summary }          — 运行结束
 * - error        { message }                   — 致命错误
 * - ping         { ts }                        — 心跳
 */

import { NextResponse } from 'next/server';
import { searchDualTrack } from '@/server/search/dual-track';
import { executeWorkflow } from '@/workflow/engine';
import { validateWorkflow } from '@/workflow/validator';
import type { WorkflowDefinition } from '@/workflow/types';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { workflow, query, language = 'zh', modelProvider = 'minimax' } = body;

        // 校验输入
        if (!query || typeof query !== 'string' || query.length < 2) {
            return NextResponse.json({ error: '查询内容不能为空且至少 2 个字符' }, { status: 400 });
        }

        if (!workflow) {
            return NextResponse.json({ error: '缺少工作流定义' }, { status: 400 });
        }

        // 校验工作流
        const validation = validateWorkflow(workflow);
        if (!validation.valid) {
            return NextResponse.json({ error: `工作流校验失败：${validation.errors.join('；')}` }, { status: 400 });
        }

        const definition = workflow as WorkflowDefinition;

        // 构建 SSE 流
        const stream = new ReadableStream({
            async start(controller) {
                let isClosed = false;
                const safeClose = () => {
                    if (!isClosed) { isClosed = true; try { controller.close(); } catch { } }
                };

                // 心跳：15s 发送 ping
                const heartbeat = setInterval(() => {
                    if (!isClosed) {
                        try {
                            controller.enqueue(new TextEncoder().encode(
                                JSON.stringify({ type: 'ping', data: { ts: Date.now() } }) + '\n'
                            ));
                        } catch { /* 忽略 */ }
                    }
                }, 15000);

                const sendEvent = (type: string, data: unknown) => {
                    if (isClosed) return;
                    try {
                        controller.enqueue(new TextEncoder().encode(
                            JSON.stringify({ type, data }) + '\n'
                        ));
                    } catch { /* 流断开则忽略 */ }
                };

                try {
                    sendEvent('log', '[WorkflowRunner] 🚀 开始执行工作流...');
                    sendEvent('log', `[WorkflowRunner] 查询: "${query}"`);
                    sendEvent('log', `[WorkflowRunner] 工作流: ${definition.name} (${definition.nodes.length} 个节点)`);

                    // 1. 双轨检索
                    sendEvent('log', '[WorkflowRunner] 📡 启动双轨数据检索...');

                    let dualTrackResult;
                    try {
                        dualTrackResult = await Promise.race([
                            searchDualTrack([query]),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('数据检索超时(30s)')), 30000)
                            ),
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ]) as any;

                        if (dualTrackResult?.success) {
                            const academicCount = dualTrackResult.academic?.results?.length || 0;
                            const industryCount = (dualTrackResult.industry?.githubRepos?.length || 0)
                                + (dualTrackResult.industry?.webResults?.length || 0);
                            sendEvent('log', `[WorkflowRunner] ✅ 检索完成: ${academicCount} 篇学术 + ${industryCount} 条产业数据`);
                        } else {
                            sendEvent('log', `[WorkflowRunner] ⚠️ 检索返回失败，使用空数据继续`);
                        }
                    } catch (e: unknown) {
                        sendEvent('log', `[WorkflowRunner] ⚠️ 检索异常(${(e instanceof Error ? e.message : String(e))})，使用空数据继续`);
                        // 构造降级空数据
                        dualTrackResult = {
                            success: false,
                            academic: {
                                source: 'quad', results: [],
                                stats: {
                                    totalPapers: 0, totalCitations: 0, openAccessCount: 0, avgCitation: 0,
                                    bySource: { openAlex: 0, arxiv: 0, crossref: 0, core: 0 },
                                    topCategories: [], topConcepts: [],
                                },
                                topConcepts: [],
                            },
                            industry: {
                                source: 'triple', webResults: [], githubRepos: [], wechatArticles: [],
                                sentiment: 'cold', hasOpenSource: false, topProjects: [],
                                webSources: { brave: 0, serpapi: 0 },
                            },
                            crossValidation: null, finalCredibility: null,
                        };
                    }

                    // 2. 调用引擎执行工作流
                    sendEvent('log', '[WorkflowRunner] ⚙️ 启动引擎执行...');
                    const startTime = Date.now();

                    // 跟踪当前正在执行的节点
                    const activeNodes = new Set<string>();

                    const result = await executeWorkflow(definition, {
                        query,
                        academicData: dualTrackResult.academic,
                        industryData: dualTrackResult.industry,
                        language: language as 'zh' | 'en',
                        modelProvider,
                        onProgress: (eventType, eventData) => {
                            sendEvent(eventType, eventData);

                            // 提取节点状态变更事件
                            if (eventType === 'agent_state' && typeof eventData === 'object' && eventData !== null) {
                                const { agentId, update } = eventData as Record<string, unknown>;
                                const agentUpdate = update as Record<string, unknown>;
                                const status = agentUpdate?.status as string;

                                if (status === 'running' || status === 'pending') {
                                    activeNodes.add(agentId as string);
                                    sendEvent('node_start', { nodeId: agentId, agentId });
                                } else if (status === 'completed' || status === 'failed' || status === 'timeout') {
                                    activeNodes.delete(agentId as string);
                                    const nodeStatus = status === 'completed' ? 'completed'
                                        : status === 'timeout' ? 'fallback' : 'failed';
                                    sendEvent('node_done', {
                                        nodeId: agentId,
                                        agentId,
                                        status: nodeStatus,
                                        durationMs: agentUpdate?.endTime && agentUpdate?.startTime
                                            ? (agentUpdate.endTime as number) - (agentUpdate.startTime as number)
                                            : undefined,
                                        error: agentUpdate?.error || undefined,
                                    });
                                }
                            }
                        },
                    });

                    const totalDuration = Date.now() - startTime;

                    // 3. 发送完成事件
                    sendEvent('done', {
                        success: true,
                        totalDurationMs: totalDuration,
                        overallScore: result.arbitration?.overallScore,
                        summary: result.arbitration?.summary?.slice(0, 200),
                        qualityPassed: result.qualityCheck?.passed,
                        isPartial: (result as unknown as Record<string, unknown>).isPartial,
                        agentCount: Object.keys(result.executionRecord?.agents || {}).length,
                    });

                    sendEvent('log', `[WorkflowRunner] ✅ 执行完成 — 总耗时 ${(totalDuration / 1000).toFixed(1)}s`);

                } catch (err: unknown) {
                    sendEvent('error', {
                        message: err instanceof Error ? err.message : '引擎执行异常',
                    });
                    sendEvent('log', `[WorkflowRunner] 🔴 致命错误: ${err instanceof Error ? err.message : String(err)}`);
                } finally {
                    clearInterval(heartbeat);
                    safeClose();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '请求处理失败' },
            { status: 500 }
        );
    }
}
