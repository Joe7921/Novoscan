import { db, getSessionId } from '@/lib/db/index';
// 简单哈希函数替代原有的 generateQueryHash
export async function generateQueryHash(query: string): Promise<string> {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
        hash = (hash << 5) - hash + query.charCodeAt(i);
        hash |= 0;
    }
    return `hash_${Math.abs(hash)}`;
}

/**
 * 保存搜索记录到本地 Dexie 数据库
 */
export async function saveSearchRecord(
    query: string,
    extractedInnovations: Array<{ keyword: string; category: string; noveltyScore: number; innovationId?: string; domainId?: string; subDomainId?: string }>
) {
    const queryHash = await generateQueryHash(query);

    await db.searchRecords.add({
        query,
        queryHash,
        timestamp: Date.now(),
        extractedInnovations: extractedInnovations.map((inv, i) => ({
            innovationId: inv.innovationId || `local_${Date.now()}_${i}`,
            keyword: inv.keyword,
            noveltyScore: inv.noveltyScore,
            category: inv.category,
            domainId: inv.domainId,
            subDomainId: inv.subDomainId,
        })),
        sessionId: getSessionId(),
    });

    console.log('[SearchHistory] 搜索记录已保存到本地');
}

/**
 * 获取本地搜索历史（按时间倒序）
 */
export async function getSearchHistory(limit = 20) {
    return db.searchRecords
        .orderBy('timestamp')
        .reverse()
        .limit(limit)
        .toArray();
}

/**
 * 清空本地搜索历史
 */
export async function clearSearchHistory() {
    await db.searchRecords.clear();
    console.log('[SearchHistory] 本地搜索历史已清空');
}
