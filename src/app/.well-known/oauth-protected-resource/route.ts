/**
 * OAuth Protected Resource Metadata (RFC 9728)
 *
 * 支持两种路径：
 *   - /.well-known/oauth-protected-resource (根路径)
 *   - /.well-known/oauth-protected-resource/api/mcp (MCP 路径特定)
 *
 * ChatGPT 会优先查找 MCP 路径特定版本
 */

import { NextResponse } from 'next/server';

function buildResponse(request: Request) {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    return NextResponse.json({
        resource: `${baseUrl}/api/mcp`,
        authorization_servers: [baseUrl],
    }, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}

export async function GET(request: Request) {
    return buildResponse(request);
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
