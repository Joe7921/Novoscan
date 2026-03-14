/**
 * OpenAlex 学术搜索服务
 *
 * 作为双轨查重系统的"学术轨道"数据源，提供真实论文检索能力。
 * 遵守 OpenAlex 礼貌访问规则（mailto 参数 + 限速）。
 *
 * 文档：https://docs.openalex.org/api-guide-for-llms
 */

const USER_EMAIL = process.env.OPENALEX_EMAIL || '';
const BASE_URL = process.env.OPENALEX_BASE_URL || 'https://api.openalex.org';

if (!USER_EMAIL) {
    console.warn('[OpenAlex] OPENALEX_EMAIL 未配置，将使用非礼貌访问（速率较低）');
}

// ==================== 基础工具 ====================

/**
 * 带礼貌访问的 fetch 封装
 * OpenAlex 要求：在 URL 中添加 mailto 参数以获取更高速率
 */
async function politeFetch(url: string): Promise<Response> {
    const urlWithEmail = url.includes('?')
        ? `${url}&mailto=${encodeURIComponent(USER_EMAIL)}`
        : `${url}?mailto=${encodeURIComponent(USER_EMAIL)}`;

    return fetch(urlWithEmail, {
        headers: {
            'User-Agent': `Novoscan/1.0 (mailto:${USER_EMAIL})`,
            'Accept': 'application/json',
        },
    });
}

/**
 * 从 OpenAlex 的 abstract_inverted_index 重建摘要文本
 * OpenAlex 返回的是倒排索引格式，需要还原为正常文本
 */
function reconstructAbstract(invertedIndex: Record<string, number[]> | null | undefined): string {
    if (!invertedIndex || typeof invertedIndex !== 'object') return '';

    const words: [string, number][] = [];
    for (const [word, positions] of Object.entries(invertedIndex)) {
        for (const pos of positions) {
            words.push([word, pos]);
        }
    }
    words.sort((a, b) => a[1] - b[1]);
    return words.map(([w]) => w).join(' ');
}

// ==================== 核心搜索 ====================

export interface OpenAlexPaper {
    id: string;
    title: string;
    authors: string[];
    year: number;
    citationCount: number;
    url: string;
    abstract: string;
    topics: string[];
    isOpenAccess: boolean;
    publicationDate: string;
    venue: string;           // 发表期刊/会议
    doi: string;
}

export interface SearchOptions {
    fromYear?: number;        // 起始年份，默认 2022
    toYear?: number;          // 截止年份
    openAccess?: boolean;     // 只查开放获取
    perPage?: number;         // 每页数量，默认 15，最多 25
    sort?: 'relevance' | 'cited_by_count' | 'publication_date';
}

/**
 * 搜索论文（学术轨道核心）
 *
 * @param keywords - 搜索关键词数组（中英文均可）
 * @param options - 搜索选项
 */
export async function searchOpenAlex(
    keywords: string[],
    options?: SearchOptions,
    _retryCount = 0
): Promise<OpenAlexPaper[]> {
    const query = keywords.join(' ');
    const encodedQuery = encodeURIComponent(query);

    // 构建过滤器（保证数据时效性）
    const filters: string[] = [];

    const fromYear = options?.fromYear ?? 2022;
    filters.push(`publication_year:>${fromYear - 1}`);

    if (options?.toYear) {
        filters.push(`publication_year:<${options.toYear + 1}`);
    }

    if (options?.openAccess) {
        filters.push('open_access.is_oa:true');
    }

    // 构建 URL
    let url = `${BASE_URL}/works?search=${encodedQuery}`;
    url += `&filter=${filters.join(',')}`;

    // 分页（礼貌访问：不要一次请求太多）
    const perPage = Math.min(options?.perPage ?? 15, 25);
    url += `&per-page=${perPage}`;

    // 排序：默认按相关性，也可按引用量
    if (options?.sort === 'cited_by_count') {
        url += '&sort=cited_by_count:desc';
    } else if (options?.sort === 'publication_date') {
        url += '&sort=publication_date:desc';
    }

    // 选择返回字段（减少数据传输，提升速度）
    url += '&select=id,doi,display_name,authorships,publication_year,publication_date,cited_by_count,open_access,abstract_inverted_index,topics,primary_location';

    console.log('[OpenAlex] 搜索:', query, '| 年份 >', fromYear - 1);

    try {
        const response = await politeFetch(url);

        if (!response.ok) {
            if (response.status === 429 && _retryCount < 2) {
                console.warn(`[OpenAlex] 请求过于频繁，${_retryCount + 1}秒后重试(${_retryCount + 1}/2)...`);
                await new Promise((r) => setTimeout(r, 1000 * (_retryCount + 1)));
                return searchOpenAlex(keywords, options, _retryCount + 1);
            }
            throw new Error(`OpenAlex API error: ${response.status}`);
        }

        const data = await response.json();

        return (data.results || []).map((work: any) => ({
            id: work.id?.replace('https://openalex.org/', '') || '',
            title: work.display_name || '',
            authors: (work.authorships || [])
                .slice(0, 5)
                .map((a: any) => a.author?.display_name || 'Unknown'),
            year: work.publication_year || 0,
            citationCount: work.cited_by_count || 0,
            url: work.open_access?.oa_url || work.doi || work.id || '',
            abstract: reconstructAbstract(work.abstract_inverted_index),
            topics: (work.topics || []).slice(0, 5).map((t: any) => t.display_name || ''),
            isOpenAccess: work.open_access?.is_oa || false,
            publicationDate: work.publication_date || '',
            venue: work.primary_location?.source?.display_name || '',
            doi: work.doi || '',
        }));
    } catch (error) {
        console.error('[OpenAlex] 搜索失败:', error);
        return []; // 失败返回空数组，不阻塞流程
    }
}

// ==================== 详情 & 相关论文 ====================

/**
 * 获取单篇论文详情（用于深度分析）
 */
export async function getWorkDetails(workId: string): Promise<any | null> {
    const cleanId = workId.replace('https://openalex.org/', '');
    const url = `${BASE_URL}/works/${cleanId}`;

    try {
        const response = await politeFetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('[OpenAlex] 获取详情失败:', error);
        return null;
    }
}

/**
 * 获取相关论文（基于引用关系）
 */
export async function getRelatedWorks(
    workId: string,
    limit = 5
): Promise<OpenAlexPaper[]> {
    const cleanId = workId.replace('https://openalex.org/', '');
    // 通过 cites/cited_by 关系查找相关论文
    const url = `${BASE_URL}/works?filter=cites:${cleanId}&per-page=${limit}&sort=cited_by_count:desc&select=id,doi,display_name,authorships,publication_year,cited_by_count,open_access,topics,primary_location`;

    try {
        const response = await politeFetch(url);
        if (!response.ok) return [];
        const data = await response.json();

        return (data.results || []).map((work: any) => ({
            id: work.id?.replace('https://openalex.org/', '') || '',
            title: work.display_name || '',
            authors: (work.authorships || [])
                .slice(0, 3)
                .map((a: any) => a.author?.display_name || ''),
            year: work.publication_year || 0,
            citationCount: work.cited_by_count || 0,
            url: work.open_access?.oa_url || work.doi || work.id || '',
            abstract: '',
            topics: (work.topics || []).slice(0, 3).map((t: any) => t.display_name || ''),
            isOpenAccess: work.open_access?.is_oa || false,
            publicationDate: '',
            venue: work.primary_location?.source?.display_name || '',
            doi: work.doi || '',
        }));
    } catch (error) {
        console.error('[OpenAlex] 获取相关论文失败:', error);
        return [];
    }
}

// ==================== 学术轨道统一接口 ====================

export interface AcademicSearchResult {
    source: 'openalex';
    query: string;
    results: Array<{
        title: string;
        authors: string[];
        year: number;
        citationCount: number;
        url: string;
        abstract: string;
        topics: string[];
        venue: string;
        relevanceScore: number;
        isRecent: boolean;        // 近2年
        isHighlyCited: boolean;   // 高引用
    }>;
    meta: {
        totalFound: number;
        searchYearRange: string;
        avgCitation: number;
        topTopics: string[];
    };
}

/**
 * 学术搜索统一接口（双轨检索中的学术轨道）
 *
 * @param keywords - AI 提取的关键词
 * @param domain - 领域提示（ai / hardware / bio / ...），优化时间范围
 */
export async function searchAcademicUnified(
    keywords: string[],
    domain?: string
): Promise<AcademicSearchResult> {
    // 根据领域调整时间范围（AI/硬件发展快，只看近2年）
    const fromYear = domain === 'ai' || domain === 'hardware' ? 2023 : 2022;

    // 同时发两个请求：按相关性 + 按引用量
    const [byRelevance, byCitation] = await Promise.all([
        searchOpenAlex(keywords, { fromYear, perPage: 15, sort: 'relevance' }),
        searchOpenAlex(keywords, { fromYear, perPage: 10, sort: 'cited_by_count' }),
    ]);

    // 合并去重（以 id 为主键）
    const seen = new Set<string>();
    const allPapers: OpenAlexPaper[] = [];
    for (const paper of [...byRelevance, ...byCitation]) {
        if (!seen.has(paper.id)) {
            seen.add(paper.id);
            allPapers.push(paper);
        }
    }

    // 统计
    const citations = allPapers.map((p) => p.citationCount);
    const avgCitation =
        citations.length > 0
            ? citations.reduce((a, b) => a + b, 0) / citations.length
            : 0;

    // 提取热门主题
    const topicCounts: Record<string, number> = {};
    allPapers.forEach((p) => {
        p.topics.forEach((t) => {
            if (t) topicCounts[t] = (topicCounts[t] || 0) + 1;
        });
    });
    const topTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic]) => topic);

    // 计算相关性评分
    const results = allPapers.map((paper) => {
        const isRecent = paper.year >= new Date().getFullYear() - 1;
        const isHighlyCited = paper.citationCount > avgCitation * 2;

        let relevanceScore = 20; // 基础分
        relevanceScore += isRecent ? 30 : 0;
        relevanceScore += Math.min(paper.citationCount / 10, 40);
        relevanceScore += paper.isOpenAccess ? 10 : 0;

        return {
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            citationCount: paper.citationCount,
            url: paper.url,
            abstract: paper.abstract,
            topics: paper.topics,
            venue: paper.venue,
            relevanceScore: Math.min(relevanceScore, 100),
            isRecent,
            isHighlyCited,
        };
    });

    // 按相关性排序
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log(`[OpenAlex] 统一搜索完成: ${results.length} 篇论文, 平均引用 ${Math.round(avgCitation)}`);

    return {
        source: 'openalex',
        query: keywords.join(' '),
        results,
        meta: {
            totalFound: results.length,
            searchYearRange: `${fromYear}-present`,
            avgCitation: Math.round(avgCitation),
            topTopics,
        },
    };
}
