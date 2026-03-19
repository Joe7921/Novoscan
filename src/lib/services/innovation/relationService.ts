import { db as serverDb, adminDb } from '@/lib/db/factory';

/**
 * 记录两个创新点被同时查看/搜索的关系（共现）
 */
export async function recordCoOccurrence(
    innovationA: string,
    innovationB: string
) {
    if (!innovationA || !innovationB || innovationA === innovationB) return;

    // 确保是字符串
    const idA = String(innovationA);
    const idB = String(innovationB);

    try {
        // 检查是否已有关系（双向查找，使用安全的参数化查询）
        const { data: asSource } = await serverDb
            .from('innovation_relations')
            .select('id, co_search_count')
            .eq('source_id', idA)
            .eq('target_id', idB)
            .maybeSingle();

        const existing = asSource || (await serverDb
            .from('innovation_relations')
            .select('id, co_search_count')
            .eq('source_id', idB)
            .eq('target_id', idA)
            .maybeSingle()).data;

        if (existing) {
            // 更新共现次数
            await adminDb
                .from('innovation_relations')
                .update({
                    co_search_count: (existing.co_search_count || 0) + 1,
                    // 去掉 updated_at，让数据库自动处理
                })
                .eq('id', existing.id);
            console.log('[RelationService] 关联次数+1:', idA, '↔', idB);
        } else {
            // 创建新关系
            const { error } = await adminDb.from('innovation_relations').insert({
                source_id: idA,
                target_id: idB,
                relation_type: 'related',
                co_search_count: 1,
            });
            if (error) {
                console.error('[RelationService] 创建关联失败:', error.message);
            } else {
                console.log('[RelationService] 创建新关联:', idA, '→', idB);
            }
        }
    } catch (err: unknown) {
        console.warn('[RelationService] 记录共现关系失败:', (err instanceof Error ? err.message : String(err)));
    }
}

/**
 * 批量记录一组创新点之间的共现关系
 * 当用户搜索结果包含多个创新点时,两两记录关联
 */
export async function recordBatchCoOccurrence(innovationIds: string[]) {
    if (innovationIds.length < 2) return;

    const promises: Promise<void>[] = [];
    for (let i = 0; i < innovationIds.length; i++) {
        for (let j = i + 1; j < innovationIds.length; j++) {
            promises.push(recordCoOccurrence(innovationIds[i], innovationIds[j]));
        }
    }

    await Promise.allSettled(promises);
    console.log(`[RelationService] 已并发记录 ${innovationIds.length} 个创新点的共现关系 (${promises.length} 组)`);
}

/**
 * 获取相关创新点推荐（"看了这个的人还关注"）
 */
export async function getRelatedInnovations(
    innovationId: string,
    limit = 5
): Promise<Record<string, unknown>[]> {
    try {
        const invId = String(innovationId);

        // 查找作为 source 的关系
        const { data: asSource } = await serverDb
            .from('innovation_relations')
            .select('target_id, co_search_count')
            .eq('source_id', invId)
            .order('co_search_count', { ascending: false })
            .limit(limit);

        // 查找作为 target 的关系
        const { data: asTarget } = await serverDb
            .from('innovation_relations')
            .select('source_id, co_search_count')
            .eq('target_id', invId)
            .order('co_search_count', { ascending: false })
            .limit(limit);

        // 合并所有关联 ID
        const relatedIds = new Set<string>();
        const idScores = new Map<string, number>();

        for (const r of asSource || []) {
            relatedIds.add(r.target_id);
            idScores.set(r.target_id, r.co_search_count || 1);
        }
        for (const r of asTarget || []) {
            relatedIds.add(r.source_id);
            idScores.set(r.source_id, (idScores.get(r.source_id) || 0) + (r.co_search_count || 1));
        }

        if (relatedIds.size === 0) return [];

        // 批量获取创新点详情
        const { data: innovations } = await serverDb
            .from('innovations')
            .select('*')
            .in('innovation_id', Array.from(relatedIds));

        if (!innovations) return [];

        // 按共现次数排序并返回
        return innovations
            .map((inv) => ({
                ...inv,
                co_search_count: idScores.get(inv.innovation_id) || 0,
            }))
            .sort((a, b) => b.co_search_count - a.co_search_count)
            .slice(0, limit);
    } catch (err: unknown) {
        console.warn('[RelationService] 获取相关推荐失败:', (err instanceof Error ? err.message : String(err)));
        return [];
    }
}
