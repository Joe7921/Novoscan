import { searchBrave } from '@/server/industry/brave'
import { searchSerpAPI } from '@/server/industry/serpapi'
import { searchGithubCached as searchGithub } from '@/server/industry/github'
import { searchWechatArticles } from '@/server/industry/wechat'
import { searchGoogleScholar, type ScholarResult } from '@/server/industry/scholar'
import type { EngineSelection, SerpEngine } from '@/server/search/engine-selector'

export async function searchIndustry(keywords: string[], engineSelection?: EngineSelection) {
    // 确定使用的 SerpAPI 引擎列表
    const serpEngines: SerpEngine[] = engineSelection?.serpEngines || ['google'];

    // 并行调用：Brave + 多个SerpAPI引擎 + GitHub + 微信 + (可选)Scholar
    const serpPromises = serpEngines.map(engine =>
        searchSerpAPI(keywords.join(' '), { engine, num: 10 }).catch(err => {
            console.error(`[SerpAPI/${engine}] 失败:`, err.message)
            return []
        })
    );

    const scholarPromise = engineSelection?.useScholar
        ? searchGoogleScholar(keywords.join(' '), { num: 10, fromYear: 2022 }).catch(err => {
            console.error('[Scholar] 失败:', err.message)
            return [] as ScholarResult[]
        })
        : Promise.resolve([] as ScholarResult[]);

    const [brave, ...serpResults] = await Promise.all([
        searchBrave(keywords.join(' '), { count: 10 }).catch(err => {
            console.error('[Brave] 失败:', err.message)
            return []
        }),
        ...serpPromises,
    ]);

    const [github, wechat, scholar] = await Promise.all([
        searchGithub(keywords, { sort: 'stars', perPage: 10 }).catch(err => {
            console.error('[GitHub] 失败:', err.message)
            return []
        }),
        searchWechatArticles(keywords.join(' '), { num: 8 }).catch(err => {
            console.error('[微信公众号] 失败:', err.message)
            return []
        }),
        scholarPromise,
    ]);

    // 合并多引擎 SerpAPI 结果
    const allSerpResults = serpResults.flat();

    // 合并网页结果（去重）
    const seen = new Set()
    const webResults = [...brave, ...allSerpResults].filter(item => {
        const key = item.url?.toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })

    // 统计各引擎贡献
    const serpapiByEngine: Record<string, number> = {};
    serpEngines.forEach((engine, idx) => {
        serpapiByEngine[engine] = serpResults[idx]?.length || 0;
    });
    const totalSerpapi = allSerpResults.length;

    // 分析情绪（微信文章也计入热度判断）
    const totalSignals = webResults.length + wechat.length
    const sentiment = totalSignals > 20 ? 'hot' :
        totalSignals > 5 ? 'warm' : 'cold'

    // 生成引擎描述日志
    const engineDesc = serpEngines.map(e => `${e}(${serpapiByEngine[e]}条)`).join('+');
    console.log(`[Industry] 🌐 多引擎搜索完成: ${engineDesc} | Brave(${brave.length}条) | Scholar(${scholar.length}篇)`);

    return {
        success: true,
        sources: {
            brave: brave.length,
            serpapi: totalSerpapi,
            serpEngines: serpapiByEngine,  // 新增：各引擎详细统计
            github: github.length,
            wechat: wechat.length,
            scholar: scholar.length,
        },
        webResults: webResults.slice(0, 20),
        githubRepos: github.slice(0, 10),
        wechatArticles: wechat,
        scholarResults: scholar,  // 新增：Google Scholar 结果
        sentiment,
        hasOpenSource: github.length > 0
    }
}

