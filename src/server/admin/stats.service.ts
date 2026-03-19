/**
 * stats.service — KPI 统计服务
 *
 * 返回结构化 JSON，供 API 路由和 CLI 使用。
 * 数据来源：search_history + api_call_logs
 */

import { adminDb } from '@/lib/db/factory';

/** KPI 统计结果 */
export interface KpiStats {
    totalAnalyses: number;
    todayCount: number;
    yesterdayCount: number;
    dodChange: string;            // 环比变化
    tokenStats: {
        sevenDayTotal: number;    // 7 日 token 总量
        todayTotal: number;       // 今日 token
    };
    apiStats: {
        totalCalls: number;
        successCalls: number;
        failedCalls: number;
        successRate: string;      // "98.5"
        avgResponseMs: number;
    };
    avgSearchMs: number;
    validSearchCount: number;
    updatedAt: string;
}

/**
 * 获取 KPI 总览数据
 */
export async function getKpiStats(): Promise<KpiStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 86400000);

    // 并行查询
    const [totalRes, recent7Res, apiCallsRes] = await Promise.all([
        adminDb.from('search_history').select('*', { count: 'exact', head: true }),
        adminDb.from('search_history').select('created_at, search_time_ms')
            .gte('created_at', sevenDaysAgo.toISOString()),
        adminDb.from('api_call_logs').select('provider, estimated_tokens, response_time_ms, is_success, called_at')
            .gte('called_at', sevenDaysAgo.toISOString())
            .limit(10000),
    ]);

    const totalAnalyses = totalRes.count || 0;
    const recent7 = recent7Res.data || [];
    const apiCalls = apiCallsRes.data || [];

    // 今日/昨日发单量
    const getDateStr = (d: Date) => `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    const todayStr = getDateStr(todayStart);
    const yesterdayStr = getDateStr(yesterdayStart);

    let todayCount = 0, yesterdayCount = 0;
    for (const r of recent7) {
        if (!r.created_at) continue;
        const ds = getDateStr(new Date(r.created_at));
        if (ds === todayStr) todayCount++;
        else if (ds === yesterdayStr) yesterdayCount++;
    }

    const dodChange = yesterdayCount === 0
        ? (todayCount > 0 ? '+100%' : '0%')
        : `${((todayCount - yesterdayCount) / yesterdayCount * 100).toFixed(1)}%`;

    // Token 汇总
    let totalTokens = 0, todayTokens = 0;
    let totalSucc = 0, totalFail = 0;
    let totalMs = 0;

    for (const c of apiCalls) {
        totalTokens += c.estimated_tokens || 0;
        if (c.is_success) totalSucc++; else totalFail++;
        totalMs += c.response_time_ms || 0;

        if (c.called_at) {
            const ds = getDateStr(new Date(c.called_at));
            if (ds === todayStr) todayTokens += c.estimated_tokens || 0;
        }
    }

    const avgMs = apiCalls.length > 0 ? Math.round(totalMs / apiCalls.length) : 0;
    const successRate = apiCalls.length > 0 ? ((totalSucc / apiCalls.length) * 100).toFixed(1) : '100';

    // 搜索平均耗时
    const validSearchTimes = recent7.filter(r => r.search_time_ms && r.search_time_ms > 0);
    const avgSearchMs = validSearchTimes.length > 0
        ? Math.round(validSearchTimes.reduce((s, r) => s + r.search_time_ms, 0) / validSearchTimes.length)
        : 0;

    return {
        totalAnalyses,
        todayCount,
        yesterdayCount,
        dodChange,
        tokenStats: {
            sevenDayTotal: totalTokens,
            todayTotal: todayTokens,
        },
        apiStats: {
            totalCalls: apiCalls.length,
            successCalls: totalSucc,
            failedCalls: totalFail,
            successRate,
            avgResponseMs: avgMs,
        },
        avgSearchMs,
        validSearchCount: validSearchTimes.length,
        updatedAt: now.toISOString(),
    };
}
