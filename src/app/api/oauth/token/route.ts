export const dynamic = 'force-dynamic';

/**
 * OAuth Token 端点 — 用 authorization code 换取 access_token
 *
 * ChatGPT 会 POST 到此端点：
 *   - grant_type: authorization_code
 *   - code: 从授权页面获得的 code
 *   - redirect_uri: 回调 URL
 *
 * 返回 access_token（即用户的 API Key）
 */

import { NextResponse } from 'next/server';
import { codeStore } from '@/app/api/oauth/store';

export async function POST(request: Request) {
    try {
        // ChatGPT 可能以 form-urlencoded 或 JSON 发送
        const contentType = request.headers.get('content-type') || '';
        let grantType: string, code: string;

        if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await request.formData();
            grantType = formData.get('grant_type') as string || '';
            code = formData.get('code') as string || '';
        } else {
            const body = await request.json();
            grantType = body.grant_type || '';
            code = body.code || '';
        }

        // 仅支持 authorization_code 模式
        if (grantType !== 'authorization_code') {
            return NextResponse.json(
                { error: 'unsupported_grant_type', error_description: '仅支持 authorization_code' },
                { status: 400 }
            );
        }

        if (!code) {
            return NextResponse.json(
                { error: 'invalid_request', error_description: '缺少 code 参数' },
                { status: 400 }
            );
        }

        // 查找并消费 code
        const stored = await codeStore.get(code);
        if (!stored) {
            return NextResponse.json(
                { error: 'invalid_grant', error_description: 'code 无效或已过期' },
                { status: 400 }
            );
        }

        // code 一次性使用
        await codeStore.delete(code);

        // 检查过期
        if (Date.now() > stored.expiresAt) {
            return NextResponse.json(
                { error: 'invalid_grant', error_description: 'code 已过期' },
                { status: 400 }
            );
        }

        // 返回 access_token（直接使用 API Key 作为 token）
        console.log(`[OAuth] ✅ Token 发放成功，code: ${code.slice(0, 20)}...`);

        return NextResponse.json({
            access_token: stored.apiKey,
            token_type: 'Bearer',
            expires_in: 86400 * 365,  // 1 年（实际有效期由 mcp_api_keys 表控制）
            scope: 'novoscan:analyze',
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[OAuth] Token 端点错误:', msg);
        return NextResponse.json(
            { error: 'server_error', error_description: msg },
            { status: 500 }
        );
    }
}
