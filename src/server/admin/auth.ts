/**
 * Admin API 鉴权中间件
 *
 * 使用 ADMIN_SECRET 环境变量做 Bearer Token 校验。
 * 开源版轻量方案，适合自托管场景。
 */

import { NextResponse } from 'next/server';

/**
 * 校验 Admin API 请求的 Authorization 头
 *
 * 使用方式：
 * ```ts
 * const authError = verifyAdminAuth(request);
 * if (authError) return authError;
 * ```
 *
 * @returns 鉴权失败时返回 NextResponse，成功时返回 null
 */
export function verifyAdminAuth(request: Request): NextResponse | null {
    const secret = process.env.ADMIN_SECRET;

    // 未配置 ADMIN_SECRET 时拒绝所有请求
    if (!secret) {
        return NextResponse.json(
            { error: '未配置 ADMIN_SECRET 环境变量' },
            { status: 500 }
        );
    }

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    if (token !== secret) {
        return NextResponse.json(
            { error: '未授权访问' },
            { status: 401 }
        );
    }

    return null; // 鉴权通过
}
