/**
 * logs.service — 执行日志服务
 *
 * 分页查询 search_history 和 api_call_logs。
 */

import { adminDb } from '@/lib/db/factory';

/** 单条执行日志 */
export interface ExecutionLogEntry {
    id: number;
    query: string;
    modelProvider: string;
    searchTimeMs: number;
    status: 'COMPLETE' | 'PARTIAL' | 'FAILED' | 'LEGACY';
    createdAt: string;
}

export interface ExecutionLogsResult {
    logs: ExecutionLogEntry[];
    page: number;
    totalPages: number;
    totalCount: number;
}

/** API 失败记录 */
export interface ApiFailureEntry {
    provider: string;
    callType: string;
    responseTimeMs: number;
    errorMessage: string;
    calledAt: string;
}

/**
 * 获取分页执行日志
 */
export async function getExecutionLogs(options: {
    limit?: number;
    page?: number;
} = {}): Promise<ExecutionLogsResult> {
    const limit = options.limit || 15;
    const page = options.page || 1;
    const offset = (page - 1) * limit;

    // 总条数
    const { count } = await adminDb.from('search_history')
        .select('*', { count: 'exact', head: true });
    const totalPages = Math.ceil((count || 0) / limit);

    // 分页数据
    const { data, error } = await adminDb.from('search_history')
        .select('id, query, model_provider, search_time_ms, created_at, result')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw new Error(`查询失败: ${error.message}`);

    const logs: ExecutionLogEntry[] = (data || []).map(row => {
        const hasError = row.result?.error || row.result?.errorMessage;
        const isPartial = row.result?.isPartial;
        const isMulti = row.result?.executionRecord?.agents;
        const noResult = !row.result || Object.keys(row.result).length === 0;

        let status: ExecutionLogEntry['status'];
        if (hasError || noResult) status = 'FAILED';
        else if (!isMulti) status = 'LEGACY';
        else if (isPartial) status = 'PARTIAL';
        else status = 'COMPLETE';

        return {
            id: row.id,
            query: row.query || '',
            modelProvider: row.model_provider || '-',
            searchTimeMs: row.search_time_ms || 0,
            status,
            createdAt: row.created_at,
        };
    });

    return {
        logs,
        page,
        totalPages,
        totalCount: count || 0,
    };
}

/**
 * 获取 API 失败记录
 */
export async function getApiFailures(limit = 15): Promise<ApiFailureEntry[]> {
    const { data, error } = await adminDb.from('api_call_logs')
        .select('*')
        .eq('is_success', false)
        .order('called_at', { ascending: false })
        .limit(limit);

    if (error) {
        // 表不存在时返回空数组
        if (error.message.includes('does not exist') || error.code === '42P01') {
            return [];
        }
        throw new Error(`查询失败: ${error.message}`);
    }

    return (data || []).map(row => ({
        provider: row.provider || '-',
        callType: row.call_type || '-',
        responseTimeMs: row.response_time_ms || 0,
        errorMessage: row.error_message || '未知错误',
        calledAt: row.called_at || '',
    }));
}
