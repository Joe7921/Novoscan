import { NextResponse, type NextRequest } from 'next/server';

/**
 * 开源版中间件 — 简化版
 *
 * 开源版无需认证，所有路由直接放行。
 * 保留中间件文件以便未来启用认证时快速恢复。
 */
export async function middleware(_request: NextRequest) {
    return NextResponse.next();
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
