/**
 * CrossRef 学术搜索服务
 *
 * 特点：DOI 元数据权威来源，引用数据最准确，期刊/出版商信息丰富。
 * 礼貌访问：使用 mailto 参数获取更高速率（非礼貌池 < 50 req/s）。
 *
 * 文档：https://api.crossref.org/swagger-ui/index.html
 */

const USER_EMAIL = process.env.CROSSREF_EMAIL || '';
const CROSSREF_API = process.env.CROSSREF_BASE_URL || 'https://api.crossref.org/works';

// ==================== 类型 ====================

export interface CrossRefAuthor {
    given: string;
    family: string;
}

export interface CrossRefPaper {
    doi: string;
    title: string;
    authors: CrossRefAuthor[];
    year: number;
    journal: string;
    citationCount: number;     // is-referenced-by-count（权威引用数）
    referenceCount: number;    // 参考文献数
    url: string;
    abstract?: string;
    subject: string[];
    isOpenAccess?: boolean;
    license?: string[];
}

export interface CrossRefSearchOptions {
    fromYear?: number;
    toYear?: number;
    rows?: number;             // 默认 10，最多 50
    sort?: 'relevance' | 'published' | 'is-referenced-by-count';
}

// ==================== 工具函数 ====================

/**
 * 从 CrossRef 日期对象中提取年份
 * CrossRef 日期格式：{ "date-parts": [[2023, 5, 12]] }
 */
function extractYear(item: any): number {
    // 优先 published-print → published-online → created
    const sources = [
        item?.['published-print'],
        item?.['published-online'],
        item?.['published'],
        item?.['created'],
    ];

    for (const src of sources) {
        const year = src?.['date-parts']?.[0]?.[0];
        if (typeof year === 'number' && year > 1900) return year;
    }

    return 0;
}

/**
 * 去除 HTML 标签（CrossRef 摘要有时含 <jats:p> 等标签）
 */
function stripHtml(html: string | undefined): string | undefined {
    if (!html) return undefined;
    return html.replace(/<[^>]*>/g, '').trim();
}

// ==================== 搜索 ====================

/**
 * CrossRef 搜索论文
 *
 * @param keywords - 搜索关键词
 * @param options - 过滤和排序选项
 */
export async function searchCrossRef(
    keywords: string[],
    options?: CrossRefSearchOptions,
    _retryCount = 0
): Promise<CrossRefPaper[]> {
    const query = keywords.join(' ');
    const rows = Math.min(options?.rows ?? 10, 50);
    const sort = options?.sort || 'relevance';

    // 构建过滤器
    const filterParts: string[] = [];
    if (options?.fromYear) {
        filterParts.push(`from-pub-date:${options.fromYear}`);
    }
    if (options?.toYear) {
        filterParts.push(`until-pub-date:${options.toYear}`);
    }

    let url =
        `${CROSSREF_API}?` +
        `query=${encodeURIComponent(query)}&` +
        `rows=${rows}&` +
        `sort=${sort}&` +
        `mailto=${encodeURIComponent(USER_EMAIL)}`;

    if (filterParts.length > 0) {
        url += `&filter=${filterParts.join(',')}`;
    }

    console.log(`[CrossRef] 搜索: ${query} | ${rows} 条 | 排序=${sort}`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': `Novoscan/1.0 (mailto:${USER_EMAIL})`,
            },
        });

        if (!response.ok) {
            if (response.status === 429 && _retryCount < 2) {
                console.warn(`[CrossRef] 请求过于频繁，${_retryCount + 1}秒后重试(${_retryCount + 1}/2)...`);
                await new Promise((r) => setTimeout(r, 1000 * (_retryCount + 1)));
                return searchCrossRef(keywords, options, _retryCount + 1);
            }
            throw new Error(`CrossRef API error: ${response.status}`);
        }

        const data = await response.json();
        const items: any[] = data.message?.items || [];

        return items.map((item) => ({
            doi: item.DOI || '',
            title: item.title?.[0] || '',
            authors:
                item.author?.map((a: any) => ({
                    given: a.given || '',
                    family: a.family || '',
                })) || [],
            year: extractYear(item),
            journal: item['container-title']?.[0] || item.publisher || '',
            citationCount: item['is-referenced-by-count'] || 0,
            referenceCount: item['references-count'] || 0,
            url: item.URL || `https://doi.org/${item.DOI}`,
            abstract: stripHtml(item.abstract),
            subject: item.subject || [],
            isOpenAccess: item.license?.some((l: any) =>
                l.URL?.includes('creativecommons')
            ),
            license: item.license?.map((l: any) => l.URL) || [],
        }));
    } catch (error) {
        console.error('[CrossRef] 搜索失败:', error);
        return [];
    }
}

// ==================== 详情 & 期刊 ====================

/**
 * 通过 DOI 获取单篇论文详情
 */
export async function getCrossRefWork(doi: string): Promise<any | null> {
    const cleanDoi = doi.replace('https://doi.org/', '');
    const url = `${CROSSREF_API}/${encodeURIComponent(cleanDoi)}?mailto=${encodeURIComponent(USER_EMAIL)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': `Novoscan/1.0 (mailto:${USER_EMAIL})`,
            },
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.message;
    } catch (error) {
        console.error('[CrossRef] 获取详情失败:', error);
        return null;
    }
}

/**
 * 获取期刊信息（评估发表平台质量）
 *
 * @param issn - 期刊 ISSN 号
 */
export async function getJournalInfo(issn: string): Promise<any | null> {
    const url = `https://api.crossref.org/journals/${issn}?mailto=${encodeURIComponent(USER_EMAIL)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data.message;
    } catch (error) {
        console.error('[CrossRef] 获取期刊信息失败:', error);
        return null;
    }
}
