/**
 * 插件市场 — 连接状态查询 API（开源版）
 *
 * GET /api/marketplace/status
 *
 * 返回当前开源版实例与 Pro 中心市场的连接状态：
 * - 是否已配置开发者令牌
 * - Pro 端是否可达
 * - 令牌是否仍然有效
 */

import { NextResponse } from 'next/server';
import {
    getBridgeConfig,
    isBridgeConfigured,
    fetchMarketplaceStats,
} from '@/lib/services/marketplaceBridge';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. 检查是否已配置
        if (!isBridgeConfigured()) {
            return NextResponse.json({
                connected: false,
                reason: 'not_configured',
                message: '未配置 Pro Marketplace 连接',
                help: '请设置 NOVOSCAN_PRO_MARKETPLACE_TOKEN 和 NOVOSCAN_PRO_URL 环境变量',
                oauth_url_hint: '{PRO_URL}/api/marketplace/oauth/authorize?redirect_uri={YOUR_CALLBACK}',
            });
        }

        const config = getBridgeConfig();

        // 2. 尝试访问 Pro 统计 API 验证连通性
        const statsResult = await fetchMarketplaceStats();

        if (!statsResult.success) {
            return NextResponse.json({
                connected: false,
                reason: 'unreachable',
                message: `无法连接 Pro 服务器: ${config?.proBaseUrl}`,
                proBaseUrl: config?.proBaseUrl,
                error: statsResult.error,
            });
        }

        // 3. 尝试用 token 调用需要认证的端点，验证令牌有效性
        let tokenValid = false;
        try {
            const response = await fetch(`${config!.proBaseUrl}/api/marketplace/publish/external`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config!.developerToken}`,
                },
                // 发送空 body 触发 400（Manifest 校验失败），而非 401（令牌无效）
                body: JSON.stringify({ manifest: {} }),
            });
            // 400 = 令牌有效但 manifest 无效 → 令牌 OK
            // 401 = 令牌无效
            tokenValid = response.status !== 401;
        } catch {
            // 网络错误不影响令牌状态判断
        }

        return NextResponse.json({
            connected: true,
            tokenValid,
            proBaseUrl: config?.proBaseUrl,
            marketplace: statsResult.data,
            message: tokenValid
                ? '已连接 Pro Marketplace，可以发布插件'
                : '已连接 Pro 服务器，但开发者令牌可能已过期，请重新授权',
        });

    } catch (error) {
        console.error('[Marketplace/Status] 异常:', error);
        return NextResponse.json(
            { connected: false, reason: 'error', error: '状态检查失败' },
            { status: 500 }
        );
    }
}
