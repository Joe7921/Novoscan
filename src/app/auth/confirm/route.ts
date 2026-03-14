export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { addPoints, getBalance } from '@/lib/services/walletService';
import { WELCOME_BONUS } from '@/lib/featureCosts';

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
        const supabase = createClient();
        const { error, data } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        });

        if (!error && data?.user) {
            // 🎁 新用户欢迎奖励：首次注册赠送点数
            try {
                const balance = await getBalance(data.user.id);
                if (balance === 0) {
                    await addPoints(data.user.id, WELCOME_BONUS, '新用户欢迎奖励', 'admin');
                    console.log(`[Auth Confirm] 🎁 新用户 ${data.user.id} 赠送 ${WELCOME_BONUS} 点欢迎奖励`);
                }
            } catch (e: any) {
                console.warn('[Auth Confirm] 欢迎奖励发放失败(不影响登录):', e.message);
            }

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
