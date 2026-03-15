import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 创建用于服务端组件 / API 路由的 Supabase 客户端。
 * 通过 Next.js cookies() 实现会话的读取（只读模式）。
 */
export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn(
            '[Supabase] 缺少环境变量 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY，请检查 Vercel / .env.local 配置'
        );
    }

    const cookieStore = cookies();

    return createServerClient(
        supabaseUrl || 'http://localhost:0',
        supabaseAnonKey || 'fallback-key-for-build-only',
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // 在服务端组件中调用 setAll 会失败，这是正常的。
                        // 如果你有中间件来刷新过期的用户会话，这里可以安全忽略。
                    }
                },
            },
        }
    );
}
