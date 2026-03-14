/**
 * 成本限速器 — 桩模块
 * 
 * 预留接口（FinOps 成本控制），当前为空实现。
 * 用于限制 API 调用成本，防止超额使用。
 */

/** 成本计费提供商标识 */
export type CostProvider = string;

/**
 * 检查当前调用是否超出成本限额
 * @returns 始终允许（桩实现）
 */
export async function checkCostLimit(
    _provider: CostProvider,
    _callType: string,
): Promise<{ allowed: boolean; reason?: string }> {
    return { allowed: true };
}

/**
 * 记录搜索引擎调用（桩实现）
 * 开源版不做成本追踪，空操作。
 */
export function recordSerpEngineCall(_engine: string): void {
    // 开源版空操作
}
