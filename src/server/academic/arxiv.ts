/**
 * arXiv 学术搜索服务
 * 
 * 预印本论文库，涵盖物理、数学、计算机科学等领域
 * 无需 API Key，使用公开 API
 * 文档：http://export.arxiv.org/api/help/
 */

const BASE_URL = process.env.ARXIV_BASE_URL || 'http://export.arxiv.org/api/query';

export interface ArxivPaper {
    id: string;
    title: string;
    authors: string[];
    year: number;
    summary: string;
    pdfUrl: string;
    arxivUrl: string;
    categories: string[];
    published: string;
    updated: string;
    primaryCategory: string;
}

export interface SearchOptions {
    fromYear?: number;
    maxResults?: number;
    sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
}

/**
 * 搜索 arXiv 论文
 */
export async function searchArxiv(
    keywords: string[],
    options?: SearchOptions
): Promise<ArxivPaper[]> {
    const query = keywords.join(' ');

    // 构建搜索查询
    const searchQuery = encodeURIComponent(query);

    // 起始位置
    const start = 0;

    // 最大结果数（默认20，最多50）
    const maxResults = Math.min(options?.maxResults || 20, 50);

    // 排序方式
    const sortBy = options?.sortBy || 'relevance';
    const sortOrder = 'descending';

    const url = `${BASE_URL}?search_query=all:${searchQuery}&start=${start}&max_results=${maxResults}&sortBy=${sortBy}&sortOrder=${sortOrder}`;

    console.log('[arXiv] 搜索:', query);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`arXiv API error: ${response.status}`);
        }

        const xmlText = await response.text();

        // 解析 XML（arXiv 返回 Atom XML 格式）
        const papers = parseArxivXML(xmlText);

        // 过滤年份（如果指定了 fromYear）
        if (options?.fromYear) {
            return papers.filter(p => p.year >= options.fromYear!);
        }

        console.log('[arXiv] 找到论文:', papers.length);
        return papers;

    } catch (error) {
        console.error('[arXiv] 搜索失败:', error);
        return [];
    }
}

/**
 * 解析 arXiv Atom XML 响应
 */
function parseArxivXML(xmlText: string): ArxivPaper[] {
    const papers: ArxivPaper[] = [];

    // 使用简单的正则解析（也可以用 xml2js 库）
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xmlText)) !== null) {
        const entry = match[1];

        // 提取 ID
        const idMatch = entry.match(/<id>(.*?)<\/id>/);
        const id = idMatch ? idMatch[1].split('/').pop() || '' : '';

        // 提取标题（移除换行和多余空格）
        const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
        const title = titleMatch
            ? titleMatch[1].replace(/\s+/g, ' ').trim()
            : '';

        // 提取作者
        const authors: string[] = [];
        const authorRegex = /<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/g;
        let authorMatch;
        while ((authorMatch = authorRegex.exec(entry)) !== null) {
            authors.push(authorMatch[1]);
        }

        // 提取摘要
        const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
        const summary = summaryMatch
            ? summaryMatch[1].replace(/\s+/g, ' ').trim()
            : '';

        // 提取发布时间
        const publishedMatch = entry.match(/<published>(\d{4})-(\d{2})-(\d{2})/);
        const year = publishedMatch ? parseInt(publishedMatch[1]) : 0;
        const published = publishedMatch ? `${publishedMatch[1]}-${publishedMatch[2]}-${publishedMatch[3]}` : '';

        // 提取更新时间
        const updatedMatch = entry.match(/<updated>(\d{4})-(\d{2})-(\d{2})/);
        const updated = updatedMatch ? `${updatedMatch[1]}-${updatedMatch[2]}-${updatedMatch[3]}` : '';

        // 提取分类
        const categories: string[] = [];
        const categoryRegex = /<category term="(.*?)"/g;
        let categoryMatch;
        while ((categoryMatch = categoryRegex.exec(entry)) !== null) {
            categories.push(categoryMatch[1]);
        }
        const primaryCategory = categories[0] || '';

        // 构建链接
        const arxivUrl = `https://arxiv.org/abs/${id}`;
        const pdfUrl = `https://arxiv.org/pdf/${id}.pdf`;

        if (id && title) {
            papers.push({
                id,
                title,
                authors,
                year,
                summary,
                pdfUrl,
                arxivUrl,
                categories,
                published,
                updated,
                primaryCategory,
            });
        }
    }

    return papers;
}

/**
 * 获取单篇论文详情
 */
export async function getArxivPaper(id: string): Promise<ArxivPaper | null> {
    const url = `${BASE_URL}?id_list=${id}`;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const xmlText = await response.text();
        const papers = parseArxivXML(xmlText);
        return papers[0] || null;
    } catch (error) {
        console.error('[arXiv] 获取详情失败:', error);
        return null;
    }
}
