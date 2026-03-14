import { searchAcademic } from './academic';
import { searchIndustry } from './industry';
import { extractEnglishKeywordsAI, containsChinese } from './dual-track-utils';
import { selectSearchEngines, type EngineSelection } from './engine-selector';
import { searchGoogleTrends, type TrendsResult } from '@/server/industry/trends';

// ==================== 内部类型定义 ====================

/** 学术论文结构（基于 OpenAlex/CrossRef/CORE/arXiv 返回字段） */
interface AcademicPaper {
    title?: string;
    citationCount?: number;
    isOa?: boolean;
    pdfUrl?: string;
    isOpenAccess?: boolean;
    downloadUrl?: string;
    concepts?: string[];
    year?: number;
}

/** 网页搜索结果 */
interface WebResult {
    url?: string;
    title?: string;
    snippet?: string;
}

/** GitHub 仓库信息 */
interface GithubRepo {
    name?: string;
    fullName?: string;
    stars?: number;
    health?: string;
    topics?: string[];
}

/** 微信公众号文章 */
interface WechatArticle {
    url?: string;
    title?: string;
}

/** Google Scholar 论文 */
interface ScholarPaper {
    title?: string;
    citedByCount?: number;
}

/** 学术搜索返回结构 */
interface AcademicSearchResult {
    success?: boolean;
    results?: AcademicPaper[];
    sources?: { openAlex?: number; crossRef?: number; core?: number; arxiv?: number };
}

/** 产业搜索返回结构 */
interface IndustrySearchResult {
    success?: boolean;
    webResults?: WebResult[];
    githubRepos?: GithubRepo[];
    wechatArticles?: WechatArticle[];
    scholarResults?: ScholarPaper[];
    sources?: { brave?: number; serpapi?: number; scholar?: number };
}

/** 组装后的学术数据 */
interface AcademicData {
    source: string;
    results: AcademicPaper[];
    stats: {
        totalPapers: number;
        totalCitations: number;
        openAccessCount: number;
        avgCitation: number;
        bySource: { openAlex: number; arxiv: number; crossref: number; core: number };
        topCategories: string[];
    };
    topConcepts: string[];
}

/** 组装后的产业数据 */
interface IndustryData {
    source: string;
    webResults: WebResult[];
    webSources: { brave: number; serpapi: number };
    githubRepos: GithubRepo[];
    wechatArticles: WechatArticle[];
    scholarResults: ScholarPaper[];
    trendsResult?: TrendsResult;
    sentiment: 'hot' | 'warm' | 'cold';
    hasOpenSource: boolean;
    topProjects: GithubRepo[];
}

/** 交叉验证结果 */
interface CrossValidationResult {
    consistencyScore: number;
    academicSupport: string;
    industrySupport: string;
    openSourceVerified: boolean;
    conceptOverlap: string[];
    redFlags: string[];
    insights: string[];
}

/** 可信度结果 */
interface CredibilityResult {
    score: number;
    level: string;
    reasoning: string[];
}

/**
 * 对中文 query 生成搜索关键词组：[原始中文, 英文翻译]
 * 英文 query 直接返回原样
 */
async function buildSearchKeywords(keywords: string[]): Promise<string[][]> {
    const query = keywords.join(' ');
    if (!containsChinese(query)) {
        return [keywords]; // 英文 query 不需要翻译
    }

    const enQuery = await extractEnglishKeywordsAI(query);
    console.log(`[Search DualTrack] 🌐 中英双语搜索: "${query}" → "${enQuery}"`);

    // 返回中文+英文两组关键词
    return [keywords, [enQuery]];
}

export async function searchDualTrack(keywords: string[], domain?: string) {
    console.log('[Search DualTrack] 启动:', keywords);
    const startTime = performance.now();

    // ===== Step 0: AI 智能引擎选择（在所有搜索之前） =====
    const engineSelection: EngineSelection = await selectSearchEngines(keywords).catch(err => {
        console.error('[Search DualTrack] 引擎选择失败，使用默认:', err);
        return { serpEngines: ['google' as const], useScholar: false, useTrends: false, reasoning: '默认 Google', method: 'fallback' as const };
    });
    console.log(`[Search DualTrack] 🧠 引擎决策: ${engineSelection.serpEngines.join('+')} | Scholar=${engineSelection.useScholar} | Trends=${engineSelection.useTrends} | 方式=${engineSelection.method}`);

    // 中文检测：生成中英双语关键词组
    const keywordGroups = await buildSearchKeywords(keywords);

    // ===== Step 0.5: Google Trends 趋势查询（与主搜索并行） =====
    const trendsPromise: Promise<TrendsResult | null> = engineSelection.useTrends
        ? searchGoogleTrends(keywords.join(' ')).catch(err => {
            console.error('[Search DualTrack] Trends 查询失败:', err);
            return null;
        })
        : Promise.resolve(null);

    // 并行调用学术 + 产业服务端逻辑（对每组关键词都搜索）
    const academicPromises = keywordGroups.map(kw =>
        searchAcademic(kw, domain).catch(err => {
            console.error('[Search DualTrack] 学术检索失败:', err);
            return { success: false, results: [] } as AcademicSearchResult;
        })
    );
    const industryPromises = keywordGroups.map(kw =>
        searchIndustry(kw, engineSelection).catch(err => {
            console.error('[Search DualTrack] 产业检索失败:', err);
            return { success: false, webResults: [], githubRepos: [] } as IndustrySearchResult;
        })
    );

    const [allResults, trendsResult] = await Promise.all([
        Promise.all([...academicPromises, ...industryPromises]),
        trendsPromise,
    ]);
    const rawAcademicResults = allResults.slice(0, keywordGroups.length);
    const rawIndustryResults = allResults.slice(keywordGroups.length);

    // 合并多组学术结果（去重）
    const mergedAcademicResults: AcademicPaper[] = [];
    const seenTitles = new Set<string>();
    const mergedSources = { openAlex: 0, crossRef: 0, core: 0, arxiv: 0 };
    for (const res of rawAcademicResults) {
        for (const paper of (res.results || [])) {
            const key = paper.title?.toLowerCase().trim();
            if (key && !seenTitles.has(key)) {
                seenTitles.add(key);
                mergedAcademicResults.push(paper);
            }
        }
        if (res.sources) {
            mergedSources.openAlex += res.sources.openAlex || 0;
            mergedSources.crossRef += res.sources.crossRef || 0;
            mergedSources.core += res.sources.core || 0;
            mergedSources.arxiv += res.sources.arxiv || 0;
        }
    }

    // 合并多组产业结果（去重）
    const mergedWebResults: WebResult[] = [];
    const seenUrls = new Set<string>();
    const mergedGithub: GithubRepo[] = [];
    const seenRepoNames = new Set<string>();
    const mergedWechat: WechatArticle[] = [];
    const seenWechatUrls = new Set<string>();
    const mergedIndSources = { brave: 0, serpapi: 0, scholar: 0 };
    const mergedScholar: ScholarPaper[] = [];
    const seenScholarTitles = new Set<string>();

    for (const res of rawIndustryResults) {
        for (const item of (res.webResults || [])) {
            const key = item.url?.toLowerCase();
            if (key && !seenUrls.has(key)) {
                seenUrls.add(key);
                mergedWebResults.push(item);
            }
        }
        for (const repo of (res.githubRepos || [])) {
            const key = repo.fullName?.toLowerCase() || repo.name?.toLowerCase();
            if (key && !seenRepoNames.has(key)) {
                seenRepoNames.add(key);
                mergedGithub.push(repo);
            }
        }
        for (const article of (res.wechatArticles || [])) {
            const key = article.url?.toLowerCase() || article.title;
            if (key && !seenWechatUrls.has(key)) {
                seenWechatUrls.add(key);
                mergedWechat.push(article);
            }
        }
        if (res.sources) {
            mergedIndSources.brave += res.sources.brave || 0;
            mergedIndSources.serpapi += res.sources.serpapi || 0;
            mergedIndSources.scholar += res.sources.scholar || 0;
        }
        // 合并 Scholar 结果
        for (const paper of (res.scholarResults || [])) {
            const key = paper.title?.toLowerCase().trim();
            if (key && !seenScholarTitles.has(key)) {
                seenScholarTitles.add(key);
                mergedScholar.push(paper);
            }
        }
    }

    if (keywordGroups.length > 1) {
        console.log(`[Search DualTrack] 🌐 双语合并: 学术 ${mergedAcademicResults.length} 篇, 产业 Web ${mergedWebResults.length} + GitHub ${mergedGithub.length} + 微信 ${mergedWechat.length}`);
    }

    // 1. 组装 Academic 数据结构（统计 citations/openAccess/concepts）
    const papers = mergedAcademicResults;
    let totalCitations = 0;
    let openAccessCount = 0;
    const topConceptsMap = new Map<string, number>();

    papers.forEach((p: AcademicPaper) => {
        totalCitations += (p.citationCount || 0);
        if (p.isOa || p.pdfUrl || p.isOpenAccess || p.downloadUrl) openAccessCount++;
        if (p.concepts) {
            p.concepts.forEach((c: string) => {
                topConceptsMap.set(c, (topConceptsMap.get(c) || 0) + 1);
            });
        }
    });

    const topConcepts = Array.from(topConceptsMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10).map(e => e[0]);

    const academic = {
        source: 'quad',
        results: papers,
        stats: {
            totalPapers: papers.length,
            totalCitations,
            openAccessCount,
            avgCitation: papers.length > 0 ? totalCitations / papers.length : 0,
            bySource: {
                openAlex: mergedSources.openAlex,
                arxiv: mergedSources.arxiv,
                crossref: mergedSources.crossRef,
                core: mergedSources.core
            },
            topCategories: topConcepts
        },
        topConcepts
    };

    // 2. 组装 Industry 数据结构
    // Trends 数据增强 sentiment 判断
    const baseSentimentSignals = mergedWebResults.length + mergedWechat.length;
    let sentiment: 'hot' | 'warm' | 'cold';
    if (trendsResult && trendsResult.trendScore > 0) {
        // 用 Trends 量化数据辅助判断
        const trendBoost = trendsResult.trendDirection === 'rising' ? 10 : trendsResult.trendDirection === 'stable' ? 5 : 0;
        const adjustedSignals = baseSentimentSignals + trendBoost;
        sentiment = adjustedSignals > 20 ? 'hot' : adjustedSignals > 5 ? 'warm' : 'cold';
    } else {
        sentiment = baseSentimentSignals > 20 ? 'hot' : baseSentimentSignals > 5 ? 'warm' : 'cold';
    }

    const industry = {
        source: 'triple',
        webResults: mergedWebResults.slice(0, 20),
        webSources: {
            brave: mergedIndSources.brave,
            serpapi: mergedIndSources.serpapi
        },
        githubRepos: mergedGithub.slice(0, 10),
        wechatArticles: mergedWechat,
        scholarResults: mergedScholar,     // 新增：Google Scholar 结果
        trendsResult: trendsResult || undefined,  // 新增：Google Trends 数据
        sentiment,
        hasOpenSource: mergedGithub.length > 0,
        topProjects: mergedGithub.slice(0, 3)
    };

    // 3. 交叉验证
    const crossValidation = validateSources(academic, industry);

    // 4. 计算可信度
    const finalCredibility = calculateCredibility(academic, industry, crossValidation);

    // 5. 生成建议
    const recommendation = generateRecommendation(finalCredibility, crossValidation);

    const searchTimeMs = Math.round(performance.now() - startTime);

    return {
        success: true,
        academic,
        industry,
        crossValidation,
        finalCredibility,
        recommendation,
        searchTimeMs,
        engineSelection,  // 新增：AI 引擎选择结果（供前端展示/调试）
    };
}

// ==================== 交叉验证逻辑 ====================

function validateSources(academic: AcademicData, industry: IndustryData): CrossValidationResult {
    const mergedCount = academic.results.length;
    const githubCount = industry.githubRepos.length;
    const webCount = industry.webResults.length;

    const academicSupport = mergedCount > 20 ? 'strong' : mergedCount > 5 ? 'moderate' : 'weak';

    // ==================== [改进] 产业支撑度综合评估: GitHub + Web ====================
    // GitHub 权重更高(3)，网页资讯权重(1)。例如 1个项目+2条资讯=5(中等)，0项目+15条资讯=15(强)
    const industrySignal = webCount * 1 + githubCount * 3;
    const industrySupport = industrySignal >= 15 ? 'strong' : industrySignal >= 5 ? 'moderate' : 'weak';

    const redFlags: string[] = [];
    const insights: string[] = [];

    if (academicSupport === 'strong' && industrySupport === 'weak') {
        redFlags.push('学术热度高但产业落地与资讯讨论极少，可能存在技术转化风险');
    }
    if (industrySupport === 'strong' && academicSupport === 'weak') {
        redFlags.push('产业界/媒体热度高但学术支撑不足，需警惕概念包装或炒作');
    }

    const highStarRepos = industry.githubRepos.filter((r: GithubRepo) => (r.stars || 0) > 5000);
    if (highStarRepos.length > 0) {
        redFlags.push(`已有 ${highStarRepos.length} 个高影响开源项目（>5000⭐），需明确差异化`);
    }

    if (githubCount > 0 && industry.githubRepos.every((r: GithubRepo) => r.health === 'declining')) {
        redFlags.push('相关开源项目可能已停止维护，领域可能已经衰退');
    }

    const highlyCited = academic.results.filter((p: AcademicPaper) => (p.citationCount || 0) > (academic.stats.avgCitation * 2));
    if (highlyCited.length > 0) {
        insights.push(`${highlyCited.length} 篇高引论文，领域受学术界持续关注`);
    }

    const currentYear = new Date().getFullYear();
    const recentPapers = academic.results.filter((p: AcademicPaper) => (p.year || 0) >= currentYear - 1);
    if (recentPapers.length > mergedCount * 0.6 && mergedCount > 3) {
        insights.push('近两年论文占比超 60%，属于快速增长领域');
    }

    const activeRepos = industry.githubRepos.filter((r: GithubRepo) => r.health === 'active');
    if (activeRepos.length > 0) {
        insights.push(`[代码源] ${activeRepos.length} 个活跃开源项目，技术社区参与度高`);
    }

    // [改进] 增加对 webResults 的透明洞察
    if (webCount > 0) {
        insights.push(`[资讯源] 全网检索到 ${webCount} 篇关联产业资讯或产品页面`);
        if (webCount >= 10 && githubCount === 0) {
            insights.push('💡 网页资讯丰富但无开源实现，表明该领域可能偏向企业闭源商业化模式');
        }
    }

    // 微信公众号文章洞察
    const wechatCount = industry.wechatArticles?.length || 0;
    if (wechatCount > 0) {
        insights.push(`[微信公众号] 检索到 ${wechatCount} 篇相关公众号文章，国内关注度较高`);
        if (wechatCount >= 5) {
            insights.push('💡 微信公众号大量报道，表明该领域在中国市场有显著讨论热度');
        }
    }

    // Google Scholar 洞察
    const scholarCount = industry.scholarResults?.length || 0;
    if (scholarCount > 0) {
        const highCited = industry.scholarResults?.filter((p: ScholarPaper) => (p.citedByCount || 0) > 100) || [];
        insights.push(`[Google Scholar] 检索到 ${scholarCount} 篇学术论文${highCited.length > 0 ? `，其中 ${highCited.length} 篇高引(>100次)` : ''}`);
    }

    // Google Trends 洞察
    if (industry.trendsResult) {
        const t = industry.trendsResult;
        const dirMap: Record<string, string> = { rising: '📈 上升', stable: '➡️ 平稳', declining: '📉 下降' };
        insights.push(`[Google Trends] 搜索热度 ${t.trendScore}/100 | 趋势: ${dirMap[t.trendDirection] || t.trendDirection}`);
    }

    const sourcesCount = [
        academic.stats.bySource.openAlex,
        academic.stats.bySource.crossref,
        academic.stats.bySource.core
    ].filter(n => n > 0).length;

    if (sourcesCount >= 2 && industrySignal >= 5) {
        const indType = githubCount > 0 ? (webCount > 0 ? '开源+资讯' : '开源实现') : '全网资讯';
        insights.push(`多源互补验证：学术 ${sourcesCount} 源支撑 + 产业界 ${indType} 验证`);
    }

    if (academic.stats.openAccessCount > 0) {
        insights.push(`${academic.stats.openAccessCount} 篇论文可免费获取全文`);
    }

    if (academicSupport !== 'weak' && industrySupport !== 'weak') {
        insights.push('学术和产业双轨验证通过，方向有扎实的研究和实践基础');
    }

    const academicConcepts = new Set(academic.stats.topCategories.map((c: string) => c.toLowerCase()));
    const githubTopics = new Set(industry.githubRepos.flatMap((r: GithubRepo) => (r.topics || []).map((t: string) => t.toLowerCase())));
    const overlap: string[] = [];
    Array.from(academicConcepts).forEach((c: string) => {
        if (githubTopics.has(c)) overlap.push(c);
    });

    let consistencyScore = 40;
    if (mergedCount >= 20) consistencyScore += 15;
    else if (mergedCount >= 10) consistencyScore += 10;
    else if (mergedCount >= 3) consistencyScore += 5;

    // webResults 对一致性评分的贡献
    if (webCount >= 10) consistencyScore += 10;
    else if (webCount >= 5) consistencyScore += 5;
    else if (webCount >= 1) consistencyScore += 2;

    if (industry.hasOpenSource) consistencyScore += 10;
    consistencyScore -= redFlags.length * 6;
    if (academicSupport !== 'weak' && industrySupport !== 'weak') consistencyScore += 10;
    consistencyScore = Math.max(0, Math.min(100, consistencyScore));

    return {
        consistencyScore,
        academicSupport,
        industrySupport,
        openSourceVerified: industry.hasOpenSource,
        conceptOverlap: overlap,
        redFlags,
        insights,
    };
}

// ==================== 可信度计算 ====================

function calculateCredibility(academic: AcademicData, industry: IndustryData, validation: CrossValidationResult): CredibilityResult {
    let score = 0;
    const hasAcademic = academic.results.length > 0;
    const hasGithub = industry.hasOpenSource;
    const webCount = industry.webResults?.length || 0;
    const hasWeb = webCount >= 3; // 3条以上网页结果视为有效产业信号

    // [改进] 可信度基础分引入 hasWeb
    if (hasAcademic && (hasGithub || hasWeb)) score = 60;
    else if (hasAcademic) score = 40;
    else if (hasGithub && hasWeb) score = 45;
    else if (hasGithub) score = 30;
    else if (hasWeb) score = 25;
    else score = 10;

    if (academic.stats.totalCitations > 1000) score += 15;
    else if (academic.stats.totalCitations > 100) score += 10;
    else if (academic.stats.totalCitations > 10) score += 5;

    const sourcesWithData = [
        academic.stats.bySource.openAlex,
        academic.stats.bySource.crossref,
        academic.stats.bySource.core,
    ].filter(n => n > 0).length;
    score += sourcesWithData * 3;

    const activeRepos = industry.githubRepos.filter((r: GithubRepo) => r.health === 'active').length;
    if (activeRepos >= 3) score += 15;
    else if (activeRepos > 0) score += 10;

    // [改进] 增加网页资讯覆盖分
    if (webCount >= 10) score += 10;
    else if (webCount >= 5) score += 5;

    score -= validation.redFlags.length * 10;
    score = Math.max(0, Math.min(100, score));

    const level = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
    const reasoning: string[] = [];

    if (hasAcademic && (hasGithub || hasWeb)) {
        reasoning.push('✅ 学术与产业（开源/资讯）双轨验证通过（基础分60分）');
    } else if (hasAcademic) {
        reasoning.push('✅ 具备学术研究基础（基础分40分）');
    } else if (hasGithub || hasWeb) {
        reasoning.push('✅ 具备产业界关注基础（基础分25-45分）');
    }

    if (academic.results.length > 10) reasoning.push(`学术基础扎实（${academic.results.length} 篇论文，${sourcesWithData} 个学术源有数据）`);
    else if (academic.results.length > 0) reasoning.push(`有一定学术基础（${academic.results.length} 篇论文）`);
    else reasoning.push('缺少学术论文支撑');

    if (academic.stats.totalCitations > 100) reasoning.push(`总引用 ${academic.stats.totalCitations} 次`);

    const wechatCount = industry.wechatArticles?.length || 0;
    if (industry.hasOpenSource || webCount > 0 || wechatCount > 0) {
        if (industry.hasOpenSource) {
            reasoning.push(`[GitHub] 发现开源框架实现（${industry.githubRepos.length} 个项目，其中 ${activeRepos} 个活跃）`);
        }
        if (webCount > 0) {
            const sources = [];
            if (industry.webSources?.brave) sources.push(`Brave(${industry.webSources.brave}条)`);
            if (industry.webSources?.serpapi) sources.push(`SerpAPI多引擎(${industry.webSources.serpapi}条)`);
            reasoning.push(`[全网资讯] 获取关联网页结果 ${webCount} 条（来源：${sources.length > 0 ? sources.join('，') : '多源搜索引擎'}）`);
        }
        if (wechatCount > 0) {
            reasoning.push(`[微信公众号] 获取 ${wechatCount} 篇相关公众号文章，国内产业关注度有据可查`);
        }
    } else {
        reasoning.push('未检测到显著的产业界落地信号');
    }

    for (const f of validation.redFlags) reasoning.push(`⚠️ ${f}`);

    return { score, level, reasoning };
}

// ==================== 建议生成 ====================

function generateRecommendation(credibility: CredibilityResult, validation: CrossValidationResult): string {
    if (credibility.level === 'high') {
        if (validation.openSourceVerified) return '该方向学术基础扎实，已有开源实现验证，产业落地有据可查。建议深入调研差异化空间。';
        return '该方向学术基础扎实，理论可行性较高。建议关注工程化落地机会。';
    }
    if (credibility.level === 'low') {
        if (validation.redFlags.length > 0) return `该方向存在风险：${validation.redFlags[0]}。建议谨慎评估。`;
        return '该方向信息不足，建议扩大调研范围或尝试不同关键词。';
    }
    if (validation.openSourceVerified) return '该方向有一定基础，已有开源实现。建议聚焦差异化创新点。';
    return '该方向有一定学术基础，但产业验证不足。建议进一步调研工程可行性。';
}
