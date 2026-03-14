/**
 * Google Trends 搜索趋势服务
 *
 * 通过 SerpAPI 的 Google Trends 引擎获取关键词搜索热度趋势。
 * 为技术热度评估提供量化数据，替代简单的结果数量判断。
 *
 * 特色：热度趋势曲线、相关搜索词 — 让 sentiment 评估有据可依。
 * 文档：https://serpapi.com/google-trends-api
 */

import { checkCostLimit, recordSerpEngineCall } from '@/lib/stubs';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const SERPAPI_URL = process.env.SERPAPI_BASE_URL || 'https://serpapi.com/search';

// ==================== 类型 ====================

export interface TrendsResult {
    query: string;                  // 搜索关键词
    trendScore: number;             // 0-100 热度分数（取近期平均值）
    trendDirection: 'rising' | 'stable' | 'declining';  // 趋势方向
    relatedQueries: string[];       // 相关搜索词
    source: 'google_trends';
}

// ==================== 24h 缓存 ====================

/** 内存缓存：key=查询词, value={结果, 过期时间} */
const trendsCache = new Map<string, { result: TrendsResult; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 小时

/** 清理过期缓存条目 */
function cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of trendsCache) {
        if (entry.expiresAt <= now) trendsCache.delete(key);
    }
}

// ==================== 搜索 ====================

/**
 * Google Trends 搜索趋势查询（含 24h 缓存）
 *
 * @param query - 搜索查询字符串（最多 100 字符）
 */
export async function searchGoogleTrends(query: string): Promise<TrendsResult | null> {
    // 缓存检查
    const cacheKey = query.toLowerCase().trim();
    const cached = trendsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`[Trends] 📦 缓存命中: "${query}" | 热度=${cached.result.trendScore}`);
        return cached.result;
    }

    // 定期清理过期条目
    if (trendsCache.size > 50) cleanExpiredCache();
    if (!SERPAPI_KEY) {
        console.warn('[Trends] SERPAPI_KEY 未配置，跳过趋势查询');
        return null;
    }

    const limitCheck = await checkCostLimit('serpapi', 'search');
    if (!limitCheck.allowed) {
        console.warn('[Trends] SerpAPI 配额已达上限，跳过');
        return null;
    }

    // 截断到 100 字符（Google Trends 限制）
    const truncatedQuery = query.slice(0, 100);

    const params = new URLSearchParams({
        q: truncatedQuery,
        api_key: SERPAPI_KEY,
        engine: 'google_trends',
        data_type: 'TIMESERIES',
    });

    const url = `${SERPAPI_URL}?${params.toString()}`;

    console.log(`[Trends] 📈 趋势查询: ${truncatedQuery}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 429) {
                console.warn('[Trends] SerpAPI 配额已用完');
            }
            throw new Error(`SerpAPI (Trends) error: ${response.status}`);
        }

        const data = await response.json();

        // 解析趋势时间线数据
        const timelineData = data.interest_over_time?.timeline_data || [];

        if (timelineData.length === 0) {
            console.warn('[Trends] 无趋势数据');
            return null;
        }

        // 提取热度值
        const values = timelineData.map((point: any) => {
            const val = point.values?.[0]?.extracted_value;
            return typeof val === 'number' ? val : 0;
        });

        // 计算平均热度
        const avgScore = Math.round(values.reduce((sum: number, v: number) => sum + v, 0) / values.length);

        // 计算趋势方向（比较前半段和后半段平均值）
        const mid = Math.floor(values.length / 2);
        const firstHalf = values.slice(0, mid);
        const secondHalf = values.slice(mid);
        const firstAvg = firstHalf.reduce((s: number, v: number) => s + v, 0) / (firstHalf.length || 1);
        const secondAvg = secondHalf.reduce((s: number, v: number) => s + v, 0) / (secondHalf.length || 1);

        const changeRatio = (secondAvg - firstAvg) / (firstAvg || 1);
        let trendDirection: 'rising' | 'stable' | 'declining';
        if (changeRatio > 0.15) trendDirection = 'rising';
        else if (changeRatio < -0.15) trendDirection = 'declining';
        else trendDirection = 'stable';

        const result: TrendsResult = {
            query: truncatedQuery,
            trendScore: avgScore,
            trendDirection,
            relatedQueries: [],
            source: 'google_trends',
        };

        console.log(`[Trends] 📈 热度=${avgScore}/100 | 趋势=${trendDirection}`);
        recordSerpEngineCall('google_trends');  // 记录引擎调用

        // 写入 24h 缓存
        trendsCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });

        return result;

    } catch (error) {
        console.error('[Trends] 趋势查询失败:', error);
        return null;
    }
}
