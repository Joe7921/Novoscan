/**
 * 统一获取当前用户的服务端函数
 *
 * 根据 AUTH_PROVIDER 环境变量自动切换：
 * - nextauth：使用 NextAuth auth() 获取 session
 * - supabase：使用 Supabase createClient().auth.getUser()
 *
 * 返回统一的用户对象格式，供所有 API 路由和服务端组件使用。
 */

/** 当前认证提供者 */
const AUTH_PROVIDER = (process.env.NEXT_PUBLIC_AUTH_PROVIDER || process.env.AUTH_PROVIDER || 'supabase') as 'nextauth' | 'supabase';

/** 统一的用户对象类型 */
export interface AuthUser {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
}

/**
 * 获取当前登录用户（服务端使用）
 * @returns 用户对象或 null
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
    if (AUTH_PROVIDER === 'nextauth') {
        // 动态导入避免 Supabase 模式下加载 NextAuth
        const { auth } = await import('./auth');
        const session = await auth();
        if (!session?.user) return null;
        return {
            id: session.user.id || '',
            email: session.user.email || '',
            name: session.user.name,
            image: session.user.image,
        };
    }

    // Supabase 模式
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.full_name || user.email?.split('@')[0],
        image: user.user_metadata?.avatar_url,
    };
}
