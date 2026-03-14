/**
 * Bizscan 商业想法创新度查重 — 多源商业数据采集层
 *
 * 复用现有的 Brave Search、SerpAPI、GitHub Token 进行竞品和市场信号采集。
 * 额外接入 Product Hunt GraphQL API（免费）获取已上线产品数据。
 */

import { searchBrave } from '@/server/industry/brave';
import { searchSerpAPI } from '@/server/industry/serpapi';
import { searchGithubCached } from '@/server/industry/github';
import type {
    MarketSearchResult,
    ProductHuntItem,
    GitHubAlternative,
    MarketSignals,
} from '@/types/bizscan';

// ============================================================
//  1. 网络搜索 — 竞品与行业信息
// ============================================================

/**
 * 搜索竞品（Brave + SerpAPI 双源合并去重）
 *
 * 使用多种查询模板覆盖不同角度：
 * - 英文查询覆盖海外市场（startup competitors / alternatives）
 * - 中文查询覆盖国内市场（竞品 公司 / 解决方案 产品）
 * - 自动检测关键词语言，分别构建查询
 */
async function searchCompetitors(
    keywords: string[],
    targetMarket?: string,
): Promise<MarketSearchResult[]> {
    // 分流中英文关键词
    const chineseKeywords: string[] = [];
    const englishKeywords: string[] = [];
    for (const kw of keywords.slice(0, 8)) {
        if (/[\u4e00-\u9fff]/.test(kw)) {
            chineseKeywords.push(kw);
        } else {
            englishKeywords.push(kw);
        }
    }

    const enStr = englishKeywords.slice(0, 4).join(' ');
    const zhStr = chineseKeywords.slice(0, 4).join(' ');

    // 核心查询（最多 3 组，优先覆盖中英双轨）
    const coreQueries: string[] = [];

    if (enStr) {
        coreQueries.push(`${enStr} startup competitors alternatives`);
    }
    if (zhStr) {
        coreQueries.push(`${zhStr} 竞品 解决方案`);
    }
    // 保底：混合关键词
    if (coreQueries.length < 2) {
        const allStr = keywords.slice(0, 5).join(' ');
        coreQueries.push(`${allStr} competitor 竞品`);
    }

    console.log(`[Bizscan/DataSources] 搜索竞品: ${coreQueries.length} 组核心查询 (中文:${chineseKeywords.length}, 英文:${englishKeywords.length})`);

    const allResults: MarketSearchResult[] = [];
    const seenUrls = new Set<string>();

    // 执行核心查询（每组仅使用 Brave，减少 API 调用）
    const coreSearchTasks = coreQueries.flatMap(query => [
        searchBrave(query, { count: 10 }).catch(() => []),
        searchSerpAPI(query, { num: 6 }).catch(() => []),
    ]);

    const coreResults = await Promise.allSettled(coreSearchTasks);

    for (const result of coreResults) {
        if (result.status !== 'fulfilled') continue;
        for (const item of result.value) {
            if (seenUrls.has(item.url)) continue;
            seenUrls.add(item.url);
            allResults.push({
                title: item.title,
                url: item.url,
                snippet: ('description' in item ? item.description : '') || '',
                source: 'source' in item && item.source === 'serpapi' ? 'serpapi' : 'brave',
            });
        }
    }

    // 动态扩展：仅当核心查询结果不足时追加（最多 2 组）
    if (allResults.length < 5) {
        const expandQueries: string[] = [];
        if (enStr && targetMarket) expandQueries.push(`${enStr} ${targetMarket} market companies`);
        if (zhStr && targetMarket) expandQueries.push(`${zhStr} ${targetMarket} 市场`);
        if (expandQueries.length === 0) expandQueries.push(`${keywords.slice(0, 3).join(' ')} similar products`);

        console.log(`[Bizscan/DataSources] 核心结果不足(${allResults.length}条)，追加 ${expandQueries.length} 组扩展查询`);

        const expandTasks = expandQueries.slice(0, 2).map(q =>
            searchBrave(q, { count: 8 }).catch(() => [])
        );
        const expandResults = await Promise.allSettled(expandTasks);
        for (const result of expandResults) {
            if (result.status !== 'fulfilled') continue;
            for (const item of result.value) {
                if (seenUrls.has(item.url)) continue;
                seenUrls.add(item.url);
                allResults.push({
                    title: item.title,
                    url: item.url,
                    snippet: ('description' in item ? item.description : '') || '',
                    source: 'brave',
                });
            }
        }
    }

    console.log(`[Bizscan/DataSources] 竞品搜索完成: ${allResults.length} 条去重结果`);
    return allResults;
}

// ============================================================
//  2. Product Hunt — 已上线产品
// ============================================================

/**
 * 搜索 Product Hunt 上的相关产品
 *
 * 使用 Product Hunt 网站搜索（通过 Brave/SerpAPI 间接搜索）
 * 因 PH GraphQL API 需要 OAuth 且限制严格，V1 采用网络搜索方式
 */
async function searchProductHunt(keywords: string[]): Promise<ProductHuntItem[]> {
    const query = `site:producthunt.com ${keywords.slice(0, 4).join(' ')}`;

    console.log(`[Bizscan/DataSources] Product Hunt 搜索: ${query}`);

    try {
        const results = await searchBrave(query, { count: 10 });
        const items: ProductHuntItem[] = results
            .filter(r => r.url.includes('producthunt.com/posts/'))
            .map(r => ({
                name: r.title.replace(/ - Product Hunt.*$/i, '').trim(),
                tagline: r.description?.slice(0, 150) || '',
                url: r.url,
                votesCount: 0, // V1 无法从搜索结果直接获取投票数
                topics: [],
            }));

        console.log(`[Bizscan/DataSources] Product Hunt 发现 ${items.length} 个产品`);
        return items;
    } catch (error) {
        console.warn('[Bizscan/DataSources] Product Hunt 搜索失败:', error);
        return [];
    }
}

// ============================================================
//  3. GitHub — 开源替代方案
// ============================================================

/**
 * 搜索 GitHub 上的开源替代方案
 */
async function searchGitHubAlternatives(keywords: string[]): Promise<GitHubAlternative[]> {
    console.log(`[Bizscan/DataSources] GitHub 搜索: ${keywords.join(', ')}`);

    try {
        const repos = await searchGithubCached(keywords, {
            sort: 'stars',
            order: 'desc',
            perPage: 10,
            minStars: 10,
        });

        const alternatives: GitHubAlternative[] = repos.map(repo => ({
            name: repo.name,
            fullName: repo.fullName,
            description: repo.description || '',
            url: repo.url,
            stars: repo.stars,
            language: repo.language,
            updatedAt: repo.updatedAt,
        }));

        console.log(`[Bizscan/DataSources] GitHub 发现 ${alternatives.length} 个开源项目`);
        return alternatives;
    } catch (error) {
        console.warn('[Bizscan/DataSources] GitHub 搜索失败:', error);
        return [];
    }
}

// ============================================================
//  4. 众筹平台 — 早期验证信号
// ============================================================

/**
 * 搜索 Kickstarter/Indiegogo 上的相关项目
 */
async function searchCrowdfunding(keywords: string[]): Promise<MarketSearchResult[]> {
    const query = `(site:kickstarter.com OR site:indiegogo.com) ${keywords.slice(0, 4).join(' ')}`;

    console.log(`[Bizscan/DataSources] 众筹平台搜索: ${query}`);

    try {
        const results = await searchBrave(query, { count: 8 });

        const crowdfunding: MarketSearchResult[] = results
            .filter(r =>
                r.url.includes('kickstarter.com') ||
                r.url.includes('indiegogo.com')
            )
            .map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.description || '',
                source: 'crowdfunding' as const,
            }));

        console.log(`[Bizscan/DataSources] 众筹发现 ${crowdfunding.length} 个项目`);
        return crowdfunding;
    } catch (error) {
        console.warn('[Bizscan/DataSources] 众筹搜索失败:', error);
        return [];
    }
}

// ============================================================
//  5. 聚合入口 — gatherMarketSignals
// ============================================================

/**
 * 聚合所有数据源的市场信号
 *
 * 并行调用所有数据源，容错处理（任一源失败不影响整体）。
 * 返回统一的 MarketSignals 结构。
 * 
 * 优化：对中文关键词自动 AI 翻译为英文，双语搜索提升命中率。
 */
export async function gatherMarketSignals(
    keywords: string[],
    targetMarket?: string,
): Promise<MarketSignals> {
    console.log(`[Bizscan/DataSources] 开始聚合市场信号，关键词: ${keywords.join(', ')}`);

    const startTime = Date.now();

    // AI 双语翻译：对纯中文关键词生成英文版本
    let searchKeywords = keywords;
    const hasChinese = keywords.some(kw => /[\u4e00-\u9fff]/.test(kw));
    if (hasChinese) {
        try {
            const { extractEnglishKeywordsAI } = await import('@/server/search/dual-track-utils');
            const zhStr = keywords.filter(kw => /[\u4e00-\u9fff]/.test(kw)).join(' ');
            const enTranslated = await extractEnglishKeywordsAI(zhStr);
            if (enTranslated && enTranslated !== zhStr) {
                // 合并中英文关键词（去重）
                const enTokens = enTranslated.split(/\s+/).filter((t: string) => t.length >= 2);
                searchKeywords = [...keywords, ...enTokens.filter((t: string) => !keywords.includes(t))];
                console.log(`[Bizscan/DataSources] 🌐 AI 翻译注入: +${enTokens.length} 个英文关键词`);
            }
        } catch (e: any) {
            console.warn(`[Bizscan/DataSources] AI 翻译跳过: ${e.message}`);
        }
    }

    // 并行采集所有数据源
    const [webResults, productHuntItems, githubAlternatives, crowdfundingResults] =
        await Promise.all([
            searchCompetitors(searchKeywords, targetMarket),
            searchProductHunt(searchKeywords),
            searchGitHubAlternatives(searchKeywords),
            searchCrowdfunding(searchKeywords),
        ]);

    // 统计使用的数据源
    const dataSourcesUsed: string[] = [];
    if (webResults.length > 0) dataSourcesUsed.push('Brave Search', 'SerpAPI');
    if (productHuntItems.length > 0) dataSourcesUsed.push('Product Hunt');
    if (githubAlternatives.length > 0) dataSourcesUsed.push('GitHub');
    if (crowdfundingResults.length > 0) dataSourcesUsed.push('Crowdfunding');

    const totalSourcesScanned =
        webResults.length +
        productHuntItems.length +
        githubAlternatives.length +
        crowdfundingResults.length;

    const elapsed = Date.now() - startTime;
    console.log(
        `[Bizscan/DataSources] 市场信号聚合完成 (${elapsed}ms): ` +
        `Web=${webResults.length}, PH=${productHuntItems.length}, ` +
        `GH=${githubAlternatives.length}, CF=${crowdfundingResults.length}`
    );

    return {
        webResults,
        productHuntItems,
        githubAlternatives,
        crowdfundingResults,
        totalSourcesScanned,
        dataSourcesUsed,
    };
}
