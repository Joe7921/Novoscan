/**
 * CORE 开放获取论文搜索服务
 *
 * 特点：专注开放获取（OA）论文，提供全文下载链接。
 * 适合需要获取论文全文的场景。
 *
 * 文档：https://api.core.ac.uk/docs/v3
 * 免费限额：每月 10,000 次请求
 */


const CORE_API_KEY = process.env.CORE_API_KEY || '';
const CORE_API = process.env.CORE_API_BASE_URL || 'https://api.core.ac.uk/v3';

if (!CORE_API_KEY) {
    console.warn('CORE_API_KEY is not set. CORE search will not be available.');
}

// ==================== 类型 ====================

export interface CorePaper {
    id: string;
    title: string;
    authors: string[];
    year: number;
    citationCount?: number;
    downloadUrl: string;       // 全文下载链接（OA 核心价值）
    abstract?: string;
    subjects: string[];
    publisher: string;
    language: string;
    doi?: string;
}

export interface CoreSearchOptions {
    limit?: number;            // 默认 10，最多 50
    fromYear?: number;
    toYear?: number;
    sort?: 'relevance' | 'citationCount' | 'datePublished';
}

// ==================== 搜索 ====================

/**
 * CORE 搜索论文
 *
 * @param keywords - 搜索关键词
 * @param options - 过滤排序选项
 */
export async function searchCore(
    keywords: string[],
    options?: CoreSearchOptions,
    _retryCount = 0
): Promise<CorePaper[]> {
    if (!CORE_API_KEY) {
        console.warn('[CORE] API Key 未配置，跳过搜索');
        return [];
    }

    const query = keywords.join(' ');
    const limit = Math.min(options?.limit ?? 10, 50);

    // 构建查询字符串（CORE v3 使用 GET + query 参数）
    // 年份过滤通过查询语法实现
    let searchQuery = query;
    if (options?.fromYear) {
        searchQuery += ` AND yearPublished>=${options.fromYear}`;
    }
    if (options?.toYear) {
        searchQuery += ` AND yearPublished<=${options.toYear}`;
    }

    const params = new URLSearchParams({
        q: searchQuery,
        limit: String(limit),
        scroll: 'false',
    });

    // 排序
    if (options?.sort === 'citationCount') {
        params.set('sort', 'citationCount:desc');
    } else if (options?.sort === 'datePublished') {
        params.set('sort', 'yearPublished:desc');
    }

    const url = `${CORE_API}/search/works?${params.toString()}`;

    console.log(`[CORE] 搜索: ${query} | ${limit} 条`);

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${CORE_API_KEY}`,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 429 && _retryCount < 2) {
                console.warn(`[CORE] 请求过于频繁，${_retryCount + 1}秒后重试(${_retryCount + 1}/2)...`);
                await new Promise((r) => setTimeout(r, 1000 * (_retryCount + 1)));
                return searchCore(keywords, options, _retryCount + 1);
            }
            if (response.status === 401) {
                console.error('[CORE] API Key 无效');
                return [];
            }
            // 5xx 服务端错误：优雅降级，返回空数组而非抛出异常
            console.warn(`[CORE] 搜索失败 (HTTP ${response.status})，跳过此数据源`);
            return [];
        }

        const data = await response.json();
        const works: any[] = data.results || [];

        return works.map((work) => ({
            id: String(work.id || ''),
            title: work.title || '',
            authors: (work.authors || []).map((a: any) =>
                typeof a === 'string' ? a : a.name || ''
            ),
            year: work.yearPublished || 0,
            citationCount: work.citationCount ?? undefined,
            downloadUrl:
                work.downloadUrl ||
                work.links?.find((l: any) => l.type === 'download')?.url ||
                '',
            abstract: work.abstract || undefined,
            subjects: work.subjects || [],
            publisher: work.publisher || '',
            language: work.language?.name || work.language || 'unknown',
            doi: work.doi || undefined,
        }));
    } catch (error) {
        console.error('[CORE] 搜索失败:', error);
        return [];
    }
}

// ==================== 详情 & 推荐 ====================

/**
 * 获取单篇论文详情
 */
export async function getCoreWork(workId: string): Promise<any | null> {
    if (!CORE_API_KEY) return null;

    try {
        const response = await fetch(`${CORE_API}/works/${workId}`, {
            headers: {
                'Authorization': `Bearer ${CORE_API_KEY}`,
                'Accept': 'application/json',
            },
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('[CORE] 获取详情失败:', error);
        return null;
    }
}

/**
 * 获取推荐论文（相关推荐）
 */
export async function getCoreRecommendations(
    workId: string,
    limit = 5
): Promise<any[]> {
    if (!CORE_API_KEY) return [];

    try {
        const response = await fetch(`${CORE_API}/recommend`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CORE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: workId, limit }),
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error('[CORE] 获取推荐失败:', error);
        return [];
    }
}
