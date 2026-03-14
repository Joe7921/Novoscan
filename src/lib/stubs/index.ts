/**
 * 桩模块统一入口 — 开源版
 *
 * 将所有云端功能桩（空实现）集中在此文件。
 * 开源版中这些功能被禁用或返回默认值。
 *
 * 包含：
 * - checkCostLimit / recordSerpEngineCall — FinOps 成本控制（桩）
 * - checkFeatureAccess — 功能权限检查（桩，始终允许）
 */

// ==================== 成本限速器 ====================

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

// ==================== 功能权限检查 ====================

/**
 * 检查用户是否有指定功能的访问权限（桩实现）
 * 开源版所有功能对所有用户开放，始终返回 true。
 */
export async function checkFeatureAccess(
    _userId: string,
    _featureKey: string,
): Promise<boolean> {
    return true;
}
