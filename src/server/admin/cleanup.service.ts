/**
 * cleanup.service — 数据清理服务
 *
 * 清理过期的 api_call_logs 和 search_history 数据。
 */

import { supabaseAdmin } from '@/lib/supabase';

/** 清理预览项 */
export interface CleanupPreviewItem {
    table: string;
    label: string;
    rowCount: number;
}

export interface CleanupResult {
    items: { table: string; label: string; deletedCount: number; success: boolean; error?: string }[];
}

// 需要清理的表和时间字段
const CLEANUP_TARGETS = [
    { name: 'api_call_logs', timeCol: 'called_at', label: 'API 调用日志' },
    { name: 'search_history', timeCol: 'created_at', label: '搜索历史' },
];

/**
 * 获取清理预览
 */
export async function getCleanupPreview(olderThanDays = 90): Promise<CleanupPreviewItem[]> {
    const cutoffStr = new Date(Date.now() - olderThanDays * 86400000).toISOString();
    const items: CleanupPreviewItem[] = [];

    for (const { name, timeCol, label } of CLEANUP_TARGETS) {
        const { count, error } = await supabaseAdmin.from(name)
            .select('*', { count: 'exact', head: true })
            .lt(timeCol, cutoffStr);

        items.push({
            table: name,
            label,
            rowCount: error ? 0 : (count || 0),
        });
    }

    return items;
}

/**
 * 执行实际清理
 */
export async function executeCleanup(olderThanDays = 90): Promise<CleanupResult> {
    const cutoffStr = new Date(Date.now() - olderThanDays * 86400000).toISOString();
    const items: CleanupResult['items'] = [];

    for (const { name, timeCol, label } of CLEANUP_TARGETS) {
        // 先统计
        const { count } = await supabaseAdmin.from(name)
            .select('*', { count: 'exact', head: true })
            .lt(timeCol, cutoffStr);

        const rowCount = count || 0;
        if (rowCount === 0) {
            items.push({ table: name, label, deletedCount: 0, success: true });
            continue;
        }

        // 执行删除
        const { error } = await supabaseAdmin.from(name)
            .delete()
            .lt(timeCol, cutoffStr);

        items.push({
            table: name,
            label,
            deletedCount: error ? 0 : rowCount,
            success: !error,
            error: error?.message,
        });
    }

    return { items };
}
