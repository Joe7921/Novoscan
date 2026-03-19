export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
/**
 * Magic Link 邮箱登录确认路由。
 * 当用户点击邮件中的 Magic Link 时，Supabase 会重定向到此 URL，
 * 携带 token_hash 和 type 参数。这里用这些参数验证令牌并创建会话。
 */
export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type') as 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email' | null;
    const next = searchParams.get('next') ?? '/';

    if (token_hash && type) {
        const { error, data } = await serverDb.auth.verifyOtp({
            type,
            token_hash,
        });

        if (!error && data?.user) {
            const forwardedHost = request.headers.get('x-forwarded-host');
            const isLocalEnv = process.env.NODE_ENV === 'development';

            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${next}`);
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`);
            } else {
                return NextResponse.redirect(`${origin}${next}`);
            }
        }
    }

    // 验证失败，重定向到错误页面
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
