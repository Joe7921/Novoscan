/**
 * system.service — 系统健康检查服务
 *
 * 检查环境变量配置、数据库连接状态和各表行数统计。
 */

import { adminDb } from '@/lib/db/factory';

/** 环境变量检查项 */
interface EnvCheckItem {
    key: string;
    label: string;
    category: string;
    configured: boolean;
}

/** 表行数统计 */
interface TableStat {
    name: string;
    rowCount: number | null;   // null 表示查询失败
}

export interface SystemHealthResult {
    envChecks: EnvCheckItem[];
    dbStatus: {
        connected: boolean;
        latencyMs: number;
        error?: string;
    };
    tableStats: TableStat[];
    runtime: {
        nodeVersion: string;
        platform: string;
    };
    updatedAt: string;
}

// 需要检查的环境变量
const ENV_CHECKS: { key: string; label: string; category: string }[] = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL', category: 'database' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', category: 'database' },
    { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek API Key', category: 'ai' },
    { key: 'DEEPSEEK_BASE_URL', label: 'DeepSeek Base URL', category: 'ai' },
    { key: 'MINIMAX_API_KEY', label: 'Minimax API Key', category: 'ai' },
    { key: 'MINIMAX_BASE_URL', label: 'Minimax Base URL', category: 'ai' },
    { key: 'MOONSHOT_API_KEY', label: 'Moonshot API Key', category: 'ai' },
    { key: 'BRAVE_API_KEY', label: 'Brave Search Key', category: 'search' },
    { key: 'SERPAPI_KEY', label: 'SerpAPI Key', category: 'search' },
    { key: 'GITHUB_TOKEN', label: 'GitHub Token', category: 'search' },
    { key: 'CORE_API_KEY', label: 'CORE API Key', category: 'search' },
];

// 需要统计行数的表
const TABLES_TO_CHECK = [
    'search_history',
    'api_call_logs',
    'innovations',
    'feature_access',
    'tracker_keywords',
    'tracker_alerts',
    'public_report_shares',
];

/**
 * 获取系统健康状态
 */
export async function getSystemHealth(): Promise<SystemHealthResult> {
    // 1. 环境变量审计
    const envChecks: EnvCheckItem[] = ENV_CHECKS.map(({ key, label, category }) => ({
        key,
        label,
        category,
        configured: !!process.env[key],
    }));

    // 2. 数据库连接检查
    let dbStatus: SystemHealthResult['dbStatus'];
    try {
        const start = Date.now();
        const { error } = await adminDb.from('search_history').select('id', { count: 'exact', head: true });
        const latency = Date.now() - start;

        dbStatus = error
            ? { connected: false, latencyMs: latency, error: error.message }
            : { connected: true, latencyMs: latency };
    } catch (err: any) {
        dbStatus = { connected: false, latencyMs: 0, error: err.message };
    }

    // 3. 各表行数统计
    const tableStats: TableStat[] = [];
    for (const tableName of TABLES_TO_CHECK) {
        try {
            const { count, error } = await adminDb.from(tableName)
                .select('*', { count: 'exact', head: true });
            tableStats.push({
                name: tableName,
                rowCount: error ? null : (count || 0),
            });
        } catch {
            tableStats.push({ name: tableName, rowCount: null });
        }
    }

    return {
        envChecks,
        dbStatus,
        tableStats,
        runtime: {
            nodeVersion: process.version,
            platform: process.platform,
        },
        updatedAt: new Date().toISOString(),
    };
}
