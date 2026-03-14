/**
 * Supabase Auth 兼容适配器
 *
 * 当 AUTH_PROVIDER=supabase 时，提供与 NextAuth API 风格一致的接口封装。
 * 让客户端组件可以通过统一的接口调用 Supabase Auth。
 */

import { createClient } from '@/utils/supabase/client';
import type { AuthUser } from '../get-current-user';

/**
 * 获取当前 Supabase 用户（客户端使用）
 */
export async function getSupabaseUser(): Promise<AuthUser | null> {
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

/**
 * Supabase OAuth 登录
 */
export async function supabaseOAuthSignIn(provider: 'google' | 'github') {
    const supabase = createClient();
    return supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
        },
    });
}

/**
 * Supabase Magic Link 邮箱登录
 */
export async function supabaseMagicLinkSignIn(email: string) {
    const supabase = createClient();
    return supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
    });
}

/**
 * Supabase 登出
 */
export async function supabaseSignOut() {
    const supabase = createClient();
    return supabase.auth.signOut();
}

/**
 * 监听 Supabase 认证状态变化
 */
export function onSupabaseAuthStateChange(callback: (user: AuthUser | null) => void) {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
            if (session?.user) {
                callback({
                    id: session.user.id,
                    email: session.user.email || '',
                    name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
                    image: session.user.user_metadata?.avatar_url,
                });
            } else {
                callback(null);
            }
        }
    );
    return subscription;
}
