/**
 * 插件市场 — 发布代理 API（开源版）
 *
 * POST /api/marketplace/publish
 *
 * 将发布请求代理到 Pro 中心 Marketplace。
 * 需要在环境变量中配置 NOVOSCAN_PRO_MARKETPLACE_TOKEN。
 *
 * Body: { manifest, github_url?, npm_package?, changelog? }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    publishToProMarketplace,
    isBridgeConfigured,
} from '@/lib/services/marketplaceBridge';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // 检查桥接是否已配置
        if (!isBridgeConfigured()) {
            return NextResponse.json(
                {
                    success: false,
                    error: '未配置 Pro Marketplace 连接',
                    help: '请先访问 Pro 端 OAuth 授权页获取开发者令牌，然后设置 NOVOSCAN_PRO_MARKETPLACE_TOKEN 环境变量。',
                },
                { status: 503 }
            );
        }

        // 解析请求体
        const body = await request.json();
        const { manifest, github_url, npm_package, changelog } = body;

        if (!manifest) {
            return NextResponse.json(
                { success: false, error: '缺少 manifest 字段' },
                { status: 400 }
            );
        }

        // 代理到 Pro 发布 API
        const result = await publishToProMarketplace(manifest, {
            github_url,
            npm_package,
            changelog,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            plugin: result.plugin,
            isUpdate: result.isUpdate,
            version: result.version,
            rateLimitRemaining: result.rateLimitRemaining,
            rateLimitTotal: result.rateLimitTotal,
        }, {
            status: result.isUpdate ? 200 : 201,
        });

    } catch (error) {
        console.error('[Marketplace/Publish] 代理发布异常:', error);
        return NextResponse.json(
            { success: false, error: '发布请求失败' },
            { status: 500 }
        );
    }
}
