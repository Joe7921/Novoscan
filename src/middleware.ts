import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

/**
 * Next.js 中间件入口。
 * 在每个匹配的请求前刷新 Supabase Auth 会话。
 */
export async function middleware(request: NextRequest) {
    // 性能优化：API 路由不需要刷新前端 Auth session，直接放行
    if (request.nextUrl.pathname.startsWith('/api')) {
        return NextResponse.next();
    }

    // 性能优化：首页和公开页面跳过 Supabase session 刷新
    // 这些页面的登录检查已在客户端完成，跳过 middleware 可减少 200-500ms TTFB（尤其中国用户）
    const publicPaths = ['/', '/docs', '/auth', '/health'];
    const isPublicPath = publicPaths.some(p =>
        p === '/' ? request.nextUrl.pathname === '/' : request.nextUrl.pathname.startsWith(p)
    );
    if (isPublicPath) {
        return NextResponse.next();
    }

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
