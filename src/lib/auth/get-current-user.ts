/**
 * 统一获取当前用户的服务端函数
 *
 * 开源版：无需登录，直接返回 null
 * 保留接口以兼容上层调用链（API 路由 check-access 等）
 */

/** 统一的用户对象类型 */
export interface AuthUser {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
}

/**
 * 获取当前登录用户（服务端使用）
 * 开源版始终返回 null（无需登录）
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
    return null;
}
