export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 多 Agent 分析流程需要 120-240 秒，设为 Vercel Pro 最大值

import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { searchDualTrack } from '@/server/search/dual-track';
import { analyzeWithMultiAgents, AllAgentsFailedError } from '@/agents/orchestrator';
import { recordSearchEvent } from '@/lib/services/user/userPreferenceService';
import { createClient } from '@/utils/supabase/server';
import { checkRateLimit, sanitizeInput, isValidModelProvider, safeErrorResponse } from '@/lib/security/apiSecurity';
import { chargeForFeature, FEATURE_COSTS } from '@/lib/featureCosts';
import { addPoints } from '@/lib/services/walletService';

// ==================== 辅助函数 ====================

/** 顶刊/顶会名单（用于 authorityLevel 推断） */
const TOP_VENUES = new Set([
  'nature', 'science', 'cell', 'pnas',
  'neurips', 'nips', 'icml', 'iclr', 'cvpr', 'iccv', 'eccv',
  'acl', 'emnlp', 'naacl', 'aaai', 'ijcai',
  'sigmod', 'vldb', 'icde', 'kdd', 'www',
  'ieee transactions', 'acm transactions',
]);

/** 推断论文权威度 */
function inferAuthorityLevel(citationCount: number, venue: string): 'high' | 'medium' | 'low' {
  const venueLower = (venue || '').toLowerCase();
  const isTopVenue = Array.from(TOP_VENUES).some(v => venueLower.includes(v));
  if (isTopVenue || citationCount > 100) return 'high';
  if (citationCount >= 20 || venueLower.length > 0) return 'medium';
  return 'low';
}

/**
 * 构建 similarPapers 数据
 * 优先使用学术审查员 Agent 的 AI 语义评估结果，
 * 兜底时从原始检索数据映射（修正所有字段）
 */
function buildSimilarPapers(academicReview: any, dualTrackResult: any): any[] {
  // 优先方案：使用 Agent 的 AI 语义评估
  if (academicReview?.similarPapers?.length > 0) {
    console.log(`[API Analyze] 使用 Agent AI 评估的 similarPapers (${academicReview.similarPapers.length} 篇)`);
    return academicReview.similarPapers
      .filter((p: any) => p.title && typeof p.similarityScore === 'number')
      .sort((a: any, b: any) => (b.similarityScore || 0) - (a.similarityScore || 0))
      .slice(0, 6);
  }

  // 兜底方案：从原始检索数据构建（修正全部字段映射）
  console.log('[API Analyze] Agent 未输出 similarPapers，使用原始数据兜底构建');
  const papers = dualTrackResult?.academic?.results || [];
  if (papers.length === 0) return [];

  return papers.slice(0, 6).map((p: any) => {
    const citationCount = p.citationCount || 0;
    const venue = p.venue || '';

    return {
      title: p.title || '',
      year: p.year || 0,
      // 兜底相似度：基于检索排名递减（第 1 篇 65，逐步降低），
      // 避免之前全部默认 70 的问题
      similarityScore: Math.max(30, 65 - papers.indexOf(p) * 5),
      keyDifference: p.topics?.length > 0
        ? `相关研究领域：${p.topics.slice(0, 3).join('、')}`
        : (p.abstract ? p.abstract.slice(0, 80) + '...' : ''),
      description: p.abstract ? p.abstract.slice(0, 120) + '...' : '',
      citation: p.citation || '',
      authors: Array.isArray(p.authors) ? p.authors.join(', ') : (p.authors || ''),
      url: p.url || '',
      citationCount,
      venue,
      authorityLevel: inferAuthorityLevel(citationCount, venue),
    };
  });
}

export async function POST(request: Request) {
  try {
    // 🔒 速率限制（5次/分钟）
    const rateLimitRes = await checkRateLimit(request, 'analyze', 5);
    if (rateLimitRes) return rateLimitRes;

    const { query: rawQuery, domain, language = 'zh', modelProvider = 'minimax', domainId, subDomainId, domainHint, anonymousId, privacyMode = false } = await request.json();

    // 输入验证加固
    const query = sanitizeInput(rawQuery, 2000);

    // 获取当前登录用户（如有）— 隐私模式下跳过
    let currentUserId: string | undefined;
    if (!privacyMode) {
      try {
        const supabaseAuth = await createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        currentUserId = user?.id;
      } catch { /* 未登录，忽略 */ }
    }

    if (!query || query.length < 2) {
      return NextResponse.json({ success: false, error: '查询内容不能为空且至少 2 个字符' }, { status: 400 });
    }

    if (query.length > 2000) {
      return NextResponse.json({ success: false, error: '查询内容过长，最多 2000 个字符' }, { status: 400 });
    }

    // 模型白名单校验
    const safeModelProvider = isValidModelProvider(modelProvider) ? modelProvider : 'minimax';

    // ==================== 💰 点数扣费 ====================
    if (currentUserId) {
      // 已登录用户：扣费（缓存命中时后续会跳过扣费，此处先预扣）
      const charge = await chargeForFeature(currentUserId, 'novoscan-full');
      if (!charge.success) {
        return NextResponse.json(
          { success: false, error: charge.error, currentBalance: charge.currentBalance, required: charge.required },
          { status: 402 }
        );
      }
    } else {
      // 未登录用户：基于 IP hash 限制一次免费
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
      const ipHash = Array.from(ip).reduce((h, c) => 0 | (31 * h + c.charCodeAt(0)), 0).toString();

      try {
        const { data: existing } = await supabaseAdmin
          .from('anonymous_usage')
          .select('id')
          .eq('ip_hash', ipHash)
          .eq('feature', 'novoscan-full')
          .limit(1);

        if (existing && existing.length > 0) {
          return NextResponse.json(
            { success: false, error: '免费体验次数已用完，请登录后继续使用', requireLogin: true },
            { status: 401 }
          );
        }

        // 记录本次免费使用
        await supabaseAdmin.from('anonymous_usage').insert({
          ip_hash: ipHash,
          feature: 'novoscan-full',
        });
      } catch (e: any) {
        // 表不存在时跳过（首次部署可能未建表），不阻塞主流程
        console.warn('[API Analyze] 匿名使用记录失败:', e.message);
      }
    }

    const startTime = Date.now();

    // ==================== 双轨检索超时保护 ====================
    const DUAL_TRACK_TIMEOUT = 30000;

    const stream = new ReadableStream({
      async start(controller) {
        // 幂等关闭保护：防止多次 close() 导致异常
        let isClosed = false;
        const safeClose = () => {
          if (!isClosed) { isClosed = true; try { controller.close(); } catch { } }
        };

        // 心跳机制：每 15s 发送 ping，防止 Vercel/CDN 空闲断连
        const heartbeatInterval = setInterval(() => {
          if (!isClosed) {
            try {
              controller.enqueue(new TextEncoder().encode(
                JSON.stringify({ type: 'ping', data: { ts: Date.now() } }) + '\n'
              ));
            } catch { /* 流可能已关闭，忽略 */ }
          }
        }, 15000);

        const sendEvent = (type: string, data: any) => {
          if (isClosed) return; // 流已关闭则忽略后续写入
          try {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type, data }) + '\n'));
          } catch { /* 写入失败时忽略（流可能已断开） */ }
        };

        try { // ===== 全局异常兜底 =====

          // 1. 检查缓存（24小时内）
          try {
            const { data: cached } = await supabase
              .from('search_history')
              .select('*')
              .eq('query', query)
              .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (cached && cached.result) {
              const cachedResult = cached.result;

              // 跳过降级/超时的缓存结果，强制重新分析
              const isCachedPartial = cachedResult.isPartial || cachedResult.arbitration?.isPartial;
              if (isCachedPartial) {
                console.log(`[API Analyze] 缓存命中但为降级结果，跳过: "${query}"`);
              } else {
                console.log(`[API Analyze] 缓存命中: "${query}"`);

                // 即使缓存命中，也触发创新点提取和检索事件记录（追踪用户关注度趋势）
                // 隐私模式下跳过
                if (!privacyMode) {
                  try {
                    const { handleSearchComplete } = await import('@/lib/services/innovation/innovationService');
                    handleSearchComplete(query, cachedResult).catch(console.error);
                  } catch (e: any) {
                    console.warn('[API Analyze] 缓存命中时趋势事件记录失败(不影响主流程):', e.message);
                  }

                  // 记录用户搜索事件（与非缓存路径一致）
                  recordSearchEvent({
                    userId: currentUserId,
                    anonymousId: anonymousId || undefined,
                    query,
                    domainId: domainId || undefined,
                    subDomainId: subDomainId || undefined,
                    modelUsed: modelProvider,
                    noveltyScore: cachedResult.noveltyScore || cachedResult.arbitration?.overallScore,
                    practicalScore: cachedResult.practicalScore,
                  }).catch(() => { });

                  // 🔧 IDEA 行为信号收集（缓存命中时也需要记录，否则行为验证进度永远为 0）
                  if (currentUserId) {
                    import('@/lib/services/innovation/ideaBehaviorService').then(({ recordBehaviorSignal }) => {
                      recordBehaviorSignal({
                        userId: currentUserId!,
                        type: 'search',
                        query,
                        domainId: domainId || undefined,
                        noveltyScore: cachedResult.noveltyScore || cachedResult.arbitration?.overallScore,
                      }).catch(() => { });
                    }).catch(() => { });
                  }
                }

                // 判断是新格式还是旧格式
                const isNewFormat = cachedResult.isMultiAgent === true || cachedResult.arbitration !== undefined;

                if (isNewFormat) {
                  // 新格式：直接返回
                  sendEvent('done', {
                    ...cachedResult,
                    fromCache: true,
                    cacheSavedMs: Date.now() - new Date(cached.created_at).getTime()
                  });
                  controller.close();
                  return;
                } else {
                  // 旧格式：转换为兼容格式
                  console.log(`[API Analyze] 旧格式缓存，转换中...`);
                  sendEvent('done', {
                    ...cachedResult,
                    // 给新字段默认值
                    academicReview: null,
                    industryAnalysis: null,
                    innovationEvaluation: null,
                    competitorAnalysis: null,
                    arbitration: {
                      overallScore: cachedResult.noveltyScore,
                      summary: cachedResult.summary,
                      recommendation: cachedResult.recommendation,
                      conflictsResolved: [],
                      nextSteps: []
                    },
                    qualityCheck: { passed: true, issues: [] },
                    isMultiAgent: false,
                    fromCache: true,
                    cacheSavedMs: Date.now() - new Date(cached.created_at).getTime()
                  });
                  controller.close();
                  return;
                }
              }
            }
          } catch (e: any) {
            console.warn('[API Analyze] 缓存读取提示:', e.message);
          }

          console.log(`[API Analyze] 开始双轨检索: "${query}"`);

          // 2. 调用双轨检索（带 30s 超时保护）
          let dualTrackResult;
          try {
            sendEvent('log', '[Orchestrator] 启动双轨检索...');
            dualTrackResult = await Promise.race([
              searchDualTrack([query], domain),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('双轨检索超时(30s)')), DUAL_TRACK_TIMEOUT)
              )
            ]) as any;
            if (!dualTrackResult.success) {
              console.warn('[API Analyze] 双轨检索返回失败:', (dualTrackResult as any).error);
            } else {
              // 将检索到的真实基础上下文发送给前端，用于渲染真实的“加载中”信息 (代替模拟日志)
              sendEvent('context_ready', {
                academic: dualTrackResult.academic?.results?.slice(0, 6).map((p: any) => p.title) || [],
                industryRepos: dualTrackResult.industry?.githubRepos?.slice(0, 5).map((r: any) => r.name) || [],
                industryWeb: dualTrackResult.industry?.webResults?.slice(0, 5).map((w: any) => w.title) || []
              });
            }
          } catch (e: any) {
            console.error('[API Analyze] 双轨检索失败/超时:', e.message);
            sendEvent('log', `[Orchestrator] ⚠️ 检索异常(${e.message})，使用空数据继续分析`);
            // 构造降级空数据，确保后续 Agent 流程可继续执行
            dualTrackResult = {
              success: false,
              academic: {
                source: 'quad', results: [],
                stats: {
                  totalPapers: 0, totalCitations: 0, openAccessCount: 0, avgCitation: 0,
                  bySource: { openAlex: 0, arxiv: 0, crossref: 0, core: 0 },
                  topCategories: [], topConcepts: []
                },
                topConcepts: []
              },
              industry: {
                source: 'triple', webResults: [], githubRepos: [], wechatArticles: [],
                sentiment: 'cold', hasOpenSource: false, topProjects: [],
                webSources: { brave: 0, serpapi: 0 }
              },
              crossValidation: null, finalCredibility: null,
            };
          }

          // ========== NovoDNA 方向二：DNA -> 搜索（搜索前预洞察） ==========
          let dnaInsightSummary = '';
          try {
            const { preScanDNAInsight } = await import('@/lib/services/innovation/dnaFeedbackLoop');
            const insight = await preScanDNAInsight(query);
            if (insight.hasInsight) {
              dnaInsightSummary = insight.insightSummary;
              sendEvent('novodna_prescan', {
                genePoolSize: insight.genePoolSize,
                crowdingWarning: insight.crowdingWarning,
                similarQueries: insight.similarQueries.slice(0, 3),
                enhancedKeywords: insight.enhancedKeywords,
              });
              console.log(`[API Analyze] NovoDNA 预洞察: 基因库=${insight.genePoolSize}, 密度=${insight.crowdingWarning}`);
            }
          } catch (e: any) {
            console.warn('[API Analyze] NovoDNA 预洞察失败(不影响主流程):', e.message);
          }

          // 3. 调用 Multi-agents 分析
          console.log(`[API Analyze] 启动 Multi-agents 分析...`);
          const multiAgentResult = await analyzeWithMultiAgents({
            query,
            academicData: dualTrackResult.academic,
            industryData: dualTrackResult.industry,
            language: language as 'zh' | 'en',
            modelProvider: safeModelProvider,
            domainId: domainId || undefined,
            subDomainId: subDomainId || undefined,
            domainHint: domainHint || undefined,
            dnaInsight: dnaInsightSummary || undefined,
            onProgress: (type, data) => sendEvent(type, data)
          });

          const {
            academicReview,
            industryAnalysis,
            innovationEvaluation,
            competitorAnalysis,
            crossDomainTransfer,
            debate,
            arbitration,
            qualityCheck,
            executionRecord,
            memoryInsight
          } = multiAgentResult;

          console.log(`[API Analyze] Multi-agents 完成，综合评分: ${arbitration.overallScore}`);

          const isZh = language === 'zh';

          // 4. 合成产业实践可行性评分（多源加权）
          // 数据源：产业分析员 Agent 50% + 仲裁员加权校正 30% + 双轨可信度 20%
          let practicalScore: number | undefined;
          {
            const agentScore = industryAnalysis?.score;
            const arbIndustryScore = arbitration?.weightedBreakdown?.industry?.raw;
            const credScore = (dualTrackResult as any)?.finalCredibility?.score;

            // 收集可用数据源及其权重
            const sources: { value: number; weight: number }[] = [];
            if (typeof agentScore === 'number' && agentScore > 0) sources.push({ value: agentScore, weight: 0.50 });
            if (typeof arbIndustryScore === 'number' && arbIndustryScore > 0) sources.push({ value: arbIndustryScore, weight: 0.30 });
            if (typeof credScore === 'number' && credScore > 0) sources.push({ value: credScore, weight: 0.20 });

            if (sources.length > 0) {
              // 动态重分配权重（当某源缺失时，按比例放大剩余源的权重）
              const totalWeight = sources.reduce((s, src) => s + src.weight, 0);
              practicalScore = Math.round(
                sources.reduce((s, src) => s + src.value * (src.weight / totalWeight), 0)
              );
              practicalScore = Math.max(0, Math.min(100, practicalScore));
              console.log(`[API Analyze] [practicalScore] 合成: ${practicalScore} (来源: agent=${agentScore}, arb=${arbIndustryScore}, cred=${credScore})`);
            }
          }

          // 5. 构建最终结果（兼容新旧两种格式）
          const finalResult = {
            success: true,

            // ===== 原有字段（兼容旧数据）=====
            academic: dualTrackResult?.academic,
            industry: dualTrackResult?.industry,
            crossValidation: dualTrackResult?.crossValidation,
            finalCredibility: (dualTrackResult as any)?.finalCredibility,
            credibility: (dualTrackResult as any)?.credibility,

            // 兼容字段：从仲裁结果映射
            noveltyScore: arbitration?.overallScore,
            practicalScore,
            summary: arbitration?.summary,
            recommendation: arbitration?.recommendation,
            keyDifferentiators: academicReview?.keyFindings?.join('\n'),
            improvementSuggestions: innovationEvaluation?.redFlags?.join('\n'),

            // AI 生成内容
            sections: {
              academic: {
                title: isZh ? '学术界查重审查' : 'Academic Prior Art Review',
                subsections: [
                  { title: isZh ? '现有技术树' : 'Prior Art Tree', content: academicReview?.analysis || '' },
                  { title: isZh ? '学术支撑度' : 'Academic Support', content: `Score: ${academicReview?.score}/100` }
                ]
              },
              internet: {
                title: isZh ? '全网/产业界查重审查' : 'Global Internet & Industry Review',
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
            similarPapers: buildSimilarPapers(academicReview, dualTrackResult),

            // ===== 新增 Multi-agents 完整数据 =====
            academicReview,
            industryAnalysis,
            innovationEvaluation,
            competitorAnalysis,
            debate,
            arbitration,
            qualityCheck,
            executionRecord,

            // 元数据
            usedModel: modelProvider,
            fromCache: false,
            isMultiAgent: true,  // 标记为新格式
            isPartial: !!arbitration?.isPartial,  // 是否为降级/超时结果

            // NovoStarchart 六维创新性雷达图数据
            innovationRadar: innovationEvaluation?.innovationRadar || null,

            // 🆕 跨域创新迁移引擎数据
            crossDomainTransfer: crossDomainTransfer && !crossDomainTransfer.isFallback ? crossDomainTransfer : null,

            // 🧠 Agent 记忆进化数据
            memoryInsight: memoryInsight || null,
          };

          const searchTimeMs = Date.now() - startTime;

          // 5. 质量门控 + 保存到数据库（三层防护）
          const isPartialResult = finalResult.isPartial;

          // 🛡️ 质量门控：在 isPartial 之上叠加质量检查
          let qualityBlocked = false;
          let qualityTierValue: 'high' | 'medium' | 'low' = 'medium';
          if (!isPartialResult) {
            try {
              const { shouldBlockStorage, computeQualityTier } = await import('@/lib/services/ai/qualityGate');
              const allAgents = [academicReview, industryAnalysis, innovationEvaluation, competitorAnalysis];
              const blockResult = shouldBlockStorage(qualityCheck, allAgents);
              qualityTierValue = computeQualityTier(qualityCheck, allAgents);

              if (blockResult.blocked) {
                qualityBlocked = true;
                console.warn(`[API Analyze] 🛡️ 质量门控拦截入库: ${blockResult.reason}`);
              } else {
                console.log(`[API Analyze] 🛡️ 质量门控通过, tier=${qualityTierValue}`);
              }
            } catch (e: any) {
              console.warn('[API Analyze] 质量门控模块加载失败(降级为允许入库):', e.message);
            }
          }

          // 在 finalResult 中附加质量等级
          (finalResult as any).qualityTier = qualityTierValue;

          if (!isPartialResult && !qualityBlocked && !privacyMode) {
            try {
              const { error: insertError } = await supabaseAdmin.from('search_history').insert({
                query,
                domain: domain || null,
                result: finalResult,
                model_provider: modelProvider,
                search_time_ms: searchTimeMs,
                user_id: currentUserId || null,
              });
              if (insertError) throw insertError;
              console.log(`[API Analyze] 结果已存入数据库: "${query}"`);
            } catch (e: any) {
              console.warn('[API Analyze] 保存到数据库失败:', e.message);
            }

            // 6. 提取创新点并存入 innovations 表（传递质量等级用于分级入库）
            try {
              const { handleSearchComplete } = await import('@/lib/services/innovation/innovationService');
              await handleSearchComplete(query, finalResult, qualityTierValue);
              console.log(`[API Analyze] 创新点已提取并存储到 innovations 表 (tier=${qualityTierValue})`);
            } catch (e: any) {
              console.warn('[API Analyze] 创新点存储失败(不影响主流程):', e.message);
            }
          } else if (isPartialResult) {
            console.log(`[API Analyze] 结果为降级/超时，不存入缓存: "${query}"`);
          } else if (qualityBlocked) {
            console.log(`[API Analyze] 🛡️ 质量检查未通过，跳过缓存和创新点入库: "${query}"`);
          } else {
            console.log(`[API Analyze] 隐私模式，跳过数据库存储和创新点提取: "${query}"`);
          }

          // 7. 异步记录用户搜索事件（不阻塞主流程）— 隐私模式下跳过
          if (!privacyMode) {
            recordSearchEvent({
              userId: currentUserId,
              anonymousId: anonymousId || undefined,
              query,
              domainId: domainId || undefined,
              subDomainId: subDomainId || undefined,
              modelUsed: modelProvider,
              noveltyScore: finalResult.noveltyScore,
              practicalScore: finalResult.practicalScore,
            }).catch(err => console.warn('[API Analyze] 偏好记录失败(不影响主流程):', err.message));

            // IDEA 行为信号收集（静默、不阻塞）
            if (currentUserId) {
              import('@/lib/services/innovation/ideaBehaviorService').then(({ recordBehaviorSignal }) => {
                recordBehaviorSignal({
                  userId: currentUserId!,
                  type: 'search',
                  query,
                  domainId: domainId || undefined,
                  noveltyScore: finalResult.noveltyScore,
                }).catch(() => { });
              }).catch(() => { });
            }
          }

          // 8. NovoDNA 图谱构建 + 双向进化闭环

          // 7.5 Agent 记忆进化：保存本次分析经验（质量门控通过时才保存，避免不可靠经验污染记忆库）
          if (!isPartialResult && !qualityBlocked && !privacyMode) {
            try {
              const { saveExperience } = await import('@/lib/services/agentMemoryService');
              await saveExperience(
                query, multiAgentResult, domainId, subDomainId,
                Date.now() - startTime, safeModelProvider
              );
              console.log(`[API Analyze] 🧠 Agent 经验已保存到记忆库`);
            } catch (e: any) {
              console.warn('[API Analyze] 经验保存失败(不影响主流程):', e.message);
            }
          }
          try {
            const { buildInnovationMap } = await import('@/lib/services/innovation/innovationDNA');
            const dnaContext = arbitration?.summary || innovationEvaluation?.analysis || '';
            const dnaMap = await buildInnovationMap(query, dnaContext, safeModelProvider);
            (finalResult as any).innovationDNA = dnaMap;
            console.log(`[API Analyze] NovoDNA 图谱完成: [${dnaMap.vector.join(', ')}]`);

            // ========== NovoDNA 方向二：DNA -> 搜索（搜索后加权修正） ==========
            if (dnaMap.density) {
              const { postSearchDNARanking, evolutionaryFeedback } = await import('@/lib/services/innovation/dnaFeedbackLoop');
              const ranking = postSearchDNARanking(
                dnaMap.density.uniquenessScore,
                dnaMap.density.overallCrowding,
                finalResult.noveltyScore ?? arbitration.overallScore,
                dnaMap.density.totalInnovations,
              );
              if (ranking.adjusted) {
                (finalResult as any).novoDNARanking = ranking;
                console.log(`[API Analyze] NovoDNA 加权: ${ranking.originalScore} -> ${ranking.adjustedScore} (${ranking.reason})`);
              }

              // ========== NovoDNA 方向一：搜索 -> DNA（进化反馈） ==========
              const { generateQueryHash } = await import('@/lib/services/innovation/innovationService');
              const qHash = await generateQueryHash(query);
              const compCount = (dualTrackResult?.industry?.githubRepos?.length || 0)
                + (dualTrackResult?.industry?.webResults?.length || 0);
              evolutionaryFeedback(
                qHash, dnaMap.density.uniquenessScore,
                finalResult.noveltyScore ?? arbitration.overallScore, compCount,
              ).catch(e => console.warn('[API Analyze] 进化反馈失败:', e.message));
            }
          } catch (e: any) {
            console.warn('[API Analyze] Innovation DNA 构建失败(不影响主流程):', e.message);
          }

          // 9. Async store cross-domain bridges + incremental knowledge graph merging
          if (crossDomainTransfer && !crossDomainTransfer.isFallback && crossDomainTransfer.bridges?.length > 0) {
            try {
              const { storeCrossDomainBridges, buildGlobalCrossFieldGraph, mergeKnowledgeGraphs } = await import('@/lib/services/innovation/crossDomainService');
              await storeCrossDomainBridges(
                query,
                crossDomainTransfer.bridges,
                crossDomainTransfer.knowledgeGraph
              );
              console.log(`[API Analyze] Cross-domain bridges stored: ${crossDomainTransfer.bridges.length}`);

              // Incremental knowledge graph: merge current + global historical graph
              try {
                const globalGraph = await buildGlobalCrossFieldGraph(30);
                if (globalGraph.nodes.length > 0) {
                  const mergedGraph = mergeKnowledgeGraphs(
                    crossDomainTransfer.knowledgeGraph,
                    globalGraph
                  );
                  // Update the finalResult with the merged graph
                  if (finalResult.crossDomainTransfer) {
                    finalResult.crossDomainTransfer = {
                      ...finalResult.crossDomainTransfer,
                      knowledgeGraph: mergedGraph,
                    };
                  }
                  console.log(`[API Analyze] Knowledge graph merged: ${mergedGraph.nodes.length} nodes, ${mergedGraph.edges.length} edges`);
                }
              } catch (graphErr: any) {
                console.warn('[API Analyze] Global graph merge failed (non-blocking):', graphErr.message);
              }
            } catch (e: any) {
              console.warn('[API Analyze] Cross-domain bridge storage failed (non-blocking):', e.message);
            }
          }

          // 10. 后台异步触发专业报告预生成（不阻塞主流程返回）
          if (!isPartialResult && !qualityBlocked && !privacyMode) {
            import('@/server/report/reportWriter').then(({ generateProfessionalReport }) => {
              generateProfessionalReport(
                query, finalResult, dualTrackResult,
                language as 'zh' | 'en', safeModelProvider,
              ).then(async (profReport) => {
                const { error } = await supabaseAdmin
                  .from('search_history')
                  .update({ professional_report: profReport })
                  .eq('query', query)
                  .order('created_at', { ascending: false })
                  .limit(1);
                if (error) {
                  console.warn('[API Analyze] 📄 报告回写失败:', error.message);
                } else {
                  console.log(`[API Analyze] 📄 专业报告预生成完成并已存入`);
                }
              }).catch((err: any) => {
                console.warn('[API Analyze] 📄 报告预生成失败(不影响主流程):', err.message);
              });
            }).catch(() => { });
          }

          sendEvent('done', finalResult);
          clearInterval(heartbeatInterval);
          safeClose();

        } catch (fatalError: any) {
          // ===== 全员失败熔断：AI API 完全不可用，退费并通知前端 =====
          if (fatalError instanceof AllAgentsFailedError) {
            console.error('[API Analyze] 🚨 全员失败熔断:', fatalError.message);
            // 退费：已登录用户退还预扣点数
            if (currentUserId) {
              try {
                const cost = FEATURE_COSTS['novoscan-full'];
                await addPoints(currentUserId, cost, 'AI 服务不可用自动退费');
                console.log(`[API Analyze] 💰 已为用户 ${currentUserId} 退还 ${cost} 点`);
              } catch (refundErr: any) {
                console.error('[API Analyze] 退费失败:', refundErr.message);
              }
            }

            // 📝 写入失败记录到 search_history
            if (!privacyMode) {
              try {
                await supabaseAdmin.from('search_history').insert({
                  query,
                  domain: domain || null,
                  model_provider: safeModelProvider,
                  search_time_ms: Date.now() - startTime,
                  user_id: currentUserId || null,
                  result: {
                    success: false,
                    error: fatalError.message,
                    errorType: 'AllAgentsFailedError',
                    failedAgents: fatalError.failedAgents,
                    modelProvider: fatalError.modelProvider || safeModelProvider,
                    isPartial: true,
                  },
                });
                console.log(`[API Analyze] 📝 全员失败记录已写入 search_history`);
              } catch (logErr: any) {
                console.warn('[API Analyze] 失败记录写入数据库失败:', logErr.message);
              }
            }

            try {
              controller.enqueue(new TextEncoder().encode(
                JSON.stringify({
                  type: 'all_agents_failed',
                  data: {
                    message: fatalError.message,
                    failedAgents: fatalError.failedAgents,
                    modelProvider: fatalError.modelProvider || safeModelProvider,
                    refunded: !!currentUserId,
                  }
                }) + '\n'
              ));
            } catch { /* 写入失败则忽略 */ }
            clearInterval(heartbeatInterval);
            safeClose();
            return;
          }

          // ===== 其他全局异常兜底：确保前端不会无限等待 =====
          console.error('[API Analyze] 💀 致命异常:', fatalError?.message || fatalError);

          // 📝 写入失败记录到 search_history
          if (!privacyMode) {
            try {
              await supabaseAdmin.from('search_history').insert({
                query,
                domain: domain || null,
                model_provider: safeModelProvider,
                search_time_ms: Date.now() - startTime,
                user_id: currentUserId || null,
                result: {
                  success: false,
                  error: fatalError?.message || String(fatalError),
                  errorType: 'FatalError',
                  isPartial: true,
                },
              });
              console.log(`[API Analyze] 📝 致命异常记录已写入 search_history`);
            } catch (logErr: any) {
              console.warn('[API Analyze] 失败记录写入数据库失败:', logErr.message);
            }
          }

          try {
            controller.enqueue(new TextEncoder().encode(
              JSON.stringify({ type: 'error', data: { message: '分析流程发生内部错误，请重试' } }) + '\n'
            ));
          } catch { /* 写入失败则忽略 */ }
          clearInterval(heartbeatInterval);
          safeClose();
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

  } catch (error: any) {
    return safeErrorResponse(error, '分析请求处理失败，请稍后重试', 500, '[API Analyze]');
  }
}

