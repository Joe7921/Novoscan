/**
 * 钱包服务桩模块 — 开源版
 *
 * 开源版不含积分系统，此桩模块保持接口兼容。
 */

/** 获取用户余额（桩实现）— 返回无限余额 */
export async function getBalance(_userId: string): Promise<number> {
    return Infinity;
}

/** 扣减积分（桩实现）— 始终成功 */
export async function deductPoints(
    _userId: string,
    _amount: number,
    _reason?: string,
): Promise<{ success: boolean }> {
    return { success: true };
}

/** 增加积分（桩实现）— 静默忽略 */
export async function addPoints(
    _userId: string,
    _amount: number,
    _reason?: string,
): Promise<void> {
    // 开源版无积分系统
}
