/**
 * Google Scholar 学术论文搜索服务
 *
 * 通过 SerpAPI 的 Google Scholar 引擎获取学术论文结构化数据。
 * 作为学术轨道（OpenAlex/arXiv/Crossref/CORE）的第五补充数据源。
 *
 * 特色：引用数、出版信息、PDF 链接 — 这些是其他学术源不一定有的。
 * 文档：https://serpapi.com/google-scholar-api
 */

import { checkCostLimit, recordSerpEngineCall } from '@/lib/services/costLimiter';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const SERPAPI_URL = process.env.SERPAPI_BASE_URL || 'https://serpapi.com/search';

// ==================== 类型 ====================

export interface ScholarResult {
    title: string;
    url?: string;
    snippet: string;
    citedByCount?: number;       // 被引次数
    publicationInfo?: string;    // 出版信息（作者 - 年份 - 期刊）
    pdfUrl?: string;             // PDF 下载链接
    year?: number;               // 发表年份
    source: 'google_scholar';
}

export interface ScholarSearchOptions {
    num?: number;       // 结果数量，默认 10，最大 20
    fromYear?: number;  // 起始年份过滤
}

// ==================== 搜索 ====================

/**
 * Google Scholar 学术论文搜索
 *
 * @param query - 搜索查询字符串
 * @param options - 搜索选项
 */
export async function searchGoogleScholar(
    query: string,
    options?: ScholarSearchOptions
): Promise<ScholarResult[]> {
    if (!SERPAPI_KEY) {
        console.warn('[Scholar] SERPAPI_KEY 未配置，跳过学术搜索');
        return [];
    }

    const limitCheck = await checkCostLimit('serpapi', 'search');
    if (!limitCheck.allowed) {
        console.warn('[Scholar] SerpAPI 配额已达上限，跳过');
        return [];
    }

    const num = Math.min(options?.num ?? 10, 20);

    const params = new URLSearchParams({
        q: query,
        api_key: SERPAPI_KEY,
        engine: 'google_scholar',
        num: String(num),
        hl: 'en',
    });

    // 年份过滤
    if (options?.fromYear) {
        params.set('as_ylo', String(options.fromYear));
    }

    const url = `${SERPAPI_URL}?${params.toString()}`;

    console.log(`[Scholar] 🎓 搜索: ${query} | 数量=${num}${options?.fromYear ? ` | 起始年=${options.fromYear}` : ''}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 429) {
                console.warn('[Scholar] SerpAPI 配额已用完');
            }
            throw new Error(`SerpAPI (Scholar) error: ${response.status}`);
        }

        const data = await response.json();

        const results: ScholarResult[] = (data.organic_results || []).map((item: any) => {
            // 提取年份
            const pubInfo = item.publication_info?.summary || '';
            const yearMatch = pubInfo.match(/(\d{4})/);

            return {
                title: item.title || '',
                url: item.link || undefined,
                snippet: item.snippet || '',
                citedByCount: item.inline_links?.cited_by?.total || undefined,
                publicationInfo: pubInfo || undefined,
                pdfUrl: item.resources?.[0]?.link || undefined,
                year: yearMatch ? parseInt(yearMatch[1]) : undefined,
                source: 'google_scholar' as const,
            };
        });

        console.log(`[Scholar] 🎓 返回 ${results.length} 篇论文`);
        recordSerpEngineCall('google_scholar');  // 记录引擎调用
        return results;
    } catch (error) {
        console.error('[Scholar] 搜索失败:', error);
        return [];
    }
}
