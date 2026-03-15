import { createBrowserClient } from '@supabase/ssr';

/**
 * 创建用于客户端组件的 Supabase 浏览器端客户端。
 * 在客户端组件中调用此函数获取 supabase 实例。
 */
export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn(
            '[Supabase] 缺少环境变量 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY，请检查 Vercel / .env.local 配置'
        );
    }

    return createBrowserClient(
        supabaseUrl || 'http://localhost:0',
        supabaseAnonKey || 'fallback-key-for-build-only'
    );
}
