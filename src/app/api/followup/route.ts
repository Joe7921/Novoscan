export const dynamic = 'force-dynamic';

/**
 * 追问系统 API 端点
 *
 * 两种 action：
 * 1. action='generate' — 根据首次分析结果生成追问问题
 * 2. action='refine'  — 基于用户选择的追问方向，重新运行精化分析
 */
import { NextResponse } from 'next/server';
import { generateFollowUpQuestions } from '@/server/followup/followupGenerator';
import { analyzeWithMultiAgents, AllAgentsFailedError } from '@/agents/orchestrator';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
import { checkRateLimit, sanitizeInput, safeErrorResponse } from '@/lib/security/apiSecurity';
import { chargeForFeature, FEATURE_COSTS } from '@/lib/featureCosts';
import { addPoints } from '@/lib/services/walletService';
import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import { searchDualTrack } from '@/server/search/dual-track';

export async function POST(request: Request) {
    try {
        // 🔒 速率限制（5次/分钟）
        const rateLimitRes = await checkRateLimit(request, 'followup', 5);
        if (rateLimitRes) return rateLimitRes;

        const body = await request.json();
        const { action } = body;

        // ✅ Followup 需要登录
        let currentUserId: string | undefined;
        try {
            const supabaseAuth = await createClient();
            const { data: { user } } = await supabaseAuth.auth.getUser();
            currentUserId = user?.id;
        } catch { /* 未登录 */ }

        if (!currentUserId) {
            return NextResponse.json(
                { success: false, error: '请登录后使用追问功能', requireLogin: true },
                { status: 401 }
            );
        }

        // 💰 追问生成免费；追问精化按常规分析费率扣费（合并显示）
        if (action === 'refine') {
            const charge = await chargeForFeature(currentUserId, 'novoscan-full');
            if (!charge.success) {
                return NextResponse.json(
                    { success: false, error: charge.error, currentBalance: charge.currentBalance, required: charge.required },
                    { status: 402 }
                );
            }
        }

        if (action === 'generate') {
            return handleGenerate(body);
        } else if (action === 'refine') {
            return handleRefine(body);
        } else {
            return NextResponse.json(
                { success: false, error: `Unknown action: ${action}` },
                { status: 400 }
            );
        }
    } catch (error: any) {
        return safeErrorResponse(error, '追问请求处理失败', 500, '[API Followup]');
    }
}

// ==================== 生成追问问题 ====================

async function handleGenerate(body: any) {
    const {
        query,
        arbitrationSummary,
        keyFindings = [],
        redFlags = [],
        language = 'zh',
        modelProvider = 'minimax',
    } = body;

    if (!query || !arbitrationSummary) {
        return NextResponse.json(
            { success: false, error: 'query 和 arbitrationSummary 必须提供' },
            { status: 400 }
        );
    }

    console.log(`[API Followup] 生成追问问题: "${query}"`);

    const questions = await generateFollowUpQuestions(
        query,
        arbitrationSummary,
        keyFindings,
        redFlags,
        language as 'zh' | 'en',
        modelProvider,
    );

    console.log(`[API Followup] 生成了 ${questions.length} 条追问问题`);

    return NextResponse.json({
        success: true,
        questions,
    });
}

// ==================== 精化分析（追问后重新分析） ====================

async function handleRefine(body: any) {
    const {
        query,
        dualTrackResult,
        selectedQuestions = [],
        userInput: rawUserInput,
        previousSummary,
        language = 'zh',
        modelProvider = 'minimax',
        domainId,
        subDomainId,
        domainHint,
        round = 1,
        privacyMode = false,
        parentSearchId,
    } = body;

    // 🔒 对用户输入进行 Prompt 注入清洗
    const userInput = rawUserInput ? sanitizeInput(rawUserInput, 1000) : undefined;

    if (!query || !dualTrackResult) {
        return NextResponse.json(
            { success: false, error: 'query 和 dualTrackResult 必须提供' },
            { status: 400 }
        );
    }

    // 获取用户 ID（隐私模式下跳过）
    let currentUserId: string | undefined;
    if (!privacyMode) {
        try {
            const supabaseAuth = await createClient();
            const { data: { user } } = await supabaseAuth.auth.getUser();
            currentUserId = user?.id;
        } catch { /* 未登录，忽略 */ }
    }

    const startTime = Date.now();

    console.log(`[API Followup] 精化分析 (Round ${round}): "${query}"`);
    console.log(`[API Followup] 追问方向: ${selectedQuestions.length} 条, 用户输入: ${userInput ? '有' : '无'}`);

    // 构建 SSE 流式响应
    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (type: string, data: any) => {
                controller.enqueue(new TextEncoder().encode(JSON.stringify({ type, data }) + '\n'));
            };

            try {
                sendEvent('log', `[Orchestrator] 追问精化分析启动 (Round ${round}), 基于已有检索数据进一步聚焦...`);

                // 将追问上下文融入查询，引导 Agent 聚焦分析方向
                let enrichedQuery = query;
                if (selectedQuestions.length > 0 || userInput) {
                    const contextParts: string[] = [query];
                    if (selectedQuestions.length > 0) {
                        contextParts.push(`[追问方向: ${selectedQuestions.join('; ')}]`);
                    }
                    if (userInput) {
                        contextParts.push(`[用户补充: ${userInput}]`);
                    }
                    if (previousSummary) {
                        contextParts.push(`[前次分析摘要: ${previousSummary.slice(0, 200)}]`);
                    }
                    enrichedQuery = contextParts.join(' ');
                }

                // ===== 新意检测 + 标题合成（合并为一次轻量 AI 调用）=====
                let mergedAcademic = dualTrackResult.academic;
                let mergedIndustry = dualTrackResult.industry;

                const hasUserContent = (selectedQuestions.length > 0 || userInput);

                if (hasUserContent) {
                    sendEvent('log', '[Orchestrator] \ud83d\udd0d 正在检测追问内容的新意与合成分析标题...');

                    const noveltyPrompt = `你是一个内容新意检测器兼标题合成器。

原始分析查询: "${query}"
用户追问方向: ${selectedQuestions.join('; ')}
${userInput ? `用户补充说明: "${userInput}"` : ''}

请完成两个任务：
1. 判断追问内容中是否引入了原始查询未覆盖的**新实体**（新技术、新应用领域、新竞品、新行业等），需要额外检索？
2. 将原始查询和追问方向合成一个简短自然的分析标题（15-30字），保留核心信息。

以 JSON 格式回答：
{
  "hasNewContent": true/false,
  "newKeywords": ["keyword1", "keyword2"],
  "synthesizedTitle": "合成后的标题",
  "reason": "一句话说明"
}

规则：
- 如果追问只是要求更深入分析已有内容（如"更详细的市场分析"），返回 hasNewContent: false
- 如果追问引入了新的具体实体（如"与 GPT-4o 对比"、"在医疗领域的应用"），返回 hasNewContent: true
- newKeywords 只包含需要额外检索的关键词，最多 3 个
- synthesizedTitle 必须自然连贯，例如原始"Transformer" + 追问"医疗应用" → "Transformer 在医疗健康领域的创新应用"`;

                    try {
                        const { text } = await callAIRaw(noveltyPrompt, modelProvider, 15000, undefined, undefined, undefined, 512, 0.1);
                        const detection = parseAgentJSON<{
                            hasNewContent?: boolean;
                            newKeywords?: string[];
                            synthesizedTitle?: string;
                            reason?: string;
                        }>(text);

                        // 使用合成标题
                        if (detection?.synthesizedTitle) {
                            sendEvent('refine_title', detection.synthesizedTitle);
                            console.log(`[API Followup] 合成标题: ${detection.synthesizedTitle}`);
                        }

                        // 增量检索
                        if (detection?.hasNewContent && Array.isArray(detection.newKeywords) && detection.newKeywords.length > 0) {
                            sendEvent('log', `[Orchestrator] \ud83d\udca1 检测到新内容: ${detection.newKeywords.join(', ')}，启动增量检索...`);
                            sendEvent('progress', 5);

                            const supplementResult = await searchDualTrack(
                                detection.newKeywords,
                                domainId || undefined
                            ) as any;

                            if (supplementResult?.success) {
                                mergedAcademic = mergeAcademicData(dualTrackResult.academic, supplementResult.academic);
                                mergedIndustry = mergeIndustryData(dualTrackResult.industry, supplementResult.industry);
                                const newPapers = supplementResult.academic?.results?.length || 0;
                                const newWeb = supplementResult.industry?.webResults?.length || 0;
                                sendEvent('log', `[Orchestrator] \u2705 增量检索完成，新增 ${newPapers} 篇论文 + ${newWeb} 条资讯`);
                            }
                        } else {
                            sendEvent('log', '[Orchestrator] 追问方向基于已有数据，跳过增量检索');
                        }
                    } catch (err: any) {
                        console.warn('[Followup] 新意检测失败，回退到复用已有数据:', err.message);
                        sendEvent('log', '[Orchestrator] 新意检测跳过，使用已有检索数据');
                    }
                }

                // 调用 Multi-Agent 分析（使用可能已增量合并的数据）
                const multiAgentResult = await analyzeWithMultiAgents({
                    query: enrichedQuery,
                    academicData: mergedAcademic,
                    industryData: mergedIndustry,
                    language: language as 'zh' | 'en',
                    modelProvider,
                    domainId: domainId || undefined,
                    subDomainId: subDomainId || undefined,
                    domainHint: domainHint || undefined,
                    onProgress: (type, data) => sendEvent(type, data),
                });

                const {
                    academicReview,
                    industryAnalysis,
                    innovationEvaluation,
                    competitorAnalysis,
                    arbitration,
                    qualityCheck,
                    executionRecord,
                } = multiAgentResult;

                console.log(`[API Followup] 精化分析完成, 综合评分: ${arbitration.overallScore}`);

                const isZh = language === 'zh';

                // 合成产业实践可行性评分，与 analyze 端点保持一致
                let practicalScore: number | undefined;
                {
                    const agentScore = industryAnalysis?.score;
                    const arbIndustryScore = arbitration?.weightedBreakdown?.industry?.raw;
                    const credScore = (dualTrackResult as any)?.finalCredibility?.score;

                    const sources: { value: number; weight: number }[] = [];
                    if (typeof agentScore === 'number' && agentScore > 0) sources.push({ value: agentScore, weight: 0.50 });
                    if (typeof arbIndustryScore === 'number' && arbIndustryScore > 0) sources.push({ value: arbIndustryScore, weight: 0.30 });
                    if (typeof credScore === 'number' && credScore > 0) sources.push({ value: credScore, weight: 0.20 });

                    if (sources.length > 0) {
                        const totalWeight = sources.reduce((s, src) => s + src.weight, 0);
                        practicalScore = Math.round(
                            sources.reduce((s, src) => s + src.value * (src.weight / totalWeight), 0)
                        );
                        practicalScore = Math.max(0, Math.min(100, practicalScore));
                    }
                }

                // 构建精化结果
                const refinedResult = {
                    success: true,

                    // 原有字段（兼容旧数据）
                    academic: dualTrackResult?.academic,
                    industry: dualTrackResult?.industry,
                    crossValidation: dualTrackResult?.crossValidation,
                    finalCredibility: (dualTrackResult as any)?.finalCredibility,
                    credibility: (dualTrackResult as any)?.credibility,

                    // 兼容字段
                    noveltyScore: arbitration?.overallScore,
                    practicalScore,
                    summary: arbitration?.summary,
                    recommendation: arbitration?.recommendation,
                    keyDifferentiators: academicReview?.keyFindings?.join('\n'),
                    improvementSuggestions: innovationEvaluation?.redFlags?.join('\n'),

                    sections: {
                        academic: {
                            title: isZh ? '学术界查重审查' : 'Academic Review (Refined)',
                            subsections: [
                                { title: isZh ? '现有技术树' : 'Prior Art Tree', content: academicReview?.analysis || '' },
                                { title: isZh ? '学术支撑度' : 'Academic Support', content: `Score: ${academicReview?.score}/100` }
                            ]
                        },
                        internet: {
                            title: isZh ? '全网/产业界查重审查' : 'Industry Review (Refined)',
                            subsections: [
                                { title: isZh ? '产业现状' : 'Industry Landscape', content: industryAnalysis?.analysis || '' },
                                { title: isZh ? '创新评估' : 'Innovation Assessment', content: innovationEvaluation?.analysis || '' }
                            ]
                        }
                    },
                    keyPoints: [
                        ...(academicReview?.keyFindings || []),
                        ...(industryAnalysis?.keyFindings || [])
                    ].slice(0, 5),
                    similarPapers: academicReview?.similarPapers || [],

                    // Multi-agents 完整数据
                    academicReview,
                    industryAnalysis,
                    innovationEvaluation,
                    competitorAnalysis,
                    arbitration,
                    qualityCheck,
                    executionRecord,

                    // 元数据
                    usedModel: modelProvider,
                    fromCache: false,
                    isMultiAgent: true,
                    isPartial: !!arbitration?.isPartial,
                    innovationRadar: innovationEvaluation?.innovationRadar || null,

                    // 追问标记
                    isRefined: true,
                    followUpRound: round,
                    followUpContext: {
                        selectedQuestions,
                        userInput,
                    },
                };

                const searchTimeMs = Date.now() - startTime;

                // 保存追问会话记录到数据库（隐私模式下跳过）
                if (!privacyMode) {
                    try {
                        await supabaseAdmin.from('followup_sessions').insert({
                            parent_search_id: parentSearchId || null,
                            original_query: query,
                            followup_questions: selectedQuestions,
                            selected_questions: selectedQuestions,
                            user_input: userInput || null,
                            refined_result: refinedResult,
                            round,
                            user_id: currentUserId || null,
                        });
                        console.log(`[API Followup] 追问会话已保存到数据库`);
                    } catch (e: any) {
                        console.warn('[API Followup] 保存追问会话失败(不影响主流程):', e.message);
                    }

                    // IDEA 行为信号收集（静默、不阻塞）
                    if (currentUserId) {
                        import('@/lib/services/innovation/ideaBehaviorService').then(({ recordBehaviorSignal }) => {
                            recordBehaviorSignal({
                                userId: currentUserId!,
                                type: 'followup',
                                query,
                                selectedQuestionsCount: selectedQuestions.length,
                                hasUserInput: !!userInput,
                                followupRound: round,
                            }).catch(() => { });
                        }).catch(() => { });
                    }
                }

                sendEvent('done', refinedResult);
                controller.close();
            } catch (err: any) {
                // 全员失败熔断：AI API 完全不可用
                if (err instanceof AllAgentsFailedError) {
                    console.error('[API Followup] 🚨 全员失败熔断:', err.message);
                    // 退费
                    if (currentUserId) {
                        try {
                            const cost = FEATURE_COSTS['novoscan-full'];
                            await addPoints(currentUserId, cost, 'AI 服务不可用自动退费（追问）');
                            console.log(`[API Followup] 💰 已为用户 ${currentUserId} 退还点数`);
                        } catch (refundErr: any) {
                            console.error('[API Followup] 退费失败:', refundErr.message);
                        }
                    }
                    sendEvent('all_agents_failed', {
                        message: err.message,
                        failedAgents: err.failedAgents,
                        modelProvider: err.modelProvider || modelProvider,
                        refunded: !!currentUserId,
                    });
                    controller.close();
                    return;
                }
                console.error('[API Followup] 精化分析流程错误:', err.message);
                sendEvent('error', { message: '精化分析失败，请稍后重试' });
                controller.close();
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
}

// ==================== 增量检索数据合并工具 ====================

/** 合并学术数据，按标题去重 */
function mergeAcademicData(original: any, supplement: any) {
    const existingTitles = new Set(
        (original.results || []).map((r: any) => (r.title || '').toLowerCase().trim())
    );
    const newResults = (supplement.results || []).filter(
        (r: any) => !existingTitles.has((r.title || '').toLowerCase().trim())
    );
    return {
        ...original,
        results: [...(original.results || []), ...newResults],
        stats: { ...original.stats, totalPapers: (original.results || []).length + newResults.length },
        _supplemented: true,
        _newResultsCount: newResults.length,
    };
}

/** 合并产业数据，按 URL 去重 */
function mergeIndustryData(original: any, supplement: any) {
    const existingUrls = new Set((original.webResults || []).map((r: any) => r.url));
    const existingRepoUrls = new Set((original.githubRepos || []).map((r: any) => r.url));
    const newWeb = (supplement.webResults || []).filter((r: any) => !existingUrls.has(r.url));
    const newRepos = (supplement.githubRepos || []).filter((r: any) => !existingRepoUrls.has(r.url));
    return {
        ...original,
        webResults: [...(original.webResults || []), ...newWeb],
        githubRepos: [...(original.githubRepos || []), ...newRepos],
        _supplemented: true,
        _newWebCount: newWeb.length,
        _newRepoCount: newRepos.length,
    };
}