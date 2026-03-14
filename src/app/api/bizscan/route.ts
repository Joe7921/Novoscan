export const dynamic = 'force-dynamic';

/**
 * Bizscan 商业想法创新度查重 — SSE API 路由
 *
 * POST /api/bizscan
 *
 * 三阶段 SSE 流式响应：
 *   Phase 1: idea_parsed     — 想法解析完成
 *   Phase 2: data_gathered   — 市场数据采集完成
 *   Phase 3: evaluation_complete — 评估报告生成
 */

import { parseBusinessIdea } from '@/server/bizscan/idea-parser';
import { gatherMarketSignals } from '@/server/bizscan/data-sources';
import { evaluateBusinessIdea } from '@/server/bizscan/evaluator';
import { recordSearchEvent } from '@/lib/services/user/userPreferenceService';
import { createClient } from '@/utils/supabase/server';
import { checkRateLimit, safeErrorResponse } from '@/lib/security/apiSecurity';
import { chargeForFeature } from '@/lib/featureCosts';
import { NextResponse } from 'next/server';
import type { ModelProvider } from '@/types';
import type { BizscanInput } from '@/types/bizscan';

// ============================================================
//  POST /api/bizscan — SSE 流式评估
// ============================================================

export async function POST(request: Request) {
    try {
        // 🔒 速率限制（5次/分钟）
        const rateLimitRes = await checkRateLimit(request, 'bizscan', 5);
        if (rateLimitRes) return rateLimitRes;

        const body: BizscanInput & { modelProvider?: ModelProvider } = await request.json();
        const {
            ideaDescription,
            targetMarket,
            businessModel,
            industryVertical,
            modelProvider = 'minimax',
        } = body;

        // 输入验证
        if (!ideaDescription || typeof ideaDescription !== 'string') {
            return Response.json(
                { success: false, error: '请提供商业想法描述' },
                { status: 400 }
            );
        }

        const trimmed = ideaDescription.trim();
        if (trimmed.length < 50) {
            return Response.json(
                { success: false, error: '描述字数不足，请至少输入 50 个字符以获得准确评估' },
                { status: 400 }
            );
        }
        if (trimmed.length > 5000) {
            return Response.json(
                { success: false, error: '描述字数超限（最多 5000 字符）' },
                { status: 400 }
            );
        }

        console.log(`[Bizscan/API] 收到评估请求: ${trimmed.slice(0, 80)}... (${trimmed.length}字符, model=${modelProvider})`);

        // 获取当前登录用户（如有）
        let currentUserId: string | undefined;
        try {
            const supabaseAuth = await createClient();
            const { data: { user } } = await supabaseAuth.auth.getUser();
            currentUserId = user?.id;
        } catch { /* 未登录，忽略 */ }

        // 💰 点数扣费：Bizscan 需要登录
        if (!currentUserId) {
            return NextResponse.json(
                { success: false, error: '请登录后使用 Bizscan', requireLogin: true },
                { status: 401 }
            );
        }
        const charge = await chargeForFeature(currentUserId, 'bizscan');
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
                    // ========== NovoDNA 预洞察（DNA -> 搜索） ==========
                    let dnaInsightSummary = '';
                    try {
                        const { preScanDNAInsight } = await import('@/lib/services/innovation/dnaFeedbackLoop');
                        const insight = await preScanDNAInsight(trimmed);
                        if (insight.hasInsight) {
                            dnaInsightSummary = insight.insightSummary;
                            sendEvent('novodna_prescan', {
                                genePoolSize: insight.genePoolSize,
                                crowdingWarning: insight.crowdingWarning,
                                similarQueries: insight.similarQueries.slice(0, 3),
                                enhancedKeywords: insight.enhancedKeywords,
                            });
                        }
                    } catch (e: any) {
                        console.warn('[Bizscan/API] NovoDNA 预洞察失败:', e.message);
                    }

                    // ========== Phase 1: 想法解析 ==========
                    sendEvent('progress', {
                        phase: 'parsing',
                        message: '正在解析商业想法核心要素...',
                        progress: 10,
                    });

                    const parsedIdea = await parseBusinessIdea(
                        trimmed,
                        targetMarket,
                        businessModel,
                        industryVertical,
                        modelProvider,
                    );

                    sendEvent('idea_parsed', {
                        data: parsedIdea,
                        progress: 30,
                    });

                    console.log(`[Bizscan/API] Phase 1 完成: ${parsedIdea.searchKeywords.length} 个关键词`);

                    // ========== OpenClaw 关联检测 ==========
                    const OPENCLAW_KEYWORDS = [
                        'openclaw', 'clawhub', 'skill', 'mcp', 'claude',
                        'ai agent', 'ai 应用', 'ai应用', 'ai 工具', 'ai工具',
                        'ai skill', 'claw', 'anthropic', 'tool use',
                        'function calling', '智能体', 'agent 开发',
                        'ai 助手', 'ai助手', 'llm 应用', 'llm应用',
                    ];

                    const searchPool = [
                        trimmed.toLowerCase(),
                        ...parsedIdea.searchKeywords.map((k: string) => k.toLowerCase()),
                        ...parsedIdea.industryTags.map((t: string) => t.toLowerCase()),
                        ...parsedIdea.technologyStack.map((t: string) => t.toLowerCase()),
                    ].join(' ');

                    const matchedKeywords = OPENCLAW_KEYWORDS.filter(kw => searchPool.includes(kw));

                    if (matchedKeywords.length > 0) {
                        const confidence = Math.min(100, matchedKeywords.length * 25);
                        sendEvent('openclaw_detected', {
                            data: { keywords: matchedKeywords, confidence },
                        });
                        console.log(`[Bizscan/API] OpenClaw 关联检测命中: ${matchedKeywords.join(', ')} (confidence=${confidence})`);
                    }

                    // ========== Phase 2: 市场数据采集 ==========
                    sendEvent('progress', {
                        phase: 'gathering',
                        message: '正在扫描全球市场数据库...',
                        progress: 35,
                    });

                    const marketSignals = await gatherMarketSignals(
                        parsedIdea.searchKeywords,
                        targetMarket,
                    );

                    sendEvent('data_gathered', {
                        data: {
                            competitorsFound: marketSignals.webResults.length + marketSignals.productHuntItems.length,
                            sourcesScanned: marketSignals.totalSourcesScanned,
                            dataSourcesUsed: marketSignals.dataSourcesUsed,
                        },
                        progress: 60,
                    });

                    console.log(`[Bizscan/API] Phase 2 完成: ${marketSignals.totalSourcesScanned} 条数据`);

                    // ========== Phase 3: 6Agent 多维评估 ==========
                    sendEvent('progress', {
                        phase: 'evaluating',
                        message: '正在启动 6Agent 多维深度评估引擎...',
                        progress: 62,
                    });

                    const report = await evaluateBusinessIdea(
                        parsedIdea,
                        marketSignals,
                        modelProvider,
                        (event, data) => {
                            // Agent 级进度推送
                            if (event === 'log') {
                                sendEvent('agent_log', { message: data });
                            } else if (event === 'progress') {
                                // 将 Agent 内部的 0-100 映射到 Phase3 的 62-98 区间
                                const mappedProgress = Math.round(62 + (data / 100) * 36);
                                sendEvent('progress', {
                                    phase: 'evaluating',
                                    message: `多Agent评估中 (${data}%)...`,
                                    progress: mappedProgress,
                                });
                            } else if (event === 'agent_state') {
                                sendEvent('agent_state', data);
                            }
                        },
                    );

                    // 补充总耗时
                    report.metadata.searchTimeMs = Date.now() - startTime;

                    sendEvent('evaluation_complete', {
                        data: report,
                        progress: 100,
                    });

                    // ========== NovoDNA 创新基因图谱 + 双向进化 ==========
                    try {
                        const { buildInnovationMap } = await import('@/lib/services/innovation/innovationDNA');
                        const dnaContext = (report as any).executiveSummary || (report as any).summary || trimmed;
                        const dnaMap = await buildInnovationMap(trimmed, dnaContext, modelProvider as any);
                        sendEvent('novodna_complete', { data: dnaMap });
                        console.log(`[Bizscan/API] NovoDNA 图谱完成: [${dnaMap.vector.join(', ')}]`);

                        // DNA -> 搜索：加权修正 + 进化反馈
                        if (dnaMap.density) {
                            const { postSearchDNARanking, evolutionaryFeedback } = await import('@/lib/services/innovation/dnaFeedbackLoop');
                            const ranking = postSearchDNARanking(
                                dnaMap.density.uniquenessScore, dnaMap.density.overallCrowding,
                                report.overallBII, dnaMap.density.totalInnovations,
                            );
                            if (ranking.adjusted) {
                                sendEvent('novodna_ranking', { data: ranking });
                                console.log(`[Bizscan/API] NovoDNA 加权: ${ranking.reason}`);
                            }
                            const { generateQueryHash } = await import('@/lib/services/innovation/innovationService');
                            const qHash = await generateQueryHash(trimmed);
                            evolutionaryFeedback(
                                qHash, dnaMap.density.uniquenessScore, report.overallBII,
                                (report as any).competitors?.length || 0,
                            ).catch(() => { });
                        }
                    } catch (e: any) {
                        console.warn('[Bizscan/API] NovoDNA 构建失败:', e.message);
                    }

                    console.log(
                        `[Bizscan/API] 评估完成: BII=${report.overallBII}, Grade=${report.grade}, ` +
                        `耗时=${report.metadata.searchTimeMs}ms`
                    );

                    // 异步记录用户搜索偏好事件（不阻塞主流程）
                    recordSearchEvent({
                        userId: currentUserId,
                        query: trimmed.slice(0, 200),
                        domainId: industryVertical ? 'SOC' : undefined, // 商业类默认映射社科
                        modelUsed: modelProvider,
                        noveltyScore: report.overallBII,
                    }).catch(err => console.warn('[Bizscan/API] 偏好记录失败(不影响主流程):', err.message));

                } catch (error: any) {
                    console.error('[Bizscan/API] 评估流程异常:', error);
                    // 错误分级：对用户返回安全的提示信息
                    const errMsg = error.message || '';
                    const userMessage = errMsg.includes('超时') || errMsg.includes('timeout')
                        ? '评估超时，请缩短描述后重试'
                        : errMsg.includes('API') || errMsg.includes('fetch') || errMsg.includes('network')
                            ? '上游数据服务暂时不可用，请稍后重试'
                            : errMsg.includes('解析') || errMsg.includes('parse') || errMsg.includes('JSON')
                                ? 'AI 返回格式异常，请稍后重试'
                                : '评估过程中发生未知错误，请稍后重试';
                    sendEvent('error', {
                        message: userMessage,
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
        return safeErrorResponse(error, '请求处理失败', 500, '[Bizscan/API]');
    }
}
