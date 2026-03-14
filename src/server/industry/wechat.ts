/**
 * 微信公众号文章搜索服务
 *
 * 通过 SerpAPI 限定 site:mp.weixin.qq.com 获取已被 Google 收录的公众号文章。
 * 可获取：文章标题、摘要（含部分小标题信息）、链接、公众号名称。
 *
 * 成本：复用现有 SerpAPI 配额，无额外费用。
 */

import { checkCostLimit } from '@/lib/services/costLimiter';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const SERPAPI_URL = process.env.SERPAPI_BASE_URL || 'https://serpapi.com/search';

// ==================== 类型 ====================

export interface WechatArticle {
    title: string;           // 文章标题
    url: string;             // 文章链接（mp.weixin.qq.com）
    description: string;     // 摘要/部分内容（通常包含小标题）
    author?: string;         // 公众号名称（从 displayed_link 解析）
    publishDate?: string;    // 发布日期（从 snippet 或 date 解析）
    source: 'wechat';
}

export interface WechatSearchOptions {
    num?: number;            // 结果数量，默认 8，最大 15
}

// ==================== 搜索 ====================

/**
 * 微信公众号文章搜索
 *
 * 使用 SerpAPI + site:mp.weixin.qq.com 限定搜索，
 * 从 Google 索引中获取已收录的公众号文章。
 *
 * @param query - 搜索查询字符串
 * @param options - 搜索选项
 */
export async function searchWechatArticles(
    query: string,
    options?: WechatSearchOptions
): Promise<WechatArticle[]> {
    if (!SERPAPI_KEY) {
        console.warn('[微信公众号] SerpAPI Key 未配置，跳过微信搜索');
        return [];
    }

    const limitCheck = await checkCostLimit('serpapi', 'search');
    if (!limitCheck.allowed) {
        console.warn('[微信公众号] SerpAPI 配额已达上限，跳过微信搜索');
        return [];
    }

    const num = Math.min(options?.num ?? 8, 15);

    // 使用 site: 限定搜索微信公众号域名
    const siteQuery = `site:mp.weixin.qq.com ${query}`;

    const params = new URLSearchParams({
        q: siteQuery,
        api_key: SERPAPI_KEY,
        engine: 'google',
        num: String(num),
        hl: 'zh-CN',
        gl: 'cn',
    });

    const url = `${SERPAPI_URL}?${params.toString()}`;

    console.log(`[微信公众号] 搜索: ${query} | ${num} 条`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 429) {
                console.warn('[微信公众号] SerpAPI 请求频率超限');
            }
            throw new Error(`SerpAPI (WeChat) error: ${response.status}`);
        }

        const data = await response.json();

        const results: WechatArticle[] = (data.organic_results || [])
            .filter((item: any) => {
                // 仅保留 mp.weixin.qq.com 域名的结果
                const link = item.link || '';
                return link.includes('mp.weixin.qq.com');
            })
            .map((item: any) => ({
                title: item.title || '',
                url: item.link || '',
                description: item.snippet || '',
                author: extractWechatAuthor(item.displayed_link, item.source),
                publishDate: item.date || extractDateFromSnippet(item.snippet),
                source: 'wechat' as const,
            }));

        console.log(`[微信公众号] 返回 ${results.length} 篇公众号文章`);
        return results;
    } catch (error) {
        console.error('[微信公众号] 搜索失败:', error);
        return [];
    }
}

// ==================== 辅助函数 ====================

/**
 * 从 displayed_link 或 source 中提取公众号名称
 * SerpAPI 返回的 displayed_link 通常格式为 "mp.weixin.qq.com › s"
 * source 字段可能直接包含公众号名称
 */
function extractWechatAuthor(displayedLink?: string, source?: string): string | undefined {
    // 优先使用 source 字段（SerpAPI 有时会解析出公众号名称）
    if (source && source !== 'mp.weixin.qq.com' && !source.includes('weixin')) {
        return source;
    }
    return undefined;
}

/**
 * 从 snippet 中尝试提取日期信息
 * Google snippet 中可能包含 "2025年3月1日" 等日期格式
 */
function extractDateFromSnippet(snippet?: string): string | undefined {
    if (!snippet) return undefined;

    // 匹配中文日期格式：2025年3月1日
    const zhMatch = snippet.match(/(\d{4}年\d{1,2}月\d{1,2}日)/);
    if (zhMatch) return zhMatch[1];

    // 匹配英文日期格式：Mar 1, 2025
    const enMatch = snippet.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s*\d{4})/i);
    if (enMatch) return enMatch[1];

    return undefined;
}
