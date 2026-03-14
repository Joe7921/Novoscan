/**
 * alerts.service — 预警配置与状态服务
 *
 * 预警阈值存储在环境变量 ALERTS_CONFIG 中（JSON），
 * 也支持通过 API 动态设置。
 */

import { supabaseAdmin } from '@/lib/supabase';

/** 预警配置 */
export interface AlertConfig {
    errorRate: number;        // API 错误率阈值（%）
    dailyCost: number;        // 日费用阈值（USD）
    agentTimeout: number;     // Agent 超时率阈值（%）
    minDailyQueries: number;  // 最低日发单量预警
}

const DEFAULT_ALERTS: AlertConfig = {
    errorRate: 10,
    dailyCost: 5,
    agentTimeout: 25,
    minDailyQueries: 0,
};

/** 预警指标当前值 */
export interface AlertMetric {
    name: string;
    label: string;
    currentValue: number;
    threshold: number;
    unit: string;
    triggered: boolean;
}

export interface AlertsStatusResult {
    metrics: AlertMetric[];
    config: AlertConfig;
    updatedAt: string;
}

// 模型费率（每千 token 美元）— 用于费用估算
const PRICING: Record<string, number> = {
    deepseek: 0.0042, minimax: 0.002, moonshot: 0.002,
};

/**
 * 获取预警配置
 */
export function getAlertConfig(): AlertConfig {
    try {
        const envConfig = process.env.ALERTS_CONFIG;
        if (envConfig) return { ...DEFAULT_ALERTS, ...JSON.parse(envConfig) };
    } catch { /* 解析失败用默认值 */ }
    return { ...DEFAULT_ALERTS };
}

/**
 * 获取预警状态
 */
export async function getAlertsStatus(config?: AlertConfig): Promise<AlertsStatusResult> {
    const alertConfig = config || getAlertConfig();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [apiCallsRes, todayQueriesRes, recentRecordsRes] = await Promise.all([
        supabaseAdmin.from('api_call_logs').select('*')
            .gte('called_at', todayStart.toISOString()).limit(10000),
        supabaseAdmin.from('search_history').select('*', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString()),
        supabaseAdmin.from('search_history').select('result')
            .order('created_at', { ascending: false }).limit(100),
    ]);

    const apiCalls = apiCallsRes.data || [];
    const todayQueries = todayQueriesRes.count || 0;

    // 计算指标
    const failedCalls = apiCalls.filter(c => !c.is_success).length;
    const currentErrorRate = apiCalls.length > 0 ? (failedCalls / apiCalls.length * 100) : 0;

    let dailyCost = 0;
    for (const c of apiCalls) {
        const rate = PRICING[c.provider] || 0.002;
        dailyCost += ((c.estimated_tokens || 0) / 1000) * rate;
    }

    // Agent 超时率
    let agentRuns = 0, agentTimeouts = 0;
    for (const r of (recentRecordsRes.data || [])) {
        const agents = r.result?.executionRecord?.agents;
        if (!agents) continue;
        for (const a of Object.values(agents) as any[]) {
            agentRuns++;
            if (a.status === 'timeout') agentTimeouts++;
        }
    }
    const agentTimeoutRate = agentRuns > 0 ? (agentTimeouts / agentRuns * 100) : 0;

    const metrics: AlertMetric[] = [
        {
            name: 'errorRate',
            label: 'API 错误率',
            currentValue: Number(currentErrorRate.toFixed(1)),
            threshold: alertConfig.errorRate,
            unit: '%',
            triggered: currentErrorRate >= alertConfig.errorRate,
        },
        {
            name: 'dailyCost',
            label: '今日费用',
            currentValue: Number(dailyCost.toFixed(4)),
            threshold: alertConfig.dailyCost,
            unit: 'USD',
            triggered: dailyCost >= alertConfig.dailyCost,
        },
        {
            name: 'agentTimeout',
            label: 'Agent 超时率',
            currentValue: Number(agentTimeoutRate.toFixed(1)),
            threshold: alertConfig.agentTimeout,
            unit: '%',
            triggered: agentTimeoutRate >= alertConfig.agentTimeout,
        },
        {
            name: 'minDailyQueries',
            label: '今日发单量',
            currentValue: todayQueries,
            threshold: alertConfig.minDailyQueries,
            unit: '次',
            triggered: alertConfig.minDailyQueries > 0 && todayQueries < alertConfig.minDailyQueries,
        },
    ];

    return {
        metrics,
        config: alertConfig,
        updatedAt: new Date().toISOString(),
    };
}
