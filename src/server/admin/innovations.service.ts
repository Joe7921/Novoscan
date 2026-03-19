/**
 * innovations.service — 创新趋势服务
 *
 * 查询 innovations 表的热门关键词和领域分布。
 */

import { adminDb } from '@/lib/db/factory';

/** 创新趋势条目 */
export interface InnovationEntry {
    keyword: string;
    searchCount: number;
    noveltyScore: number | null;
    domainId: string;
    lastSearchedAt: string | null;
}

export interface InnovationTrendsResult {
    innovations: InnovationEntry[];
    domainDistribution: { domain: string; count: number }[];
    updatedAt: string;
}

/**
 * 获取创新趋势数据
 */
export async function getInnovationTrends(options: {
    top?: number;
    domain?: string | null;
} = {}): Promise<InnovationTrendsResult> {
    const { top = 20, domain = null } = options;

    let query = adminDb.from('innovations')
        .select('keyword, search_count, novelty_score, domain_id, last_searched_at')
        .order('search_count', { ascending: false })
        .limit(top);

    if (domain) {
        query = query.eq('domain_id', domain);
    }

    const { data, error } = await query;
    if (error) throw new Error(`查询失败: ${error.message}`);

    const innovations: InnovationEntry[] = (data || []).map(row => ({
        keyword: row.keyword || '-',
        searchCount: row.search_count || 0,
        noveltyScore: row.novelty_score,
        domainId: row.domain_id || 'unknown',
        lastSearchedAt: row.last_searched_at || null,
    }));

    // 领域分布
    const domainCounts: Record<string, number> = {};
    for (const item of innovations) {
        domainCounts[item.domainId] = (domainCounts[item.domainId] || 0) + 1;
    }
    const domainDistribution = Object.entries(domainCounts)
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count);

    return {
        innovations,
        domainDistribution,
        updatedAt: new Date().toISOString(),
    };
}
