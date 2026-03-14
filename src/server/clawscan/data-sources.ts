/**
 * Clawscan 多源数据采集层
 *
 * 三路并行采集：
 * 1. ClawHub Registry — 现有 Skill 列表（SWR 缓存）
 * 2. Brave/SerpAPI — 网络搜索 OpenClaw 落地实战案例
 * 3. GitHub — 开源实现搜索
 */

import { searchBrave } from '@/server/industry/brave';
import { searchSerpAPI } from '@/server/industry/serpapi';
import { searchGithubCached } from '@/server/industry/github';
import { supabaseAdmin } from '@/lib/supabase';
import type {
    RegistrySkill,
    WebSearchResult,
    GitHubRepo,
    CaseStudy,
    ClawscanSearchSignals,
} from '@/types/clawscan';

// ============================================================
//  1. ClawHub Registry（SWR 缓存）
// ============================================================

const SKILLS_ENDPOINT = 'https://clawhub.ai/api/v1/skills';

interface ClawHubSkill {
    slug: string;
    displayName: string;
    summary: string;
    stats: { installsAllTime: number; stars: number };
    tags: Record<string, string> | string[];
}

interface RegistryCache {
    data: RegistrySkill[];
    fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;     // 1 小时 TTL
const STALE_TTL_MS = 4 * 60 * 60 * 1000; // 4 小时旧数据可用窗口
let registryCache: RegistryCache | null = null;
let isRefreshing = false;

function backgroundRefresh(): void {
    if (isRefreshing) return;
    isRefreshing = true;
    fetchRegistryFromRemote()
        .then(skills => {
            registryCache = { data: skills, fetchedAt: Date.now() };
            console.log(`[Clawscan/DS] 后台刷新完成，共 ${skills.length} 个 Skills`);
        })
        .catch(err => console.warn(`[Clawscan/DS] 后台刷新失败: ${err.message}`))
        .finally(() => { isRefreshing = false; });
}

async function fetchRegistryFromRemote(): Promise<RegistrySkill[]> {
    const allSkills: ClawHubSkill[] = [];
    let cursor: string | undefined;

    console.log(`[Clawscan/DS] 开始从 ClawHub 拉取 Skills...`);
    try {
        do {
            const url = cursor
                ? `${SKILLS_ENDPOINT}?limit=200&cursor=${cursor}`
                : `${SKILLS_ENDPOINT}?limit=200`;

            const res = await fetch(url, {
                signal: AbortSignal.timeout(10000),
                headers: { 'Accept': 'application/json' },
            });

            if (!res.ok) throw new Error(`ClawHub API HTTP ${res.status}`);
            const data = await res.json();
            if (data.items && Array.isArray(data.items)) {
                allSkills.push(...data.items);
            }
            cursor = data.nextCursor;
        } while (cursor);
    } catch (fetchErr: any) {
        console.warn(`[Clawscan/DS] 分页拉取中断: ${fetchErr.message}。已拉取 ${allSkills.length} 条`);
        if (allSkills.length === 0) throw fetchErr;
    }

    const mapped: RegistrySkill[] = allSkills.map(skill => {
        let tags: string[] = [];
        if (skill.tags) {
            if (Array.isArray(skill.tags)) tags = skill.tags.map(String);
        }
        const name = skill.displayName || skill.slug;
        const description = skill.summary || '';
        const features: string[] = [];
        const _searchIndex = `${name} ${description} ${tags.join(' ')} ${features.join(' ')}`.toLowerCase();
        return {
            name,
            author: 'clawhub',
            description,
            tags,
            installs: skill.stats?.installsAllTime || 0,
            githubUrl: `https://clawhub.ai/skills/${skill.slug}`,
            features,
            _searchIndex,
        };
    });

    mapped.sort((a, b) => (b.installs || 0) - (a.installs || 0));
    return mapped;
}

export async function getRegistry(): Promise<RegistrySkill[]> {
    const now = Date.now();
    if (registryCache) {
        const age = now - registryCache.fetchedAt;
        if (age < CACHE_TTL_MS) return registryCache.data;
        if (age < STALE_TTL_MS) {
            console.log('[Clawscan/DS] 缓存过期，返回旧数据并后台刷新');
            backgroundRefresh();
            return registryCache.data;
        }
    }
    try {
        const skills = await fetchRegistryFromRemote();
        registryCache = { data: skills, fetchedAt: now };
        console.log(`[Clawscan/DS] Registry 已刷新，共 ${skills.length} 个 Skills`);
        return skills;
    } catch (err: any) {
        console.warn(`[Clawscan/DS] Registry 拉取失败: ${err.message}`);
        if (registryCache) return registryCache.data;
        return getMockSkills();
    }
}

// 模块加载时预热 Registry 缓存（避免用户首次请求冷启动）
if (!registryCache) {
    getRegistry().catch(() => { /* 预热失败不影响后续 */ });
}

function getMockSkills(): RegistrySkill[] {
    return [
        {
            name: 'Web Search Explorer',
            author: 'claw-community',
            description: '无需API密钥即可进行网络搜索和网页内容深度抓取的强大技能。',
            tags: ['search', 'web', 'scraper', 'no-api'],
            installs: 15200,
            githubUrl: 'https://github.com/clawhub/web-search-explorer',
            features: ['无API搜索', '直接网络访问', '网页内容抓取', '实时数据获取'],
        },
        {
            name: 'Data Insight Analyzer',
            author: 'analytics-pro',
            description: '高级数据分析和多维可视化报表生成工具。',
            tags: ['data', 'analytics', 'visualization'],
            installs: 8600,
            githubUrl: 'https://github.com/clawhub/data-insight',
            features: ['多维数据分析', '图表生成', '报告自动汇编'],
        },
    ];
}

// ============================================================
//  2. 智能预筛选（零 AI 调用）
// ============================================================

const STOP_WORDS = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '一', '个', '做', '想',
    'the', 'a', 'an', 'is', 'are', 'to', 'for', 'with', 'and', 'or', 'i', 'you',
]);

function extractSearchTerms(description: string): string[] {
    const cleaned = description
        .replace(/[，。！？、；：""''（）《》【】\[\]{}(),.!?;:"'<>]/g, ' ')
        .toLowerCase();
    const words = cleaned.split(/\s+/).filter(w => w.length >= 2 && !STOP_WORDS.has(w));
    return Array.from(new Set(words));
}

export function smartPreFilter(
    registry: RegistrySkill[],
    keywords: string[],
    maxCandidates: number = 18,
): RegistrySkill[] {
    const searchTerms = keywords.flatMap(k => extractSearchTerms(k));
    if (searchTerms.length === 0) return registry.slice(0, maxCandidates);

    const scored = registry.map(skill => {
        const searchIndex = skill._searchIndex || `${skill.name} ${skill.description} ${(skill.tags || []).join(' ')}`.toLowerCase();
        const nameText = (skill.name || '').toLowerCase();
        let score = 0;
        for (const term of searchTerms) {
            if (nameText.includes(term)) score += 5;
            else if (searchIndex.includes(term)) score += 2;
        }
        score += Math.log10(Math.max(1, skill.installs || 0)) * 0.5;
        return { skill, score };
    });

    const withScore = scored.filter(s => s.score > 1).sort((a, b) => b.score - a.score);
    const result = withScore.slice(0, maxCandidates).map(s => s.skill);

    if (result.length < 5) {
        const candidateSet = new Set(result.map(s => s.name));
        for (const skill of registry) {
            if (!candidateSet.has(skill.name) && result.length < maxCandidates) {
                result.push(skill);
                candidateSet.add(skill.name);
            }
        }
    }
    return result;
}

// ============================================================
//  3. 网络搜索 — OpenClaw 落地实战案例
// ============================================================

async function searchOpenClawCases(keywords: string[]): Promise<WebSearchResult[]> {
    const keywordStr = keywords.slice(0, 4).join(' ');
    // 构建多角度 OpenClaw 特化查询
    const queries = [
        `openclaw ${keywordStr} 案例 实战`,
        `openclaw ${keywordStr} 部署 应用`,
        `"openclaw" "${keywordStr}" skill deployment`,
        `claw skill ${keywordStr} project implementation`,
    ];

    console.log(`[Clawscan/DS] 搜索 OpenClaw 落地案例: ${queries.length} 组查询`);

    const allResults: WebSearchResult[] = [];
    const seenUrls = new Set<string>();

    const searchTasks = queries.flatMap(query => [
        searchBrave(query, { count: 8 }).catch(() => []),
        searchSerpAPI(query, { num: 6 }).catch(() => []),
    ]);

    const rawResults = await Promise.allSettled(searchTasks);

    for (const result of rawResults) {
        if (result.status !== 'fulfilled') continue;
        for (const item of result.value) {
            if (seenUrls.has(item.url)) continue;
            seenUrls.add(item.url);
            allResults.push({
                title: item.title,
                url: item.url,
                snippet: ('description' in item ? item.description : '') || '',
                source: 'source' in item && item.source === 'serpapi' ? 'serpapi' : 'brave',
                age: 'age' in item ? (item as any).age : undefined,
            });
        }
    }

    console.log(`[Clawscan/DS] OpenClaw 案例搜索完成: ${allResults.length} 条去重结果`);
    return allResults;
}

// ============================================================
//  4. GitHub 搜索
// ============================================================

async function searchGitHubRepos(keywords: string[]): Promise<GitHubRepo[]> {
    const searchKeywords = [...keywords.slice(0, 3), 'openclaw'];
    console.log(`[Clawscan/DS] GitHub 搜索: ${searchKeywords.join(', ')}`);

    try {
        const repos = await searchGithubCached(searchKeywords, {
            sort: 'stars',
            order: 'desc',
            perPage: 10,
            minStars: 5,
        });

        const mapped: GitHubRepo[] = repos.map(repo => ({
            name: repo.name,
            fullName: repo.fullName,
            description: repo.description || '',
            url: repo.url,
            stars: repo.stars,
            language: repo.language,
            updatedAt: repo.updatedAt,
        }));

        console.log(`[Clawscan/DS] GitHub 发现 ${mapped.length} 个相关仓库`);
        return mapped;
    } catch (error) {
        console.warn('[Clawscan/DS] GitHub 搜索失败:', error);
        return [];
    }
}

// ============================================================
//  5. CaseVault 案例库检索（零外部 API 消耗）
// ============================================================

async function searchCaseVault(keywords: string[]): Promise<CaseStudy[]> {
    try {
        // 使用关键词构建模糊搜索条件
        const searchTerm = keywords.slice(0, 3).join(' ');
        const { data, error } = await supabaseAdmin
            .from('case_library')
            .select('title, source_url, summary, source_type, quality_score, capabilities, technology_stack, deployment_scale')
            .gte('quality_score', 30)
            .or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%,capabilities.cs.{${keywords.slice(0, 2).join(',')}}`)
            .order('quality_score', { ascending: false })
            .limit(10);

        if (error) {
            console.warn(`[Clawscan/DS] CaseVault 查询失败: ${error.message}`);
            return [];
        }

        const results: CaseStudy[] = (data || []).map((item: Record<string, unknown>) => ({
            title: (item.title as string) || '',
            url: (item.source_url as string) || '',
            snippet: (item.summary as string) || '',
            source: 'casevault',
            relevanceScore: (item.quality_score as number) || 50,
            keyInsight: `技术栈: ${(item.technology_stack as string[] || []).join(', ')}`,
            technologyUsed: (item.technology_stack as string[] || []).join(', '),
            deploymentScale: (item.deployment_scale as string) || undefined,
        }));

        console.log(`[Clawscan/DS] CaseVault 匹配: ${results.length} 条案例`);
        return results;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Clawscan/DS] CaseVault 检索异常: ${msg}`);
        return [];
    }
}

// ============================================================
//  6. 聚合入口
// ============================================================

export async function gatherClawscanSignals(
    keywords: string[],
    registry: RegistrySkill[],
    candidates: RegistrySkill[],
): Promise<ClawscanSearchSignals> {
    console.log(`[Clawscan/DS] 开始多源数据采集（关键词: ${keywords.join(', ')}）`);
    const startTime = Date.now();

    // AI 双语翻译：对中文关键词生成英文版本，提升搜索命中率
    let searchKeywords = keywords;
    const hasChinese = keywords.some(kw => /[\u4e00-\u9fff]/.test(kw));
    if (hasChinese) {
        try {
            const { extractEnglishKeywordsAI } = await import('@/server/search/dual-track-utils');
            const zhStr = keywords.filter(kw => /[\u4e00-\u9fff]/.test(kw)).join(' ');
            const enTranslated = await extractEnglishKeywordsAI(zhStr);
            if (enTranslated && enTranslated !== zhStr) {
                const enTokens = enTranslated.split(/\s+/).filter((t: string) => t.length >= 2);
                searchKeywords = [...keywords, ...enTokens.filter((t: string) => !keywords.includes(t))];
                console.log(`[Clawscan/DS] 🌐 AI 翻译注入: +${enTokens.length} 个英文关键词`);
            }
        } catch (e: any) {
            console.warn(`[Clawscan/DS] AI 翻译跳过: ${e.message}`);
        }
    }

    // 四路并行采集：网络搜索 + GitHub + CaseVault（Registry 已在外部获取）
    const [webCaseResults, githubRepos, caseVaultResults] = await Promise.all([
        searchOpenClawCases(searchKeywords),
        searchGitHubRepos(searchKeywords),
        searchCaseVault(keywords), // CaseVault 用原始中文搜索（Supabase ilike 支持中文）
    ]);

    const dataSourcesUsed: string[] = ['ClawHub Registry'];
    if (webCaseResults.length > 0) dataSourcesUsed.push('Brave Search', 'SerpAPI');
    if (githubRepos.length > 0) dataSourcesUsed.push('GitHub');
    if (caseVaultResults.length > 0) dataSourcesUsed.push('CaseVault');

    const totalSourcesScanned = candidates.length + webCaseResults.length + githubRepos.length + caseVaultResults.length;

    const elapsed = Date.now() - startTime;
    console.log(
        `[Clawscan/DS] 数据采集完成 (${elapsed}ms): ` +
        `Registry=${candidates.length}, Web=${webCaseResults.length}, GH=${githubRepos.length}, Vault=${caseVaultResults.length}`
    );

    return {
        registrySkills: candidates,
        webCaseResults,
        githubRepos,
        caseVaultResults: caseVaultResults.length > 0 ? caseVaultResults : undefined,
        totalSourcesScanned,
        dataSourcesUsed,
    };
}
