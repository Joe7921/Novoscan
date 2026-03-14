/**
 * 功能权限检查桩模块 — 开源版
 *
 * 开源版所有功能对所有用户开放，始终返回 true。
 */

/** 检查用户是否有指定功能的访问权限（桩实现）— 始终允许 */
export async function checkFeatureAccess(
    _userId: string,
    _featureKey: string,
): Promise<boolean> {
    return true;
}
