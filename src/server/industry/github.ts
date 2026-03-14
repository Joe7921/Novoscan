/**
 * GitHub 搜索服务（互联网轨道 — 开源项目维度）
 *
 * 使用 Personal Access Token 认证，限额 5,000 次/小时。
 * 搜索公开仓库，分析项目活跃度和技术关联性。
 *
 * 文档：https://docs.github.com/en/rest/search/search
 */


const GITHUB_API = process.env.GITHUB_API_BASE_URL || 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

if (!GITHUB_TOKEN) {
    console.warn('[GitHub] GITHUB_TOKEN 未配置，将使用匿名访问（60次/小时）');
}

// ==================== 调用计数 & 缓存 ====================

let githubCallCount = 0;

/** 获取本次会话的 GitHub API 调用次数 */
export function getGithubCallCount(): number {
    return githubCallCount;
}

/** 缓存：key → { data, expireAt } */
const githubCache = new Map<string, { data: GithubRepo[]; expireAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟缓存

// ==================== 类型 ====================

export type RepoHealth = 'active' | 'stable' | 'declining';

export interface GithubRepo {
    id: number;
    name: string;
    fullName: string;
    description: string;
    url: string;
    stars: number;
    forks: number;
    language: string;
    updatedAt: string;
    createdAt: string;
    topics: string[];
    owner: { login: string; type: string };
    health: RepoHealth;
    openIssues: number;
    license?: string;
    isArchived: boolean;
}

export interface GithubSearchOptions {
    sort?: 'stars' | 'updated' | 'forks';
    order?: 'desc' | 'asc';
    perPage?: number;          // 默认 10，最多 30
    language?: string;         // 编程语言过滤
    minStars?: number;         // 最低 star 数
}

// ==================== 基础工具 ====================

/**
 * 带 Token 的 GitHub API fetch
 */
async function githubFetch(url: string): Promise<Response> {
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Novoscan-Research-App/1.0',
    };

    if (GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }

    return fetch(url, { headers });
}

/**
 * 分析仓库健康度
 */
function analyzeRepoHealth(repo: any): RepoHealth {
    if (repo.archived) return 'declining';

    const lastUpdate = new Date(repo.updated_at || repo.pushed_at);
    const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate < 90) return 'active';
    if (daysSinceUpdate < 365) return 'stable';
    return 'declining';
}

// ==================== 搜索 ====================

/**
 * 搜索 GitHub 仓库
 *
 * @param keywords - 搜索关键词
 * @param options - 排序、语言过滤等选项
 */
export async function searchGithub(
    keywords: string[],
    options?: GithubSearchOptions
): Promise<GithubRepo[]> {
    githubCallCount++;
    console.log(`[GitHub] 第 ${githubCallCount} 次调用，查询:`, keywords);

    const sort = options?.sort || 'stars';
    const order = options?.order || 'desc';
    const perPage = Math.min(options?.perPage ?? 10, 30);

    // 构建搜索查询
    let queryParts = keywords.map((k) => k.trim()).join(' ');
    if (options?.language) {
        queryParts += ` language:${options.language}`;
    }
    if (options?.minStars && options.minStars > 0) {
        queryParts += ` stars:>=${options.minStars}`;
    }

    const url =
        `${GITHUB_API}/search/repositories?` +
        `q=${encodeURIComponent(queryParts)}&` +
        `sort=${sort}&order=${order}&per_page=${perPage}`;

    console.log(`[GitHub] 搜索: ${queryParts} | 排序=${sort} | ${perPage} 条`);

    try {
        const response = await githubFetch(url);

        if (!response.ok) {
            if (response.status === 403) {
                const remaining = response.headers.get('X-RateLimit-Remaining');
                console.warn(`[GitHub] API 限制 (剩余: ${remaining})，请检查 Token`);
            }
            if (response.status === 422) {
                console.warn('[GitHub] 查询语法错误');
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }

        // 记录速率限制
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const limit = response.headers.get('X-RateLimit-Limit');
        console.log(`[GitHub] 速率: ${remaining}/${limit} 剩余`);

        const data = await response.json();

        return (data.items || []).map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description || '',
            url: repo.html_url,
            stars: repo.stargazers_count || 0,
            forks: repo.forks_count || 0,
            language: repo.language || 'Unknown',
            updatedAt: repo.updated_at,
            createdAt: repo.created_at,
            topics: repo.topics || [],
            owner: {
                login: repo.owner?.login || '',
                type: repo.owner?.type || '',
            },
            health: analyzeRepoHealth(repo),
            openIssues: repo.open_issues_count || 0,
            license: repo.license?.spdx_id || undefined,
            isArchived: repo.archived || false,
        }));
    } catch (error) {
        console.error('[GitHub] 搜索失败:', error);
        return [];
    }
}

// ==================== README 获取 ====================

/**
 * 获取仓库 README 内容（用于深入分析项目功能）
 */
export async function getRepoReadme(
    owner: string,
    repo: string
): Promise<string | null> {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/readme`;

    try {
        const response = await githubFetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        // README 以 base64 编码返回
        if (data.content && data.encoding === 'base64') {
            return atob(data.content);
        }
        return null;
    } catch (error) {
        console.error('[GitHub] 获取 README 失败:', error);
        return null;
    }
}

// ==================== 仓库详情 ====================

/**
 * 获取仓库详细信息（贡献者数、语言分布等）
 */
export async function getRepoDetails(
    owner: string,
    repo: string
): Promise<any | null> {
    try {
        const [repoRes, langRes] = await Promise.all([
            githubFetch(`${GITHUB_API}/repos/${owner}/${repo}`),
            githubFetch(`${GITHUB_API}/repos/${owner}/${repo}/languages`),
        ]);

        if (!repoRes.ok) return null;

        const repoData = await repoRes.json();
        const languages = langRes.ok ? await langRes.json() : {};

        return {
            ...repoData,
            languages,
            health: analyzeRepoHealth(repoData),
        };
    } catch (error) {
        console.error('[GitHub] 获取详情失败:', error);
        return null;
    }
}

// ==================== 带缓存的搜索 ====================

/**
 * 带缓存的 GitHub 搜索（防止短时间重复调用）
 *
 * 相同查询在 5 分钟内直接返回缓存，不消耗 API 配额。
 */
export async function searchGithubCached(
    keywords: string[],
    options?: GithubSearchOptions
): Promise<GithubRepo[]> {
    const cacheKey = JSON.stringify({ keywords, options });

    // 检查缓存
    const cached = githubCache.get(cacheKey);
    if (cached && cached.expireAt > Date.now()) {
        console.log(`[GitHub] ⚡️ 缓存命中 (${keywords.join(', ')})`);
        return cached.data;
    }

    // 缓存未命中或已过期 → 调用 API
    const result = await searchGithub(keywords, options);

    // 写入缓存
    githubCache.set(cacheKey, {
        data: result,
        expireAt: Date.now() + CACHE_TTL_MS,
    });

    // 清理过期缓存（防止内存泄漏）
    githubCache.forEach((val, key) => {
        if (val.expireAt < Date.now()) githubCache.delete(key);
    });

    return result;
}
