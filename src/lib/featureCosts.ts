/**
 * 功能扣费桩模块 — 开源版
 *
 * 开源版不含付费系统，所有功能免费。
 * 此桩模块保持接口兼容，chargeForFeature 始终放行。
 */

/** 各功能的消耗点数（仅用于退费逻辑的常量引用） */
export const FEATURE_COSTS: Record<string, number> = {
    'novoscan-full': 15,
    'novoscan-flash': 8,
    'novoscan-retry': 8,
    'clawscan-full': 12,
    'clawscan-registry': 5,
    'bizscan': 12,
};

/**
 * 扣费（桩实现）— 始终返回成功
 */
export async function chargeForFeature(
    _userId: string,
    _featureKey: string,
): Promise<{ success: true } | { success: false; error: string; currentBalance?: number; required?: number }> {
    return { success: true };
}

/** 新用户欢迎奖励点数（开源版无实际扣费，此常量仅为兼容引用） */
export const WELCOME_BONUS = 100;
