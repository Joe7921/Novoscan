/**
 * SerpAPI 多引擎搜索服务
 *
 * 支持引擎：Google、Bing、百度、DuckDuckGo
 * 免费版：250 次/月（所有引擎共享配额）
 *
 * 各引擎参数自动适配，返回统一的 SerpResult 格式。
 * 文档：https://serpapi.com/search-api
 */


import { checkCostLimit, recordSerpEngineCall } from '@/lib/stubs';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const SERPAPI_URL = process.env.SERPAPI_BASE_URL || 'https://serpapi.com/search';

if (!SERPAPI_KEY) {
    console.warn('[SerpAPI] SERPAPI_KEY 未配置，SerpAPI 搜索将不可用');
}

// ==================== 类型 ====================

/** 支持的搜索引擎 */
export type SerpApiEngine = 'google' | 'bing' | 'baidu' | 'duckduckgo';

export interface SerpResult {
    title: string;
    url: string;
    description: string;
    displayedUrl?: string;
    position?: number;     // 搜索结果排名
    engine?: SerpApiEngine; // 来源引擎
    source: 'serpapi';
}

export interface SerpSearchOptions {
    engine?: SerpApiEngine; // 搜索引擎，默认 google
    num?: number;           // 结果数量，默认 10，最大 20
    hl?: string;            // 语言，默认 zh-CN
    gl?: string;            // 地区，默认 cn
}

// ==================== 引擎参数适配 ====================

/**
 * 根据引擎类型构建对应的 API 查询参数
 * 各引擎的参数名和格式有差异，此函数统一处理
 */
function buildEngineParams(
    query: string,
    engine: SerpApiEngine,
    options?: SerpSearchOptions
): URLSearchParams {
    const params = new URLSearchParams({
        api_key: SERPAPI_KEY,
        engine,
    });

    switch (engine) {
        case 'baidu':
            // 百度：q 查询、ct 语言限定（2=简体中文）、rn 结果数
            params.set('q', query);
            params.set('ct', '2');
            params.set('rn', String(Math.min(options?.num ?? 10, 50)));
            break;

        case 'bing':
            // Bing：q 查询、cc 国家代码、mkt 市场
            params.set('q', query);
            params.set('cc', options?.gl || 'us');
            break;

        case 'duckduckgo':
            // DuckDuckGo：q 查询、kl 区域
            params.set('q', query);
            params.set('kl', options?.hl === 'zh-CN' ? 'cn-zh' : 'us-en');
            break;

        case 'google':
        default:
            // Google：标准参数
            params.set('q', query);
            params.set('num', String(Math.min(options?.num ?? 10, 20)));
            params.set('hl', options?.hl || 'zh-CN');
            params.set('gl', options?.gl || 'cn');
            break;
    }

    return params;
}

// ==================== 搜索 ====================

/**
 * SerpAPI 多引擎搜索
 *
 * 自动适配不同引擎的参数格式，返回统一的 SerpResult 数组。
 * 所有引擎的搜索结果都在 organic_results 字段中。
 *
 * @param query - 搜索查询字符串
 * @param options - 引擎、数量、语言、地区
 */
export async function searchSerpAPI(
    query: string,
    options?: SerpSearchOptions
): Promise<SerpResult[]> {
    if (!SERPAPI_KEY) {
        console.warn('[SerpAPI] API Key 未配置，跳过搜索');
        return [];
    }

    const limitCheck = await checkCostLimit('serpapi', 'search');
    if (!limitCheck.allowed) throw new Error(limitCheck.reason || 'Cost limit exceeded for SerpAPI');

    const engine: SerpApiEngine = options?.engine || 'google';
    const params = buildEngineParams(query, engine, options);
    const url = `${SERPAPI_URL}?${params.toString()}`;

    console.log(`[SerpAPI] 🔍 搜索: ${query} | 引擎=${engine}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 429) {
                console.warn(`[SerpAPI] ${engine} 月度配额已用完`);
            }
            if (response.status === 401) {
                console.error('[SerpAPI] API Key 无效');
            }
            throw new Error(`SerpAPI (${engine}) error: ${response.status}`);
        }

        const data = await response.json();

        // 所有引擎的搜索结果都在 organic_results 字段
        const results: SerpResult[] = (data.organic_results || []).map((item: any, idx: number) => ({
            title: item.title || '',
            url: item.link || '',
            description: item.snippet || '',
            displayedUrl: item.displayed_link || item.displayed_brand || undefined,
            position: item.position || idx + 1,
            engine,
            source: 'serpapi' as const,
        }));

        console.log(`[SerpAPI] ✅ ${engine} 返回 ${results.length} 条结果`);
        recordSerpEngineCall(engine);  // 记录引擎调用
        return results;
    } catch (error) {
        console.error(`[SerpAPI] ${engine} 搜索失败:`, error);
        return [];
    }
}
