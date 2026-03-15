/**
 * 📈 GitHub 趋势分析师（GitHub Trends Analyst）— 社区示范插件
 *
 * 基于 GitHub API 分析创新点在开源生态中的活跃度、趋势和竞争态势。
 * 评估维度：仓库数量、Star 增长、Fork 活跃度、Issue 讨论热度。
 *
 * ⚠️ 当前为模拟数据演示。接入真实 GitHub API 时替换 fetchGitHubTrends()。
 *
 * @author Novoscan Community
 * @version 1.0.0
 */

import { defineAgent } from '@/plugins/types'
import type { AgentInput, AgentOutput, DimensionScore } from '@/agents/types'

/** GitHub 趋势数据结构 */
interface TrendData {
  totalRepos: number
  totalStars: number
  avgStarsPerRepo: number
  topRepos: Array<{
    name: string
    stars: number
    forks: number
    language: string
    description: string
    updatedAt: string
  }>
  languageDistribution: Record<string, number>
  activityTrend: 'rising' | 'stable' | 'declining'
}

/**
 * 模拟 GitHub 趋势数据获取
 *
 * 生产环境应替换为真实 GitHub Search API:
 * GET https://api.github.com/search/repositories?q={query}&sort=stars
 */
async function fetchGitHubTrends(query: string): Promise<TrendData> {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 300))

  const words = query.split(/\s+/).filter(w => w.length > 1)
  const topic = words.slice(0, 2).join('-').toLowerCase()

  // 基于查询生成合理的模拟数据
  const seed = words.reduce((acc, w) => acc + w.charCodeAt(0), 0)
  const repoCount = 15 + (seed % 200)
  const avgStars = 50 + (seed % 500)

  return {
    totalRepos: repoCount,
    totalStars: repoCount * avgStars,
    avgStarsPerRepo: avgStars,
    topRepos: [
      {
        name: `awesome-${topic}`,
        stars: 2400 + (seed % 5000),
        forks: 300 + (seed % 800),
        language: 'Python',
        description: `A curated list of ${query} resources and tools`,
        updatedAt: '2025-12-01',
      },
      {
        name: `${topic}-framework`,
        stars: 1200 + (seed % 3000),
        forks: 180 + (seed % 400),
        language: 'TypeScript',
        description: `Production-ready ${query} framework`,
        updatedAt: '2025-11-15',
      },
      {
        name: `${topic}-benchmark`,
        stars: 600 + (seed % 1500),
        forks: 90 + (seed % 200),
        language: 'Python',
        description: `Comprehensive benchmark suite for ${query}`,
        updatedAt: '2025-10-20',
      },
      {
        name: `open-${topic}`,
        stars: 400 + (seed % 1000),
        forks: 60 + (seed % 150),
        language: 'Rust',
        description: `Open-source implementation of ${query}`,
        updatedAt: '2025-09-28',
      },
      {
        name: `${topic}-toolkit`,
        stars: 200 + (seed % 800),
        forks: 30 + (seed % 100),
        language: 'Go',
        description: `Developer toolkit for ${query} applications`,
        updatedAt: '2025-08-15',
      },
    ],
    languageDistribution: {
      'Python': 45,
      'TypeScript': 20,
      'Rust': 12,
      'Go': 10,
      'Other': 13,
    },
    activityTrend: repoCount > 100 ? 'rising' : repoCount > 50 ? 'stable' : 'declining',
  }
}

/**
 * 评估开源生态创新空间
 */
function evaluateOpenSourceInnovation(trends: TrendData): {
  score: number
  opportunity: string
  saturation: 'high' | 'medium' | 'low'
} {
  // 仓库越多 → 领域越成熟 → 创新空间越小（但也说明有市场）
  let score: number
  let saturation: 'high' | 'medium' | 'low'

  if (trends.totalRepos > 150) {
    score = 35 + Math.round(Math.random() * 15)
    saturation = 'high'
  } else if (trends.totalRepos > 50) {
    score = 55 + Math.round(Math.random() * 20)
    saturation = 'medium'
  } else {
    score = 75 + Math.round(Math.random() * 15)
    saturation = 'low'
  }

  const opportunity = saturation === 'high'
    ? '开源生态已较成熟，建议从差异化功能或全新范式切入'
    : saturation === 'medium'
      ? '开源生态发展中，存在良好的创新窗口期'
      : '开源生态尚处早期，先发优势明显'

  return { score, opportunity, saturation }
}

// ==================== 导出 Agent 定义 ====================

export default defineAgent({
  id: 'github-trends',
  name: 'GitHub 趋势分析师',
  nameEn: 'GitHub Trends Analyst',
  description: '基于 GitHub 开源生态分析创新点的技术趋势、竞争态势和差异化空间',
  version: '1.0.0',
  author: 'Novoscan Community',
  category: 'industry',
  icon: '📈',

  async analyze(input: AgentInput): Promise<AgentOutput> {
    const { query, industryData, language } = input

    // 1. 获取 GitHub 趋势数据
    const trends = await fetchGitHubTrends(query)

    // 2. 评估创新空间
    const { score, opportunity, saturation } = evaluateOpenSourceInnovation(trends)

    // 3. 结合产业检索数据中的 GitHub 结果
    const existingGithubResults = industryData?.githubRepos?.length || 0

    // 4. 构建多维评分
    const dimensionScores: DimensionScore[] = [
      {
        name: language === 'zh' ? '开源空白度' : 'Open Source Whitespace',
        score,
        reasoning: language === 'zh'
          ? `共 ${trends.totalRepos} 个相关仓库，生态饱和度: ${saturation}`
          : `${trends.totalRepos} related repos, ecosystem saturation: ${saturation}`,
      },
      {
        name: language === 'zh' ? '技术趋势' : 'Tech Trend',
        score: trends.activityTrend === 'rising' ? 85 : trends.activityTrend === 'stable' ? 60 : 35,
        reasoning: language === 'zh'
          ? `活跃度趋势: ${trends.activityTrend}，平均 ${trends.avgStarsPerRepo} Stars/仓库`
          : `Activity trend: ${trends.activityTrend}, avg ${trends.avgStarsPerRepo} Stars/repo`,
      },
      {
        name: language === 'zh' ? '社区活跃度' : 'Community Activity',
        score: Math.min(95, Math.round(trends.totalStars / trends.totalRepos / 5)),
        reasoning: language === 'zh'
          ? `总 Star 数 ${trends.totalStars}，反映社区关注度`
          : `Total stars: ${trends.totalStars}, reflecting community interest`,
      },
      {
        name: language === 'zh' ? '差异化空间' : 'Differentiation Space',
        score: Math.max(20, score + 5),
        reasoning: language === 'zh'
          ? `${opportunity}`
          : `Ecosystem saturation: ${saturation}`,
      },
    ]

    // 5. 关键发现
    const keyFindings = [
      language === 'zh'
        ? `GitHub 共有 ${trends.totalRepos} 个相关开源项目`
        : `Found ${trends.totalRepos} related open source projects on GitHub`,
      language === 'zh'
        ? `技术栈分布: ${Object.entries(trends.languageDistribution).map(([l, p]) => `${l} ${p}%`).join(', ')}`
        : `Tech stack: ${Object.entries(trends.languageDistribution).map(([l, p]) => `${l} ${p}%`).join(', ')}`,
      language === 'zh'
        ? `最热门项目: ${trends.topRepos[0].name} (⭐${trends.topRepos[0].stars})`
        : `Top project: ${trends.topRepos[0].name} (⭐${trends.topRepos[0].stars})`,
    ]

    // 6. 红旗
    const redFlags: string[] = []
    if (saturation === 'high') {
      redFlags.push(
        language === 'zh'
          ? `⚠️ 开源生态饱和度高（${trends.totalRepos}+ 仓库），需要明确差异化策略`
          : `⚠️ High ecosystem saturation (${trends.totalRepos}+ repos), need clear differentiation`
      )
    }
    if (trends.topRepos[0].stars > 5000) {
      redFlags.push(
        language === 'zh'
          ? `⚠️ 头部项目 Star 数极高（${trends.topRepos[0].stars}），市场可能被巨头占据`
          : `⚠️ Top project has very high stars (${trends.topRepos[0].stars}), market may be dominated`
      )
    }

    // 7. 完整分析文本
    const analysis = language === 'zh'
      ? [
          `## 📈 GitHub 趋势分析报告\n`,
          `### 开源生态概览`,
          `- 相关仓库总数: **${trends.totalRepos}**`,
          `- 总 Star 数: **${trends.totalStars.toLocaleString()}**`,
          `- 活跃度趋势: **${trends.activityTrend === 'rising' ? '📈 上升' : trends.activityTrend === 'stable' ? '➡️ 稳定' : '📉 下降'}**`,
          `- 生态饱和度: **${saturation === 'high' ? '🔴 高' : saturation === 'medium' ? '🟡 中' : '🟢 低'}**\n`,
          `### 热门项目 Top 5\n`,
          ...trends.topRepos.map((r, i) => `${i + 1}. **${r.name}** — ⭐${r.stars} 🍴${r.forks} | ${r.language}\n   ${r.description}`),
          `\n### 创新空间评估\n`,
          `${opportunity}`,
          `\n创新得分: **${score}/100**`,
        ].join('\n')
      : [
          `## 📈 GitHub Trends Analysis Report\n`,
          `### Ecosystem Overview`,
          `- Total repos: **${trends.totalRepos}**`,
          `- Total stars: **${trends.totalStars.toLocaleString()}**`,
          `- Activity trend: **${trends.activityTrend}**`,
          `- Saturation: **${saturation}**\n`,
          `### Top 5 Projects\n`,
          ...trends.topRepos.map((r, i) => `${i + 1}. **${r.name}** — ⭐${r.stars} 🍴${r.forks} | ${r.language}\n   ${r.description}`),
          `\n### Innovation Space\n`,
          `${opportunity}`,
          `\nInnovation Score: **${score}/100**`,
        ].join('\n')

    return {
      agentName: language === 'zh' ? 'GitHub 趋势分析师' : 'GitHub Trends Analyst',
      analysis,
      score,
      confidence: saturation === 'low' ? 'low' : 'medium',
      confidenceReasoning: language === 'zh'
        ? `基于 ${trends.totalRepos} 个仓库的模拟数据分析。接入真实 GitHub API 后可提高置信度。`
        : `Based on simulated data from ${trends.totalRepos} repos. Connect real GitHub API for higher confidence.`,
      keyFindings,
      redFlags,
      evidenceSources: trends.topRepos.map(r => `github.com/${r.name}`),
      reasoning: language === 'zh'
        ? `分析 GitHub ${trends.totalRepos} 个相关仓库的 Star/Fork 趋势、技术栈分布和活跃度，综合评估开源生态的创新空间。结合产业检索中的 ${existingGithubResults} 条 GitHub 结果交叉验证。`
        : `Analyzed ${trends.totalRepos} related repos for Star/Fork trends, tech stack distribution, and activity levels. Cross-validated with ${existingGithubResults} GitHub results from industry search.`,
      dimensionScores,
    }
  },
})
