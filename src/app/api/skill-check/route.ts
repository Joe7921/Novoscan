export const dynamic = 'force-dynamic';

/**
 * Clawscan — OpenClaw 创新应用查重 SSE API 路由
 *
 * POST /api/skill-check
 *
 * 两种模式：
 *   registry — Skill 查新（轻量，仅 ClawHub Registry + 2 Agent）
 *   full     — 落地想法评估（完整 3 路数据 + 4 Agent 深度评估）
 *
 * 三阶段 SSE 流式响应：
 *   Phase 1: idea_parsed
 *   Phase 2: data_gathered
 *   Phase 3: evaluation_complete
 */

import { parseClawIdeaLocal } from '@/server/clawscan/idea-parser-local';
import { getRegistry, smartPreFilter, gatherClawscanSignals } from '@/server/clawscan/data-sources';
import { evaluateClawscan } from '@/server/clawscan/evaluator';
import { evaluateClawscanLite } from '@/server/clawscan/evaluator-lite';
import { recordSearchEvent } from '@/lib/services/user/userPreferenceService';
import { createClient } from '@/utils/supabase/server';
import { checkRateLimit, safeErrorResponse } from '@/lib/security/apiSecurity';
import { chargeForFeature } from '@/lib/featureCosts';
import type { ModelProvider } from '@/types';
import { NextResponse } from 'next/server';

// ============================================================
//  POST /api/skill-check — Clawscan SSE 流式评估
// ============================================================

export async function POST(request: Request) {
    try {
        // 🔒 速率限制（5次/分钟）
        const rateLimitRes = await checkRateLimit(request, 'skill-check', 5);
        if (rateLimitRes) return rateLimitRes;

        const body = await request.json();
        const {
            description,
            modelProvider = 'minimax',
            privacyMode = false,
            mode = 'registry',
        } = body;

        if (!description || typeof description !== 'string' || description.trim().length === 0) {
            return Response.json(
                { success: false, error: '请提供功能描述' },
                { status: 400 },
            );
        }

        const trimmed = description.trim();
        const isFullMode = mode === 'full';
        console.log(`[Clawscan/API] 收到评估请求: mode=${mode}, ${trimmed.slice(0, 80)}... (${trimmed.length}字符, model=${modelProvider})`);

        // 获取当前登录用户
        let currentUserId: string | undefined;
        try {
            const supabaseAuth = await createClient();
            const { data: { user } } = await supabaseAuth.auth.getUser();
            currentUserId = user?.id;
        } catch { /* 未登录 */ }

        // 💰 点数扣费：Clawscan 需要登录
        if (!currentUserId) {
            return NextResponse.json(
                { success: false, error: '请登录后使用 Clawscan', requireLogin: true },
                { status: 401 }
            );
        }
        const featureKey = isFullMode ? 'clawscan-full' : 'clawscan-registry';
        const charge = await chargeForFeature(currentUserId, featureKey);
        if (!charge.success) {
            return NextResponse.json(
                { success: false, error: charge.error, currentBalance: charge.currentBalance, required: charge.required },
                { status: 402 }
            );
        }

        // SSE 流式响应
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                const startTime = Date.now();

                function sendEvent(type: string, data: any) {
                    const eventStr = `data: ${JSON.stringify({ type, ...data })}\n\n`;
                    try {
                        controller.enqueue(encoder.encode(eventStr));
                    } catch {
                        // Controller 已关闭
                    }
                }

                try {
                    // ========== Phase 0: 并行启动（本地解析 + Registry + NovoDNA 预洞察） ==========
                    sendEvent('progress', {
                        phase: 'parsing',
                        message: isFullMode ? '正在解析 OpenClaw 应用构想...' : '正在快速分析 Skill 需求...',
                        progress: 5,
                    });

                    // 本地想法解析（零 AI，<5ms）
                    const parsedIdea = parseClawIdeaLocal(trimmed);

                    // Registry 获取 + NovoDNA 预洞察 并行
                    const [registry, dnaInsightResult] = await Promise.all([
                        getRegistry(),
                        (async () => {
                            try {
                                const { preScanDNAInsight } = await import('@/lib/services/innovation/dnaFeedbackLoop');
                                return await preScanDNAInsight(trimmed);
                            } catch { return null; }
                        })(),
                    ]);

                    // 发送解析完成事件
                    sendEvent('idea_parsed', {
                        data: parsedIdea,
                        progress: 20,
                    });

                    // 处理 NovoDNA 预洞察结果
                    if (dnaInsightResult?.hasInsight) {
                        sendEvent('novodna_prescan', {
                            genePoolSize: dnaInsightResult.genePoolSize,
                            crowdingWarning: dnaInsightResult.crowdingWarning,
                            similarQueries: dnaInsightResult.similarQueries.slice(0, 3),
                            enhancedKeywords: dnaInsightResult.enhancedKeywords,
                        });
                    }

                    console.log(`[Clawscan/API] Phase 0+1 并行完成: ${parsedIdea.coreCapabilities.length} 能力点, Registry: ${registry.length} Skills`);

                    // ========== Phase 2: 数据采集（分流） ==========
                    sendEvent('progress', {
                        phase: 'gathering',
                        message: isFullMode
                            ? '正在从 ClawHub Registry + 网络 + GitHub 采集数据...'
                            : '正在从 ClawHub Registry 检索现有 Skill...',
                        progress: 25,
                    });

                    // 2a. 预筛选（本地计算，<50ms）
                    const candidates = smartPreFilter(registry, parsedIdea.searchKeywords);

                    if (isFullMode) {
                        // ===== 完整模式: Registry + Web + GitHub =====
                        sendEvent('progress', {
                            phase: 'gathering',
                            message: `Registry 就绪 (${registry.length} Skills)，正在网络搜索 OpenClaw 案例...`,
                            progress: 30,
                        });

                        const signals = await gatherClawscanSignals(
                            parsedIdea.searchKeywords,
                            registry,
                            candidates,
                        );

                        sendEvent('data_gathered', {
                            data: {
                                registryCount: candidates.length,
                                webCasesCount: signals.webCaseResults.length,
                                githubCount: signals.githubRepos.length,
                                sourcesScanned: signals.totalSourcesScanned,
                                mode: 'full',
                            },
                            progress: 45,
                        });

                        console.log(`[Clawscan/API] Phase 2 (full): Registry=${candidates.length}, Web=${signals.webCaseResults.length}, GH=${signals.githubRepos.length}`);

                        // ========== Phase 3: 4Agent 完整评估 ==========
                        sendEvent('progress', {
                            phase: 'evaluating',
                            message: '正在启动 4-Agent 多维深度评估引擎...',
                            progress: 48,
                        });

                        const report = await evaluateClawscan(
                            parsedIdea,
                            signals,
                            modelProvider as ModelProvider,
                            (event, data) => {
                                if (event === 'log') {
                                    sendEvent('agent_log', { message: data });
                                } else if (event === 'progress') {
                                    const mappedProgress = Math.round(48 + (data / 100) * 50);
                                    sendEvent('progress', {
                                        phase: 'evaluating',
                                        message: `4-Agent 评估中 (${data}%)...`,
                                        progress: mappedProgress,
                                    });
                                } else if (event === 'agent_state') {
                                    sendEvent('agent_state', data);
                                }
                            },
                        );

                        report.metadata.searchTimeMs = Date.now() - startTime;
                        report.metadata.mode = 'full';

                        sendEvent('evaluation_complete', {
                            data: report,
                            progress: 100,
                        });

                        // ========== NovoDNA + 双向进化 ==========
                        try {
                            const { buildInnovationMap } = await import('@/lib/services/innovation/innovationDNA');
                            const dnaContext = (report as any).executiveSummary || (report as any).summary || trimmed;
                            const dnaMap = await buildInnovationMap(trimmed, dnaContext, modelProvider as any);
                            sendEvent('novodna_complete', { data: dnaMap });
                            console.log(`[Clawscan/API] NovoDNA 图谱完成(full): [${dnaMap.vector.join(', ')}]`);

                            if (dnaMap.density) {
                                const { postSearchDNARanking, evolutionaryFeedback } = await import('@/lib/services/innovation/dnaFeedbackLoop');
                                const ranking = postSearchDNARanking(
                                    dnaMap.density.uniquenessScore, dnaMap.density.overallCrowding,
                                    report.overallScore, dnaMap.density.totalInnovations,
                                );
                                if (ranking.adjusted) {
                                    sendEvent('novodna_ranking', { data: ranking });
                                }
                                const { generateQueryHash } = await import('@/lib/services/innovation/innovationService');
                                const qHash = await generateQueryHash(trimmed);
                                evolutionaryFeedback(
                                    qHash, dnaMap.density.uniquenessScore, report.overallScore, 0,
                                ).catch(() => { });
                            }
                        } catch (e: any) {
                            console.warn('[Clawscan/API] NovoDNA 构建失败(full):', e.message);
                        }

                        console.log(
                            `[Clawscan/API] 评估完成(full): Score=${report.overallScore}, Grade=${report.grade}, 耗时=${report.metadata.searchTimeMs}ms`
                        );

                        recordSearchEvent({
                            userId: currentUserId,
                            query: trimmed.slice(0, 200),
                            domainId: parsedIdea.category === '工具' ? 'ENG' : 'INTER',
                            modelUsed: modelProvider,
                            noveltyScore: report.overallScore,
                        }).catch(err => console.warn('[Clawscan/API] 偏好记录失败:', err.message));

                    } else {
                        // ===== 轻量模式: 仅 Registry =====
                        const liteSignals = {
                            registrySkills: candidates,
                            webCaseResults: [],
                            githubRepos: [],
                            totalSourcesScanned: candidates.length,
                            dataSourcesUsed: ['ClawHub Registry'],
                        };

                        sendEvent('data_gathered', {
                            data: {
                                registryCount: candidates.length,
                                webCasesCount: 0,
                                githubCount: 0,
                                sourcesScanned: candidates.length,
                                mode: 'registry',
                            },
                            progress: 50,
                        });

                        console.log(`[Clawscan/API] Phase 2 (registry): ${candidates.length} candidates`);

                        // ========== Phase 3: 2Agent 轻量评估 ==========
                        sendEvent('progress', {
                            phase: 'evaluating',
                            message: '正在启动 2-Agent 快速查新引擎...',
                            progress: 55,
                        });

                        const report = await evaluateClawscanLite(
                            parsedIdea,
                            liteSignals,
                            modelProvider as ModelProvider,
                            (event, data) => {
                                if (event === 'log') {
                                    sendEvent('agent_log', { message: data });
                                } else if (event === 'progress') {
                                    const mappedProgress = Math.round(55 + (data / 100) * 43);
                                    sendEvent('progress', {
                                        phase: 'evaluating',
                                        message: `2-Agent 查新中 (${data}%)...`,
                                        progress: mappedProgress,
                                    });
                                } else if (event === 'agent_state') {
                                    sendEvent('agent_state', data);
                                }
                            },
                        );

                        report.metadata.searchTimeMs = Date.now() - startTime;
                        report.metadata.mode = 'registry';

                        sendEvent('evaluation_complete', {
                            data: report,
                            progress: 100,
                        });

                        console.log(
                            `[Clawscan/API] 评估完成(registry): Score=${report.overallScore}, Grade=${report.grade}, 耗时=${report.metadata.searchTimeMs}ms`
                        );

                        // 偏好记录（不阻塞）
                        recordSearchEvent({
                            userId: currentUserId,
                            query: trimmed.slice(0, 200),
                            domainId: parsedIdea.category === '工具' ? 'ENG' : 'INTER',
                            modelUsed: modelProvider,
                            noveltyScore: report.overallScore,
                        }).catch(err => console.warn('[Clawscan/API] 偏好记录失败:', err.message));

                        // ========== NovoDNA 后台异步（不阻塞用户，最多等 3 秒） ==========
                        try {
                            const { buildInnovationMap } = await import('@/lib/services/innovation/innovationDNA');
                            const dnaContext = (report as any).executiveSummary || (report as any).summary || trimmed;
                            const dnaPromise = buildInnovationMap(trimmed, dnaContext, modelProvider as any);
                            const dnaMap = await Promise.race([
                                dnaPromise,
                                new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
                            ]);
                            if (dnaMap) {
                                sendEvent('novodna_complete', { data: dnaMap });
                                console.log(`[Clawscan/API] NovoDNA 图谱完成(registry): [${dnaMap.vector.join(', ')}]`);
                                if (dnaMap.density) {
                                    const { postSearchDNARanking, evolutionaryFeedback } = await import('@/lib/services/innovation/dnaFeedbackLoop');
                                    const ranking = postSearchDNARanking(
                                        dnaMap.density.uniquenessScore, dnaMap.density.overallCrowding,
                                        report.overallScore, dnaMap.density.totalInnovations,
                                    );
                                    if (ranking.adjusted) {
                                        sendEvent('novodna_ranking', { data: ranking });
                                    }
                                    const { generateQueryHash } = await import('@/lib/services/innovation/innovationService');
                                    const qHash = await generateQueryHash(trimmed);
                                    evolutionaryFeedback(
                                        qHash, dnaMap.density.uniquenessScore, report.overallScore, 0,
                                    ).catch(() => { });
                                }
                            } else {
                                console.log('[Clawscan/API] NovoDNA 3s 超时，跳过（后台继续执行）');
                            }
                        } catch (e: any) {
                            console.warn('[Clawscan/API] NovoDNA 构建失败(registry):', e.message);
                        }
                    }

                } catch (error: any) {
                    console.error('[Clawscan/API] 评估流程异常:', error);
                    sendEvent('error', {
                        message: error.message || '评估过程中发生未知错误',
                    });
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        return safeErrorResponse(error, '请求处理失败', 500, '[Clawscan/API]');
    }
}

// ============================================================
//  GET /api/skill-check — Registry 统计信息
// ============================================================

export async function GET() {
    try {
        const registry = await getRegistry();
        return NextResponse.json({
            success: true,
            totalSkills: registry.length,
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: '获取 Registry 信息失败' },
            { status: 500 },
        );
    }
}
