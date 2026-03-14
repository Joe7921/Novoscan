/**
 * Brave Search API 服务
 *
 * 特点：隐私优先搜索引擎，独立索引（不依赖 Google），结果新鲜度高。
 * 免费版：2,000 次/月
 *
 * 文档：https://api.search.brave.com/app
 */


import { checkCostLimit } from '@/lib/stubs';

const BRAVE_API_KEY = process.env.BRAVE_API_KEY || '';
const BRAVE_API = process.env.BRAVE_API_BASE_URL || 'https://api.search.brave.com/res/v1/web/search';

if (!BRAVE_API_KEY) {
    console.warn('[Brave] BRAVE_API_KEY 未配置，Brave 搜索将不可用');
}

// ==================== 类型 ====================

export interface BraveResult {
    title: string;
    url: string;
    description: string;
    age?: string;          // 结果年龄（如 "2 days ago"）
    favicon?: string;
    source: 'brave';
}

export interface BraveSearchOptions {
    count?: number;        // 结果数量，默认 10，最大 20
    offset?: number;       // 分页偏移
    freshness?: 'pd' | 'pw' | 'pm' | 'py';  // 过去一天/周/月/年
}

// ==================== 搜索 ====================

/**
 * Brave Search 搜索
 *
 * @param query - 搜索查询字符串
 * @param options - 数量、分页、时间过滤
 */
export async function searchBrave(
    query: string,
    options?: BraveSearchOptions
): Promise<BraveResult[]> {
    if (!BRAVE_API_KEY) {
        console.warn('[Brave] API Key 未配置，跳过搜索');
        return [];
    }

    const limitCheck = await checkCostLimit('brave', 'search');
    if (!limitCheck.allowed) throw new Error(limitCheck.reason || 'Cost limit exceeded for Brave Search');

    const count = Math.min(options?.count ?? 10, 20);
    const offset = options?.offset ?? 0;

    let url = `${BRAVE_API}?q=${encodeURIComponent(query)}&count=${count}&offset=${offset}`;

    if (options?.freshness) {
        url += `&freshness=${options.freshness}`;
    }

    console.log(`[Brave] 搜索: ${query} | ${count} 条`);

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': BRAVE_API_KEY,
            },
        });

        if (!response.ok) {
            if (response.status === 429) {
                console.warn('[Brave] 请求频率超限');
            }
            if (response.status === 401) {
                console.error('[Brave] API Key 无效');
            }
            throw new Error(`Brave API error: ${response.status}`);
        }

        const data = await response.json();
        const results: BraveResult[] = (data.web?.results || []).map((item: any) => ({
            title: item.title || '',
            url: item.url || '',
            description: item.description || '',
            age: item.age || undefined,
            favicon: item.profile?.img || undefined,
            source: 'brave' as const,
        }));

        console.log(`[Brave] 返回 ${results.length} 条结果`);
        return results;
    } catch (error) {
        console.error('[Brave] 搜索失败:', error);
        return [];
    }
}
