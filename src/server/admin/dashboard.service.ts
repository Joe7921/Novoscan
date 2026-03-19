/**
 * dashboard.service — 一键总览服务
 *
 * 整合 KPI + Agent 水位 + 最近失败，一次调用掌握全局。
 */

import { adminDb } from '@/lib/db/factory';

const AGENT_NAMES = ['academicReviewer', 'industryAnalyst', 'competitorDetective', 'innovationEvaluator', 'arbitrator'] as const;
const SHORT_NAMES: Record<string, string> = {
    academicReviewer: '学术', industryAnalyst: '产业',
    competitorDetective: '竞品', innovationEvaluator: '创新', arbitrator: '仲裁',
};

/** Dashboard Agent 简报 */
export interface DashboardAgent {
    name: string;
    displayName: string;
    completedRate: string;
    avgMs: number;
    health: 'healthy' | 'warning' | 'nodata';
}

/** Dashboard 失败记录 */
export interface DashboardFailure {
    query: string;
    error: string;
    createdAt: string;
}

export interface DashboardResult {
    kpi: {
        totalAnalyses: number;
        todayCount: number;
        apiSuccessRate: string;
        todayTokensM: string;   // "0.123"
    };
    agents: DashboardAgent[];
    recentFailures: DashboardFailure[];
    updatedAt: string;
}

/**
 * 获取 Dashboard 一键总览数据
 */
export async function getDashboardData(): Promise<DashboardResult> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 86400000);

    const [totalRes, recent7Res, apiCallsRes, recentRecordsRes] = await Promise.all([
        adminDb.from('search_history').select('*', { count: 'exact', head: true }),
        adminDb.from('search_history').select('created_at, search_time_ms')
            .gte('created_at', sevenDaysAgo.toISOString()),
        adminDb.from('api_call_logs').select('*')
            .gte('called_at', sevenDaysAgo.toISOString())
            .limit(10000),
        adminDb.from('search_history').select('query, model_provider, search_time_ms, result, created_at')
            .order('created_at', { ascending: false })
            .limit(100),
    ]);

    const totalAnalyses = totalRes.count || 0;
    const recent7 = recent7Res.data || [];
    const apiCalls = apiCallsRes.data || [];
    const recentRecords = recentRecordsRes.data || [];

    // KPI
    const getDateStr = (d: Date) => `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    const todayStr = getDateStr(todayStart);
    let todayCount = 0, todayTokens = 0;
    let totalSucc = 0;

    for (const r of recent7) {
        if (r.created_at && getDateStr(new Date(r.created_at)) === todayStr) todayCount++;
    }
    for (const c of apiCalls) {
        if (c.is_success) totalSucc++;
        if (c.called_at && getDateStr(new Date(c.called_at)) === todayStr) {
            todayTokens += c.estimated_tokens || 0;
        }
    }

    const successRate = apiCalls.length > 0 ? ((totalSucc / apiCalls.length) * 100).toFixed(1) : '100';

    // Agent 水位
    const agentData: Record<string, { runs: number; completed: number; timeMs: number[] }> = {};
    for (const n of AGENT_NAMES) agentData[n] = { runs: 0, completed: 0, timeMs: [] };

    for (const record of recentRecords) {
        const agents = record.result?.executionRecord?.agents;
        if (!agents) continue;
        for (const n of AGENT_NAMES) {
            const a = agents[n];
            if (!a) continue;
            agentData[n].runs++;
            if (a.status === 'completed') agentData[n].completed++;
            if (a.executionTimeMs > 0) agentData[n].timeMs.push(a.executionTimeMs);
        }
    }

    const agents: DashboardAgent[] = AGENT_NAMES.map(n => {
        const d = agentData[n];
        const rate = d.runs > 0 ? ((d.completed / d.runs) * 100).toFixed(0) : '-';
        const avg = d.timeMs.length > 0 ? Math.round(d.timeMs.reduce((a, b) => a + b, 0) / d.timeMs.length) : 0;

        return {
            name: n,
            displayName: SHORT_NAMES[n] || n,
            completedRate: rate === '-' ? '-' : rate + '%',
            avgMs: avg,
            health: d.runs === 0 ? 'nodata' as const : Number(rate) >= 90 ? 'healthy' as const : 'warning' as const,
        };
    });

    // 最近失败
    const recentFailures: DashboardFailure[] = recentRecords
        .filter(r => !r.result || r.result.success === false || r.result.error)
        .slice(0, 5)
        .map(f => ({
            query: (f.query || '').slice(0, 50),
            error: f.result?.error || f.result?.errorType || '未知错误',
            createdAt: f.created_at,
        }));

    return {
        kpi: {
            totalAnalyses,
            todayCount,
            apiSuccessRate: successRate,
            todayTokensM: (todayTokens / 1_000_000).toFixed(3),
        },
        agents,
        recentFailures,
        updatedAt: now.toISOString(),
    };
}
