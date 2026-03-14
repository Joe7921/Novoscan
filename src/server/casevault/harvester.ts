/**
 * CaseVault — 多源案例采集器
 *
 * 从多个来源采集 OpenClaw/MCP/AI Agent 实战案例：
 *   1. Brave Search — 网络落地案例
 *   2. 微信公众号 — 中文生态实战文章
 *   3. GitHub — 高星开源实现
 *
 * 成本控制策略（极其保守）：
 *   - 每次 Cron 最多 2 个关键词 × 1 源 = 2 次搜索 API 调用
 *   - 轮询采集源：周一三五用 Brave，周二四用微信，周末用 GitHub
 *   - 每月总消耗：Brave ≈ 12 次, SerpAPI(微信) ≈ 8 次, GitHub ≈ 8 次
 *   - 不到免费额度的 1%
 */

import { searchBrave } from '@/server/industry/brave';
import type { BraveResult } from '@/server/industry/brave';
import { searchWechatArticles } from '@/server/industry/wechat';
import type { WechatArticle } from '@/server/industry/wechat';
import { searchGithub } from '@/server/industry/github';

// ==================== 采集配置 ====================

/** 每次 Cron 最多采集的关键词数量（极度节俭） */
const MAX_KEYWORDS_PER_RUN = 2;

/** 每个关键词最多返回的结果数量 */
const MAX_RESULTS_PER_QUERY = 5;

/** 搜索关键词池 — 精准匹配高质量技术实战文章 */
const KEYWORD_POOL = [
    // MCP 生态（精准匹配）
    'MCP server 开发教程 实战',
    'Model Context Protocol 实战 案例',
    'Claude MCP tool 实战经验',
    'MCP 工具开发 企业应用',
    // AI Agent 落地
    'AI Agent 自动化 生产环境 案例',
    'AI Agent 企业级 部署经验',
    'Function calling 实战 生产',
    'AI 工具链 自动化 案例分享',
    // 编程与代码
    'AI 编程助手 实际使用 对比',
    'Cursor Claude Copilot 开发效率',
    'AI 辅助开发 团队实践',
    // 行业垂直
    'AI Agent 金融 自动化',
    'AI Agent 客服 智能体 落地',
    'AI Agent 数据分析 企业',
    'RAG 向量检索 生产环境',
];

// ==================== 统一采集结果 ====================

export interface HarvestedCase {
    title: string;
    url: string;
    snippet: string;
    source_type: 'web' | 'wechat' | 'github';
    author?: string;
    publishDate?: string;
    stars?: number;          // GitHub 专属
    language?: string;       // GitHub 专属
}

// ==================== 源调度（按星期几轮转） ====================

type HarvestSource = 'brave' | 'wechat' | 'github';

/**
 * 根据星期几决定使用哪个采集源，避免同时消耗多个 API 配额
 *
 * 周一、三、五 → Brave Search
 * 周二、四     → 微信公众号（SerpAPI）
 * 周六、日     → GitHub（免费 API，无配额压力）
 */
function getTodaySource(): HarvestSource {
    const dayOfWeek = new Date().getDay(); // 0=周日, 1=周一, ...6=周六
    if (dayOfWeek === 0 || dayOfWeek === 6) return 'github';
    if (dayOfWeek === 2 || dayOfWeek === 4) return 'wechat';
    return 'brave'; // 周一、三、五
}

/**
 * 从关键词池中随机选取指定数量的关键词
 */
function pickRandomKeywords(count: number): string[] {
    const shuffled = [...KEYWORD_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

// ==================== 采集入口 ====================

export interface HarvestResult {
    source: HarvestSource;
    keywords: string[];
    cases: HarvestedCase[];
    apiCallsUsed: number;
    errors: string[];
}

/**
 * 执行一轮案例采集
 *
 * 极度节俭：每次最多 2 个关键词 × 1 个来源 = 2 次 API 调用
 */
export async function harvestCases(): Promise<HarvestResult> {
    const source = getTodaySource();
    const keywords = pickRandomKeywords(MAX_KEYWORDS_PER_RUN);
    const cases: HarvestedCase[] = [];
    const errors: string[] = [];
    let apiCallsUsed = 0;

    console.log(`[CaseVault/Harvester] 🌾 开始采集 | 源=${source} | 关键词=${keywords.join(', ')}`);

    for (const keyword of keywords) {
        try {
            let batch: HarvestedCase[] = [];

            switch (source) {
                case 'brave':
                    batch = await harvestFromBrave(keyword);
                    break;
                case 'wechat':
                    batch = await harvestFromWechat(keyword);
                    break;
                case 'github':
                    batch = await harvestFromGitHub(keyword);
                    break;
            }

            apiCallsUsed++;
            cases.push(...batch);
            console.log(`[CaseVault/Harvester] ✅ "${keyword}" → ${batch.length} 条`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`[${source}] "${keyword}": ${msg}`);
            console.warn(`[CaseVault/Harvester] ⚠️ "${keyword}" 采集失败: ${msg}`);
        }
    }

    console.log(`[CaseVault/Harvester] 📊 完成 | ${cases.length} 条案例 | ${apiCallsUsed} 次API调用 | ${errors.length} 个错误`);

    return { source, keywords, cases, apiCallsUsed, errors };
}

// ==================== 各源适配器 ====================

async function harvestFromBrave(keyword: string): Promise<HarvestedCase[]> {
    const results: BraveResult[] = await searchBrave(keyword, {
        count: MAX_RESULTS_PER_QUERY,
        freshness: 'pm', // 过去一个月的新鲜内容
    });

    return results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
        source_type: 'web' as const,
    }));
}

async function harvestFromWechat(keyword: string): Promise<HarvestedCase[]> {
    const articles: WechatArticle[] = await searchWechatArticles(keyword, {
        num: MAX_RESULTS_PER_QUERY,
    });

    return articles.map(a => ({
        title: a.title,
        url: a.url,
        snippet: a.description,
        source_type: 'wechat' as const,
        author: a.author,
        publishDate: a.publishDate,
    }));
}

async function harvestFromGitHub(keyword: string): Promise<HarvestedCase[]> {
    // 复用现有的 GitHub 搜索（接受 string[] 参数），它内部已经有成本控制
    const repos = await searchGithub([keyword]);

    return repos
        .filter((r) => r.stars >= 5) // 只保留有一定星标的仓库
        .slice(0, MAX_RESULTS_PER_QUERY)
        .map((r) => ({
            title: r.fullName,
            url: r.url,
            snippet: r.description || '',
            source_type: 'github' as const,
            stars: r.stars,
            language: r.language,
        }));
}

// ==================== 用户 Idea 转采集结果 ====================

/**
 * 将用户提交的 Clawscan Idea 转换为 HarvestedCase（零 API 消耗）
 */
export function ideaToCase(
    ideaDescription: string,
    capabilities: string[],
    category: string,
): HarvestedCase {
    return {
        title: `[用户构想] ${ideaDescription.slice(0, 60)}`,
        url: '', // 用户 Idea 没有来源 URL
        snippet: ideaDescription,
        source_type: 'web' as const, // 将在 polisher 中标记为 user_idea
    };
}
