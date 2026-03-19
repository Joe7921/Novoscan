/**
 * 插件市场 — 发布桥接服务（开源版 → Pro 中心市场）
 *
 * 管理 Marketplace Developer Token 的存储和验证，
 * 并提供向 Pro 中心市场代理发布请求的工具函数。
 *
 * 开源版用户通过 Pro OAuth 获取令牌后存入环境变量，
 * 此服务负责读取令牌并代理请求到 Pro 发布 API。
 */

// ======================== 常量 ========================

/** Pro 端发布 API 路径后缀 */
const PUBLISH_PATH = '/api/marketplace/publish/external';

/** Pro 端列表 API 路径后缀 */
const LIST_PATH = '/api/marketplace/list';

/** Pro 端详情 API 路径后缀 */
const DETAIL_PATH = '/api/marketplace/detail';

/** Pro 端统计 API 路径后缀 */
const STATS_PATH = '/api/marketplace/stats';

// ======================== 类型定义 ========================

/** 发布桥接配置 */
export interface MarketplaceBridgeConfig {
    /** Pro 端基础 URL（如 https://novoscan.cn） */
    proBaseUrl: string;
    /** 开发者令牌 */
    developerToken: string;
}

/** 发布结果 */
export interface PublishResult {
    success: boolean;
    plugin?: Record<string, unknown>;
    isUpdate?: boolean;
    version?: string;
    error?: string;
    rateLimitRemaining?: number;
    rateLimitTotal?: number;
}

/** 列表查询参数 */
export interface ListParams {
    page?: number;
    pageSize?: number;
    category?: string;
    verification?: string;
    search?: string;
    sort?: 'popular' | 'newest' | 'rating';
}

// ======================== 配置读取 ========================

/**
 * 从环境变量读取桥接配置
 * @returns 配置对象，或 null（未配置时）
 */
export function getBridgeConfig(): MarketplaceBridgeConfig | null {
    const proBaseUrl = process.env.NOVOSCAN_PRO_URL || process.env.NEXT_PUBLIC_SITE_URL;
    const developerToken = process.env.NOVOSCAN_PRO_MARKETPLACE_TOKEN;

    if (!developerToken) {
        return null;
    }

    return {
        proBaseUrl: proBaseUrl?.replace(/\/$/, '') || 'https://novoscan.cn',
        developerToken,
    };
}

/**
 * 检查桥接是否已配置
 */
export function isBridgeConfigured(): boolean {
    return !!process.env.NOVOSCAN_PRO_MARKETPLACE_TOKEN;
}

// ======================== 发布 API ========================

/**
 * 通过桥接向 Pro 中心市场发布插件
 *
 * @param manifest - 插件 manifest 对象
 * @param options - 可选：github_url, npm_package, changelog
 * @returns 发布结果
 */
export async function publishToProMarketplace(
    manifest: Record<string, unknown>,
    options?: {
        github_url?: string;
        npm_package?: string;
        changelog?: string;
    }
): Promise<PublishResult> {
    const config = getBridgeConfig();

    if (!config) {
        return {
            success: false,
            error: '未配置 Pro Marketplace 连接。请先运行 OAuth 授权获取开发者令牌，并设置 NOVOSCAN_PRO_MARKETPLACE_TOKEN 环境变量。',
        };
    }

    const url = `${config.proBaseUrl}${PUBLISH_PATH}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.developerToken}`,
            },
            body: JSON.stringify({
                manifest,
                github_url: options?.github_url || null,
                npm_package: options?.npm_package || null,
                changelog: options?.changelog || '',
            }),
        });

        // 处理 429 限流
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || '60';
            return {
                success: false,
                error: `发布操作过于频繁，请 ${retryAfter} 秒后重试`,
            };
        }

        // 处理 401 令牌无效/过期
        if (response.status === 401) {
            const data = await response.json().catch(() => ({}));
            return {
                success: false,
                error: `授权失败：${data.error || '令牌无效或已过期，请重新授权'}`,
            };
        }

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.error || `发布失败 (HTTP ${response.status})`,
            };
        }

        // 提取限流信息
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const limit = response.headers.get('X-RateLimit-Limit');

        return {
            success: true,
            plugin: data.plugin,
            isUpdate: data.isUpdate,
            version: data.version,
            rateLimitRemaining: remaining ? parseInt(remaining, 10) : undefined,
            rateLimitTotal: limit ? parseInt(limit, 10) : undefined,
        };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: `无法连接 Pro 服务器 (${config.proBaseUrl})：${msg}`,
        };
    }
}

// ======================== 只读查询 API ========================

/**
 * 从 Pro 中心市场查询插件列表（无需令牌）
 */
export async function fetchMarketplaceList(params?: ListParams): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
}> {
    const config = getBridgeConfig();
    const baseUrl = config?.proBaseUrl || process.env.NOVOSCAN_PRO_URL || 'https://novoscan.cn';

    const url = new URL(`${baseUrl}${LIST_PATH}`);
    if (params?.page) url.searchParams.set('page', String(params.page));
    if (params?.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
    if (params?.category) url.searchParams.set('category', params.category);
    if (params?.verification) url.searchParams.set('verification', params.verification);
    if (params?.search) url.searchParams.set('search', params.search);
    if (params?.sort) url.searchParams.set('sort', params.sort);

    try {
        const response = await fetch(url.toString());
        const data = await response.json();
        return { success: response.ok, data };
    } catch (error) {
        return { success: false, error: `无法连接 Pro 市场: ${error}` };
    }
}

/**
 * 从 Pro 中心市场查询插件详情（无需令牌）
 */
export async function fetchMarketplaceDetail(pluginId: string): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
}> {
    const config = getBridgeConfig();
    const baseUrl = config?.proBaseUrl || process.env.NOVOSCAN_PRO_URL || 'https://novoscan.cn';

    try {
        const response = await fetch(`${baseUrl}${DETAIL_PATH}/${pluginId}`);
        const data = await response.json();
        return { success: response.ok, data };
    } catch (error) {
        return { success: false, error: `无法连接 Pro 市场: ${error}` };
    }
}

/**
 * 从 Pro 中心市场查询统计数据（无需令牌）
 */
export async function fetchMarketplaceStats(): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
}> {
    const config = getBridgeConfig();
    const baseUrl = config?.proBaseUrl || process.env.NOVOSCAN_PRO_URL || 'https://novoscan.cn';

    try {
        const response = await fetch(`${baseUrl}${STATS_PATH}`);
        const data = await response.json();
        return { success: response.ok, data };
    } catch (error) {
        return { success: false, error: `无法连接 Pro 市场: ${error}` };
    }
}
