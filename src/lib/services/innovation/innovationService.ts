import { db, adminDb } from '@/lib/db/factory';
import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import { assignDomain } from './domainService';

/**
 * 从 AI 分析结果提取创新点（智能中文关键词提取）
 */
export async function extractInnovationsFromAnalysis(
    idea: string,
    analysisResult: Record<string, unknown>
): Promise<Array<{ keyword: string; category: string; noveltyScore: number }>> {
    try {
        const prompt = `
你是一个专业的学术和商业创新点提取专家。请根据以下用户的输入(Idea)及其分析报告(Analysis Result)，提取3-5个最核心的高价值创新点（中文关键词）。
每个关键词必须简短精炼（2-8字），例如“稀疏注意力优化”或“非侵入脑机接口”。

[用户 Idea]
${idea}

[关键差异点 (Key Differentiators)]
${analysisResult?.keyDifferentiators || '无'}

[学术核心发现 (Academic Findings)]
${(analysisResult?.academicReview as Record<string, unknown> | undefined)?.keyFindings ? ((analysisResult.academicReview as Record<string, unknown>).keyFindings as string[]).join('\n') : '无'}

[产业差异化 (Industry Differentiators)]
${(analysisResult?.industryAnalysis as Record<string, unknown> | undefined)?.keyFindings ? ((analysisResult.industryAnalysis as Record<string, unknown>).keyFindings as string[]).join('\n') : '无'}

请严格以 JSON 数组格式返回结果，包含 keyword, category 和 noveltyScore 字段。
注意旧类别(category)请继续评估，仅限：'tech', 'healthcare', 'business', 'method', 或 'other'。
根据内容判断最贴合的类别。由于展示要求，请给这些关键词赋予较高的创新分(75-95之间)。

返回格式示例：
\`\`\`json
[
  { "keyword": "稀疏注意力机制", "category": "tech", "noveltyScore": 88 },
  { "keyword": "多模态医疗影像", "category": "healthcare", "noveltyScore": 82 }
]
\`\`\`
        `;

        const { text } = await callAIRaw(prompt, 'deepseek', 15000, 100000);
        const extracted = parseAgentJSON<Array<{ keyword: string; category: string; noveltyScore: number }>>(text);

        if (Array.isArray(extracted) && extracted.length > 0) {
            return extracted.slice(0, 5);
        }
    } catch (error) {
        console.error('[InnovationService] AI 提取创新点失败，降级到保守策略:', error);
    }

    // 保底：降级策略
    const fallback: Array<{ keyword: string; category: string; noveltyScore: number }> = [];

    // 如果上面没匹配到,从 analysisResult.keyDifferentiators 提取
    if (analysisResult?.keyDifferentiators) {
        const keyPoints = (analysisResult.keyDifferentiators as string)
            .split('\n')
            .filter((line: string) => line.includes('**'))
            .slice(0, 3);

        keyPoints.forEach((point: string, idx: number) => {
            const match = point.match(/\*\*(.*?)\*\*/);
            if (match) {
                fallback.push({
                    keyword: match[1].replace(/\(.*?\)/g, '').trim().substring(0, 15),
                    category: 'tech',
                    noveltyScore: 75 - idx * 5,
                });
            }
        });
    }

    // 保底
    if (fallback.length === 0) {
        fallback.push({ keyword: '智能创新方案', category: 'tech', noveltyScore: 70 });
    }

    return fallback;
}

/**
 * 存储创新点到 Supabase
 */
export async function storeInnovations(
    innovations: Array<{ keyword: string; category: string; noveltyScore: number }>,
    sourceIdeaHash: string,
    qualityTier?: 'high' | 'medium' | 'low'
): Promise<{ storedIds: string[]; eventPayloads: Array<{ innovationId: string; domainId?: string; subDomainId?: string }> }> {
    const storedIds: string[] = [];
    const eventPayloads: Array<{ innovationId: string; domainId?: string; subDomainId?: string }> = [];

    for (const inv of innovations) {
        const normalized = inv.keyword.toLowerCase().trim();

        try {
            // 检查是否已存在
            const { data: existing } = await db
                .from('innovations')
                .select('innovation_id, search_count, domain_id, sub_domain_id')
                .ilike('keyword_normalized', normalized)
                .maybeSingle();

            if (existing) {
                // 更新搜索次数
                await adminDb
                    .from('innovations')
                    .update({
                        search_count: (existing.search_count || 0) + 1,
                        last_seen_at: new Date().toISOString(),
                    })
                    .eq('innovation_id', existing.innovation_id);
                storedIds.push(existing.innovation_id);
                // 收集事件数据（用于趋势分析）
                eventPayloads.push({
                    innovationId: existing.innovation_id,
                    domainId: existing.domain_id,
                    subDomainId: existing.sub_domain_id,
                });
            } else {
                // 插入新记录，追加关联子领域计算
                const domainInfo = await assignDomain(inv.keyword, inv.category);

                const insertPayload: Record<string, unknown> = {
                    keyword: inv.keyword,
                    keyword_normalized: normalized,
                    category: inv.category,
                    novelty_score: inv.noveltyScore,
                    source_idea_hash: sourceIdeaHash,
                    domain_id: domainInfo.domainId,
                    sub_domain_id: domainInfo.subDomainId,
                    search_count: 1, // 首次创建即计为 1 次搜索
                };
                // 分级入库：写入质量等级（如果数据库有 quality_tier 列）
                if (qualityTier) {
                    insertPayload.quality_tier = qualityTier;
                }

                const { data, error } = await adminDb
                    .from('innovations')
                    .insert(insertPayload)
                    .select('innovation_id')
                    .single();

                if (data) {
                    storedIds.push(data.innovation_id);
                    eventPayloads.push({
                        innovationId: data.innovation_id,
                        domainId: domainInfo.domainId,
                        subDomainId: domainInfo.subDomainId,
                    });
                }
                if (error) console.warn('[InnovationService] 插入失败:', error.message);
            }
        } catch (err: unknown) {
            console.warn('[InnovationService] 存储创新点失败:', (err instanceof Error ? err.message : String(err)));
        }
    }

    console.log(`[InnovationService] 已存储 ${storedIds.length} 个创新点`);
    return { storedIds, eventPayloads };
}

/**
 * 获取高创新力项目（支持创新优先/热门优先排序）
 */
export async function getTrendingInnovations(
    limit = 10,
    sortBy: 'novelty' | 'trending' = 'novelty'
) {
    let query = db.from('innovations').select('*');

    if (sortBy === 'novelty') {
        // 创新优先：创新分高 + 有一定关注度
        query = query
            .gte('search_count', 0)
            .order('novelty_score', { ascending: false });
    } else {
        // 热门优先：按检索次数
        query = query.order('search_count', { ascending: false });
    }

    const { data } = await query.limit(limit);
    return data || [];
}

/**
 * 获取冷门高创新（蓝海发现）
 */
export async function getHiddenGems(limit = 10) {
    const { data } = await db
        .from('innovations')
        .select('*')
        .lt('search_count', 5)
        .gt('novelty_score', 75)
        .order('novelty_score', { ascending: false })
        .limit(limit);
    return data || [];
}

/**
 * 搜索创新点（用于自动补全联想）
 */
export async function searchInnovations(query: string, limit = 8) {
    if (!query || query.length < 2) return [];

    const normalized = query.toLowerCase().trim();
    const { data } = await db
        .from('innovations')
        .select('innovation_id, keyword, category, novelty_score, search_count')
        .ilike('keyword_normalized', `%${normalized}%`)
        .order('search_count', { ascending: false })
        .limit(limit);

    return data || [];
}

/**
 * 生成查询哈希（简易版，基于字符串哈希）
 */
export async function generateQueryHash(query: string): Promise<string> {
    const normalized = query.toLowerCase().trim();
    // 使用 Web Crypto API 生成 SHA-256 哈希
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(normalized);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // 降级: 简单哈希
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return 'hash_' + Math.abs(hash).toString(36);
}

/**
 * 搜索完成后的后处理：提取创新点 → 存储到 Supabase → 保存本地历史
 * 返回带有真实 innovation_id 的创新点数组
 *
 * @param qualityTier 分析结果的质量等级，用于分级入库和趋势加权
 */
export async function handleSearchComplete(
    idea: string,
    analysisResult: Record<string, unknown>,
    qualityTier?: 'high' | 'medium' | 'low'
): Promise<Array<{ keyword: string; category: string; noveltyScore: number; innovationId: string }>> {
    try {
        // 0. 置信度前置过滤：如果分析结果不可信，跳过创新点提取
        try {
            const { computeConfidenceGate } = await import('../ai/qualityGate');
            const gate = computeConfidenceGate(analysisResult);
            if (!gate.passed) {
                console.warn(`[InnovationService] 🛡️ 置信度门控拦截: ${gate.reason}，跳过创新点提取`);
                return [];
            }
        } catch { /* 模块加载失败时降级放行 */ }

        // 1. 提取创新点
        const innovations = await extractInnovationsFromAnalysis(idea, analysisResult);
        console.log('[InnovationService] 提取到创新点:', innovations);

        // 2. 生成 idea 哈希
        const ideaHash = await generateQueryHash(idea);

        // 3. 存储到 Supabase 并获取 ID（传递质量等级）
        const { storedIds, eventPayloads } = await storeInnovations(innovations, ideaHash, qualityTier);

        // 4. 将真实 ID 合并回创新点数据
        const innovationsWithId = innovations.map((inv, idx) => ({
            ...inv,
            innovationId: storedIds[idx] || `temp_${Date.now()}_${idx}`,
        }));
        console.log('[InnovationService] 创新点(含ID):', innovationsWithId);

        // 5. 记录创新点之间的共现关系（用于推荐）
        if (storedIds.length >= 2) {
            const { recordBatchCoOccurrence } = await import('./relationService');
            recordBatchCoOccurrence(storedIds).catch(console.error);
        }

        // 6. 趋势事件记录（开源版已移除 tracking 模块，跳过）
        // 云端版此处会调用 trendService.recordSearchEvents + throttledAggregateTrends
        if (eventPayloads.length > 0) {
            console.log(`[InnovationService] 跳过趋势事件记录（开源版无 tracking 模块），共 ${eventPayloads.length} 个事件`);
        }

        // 7. 保存到本地历史 (追加领域信息方便前端直接消费)
        const innovationsWithDomains = await Promise.all(
            innovationsWithId.map(async inv => {
                const domainInfo = await assignDomain(inv.keyword, inv.category);
                return { ...inv, domainId: domainInfo.domainId, subDomainId: domainInfo.subDomainId };
            })
        );

        const { saveSearchRecord } = await import('../../db/searchHistoryService');
        await saveSearchRecord(idea, innovationsWithDomains);

        // 8. 异步提取创新 DNA 向量（不阻塞主流程）
        try {
            const { extractDNAVector, storeDNAVector } = await import('./innovationDNA');
            const analysisContext = typeof analysisResult?.summary === 'string'
                ? analysisResult.summary as string
                : typeof (analysisResult?.arbitration as Record<string, unknown> | undefined)?.summary === 'string'
                    ? (analysisResult.arbitration as Record<string, unknown>).summary as string
                    : '';
            extractDNAVector(idea, analysisContext).then(extraction => {
                storeDNAVector(idea, extraction).catch(console.error);
            }).catch(err => {
                console.warn('[InnovationService] DNA 向量提取失败(不影响主流程):', err.message);
            });
        } catch (e: unknown) {
            console.warn('[InnovationService] DNA 模块加载失败:', (e instanceof Error ? e.message : String(e)));
        }

        console.log('[InnovationService] 后处理完成');
        return innovationsWithDomains;
    } catch (err) {
        console.error('[InnovationService] 后处理失败:', err);
        return [];
    }
}
