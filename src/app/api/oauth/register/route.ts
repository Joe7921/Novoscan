export const dynamic = 'force-dynamic';

/**
 * OAuth Dynamic Client Registration (RFC 7591)
 *
 * ChatGPT 等 MCP 客户端会自动调用此端点注册为 OAuth 客户端。
 * 我们简单地接受所有客户端注册请求并返回 client_id。
 */

import { NextResponse } from 'next/server';

// 简单的客户端注册存储（生产环境用数据库）
const registeredClients = new Map<string, Record<string, unknown>>();

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 生成 client_id
        const clientId = `nvclient_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const clientInfo = {
            client_id: clientId,
            client_name: body.client_name || 'MCP Client',
            redirect_uris: body.redirect_uris || [],
            grant_types: body.grant_types || ['authorization_code'],
            response_types: body.response_types || ['code'],
            token_endpoint_auth_method: body.token_endpoint_auth_method || 'none',
            client_id_issued_at: Math.floor(Date.now() / 1000),
        };

        registeredClients.set(clientId, clientInfo);
        console.log(`[OAuth] 📝 客户端注册: ${clientId} (${body.client_name || 'unnamed'})`);

        return NextResponse.json(clientInfo, {
            status: 201,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': '*',
            },
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
            { error: 'invalid_client_metadata', error_description: msg },
            { status: 400 }
        );
    }
}

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        },
    });
}
