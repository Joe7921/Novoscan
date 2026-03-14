'use client';

/**
 * Auth Session Provider 封装组件
 *
 * - AUTH_PROVIDER=nextauth：渲染 NextAuth SessionProvider
 * - AUTH_PROVIDER=supabase：直接渲染 children（Supabase 不需要 Provider）
 *
 * 同时提供 useAuthSession hook 供客户端组件获取统一的用户状态。
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { SessionProvider, useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react';
import type { AuthUser } from '@/lib/auth/get-current-user';

// ============ 类型定义 ============

interface AuthSessionContextValue {
    /** 当前用户 */
    user: AuthUser | null;
    /** 是否正在加载 */
    loading: boolean;
    /** OAuth 登录 */
    oauthSignIn: (provider: 'google' | 'github') => Promise<void>;
    /** 邮箱 Magic Link 登录（仅 Supabase 模式） */
    magicLinkSignIn: (email: string) => Promise<{ error?: string }>;
    /** 邮箱+密码登录（仅 NextAuth 模式） */
    credentialsSignIn: (email: string, password: string) => Promise<{ error?: string }>;
    /** 邮箱+密码注册（仅 NextAuth 模式） */
    credentialsRegister: (email: string, password: string) => Promise<{ error?: string }>;
    /** 登出 */
    handleSignOut: () => Promise<void>;
}

const AUTH_PROVIDER = (process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'supabase') as 'nextauth' | 'supabase';

const AuthSessionContext = createContext<AuthSessionContextValue>({
    user: null,
    loading: true,
    oauthSignIn: async () => {},
    magicLinkSignIn: async () => ({}),
    credentialsSignIn: async () => ({}),
    credentialsRegister: async () => ({}),
    handleSignOut: async () => {},
});

// ============ NextAuth 内部 Provider ============

function NextAuthInnerProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();

    const user: AuthUser | null = useMemo(() => {
        if (!session?.user) return null;
        return {
            id: (session.user as unknown).id || '',
            email: session.user.email || '',
            name: session.user.name,
            image: session.user.image,
        };
    }, [session]);

    const oauthSignIn = useCallback(async (provider: 'google' | 'github') => {
        await nextAuthSignIn(provider, { callbackUrl: '/' });
    }, []);

    const magicLinkSignIn = useCallback(async (_email: string) => {
        return { error: 'NextAuth 模式不支持 Magic Link，请使用邮箱+密码登录' };
    }, []);

    const credentialsSignIn = useCallback(async (email: string, password: string) => {
        try {
            const result = await nextAuthSignIn('credentials', {
                email,
                password,
                action: 'login',
                redirect: false,
            });
            if (result?.error) {
                return { error: '邮箱或密码错误' };
            }
            // 登录成功刷新页面
            window.location.reload();
            return {};
        } catch {
            return { error: '登录失败，请稍后重试' };
        }
    }, []);

    const credentialsRegister = useCallback(async (email: string, password: string) => {
        try {
            const result = await nextAuthSignIn('credentials', {
                email,
                password,
                action: 'register',
                redirect: false,
            });
            if (result?.error) {
                return { error: result.error };
            }
            window.location.reload();
            return {};
        } catch {
            return { error: '注册失败，请稍后重试' };
        }
    }, []);

    const handleSignOut = useCallback(async () => {
        await nextAuthSignOut({ callbackUrl: '/' });
    }, []);

    const value = useMemo<AuthSessionContextValue>(() => ({
        user,
        loading: status === 'loading',
        oauthSignIn,
        magicLinkSignIn,
        credentialsSignIn,
        credentialsRegister,
        handleSignOut,
    }), [user, status, oauthSignIn, magicLinkSignIn, credentialsSignIn, credentialsRegister, handleSignOut]);

    return (
        <AuthSessionContext.Provider value={value}>
            {children}
        </AuthSessionContext.Provider>
    );
}

// ============ Supabase 内部 Provider ============

function SupabaseInnerProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 动态导入避免 NextAuth 模式下加载 Supabase
        import('@/lib/auth/providers/supabase-auth-adapter').then(({ getSupabaseUser, onSupabaseAuthStateChange }) => {
            getSupabaseUser().then(u => {
                setUser(u);
                setLoading(false);
            });
            const subscription = onSupabaseAuthStateChange(u => {
                setUser(u);
            });
            return () => subscription.unsubscribe();
        });
    }, []);

    const oauthSignIn = useCallback(async (provider: 'google' | 'github') => {
        const { supabaseOAuthSignIn } = await import('@/lib/auth/providers/supabase-auth-adapter');
        const { error } = await supabaseOAuthSignIn(provider);
        if (error) {
            console.error(`${provider} 登录失败:`, error.message);
        }
    }, []);

    const magicLinkSignIn = useCallback(async (email: string) => {
        const { supabaseMagicLinkSignIn } = await import('@/lib/auth/providers/supabase-auth-adapter');
        const { error } = await supabaseMagicLinkSignIn(email);
        if (error) {
            console.error('邮箱登录失败:', error.message);
            return { error: '发送失败，请稍后重试' };
        }
        return {};
    }, []);

    const credentialsSignIn = useCallback(async (_email: string, _password: string) => {
        return { error: 'Supabase 模式不支持邮箱+密码登录，请使用 Magic Link' };
    }, []);

    const credentialsRegister = useCallback(async (_email: string, _password: string) => {
        return { error: 'Supabase 模式不支持邮箱+密码注册，请使用 Magic Link' };
    }, []);

    const handleSignOut = useCallback(async () => {
        const { supabaseSignOut } = await import('@/lib/auth/providers/supabase-auth-adapter');
        await supabaseSignOut();
        setUser(null);
        window.location.reload();
    }, []);

    const value = useMemo<AuthSessionContextValue>(() => ({
        user,
        loading,
        oauthSignIn,
        magicLinkSignIn,
        credentialsSignIn,
        credentialsRegister,
        handleSignOut,
    }), [user, loading, oauthSignIn, magicLinkSignIn, credentialsSignIn, credentialsRegister, handleSignOut]);

    return (
        <AuthSessionContext.Provider value={value}>
            {children}
        </AuthSessionContext.Provider>
    );
}

// ============ 统一导出 ============

/**
 * Auth Session Provider
 * 根据 AUTH_PROVIDER 自动选择 NextAuth 或 Supabase 实现
 */
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
    if (AUTH_PROVIDER === 'nextauth') {
        return (
            <SessionProvider>
                <NextAuthInnerProvider>
                    {children}
                </NextAuthInnerProvider>
            </SessionProvider>
        );
    }

    return (
        <SupabaseInnerProvider>
            {children}
        </SupabaseInnerProvider>
    );
}

/**
 * 统一的客户端 auth hook
 * 返回用户状态、登录、登出等操作，自动适配当前 AUTH_PROVIDER
 */
export function useAuthSession() {
    return useContext(AuthSessionContext);
}
