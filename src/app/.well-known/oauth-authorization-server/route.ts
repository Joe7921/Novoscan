/**
 * OAuth Authorization Server Metadata (RFC 8414)
 *
 * 发现端点，返回授权服务器的能力声明和端点 URL。
 * ChatGPT 通过此端点发现 authorization_endpoint 和 token_endpoint。
 *
 * 支持动态客户端注册（registration_endpoint），
 * ChatGPT 会自动注册为 OAuth 客户端。
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    return NextResponse.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
        token_endpoint: `${baseUrl}/api/oauth/token`,
        registration_endpoint: `${baseUrl}/api/oauth/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256', 'plain'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
        scopes_supported: ['novoscan:analyze'],
    }, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        },
    });
}
