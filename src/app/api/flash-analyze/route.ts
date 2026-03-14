export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { searchDualTrack } from '@/server/search/dual-track';
import { analyzeFlash } from '@/agents/flashOrchestrator';
import { recordSearchEvent } from '@/lib/services/user/userPreferenceService';
import { createClient } from '@/utils/supabase/server';
import { checkRateLimit, sanitizeInput, isValidModelProvider, safeErrorResponse } from '@/lib/security/apiSecurity';


// ==================== 辅助函数 ====================

const TOP_VENUES = new Set([
    'nature', 'science', 'cell', 'pnas',
    'neurips', 'nips', 'icml', 'iclr', 'cvpr', 'iccv', 'eccv',
    'acl', 'emnlp', 'naacl', 'aaai', 'ijcai',
    'sigmod', 'vldb', 'icde', 'kdd', 'www',
    'ieee transactions', 'acm transactions',
]);

function inferAuthorityLevel(citationCount: number, venue: string): 'high' | 'medium' | 'low' {
    const venueLower = (venue || '').toLowerCase();
    const isTopVenue = Array.from(TOP_VENUES).some(v => venueLower.includes(v));
    if (isTopVenue || citationCount > 100) return 'high';
    if (citationCount >= 20 || venueLower.length > 0) return 'medium';
    return 'low';
}

function buildSimilarPapers(academicReview: unknown, dualTrackResult: unknown): unknown[] {
    if (academicReview?.similarPapers?.length > 0) {
        return academicReview.similarPapers
            .filter((p: unknown) => p.title && typeof p.similarityScore === 'number')
            .sort((a: unknown, b: unknown) => (b.similarityScore || 0) - (a.similarityScore || 0))
            .slice(0, 4); // Flash：只取前 4 篇
    }

    const papers = dualTrackResult?.academic?.results || [];
    if (papers.length === 0) return [];

    return papers.slice(0, 4).map((p: unknown) => ({
        title: p.title || '',
        year: p.year || 0,
        similarityScore: Math.max(30, 65 - papers.indexOf(p) * 5),
        keyDifference: p.topics?.length > 0
            ? `相关研究领域：${p.topics.slice(0, 3).join('、')}`
            : (p.abstract ? p.abstract.slice(0, 80) + '...' : ''),
        description: p.abstract ? p.abstract.slice(0, 120) + '...' : '',
        authors: Array.isArray(p.authors) ? p.authors.join(', ') : (p.authors || ''),
        url: p.url || '',
        citationCount: p.citationCount || 0,
        venue: p.venue || '',
        authorityLevel: inferAuthorityLevel(p.citationCount || 0, p.venue || ''),
    }));
}

// ==================== Flash 分析 API ====================

export async function POST(request: Request) {
    try {
        // 🔒 速率限制
        const rateLimitRes = await checkRateLimit(request, 'flash-analyze', 5);
        if (rateLimitRes) return rateLimitRes;

        const {
            query: rawQuery,
            domain,
            language = 'zh',
            modelProvider = 'minimax',
            domainId,
            subDomainId,
            domainHint,
            anonymousId,
            privacyMode = false
        } = await request.json();

        const query = sanitizeInput(rawQuery, 2000);

        // 获取登录用户
        let currentUserId: string | undefined;
        if (!privacyMode) {
            try {
                const supabaseAuth = await createClient();
                const { data: { user } } = await supabaseAuth.auth.getUser();
                currentUserId = user?.id;
            } catch { /* 未登录 */ }
        }

        if (!query || query.length < 2) {
            return NextResponse.json({ success: false, error: '查询内容不能为空且至少 2 个字符' }, { status: 400 });
        }
        if (query.length > 2000) {
            return NextResponse.json({ success: false, error: '查询内容过长，最多 2000 个字符' }, { status: 400 });
        }

        const safeModelProvider = isValidModelProvider(modelProvider) ? modelProvider : 'minimax';

        // 开源版所有功能免费，无需扣费

        const startTime = Date.now();

        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (type: string, data: unknown) => {
                    controller.enqueue(new TextEncoder().encode(JSON.stringify({ type, data }) + '\n'));
                };

                try { // ===== 全局异常兜底 =====

                // 1. 检查缓存（Flash 结果也缓存 24 小时）
                try {
                    const { data: cached } = await supabase
                        .from('search_history')
                        .select('*')
                        .eq('query', query)
                        .eq('scan_mode', 'flash')
                        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (cached && cached.result && !cached.result.isPartial) {
                        console.log(`[Flash API] 缓存命中: "${query}"`);
                        sendEvent('done', { ...cached.result, fromCache: true });
                        controller.close();
                        return;
                    }
                } catch (e: unknown) {
                    console.warn('[Flash API] 缓存读取提示:', (e instanceof Error ? e.message : String(e)));
                }

                console.log(`[Flash API] ⚡ 启动 Flash 分析: "${query}"`);

                // 2. 双轨检索
                let dualTrackResult;
                try {
                    sendEvent('log', '[Flash] ⚡ 启动双轨检索...');
                    dualTrackResult = await searchDualTrack([query], domain) as unknown;
                    if (!dualTrackResult.success) {
                        console.warn('[Flash API] 双轨检索失败:', dualTrackResult.error);
                    } else {
                        sendEvent('context_ready', {
                            academic: dualTrackResult.academic?.results?.slice(0, 4).map((p: unknown) => p.title) || [],
                            industryRepos: dualTrackResult.industry?.githubRepos?.slice(0, 3).map((r: unknown) => r.name) || [],
                            industryWeb: dualTrackResult.industry?.webResults?.slice(0, 3).map((w: unknown) => w.title) || [],
                        });
                    }
                } catch (e: unknown) {
                    console.error('[Flash API] 双轨检索失败:', (e instanceof Error ? e.message : String(e)));
                    sendEvent('error', { message: `双轨检索失败: ${(e instanceof Error ? e.message : String(e))}` });
                    controller.close();
                    return;
                }

                // 3. Flash 编排器分析
                console.log(`[Flash API] ⚡ 启动 Flash 编排器...`);
                const flashResult = await analyzeFlash({
                    query,
                    academicData: dualTrackResult.academic,
                    industryData: dualTrackResult.industry,
                    language: language as 'zh' | 'en',
                    modelProvider: safeModelProvider,
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
                } = flashResult;

                console.log(`[Flash API] ⚡ Flash 完成，综合评分: ${arbitration.overallScore}`);

                const isZh = language === 'zh';

                // 4. 构建结果
                const finalResult = {
                    success: true,
                    scanMode: 'flash' as const,

                    // 原始检索数据
                    academic: dualTrackResult?.academic,
                    industry: dualTrackResult?.industry,
                    crossValidation: dualTrackResult?.crossValidation,
                    finalCredibility: (dualTrackResult as unknown)?.finalCredibility,

                    // 兼容字段
                    noveltyScore: arbitration?.overallScore,
                    summary: arbitration?.summary,
                    recommendation: arbitration?.recommendation,
                    keyDifferentiators: academicReview?.keyFindings?.join('\n'),
                    improvementSuggestions: innovationEvaluation?.redFlags?.join('\n'),

                    sections: {
                        academic: {
                            title: isZh ? '学术界查重审查' : 'Academic Review',
                            subsections: [
                                { title: isZh ? '现有技术树' : 'Prior Art', content: academicReview?.analysis || '' },
                            ]
                        },
                        internet: {
                            title: isZh ? '产业界审查' : 'Industry Review',
                            subsections: [
                                { title: isZh ? '产业现状' : 'Industry Landscape', content: industryAnalysis?.analysis || '' },
                            ]
                        }
                    },
                    keyPoints: [
                        ...(academicReview?.keyFindings || []),
                        ...(industryAnalysis?.keyFindings || []),
                    ].slice(0, 4),
                    similarPapers: buildSimilarPapers(academicReview, dualTrackResult),

                    // Multi-Agent 数据
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
                };

                const searchTimeMs = Date.now() - startTime;

                // 5. 质量门控 + 保存到数据库
                let qualityBlocked = false;
                let qualityTierValue: 'high' | 'medium' | 'low' = 'medium';
                if (!finalResult.isPartial) {
                    try {
                        const { shouldBlockStorage, computeQualityTier } = await import('@/lib/services/ai/qualityGate');
                        const allAgents = [academicReview, industryAnalysis, innovationEvaluation, competitorAnalysis];
                        const blockResult = shouldBlockStorage(qualityCheck, allAgents);
                        qualityTierValue = computeQualityTier(qualityCheck, allAgents);

                        if (blockResult.blocked) {
                            qualityBlocked = true;
                            console.warn(`[Flash API] 🛡️ 质量门控拦截入库: ${blockResult.reason}`);
                        } else {
                            console.log(`[Flash API] 🛡️ 质量门控通过, tier=${qualityTierValue}`);
                        }
                    } catch (e: unknown) {
                        console.warn('[Flash API] 质量门控模块加载失败(降级为允许入库):', (e instanceof Error ? e.message : String(e)));
                    }
                }

                (finalResult as unknown).qualityTier = qualityTierValue;

                if (!finalResult.isPartial && !qualityBlocked && !privacyMode) {
                    try {
                        const { error: insertError } = await supabaseAdmin.from('search_history').insert({
                            query,
                            domain: domain || null,
                            result: finalResult,
                            model_provider: modelProvider,
                            search_time_ms: searchTimeMs,
                            scan_mode: 'flash',
                            user_id: currentUserId || null,
                        });
                        if (insertError) throw insertError;
                        console.log(`[Flash API] 结果已存入数据库: "${query}"`);
                    } catch (e: unknown) {
                        console.warn('[Flash API] 保存到数据库失败:', (e instanceof Error ? e.message : String(e)));
                    }

                    // 创新点提取（传递质量等级）
                    try {
                        const { handleSearchComplete } = await import('@/lib/services/innovation/innovationService');
                        await handleSearchComplete(query, finalResult, qualityTierValue);
                    } catch (e: unknown) {
                        console.warn('[Flash API] 创新点存储失败:', (e instanceof Error ? e.message : String(e)));
                    }
                } else if (qualityBlocked) {
                    console.log(`[Flash API] 🛡️ 质量检查未通过，跳过缓存和创新点入库: "${query}"`);
                }

                // 6. 记录用户偏好
                if (!privacyMode) {
                    recordSearchEvent({
                        userId: currentUserId,
                        anonymousId: anonymousId || undefined,
                        query,
                        domainId: domainId || undefined,
                        subDomainId: subDomainId || undefined,
                        modelUsed: modelProvider,
                        noveltyScore: finalResult.noveltyScore,
                    }).catch(err => console.warn('[Flash API] 偏好记录失败:', err.message));
                }

                // 7. 后台异步触发专业报告预生成（不阻塞主流程返回）
                if (!finalResult.isPartial && !qualityBlocked && !privacyMode) {
                    import('@/server/report/reportWriter').then(({ generateProfessionalReport }) => {
                        generateProfessionalReport(
                            query, finalResult, dualTrackResult,
                            language as 'zh' | 'en', safeModelProvider,
                        ).then(async (profReport) => {
                            const { error } = await supabaseAdmin
                                .from('search_history')
                                .update({ professional_report: profReport })
                                .eq('query', query)
                                .eq('scan_mode', 'flash')
                                .order('created_at', { ascending: false })
                                .limit(1);
                            if (error) {
                                console.warn('[Flash API] 📄 报告回写失败:', error.message);
                            } else {
                                console.log(`[Flash API] 📄 专业报告预生成完成并已存入`);
                            }
                        }).catch((err: unknown) => {
                            console.warn('[Flash API] 📄 报告预生成失败(不影响主流程):', err.message);
                        });
                    }).catch(() => { });
                }

                sendEvent('done', finalResult);
                controller.close();

                } catch (fatalError: unknown) {
                    // ===== Flash 全局异常兜底 =====
                    console.error('[Flash API] 💀 致命异常:', fatalError?.message || fatalError);

                    // 📝 写入失败记录到 search_history
                    if (!privacyMode) {
                        try {
                            await supabaseAdmin.from('search_history').insert({
                                query,
                                domain: domain || null,
                                model_provider: safeModelProvider,
                                search_time_ms: Date.now() - startTime,
                                scan_mode: 'flash',
                                user_id: currentUserId || null,
                                result: {
                                    success: false,
                                    error: fatalError?.message || String(fatalError),
                                    errorType: 'FatalError',
                                    scanMode: 'flash',
                                    isPartial: true,
                                },
                            });
                            console.log(`[Flash API] 📝 致命异常记录已写入 search_history`);
                        } catch (logErr: unknown) {
                            console.warn('[Flash API] 失败记录写入数据库失败:', logErr.message);
                        }
                    }

                    try {
                        sendEvent('error', { message: 'Flash 分析发生内部错误，请重试' });
                    } catch { /* 写入失败则忽略 */ }
                    try { controller.close(); } catch { }
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: unknown) {
        return safeErrorResponse(error, 'Flash 分析请求处理失败', 500, '[Flash API]');
    }
}
