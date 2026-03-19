/**
 * cache.service — 缓存管理服务
 *
 * 基于 search_history 表的缓存统计和清理。
 */

import { adminDb } from '@/lib/db/factory';

/** 缓存分段统计 */
export interface CacheBracket {
    label: string;
    count: number;
    description: string;
}

export interface CacheStatsResult {
    brackets: CacheBracket[];
    total: number;
    updatedAt: string;
}

export interface ClearCacheResult {
    deletedCount: number;
    success: boolean;
    error?: string;
}

/**
 * 获取缓存分段统计
 */
export async function getCacheStats(): Promise<CacheStatsResult> {
    const now = Date.now();

    const [totalRes, last24hRes, last7dRes, last30dRes] = await Promise.all([
        adminDb.from('search_history').select('*', { count: 'exact', head: true }),
        adminDb.from('search_history').select('*', { count: 'exact', head: true })
            .gte('created_at', new Date(now - 24 * 3600000).toISOString()),
        adminDb.from('search_history').select('*', { count: 'exact', head: true })
            .gte('created_at', new Date(now - 7 * 86400000).toISOString()),
        adminDb.from('search_history').select('*', { count: 'exact', head: true })
            .gte('created_at', new Date(now - 30 * 86400000).toISOString()),
    ]);

    const total = totalRes.count || 0;
    const c24 = last24hRes.count || 0;
    const c7 = (last7dRes.count || 0) - c24;
    const c30 = (last30dRes.count || 0) - (last7dRes.count || 0);
    const cOld = total - (last30dRes.count || 0);

    return {
        brackets: [
            { label: '< 24h', count: c24, description: '前端可命中缓存' },
            { label: '1-7 天', count: c7, description: '过期但保留统计价值' },
            { label: '7-30 天', count: c30, description: '可清理' },
            { label: '> 30 天', count: cOld, description: '建议清理' },
        ],
        total,
        updatedAt: new Date().toISOString(),
    };
}

/**
 * 清除缓存
 */
export async function clearCache(options: {
    all?: boolean;
    olderThanHours?: number;
} = {}): Promise<ClearCacheResult> {
    const { all = false, olderThanHours = 24 } = options;

    if (all) {
        const { count } = await adminDb.from('search_history')
            .select('*', { count: 'exact', head: true });

        const { error } = await adminDb.from('search_history').delete().neq('id', 0);
        return {
            deletedCount: error ? 0 : (count || 0),
            success: !error,
            error: error?.message,
        };
    }

    const cutoff = new Date(Date.now() - olderThanHours * 3600000);

    const { count } = await adminDb.from('search_history')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', cutoff.toISOString());

    const { error } = await adminDb.from('search_history')
        .delete()
        .lt('created_at', cutoff.toISOString());

    return {
        deletedCount: error ? 0 : (count || 0),
        success: !error,
        error: error?.message,
    };
}
