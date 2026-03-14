import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 在中间件中刷新用户会话并写入 Cookie。
 * 确保请求到达页面或 API 路由之前，会话始终处于活跃状态。
 */
export async function updateSession(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error(
            '[Supabase] 缺少环境变量 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY，请检查 Vercel / .env.local 配置'
        );
    }

    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        supabaseUrl || 'http://localhost:0',
        supabaseAnonKey || 'fallback-key-for-build-only',
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // 重要：不要在 createServerClient 和 supabase.auth.getUser() 之间写任何逻辑。
    // 简单的错误也可能导致用户被意外登出。
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // 在此可添加路由保护逻辑，例如：
    // if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/auth')) {
    //     const url = request.nextUrl.clone();
    //     url.pathname = '/login';
    //     return NextResponse.redirect(url);
    // }

    return supabaseResponse;
}
