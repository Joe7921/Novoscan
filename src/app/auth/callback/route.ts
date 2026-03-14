export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * OAuth 回调路由。
 * Google/GitHub 授权成功后，Supabase 会重定向到此 URL 并携带 code 参数。
 * 这里用 code 交换会话令牌，之后将用户重定向到首页。
 */
export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    // 可选：Supabase 可以传回一个 next 参数，用于重定向
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = createClient();
        const { error, data } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data?.user) {
            // 将 next 中不安全的绝对路径变为相对路径
            const forwardedHost = request.headers.get('x-forwarded-host');
            const isLocalEnv = process.env.NODE_ENV === 'development';

            if (isLocalEnv) {
                // 本地开发环境直接重定向
                return NextResponse.redirect(`${origin}${next}`);
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`);
            } else {
                return NextResponse.redirect(`${origin}${next}`);
            }
        }
    }

    // 如果 code 不存在或交换失败，重定向到首页并展示错误提示
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
