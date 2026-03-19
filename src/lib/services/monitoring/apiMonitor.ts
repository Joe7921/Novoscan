import { getSessionId } from '../db/index';

// ==================== 内存统计（实时） ====================

interface CallRecord {
    provider: string;
    callType: string;
    responseTimeMs: number;
    isSuccess: boolean;
    errorMessage?: string;
    timestamp: number;
}

// 本地运行时统计（不依赖 Supabase 查询）
const callHistory: CallRecord[] = [];
const MAX_CALL_HISTORY = 1000;

// 各模型每千 token 估算费用（美元）
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
    deepseek: { input: 0.0014, output: 0.0028 },
    gemini: { input: 0.00125, output: 0.005 },
    'deepseek-r1': { input: 0.004, output: 0.016 },
    minimax: { input: 0.001, output: 0.001 },
    moonshot: { input: 0.002, output: 0.002 },
    serpapi: { input: 0, output: 0 },   // 按次计费，非 Token 计费
    brave: { input: 0, output: 0 },     // 按次计费，非 Token 计费
};

// 粗略估算 token 数（基于字符长度）
function estimateTokens(responseTimeMs: number): number {
    // 假设每秒输出约 50 token，以响应时间估算
    return Math.round((responseTimeMs / 1000) * 50);
}

// ==================== 核心 API ====================

interface ApiCallMetadata {
    callType?: string;
    queryHash?: string;
    innovationId?: string;
    estimatedTokens?: number;
}

/**
 * 包装 API 调用，自动记录调用耗时、成功/失败
 */
export async function trackApiCall<T>(
    provider: string,
    callFn: () => Promise<T>,
    metadata?: ApiCallMetadata
): Promise<T> {
    const startTime = performance.now();

    try {
        const result = await callFn();
        const responseTime = Math.round(performance.now() - startTime);

        const record: CallRecord = {
            provider,
            callType: metadata?.callType || 'call',
            responseTimeMs: responseTime,
            isSuccess: true,
            timestamp: Date.now(),
        };
        callHistory.push(record);
        if (callHistory.length > MAX_CALL_HISTORY) callHistory.splice(0, callHistory.length - MAX_CALL_HISTORY);

        // 异步写入 Supabase（不阻塞主流程）
        logApiCall({
            provider,
            response_time_ms: responseTime,
            is_success: true,
            call_type: metadata?.callType,
            query_hash: metadata?.queryHash,
            innovation_id: metadata?.innovationId,
            estimated_tokens: metadata?.estimatedTokens || estimateTokens(responseTime),
            session_id: getSessionId(),
            called_at: new Date().toISOString(),
        }).catch(() => { });

        console.log(`[ApiMonitor] ✅ ${provider} | ${record.callType} | ${responseTime}ms`);
        return result;
    } catch (error: unknown) {
        const responseTime = Math.round(performance.now() - startTime);

        const record: CallRecord = {
            provider,
            callType: metadata?.callType || 'call',
            responseTimeMs: responseTime,
            isSuccess: false,
            errorMessage: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
        };
        callHistory.push(record);
        if (callHistory.length > MAX_CALL_HISTORY) callHistory.splice(0, callHistory.length - MAX_CALL_HISTORY);

        logApiCall({
            provider,
            response_time_ms: responseTime,
            is_success: false,
            error_message: record.errorMessage,
            call_type: metadata?.callType,
            query_hash: metadata?.queryHash,
            innovation_id: metadata?.innovationId,
            estimated_tokens: 0,
            session_id: getSessionId(),
            called_at: new Date().toISOString(),
        }).catch(() => { });

        console.log(`[ApiMonitor] ❌ ${provider} | ${record.callType} | ${responseTime}ms | ${record.errorMessage}`);
        throw error;
    }
}

// ==================== 统计查询 ====================

export interface ApiStats {
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    errorRate: number;         // 0-100
    avgResponseMs: number;
    estimatedCostUsd: number;
    byProvider: Record<string, {
        calls: number;
        success: number;
        failed: number;
        avgMs: number;
        costUsd: number;
    }>;
}

/**
 * 获取今日的 API 调用统计（基于内存数据，实时响应）
 */
export function getApiStats(): ApiStats {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime();

    const todayRecords = callHistory.filter((r) => r.timestamp >= todayTs);

    const total = todayRecords.length;
    const success = todayRecords.filter((r) => r.isSuccess).length;
    const failed = total - success;
    const avgMs = total > 0
        ? Math.round(todayRecords.reduce((s, r) => s + r.responseTimeMs, 0) / total)
        : 0;

    // 按 provider 分组
    const byProvider: ApiStats['byProvider'] = {};
    for (const r of todayRecords) {
        if (!byProvider[r.provider]) {
            byProvider[r.provider] = { calls: 0, success: 0, failed: 0, avgMs: 0, costUsd: 0 };
        }
        const p = byProvider[r.provider];
        p.calls++;
        if (r.isSuccess) p.success++;
        else p.failed++;
    }

    // 计算每个 provider 的平均响应时间和费用
    let totalCost = 0;
    for (const [provider, stats] of Object.entries(byProvider)) {
        const providerRecords = todayRecords.filter((r) => r.provider === provider);
        stats.avgMs = Math.round(providerRecords.reduce((s, r) => s + r.responseTimeMs, 0) / stats.calls);

        // 费用估算
        const pricing = COST_PER_1K_TOKENS[provider];
        if (pricing) {
            const totalTokens = providerRecords
                .filter((r) => r.isSuccess)
                .reduce((s, r) => s + estimateTokens(r.responseTimeMs), 0);
            stats.costUsd = Number(((totalTokens / 1000) * (pricing.input + pricing.output)).toFixed(4));
            totalCost += stats.costUsd;
        }
    }

    return {
        totalCalls: total,
        successCalls: success,
        failedCalls: failed,
        errorRate: total > 0 ? Number(((failed / total) * 100).toFixed(1)) : 0,
        avgResponseMs: avgMs,
        estimatedCostUsd: Number(totalCost.toFixed(4)),
        byProvider,
    };
}

/**
 * 获取最近 N 条调用记录（用于详情展示）
 */
export function getRecentCalls(limit = 20): CallRecord[] {
    return [...callHistory].reverse().slice(0, limit);
}

// ==================== Supabase 写入 ====================

async function logApiCall(data: Record<string, unknown>): Promise<void> {
    try {
        const { adminDb } = await import('@/lib/db/factory');
        const { error } = await adminDb.from('api_call_logs').insert(data);
        if (error) {
            console.error('[ApiMonitor] 写入 Supabase 日志失败:', error.message);
        }
    } catch (err: unknown) {
        // 全局异常捕捉，避免弄崩主流程
        console.error('[ApiMonitor] logApiCall 致命异常:', (err instanceof Error ? err.message : String(err)) || err);
    }
}
