/**
 * costs.service — FinOps 费用监控服务
 *
 * 支持自定义每个模型每百万 Token 的费率，
 * 从 api_call_logs 拉取实际 token 用量，
 * 按 Provider / 日期维度计算费用。
 */

import { supabaseAdmin } from '@/lib/supabase';

// ==================== 费率配置 ====================

/** 单个模型的费率（每百万 Token，美元） */
export interface ModelPricing {
    name: string;           // 模型名称（provider）
    inputPerMillion: number;  // 输入费率
    outputPerMillion: number; // 输出费率
    label?: string;           // 显示标签
}

/** 完整费率配置 */
export interface PricingConfig {
    models: ModelPricing[];
    updatedAt: string;
}

/** 默认费率表（每百万 Token，美元） */
const DEFAULT_PRICING: ModelPricing[] = [
    { name: 'deepseek', inputPerMillion: 1.40, outputPerMillion: 2.80, label: 'DeepSeek V3' },
    { name: 'deepseek-r1', inputPerMillion: 4.00, outputPerMillion: 16.00, label: 'DeepSeek R1' },
    { name: 'minimax', inputPerMillion: 1.00, outputPerMillion: 1.00, label: 'MiniMax' },
    { name: 'moonshot', inputPerMillion: 2.00, outputPerMillion: 2.00, label: 'Moonshot (Kimi)' },
    { name: 'gemini', inputPerMillion: 1.25, outputPerMillion: 5.00, label: 'Gemini' },
];

/**
 * 获取费率配置
 *
 * 优先读取环境变量 FINOPS_PRICING（JSON），否则用默认值。
 */
export function getCostsPricing(): PricingConfig {
    try {
        const envPricing = process.env.FINOPS_PRICING;
        if (envPricing) {
            const parsed = JSON.parse(envPricing) as ModelPricing[];
            if (Array.isArray(parsed) && parsed.length > 0) {
                return { models: parsed, updatedAt: new Date().toISOString() };
            }
        }
    } catch { /* 解析失败用默认值 */ }
    return { models: [...DEFAULT_PRICING], updatedAt: new Date().toISOString() };
}

/**
 * 根据 provider 名称获取单条费率
 */
function getModelRate(pricing: ModelPricing[], provider: string): ModelPricing {
    const found = pricing.find(p => p.name === provider);
    if (found) return found;
    // 未知模型返回保守估算
    return { name: provider, inputPerMillion: 2.00, outputPerMillion: 2.00, label: provider };
}

// ==================== 费用聚合 ====================

/** 单个 Provider 的费用明细 */
export interface ProviderCostEntry {
    provider: string;
    label: string;
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    totalTokens: number;
    estimatedCostUsd: number;
    inputRate: number;      // 每百万 Token
    outputRate: number;     // 每百万 Token
}

/** 按日的费用数据（用于费用曲线） */
export interface DailyCostEntry {
    date: string;           // "2026-03-14"
    totalTokens: number;
    estimatedCostUsd: number;
    callsCount: number;
    byProvider: Record<string, { tokens: number; cost: number; calls: number }>;
}

export interface CostsOverviewResult {
    providers: ProviderCostEntry[];
    totalTokens: number;
    totalCostUsd: number;
    totalCalls: number;
    days: number;
    pricing: PricingConfig;
    updatedAt: string;
}

export interface CostsByDayResult {
    dailyCosts: DailyCostEntry[];
    totalCostUsd: number;
    days: number;
    updatedAt: string;
}

/**
 * 获取费用总览（按 Provider 分组）
 */
export async function getCostsOverview(days = 7): Promise<CostsOverviewResult> {
    const since = new Date(Date.now() - days * 86400000);
    const pricing = getCostsPricing();

    const { data, error } = await supabaseAdmin.from('api_call_logs')
        .select('provider, estimated_tokens, is_success, called_at')
        .gte('called_at', since.toISOString())
        .limit(50000);

    if (error) throw new Error(`查询失败: ${error.message}`);

    const records = data || [];

    // 按 provider 分组聚合
    const providerMap: Record<string, {
        totalCalls: number; successCalls: number; failedCalls: number;
        totalTokens: number;
    }> = {};

    for (const r of records) {
        const p = r.provider || 'unknown';
        if (!providerMap[p]) {
            providerMap[p] = { totalCalls: 0, successCalls: 0, failedCalls: 0, totalTokens: 0 };
        }
        providerMap[p].totalCalls++;
        if (r.is_success) providerMap[p].successCalls++;
        else providerMap[p].failedCalls++;
        providerMap[p].totalTokens += r.estimated_tokens || 0;
    }

    // 计算费用
    let totalTokens = 0, totalCostUsd = 0;
    const providers: ProviderCostEntry[] = [];

    for (const [provider, stats] of Object.entries(providerMap)) {
        const rate = getModelRate(pricing.models, provider);
        // 简化估算：Token 按 50% 输入 50% 输出分配
        const avgRate = (rate.inputPerMillion + rate.outputPerMillion) / 2;
        const cost = (stats.totalTokens / 1_000_000) * avgRate;

        totalTokens += stats.totalTokens;
        totalCostUsd += cost;

        providers.push({
            provider,
            label: rate.label || provider,
            totalCalls: stats.totalCalls,
            successCalls: stats.successCalls,
            failedCalls: stats.failedCalls,
            totalTokens: stats.totalTokens,
            estimatedCostUsd: Number(cost.toFixed(4)),
            inputRate: rate.inputPerMillion,
            outputRate: rate.outputPerMillion,
        });
    }

    // 按费用降序
    providers.sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);

    return {
        providers,
        totalTokens,
        totalCostUsd: Number(totalCostUsd.toFixed(4)),
        totalCalls: records.length,
        days,
        pricing,
        updatedAt: new Date().toISOString(),
    };
}

/**
 * 获取按日维度的费用曲线数据
 */
export async function getCostsByDay(days = 7): Promise<CostsByDayResult> {
    const since = new Date(Date.now() - days * 86400000);
    const pricing = getCostsPricing();

    const { data, error } = await supabaseAdmin.from('api_call_logs')
        .select('provider, estimated_tokens, called_at')
        .gte('called_at', since.toISOString())
        .order('called_at', { ascending: true })
        .limit(50000);

    if (error) throw new Error(`查询失败: ${error.message}`);

    const records = data || [];

    // 按日期分组
    const dayMap: Record<string, DailyCostEntry> = {};

    for (const r of records) {
        if (!r.called_at) continue;
        const date = r.called_at.slice(0, 10); // "2026-03-14"
        if (!dayMap[date]) {
            dayMap[date] = { date, totalTokens: 0, estimatedCostUsd: 0, callsCount: 0, byProvider: {} };
        }

        const day = dayMap[date];
        const tokens = r.estimated_tokens || 0;
        const provider = r.provider || 'unknown';
        const rate = getModelRate(pricing.models, provider);
        const avgRate = (rate.inputPerMillion + rate.outputPerMillion) / 2;
        const cost = (tokens / 1_000_000) * avgRate;

        day.totalTokens += tokens;
        day.estimatedCostUsd += cost;
        day.callsCount++;

        if (!day.byProvider[provider]) {
            day.byProvider[provider] = { tokens: 0, cost: 0, calls: 0 };
        }
        day.byProvider[provider].tokens += tokens;
        day.byProvider[provider].cost += cost;
        day.byProvider[provider].calls++;
    }

    // 精度修正
    const dailyCosts = Object.values(dayMap).map(d => ({
        ...d,
        estimatedCostUsd: Number(d.estimatedCostUsd.toFixed(4)),
    }));

    const totalCostUsd = dailyCosts.reduce((s, d) => s + d.estimatedCostUsd, 0);

    return {
        dailyCosts,
        totalCostUsd: Number(totalCostUsd.toFixed(4)),
        days,
        updatedAt: new Date().toISOString(),
    };
}

/**
 * 获取今日实时费用
 */
export async function getCostsRealtime(): Promise<CostsOverviewResult> {
    return getCostsOverview(1);
}
