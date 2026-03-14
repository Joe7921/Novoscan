import { NextResponse, type NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/auth.config';

/**
 * 当前认证提供者
 * 注意：middleware 中无法使用 NEXT_PUBLIC_ 前缀的环境变量（Edge Runtime 限制），
 * 因此只读取 AUTH_PROVIDER。
 */
const AUTH_PROVIDER = (process.env.AUTH_PROVIDER || 'supabase') as 'nextauth' | 'supabase';

/**
 * NextAuth Edge-safe 中间件实例
 * 仅使用 auth.config.ts（不含 CredentialsProvider / bcrypt），
 * 因此不会触发 Edge Runtime 的 Node.js API 警告。
 */
const { auth: nextAuthMiddleware } = NextAuth(authConfig);

/**
 * Next.js 中间件入口。
 * 根据 AUTH_PROVIDER 切换认证中间件：
 * - nextauth：使用 NextAuth 的 edge-safe auth 中间件
 * - supabase：使用 Supabase updateSession 刷新会话
 */
export async function middleware(request: NextRequest) {
    // 性能优化：API 路由不需要刷新前端 Auth session，直接放行
    // 但 NextAuth 的 /api/auth/* 路由需要放行
    if (request.nextUrl.pathname.startsWith('/api') &&
        !request.nextUrl.pathname.startsWith('/api/auth')) {
        return NextResponse.next();
    }

    // 性能优化：首页和公开页面跳过 session 刷新
    const publicPaths = ['/', '/docs', '/auth', '/health'];
    const isPublicPath = publicPaths.some(p =>
        p === '/' ? request.nextUrl.pathname === '/' : request.nextUrl.pathname.startsWith(p)
    );
    if (isPublicPath) {
        return NextResponse.next();
    }

    if (AUTH_PROVIDER === 'nextauth') {
        // NextAuth 模式：使用 edge-safe 的 auth 中间件
        // 仅做 JWT token 验证，不涉及 bcrypt 或数据库操作
        const session = await nextAuthMiddleware();
        return NextResponse.next();
    }

    // Supabase 模式：使用原有的 updateSession 刷新会话
    const { updateSession } = await import('@/utils/supabase/middleware');
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * 匹配除以下路径之外的所有请求：
         * - _next/static (静态资源)
         * - _next/image (图片优化)
         * - favicon.ico (浏览器自动请求)
         * - 其他静态文件 (svg, png, jpg, jpeg, gif, webp, ico)
         */
        '/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};
