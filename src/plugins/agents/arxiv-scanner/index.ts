/**
 * 🔬 arXiv 论文扫描仪（arXiv Scanner）— 社区示范插件
 *
 * 基于 arXiv API 数据评估创新点在学术前沿的热度、密集度和突破口。
 * 分析维度：论文数量趋势、引用网络、研究方向分布、最新突破。
 *
 * ⚠️ 当前为模拟数据演示。接入真实 arXiv API 时替换 searchArxiv()。
 *
 * @author Novoscan Community
 * @version 1.0.0
 */

import { defineAgent } from '@/plugins/types'
import type { AgentInput, AgentOutput, DimensionScore } from '@/agents/types'

/** arXiv 论文元数据 */
interface ArxivPaper {
  title: string
  authors: string[]
  abstract: string
  categories: string[]
  publishedDate: string
  arxivId: string
  citationEstimate: number
}

/** arXiv 分析结果 */
interface ArxivAnalysis {
  papers: ArxivPaper[]
  totalResults: number
  yearlyTrend: Array<{ year: number; count: number }>
  topCategories: Array<{ category: string; count: number }>
  recentBreakthroughs: string[]
}

/**
 * 模拟 arXiv API 搜索
 *
 * 生产环境应替换为真实 arXiv API:
 * GET http://export.arxiv.org/api/query?search_query=all:{query}&max_results=20
 */
async function searchArxiv(query: string): Promise<ArxivAnalysis> {
  await new Promise(resolve => setTimeout(resolve, 400))

  const words = query.split(/\s+/).filter(w => w.length > 1)
  const topic = words.join(' ')
  const seed = words.reduce((acc, w) => acc + w.charCodeAt(0), 0)

  // 生成模拟论文
  const papers: ArxivPaper[] = [
    {
      title: `A Survey of ${topic}: Methods, Challenges, and Future Directions`,
      authors: ['Zhang et al.'],
      abstract: `This paper provides a comprehensive survey of recent advances in ${topic}, covering key methodologies and identifying open challenges.`,
      categories: ['cs.AI', 'cs.LG'],
      publishedDate: '2025-08-15',
      arxivId: `2508.${10000 + seed % 5000}`,
      citationEstimate: 45 + (seed % 100),
    },
    {
      title: `Towards Efficient ${topic} with Transformer Architectures`,
      authors: ['Li, Wang, Chen'],
      abstract: `We propose a novel transformer-based approach for ${topic} that achieves state-of-the-art results with 3x less computation.`,
      categories: ['cs.LG', 'cs.CL'],
      publishedDate: '2025-10-22',
      arxivId: `2510.${10000 + seed % 3000}`,
      citationEstimate: 28 + (seed % 60),
    },
    {
      title: `${topic}: A Benchmark and Analysis`,
      authors: ['Liu et al.'],
      abstract: `We introduce a comprehensive benchmark for evaluating ${topic} systems and provide detailed analysis of existing approaches.`,
      categories: ['cs.AI'],
      publishedDate: '2025-06-10',
      arxivId: `2506.${10000 + seed % 4000}`,
      citationEstimate: 62 + (seed % 80),
    },
    {
      title: `Scalable ${topic} via Federated Learning`,
      authors: ['Park, Kim, Lee'],
      abstract: `A federated learning framework for scalable ${topic} that preserves data privacy while maintaining model performance.`,
      categories: ['cs.LG', 'cs.DC'],
      publishedDate: '2025-09-05',
      arxivId: `2509.${10000 + seed % 6000}`,
      citationEstimate: 15 + (seed % 40),
    },
    {
      title: `Real-time ${topic} on Edge Devices`,
      authors: ['Sharma, Patel'],
      abstract: `An optimized inference pipeline for deploying ${topic} models on resource-constrained edge devices.`,
      categories: ['cs.CV', 'cs.AR'],
      publishedDate: '2025-11-01',
      arxivId: `2511.${10000 + seed % 2000}`,
      citationEstimate: 8 + (seed % 25),
    },
  ]

  const totalResults = 20 + (seed % 200)

  return {
    papers,
    totalResults,
    yearlyTrend: [
      { year: 2021, count: Math.round(totalResults * 0.1) },
      { year: 2022, count: Math.round(totalResults * 0.2) },
      { year: 2023, count: Math.round(totalResults * 0.35) },
      { year: 2024, count: Math.round(totalResults * 0.5) },
      { year: 2025, count: Math.round(totalResults * 0.7) },
    ],
    topCategories: [
      { category: 'cs.AI', count: Math.round(totalResults * 0.4) },
      { category: 'cs.LG', count: Math.round(totalResults * 0.3) },
      { category: 'cs.CL', count: Math.round(totalResults * 0.15) },
      { category: 'cs.CV', count: Math.round(totalResults * 0.1) },
      { category: 'cs.DC', count: Math.round(totalResults * 0.05) },
    ],
    recentBreakthroughs: [
      `${topic} 在大规模数据集上突破 SOTA`,
      `跨模态 ${topic} 方法论统一`,
      `${topic} 的可解释性新框架`,
    ],
  }
}

/**
 * 学术热度 → 创新空间评估
 */
function assessAcademicInnovation(analysis: ArxivAnalysis): {
  innovationScore: number
  heatLevel: 'hot' | 'warm' | 'cold'
  insight: string
} {
  const { totalResults, yearlyTrend } = analysis
  // 计算增长率
  const recentGrowth = yearlyTrend.length >= 2
    ? (yearlyTrend[yearlyTrend.length - 1].count - yearlyTrend[yearlyTrend.length - 2].count) / Math.max(1, yearlyTrend[yearlyTrend.length - 2].count)
    : 0

  let innovationScore: number
  let heatLevel: 'hot' | 'warm' | 'cold'
  let insight: string

  if (totalResults > 100 && recentGrowth > 0.3) {
    innovationScore = 40 + Math.round(Math.random() * 15)
    heatLevel = 'hot'
    insight = '该领域学术热度极高且仍在加速增长，竞争激烈但市场验证充分。建议聚焦细分方向突破。'
  } else if (totalResults > 30) {
    innovationScore = 60 + Math.round(Math.random() * 15)
    heatLevel = 'warm'
    insight = '该领域学术关注度适中，存在较好的创新窗口。建议结合工程落地差异化。'
  } else {
    innovationScore = 80 + Math.round(Math.random() * 10)
    heatLevel = 'cold'
    insight = '该领域学术关注度较低，先发优势明显。但需注意可能的市场风险（需求未经学术验证）。'
  }

  return { innovationScore, heatLevel, insight }
}

// ==================== 导出 Agent 定义 ====================

export default defineAgent({
  id: 'arxiv-scanner',
  name: 'arXiv 论文扫描仪',
  nameEn: 'arXiv Scanner',
  description: '扫描 arXiv 前沿论文，评估创新点在学术研究中的热度、密集度和突破口',
  version: '1.0.0',
  author: 'Novoscan Community',
  category: 'academic',
  icon: '🔬',

  async analyze(input: AgentInput): Promise<AgentOutput> {
    const { query, academicData, language } = input

    // 1. 搜索 arXiv
    const arxivData = await searchArxiv(query)

    // 2. 评估创新空间
    const { innovationScore, heatLevel, insight } = assessAcademicInnovation(arxivData)

    // 3. 结合编排器已有的学术数据
    const existingPapers = academicData?.results?.length || 0

    // 4. 多维评分
    const dimensionScores: DimensionScore[] = [
      {
        name: language === 'zh' ? '学术空白度' : 'Academic Whitespace',
        score: innovationScore,
        reasoning: language === 'zh'
          ? `arXiv 共 ${arxivData.totalResults} 篇相关论文，热度: ${heatLevel}`
          : `${arxivData.totalResults} related papers on arXiv, heat: ${heatLevel}`,
      },
      {
        name: language === 'zh' ? '增长趋势' : 'Growth Trend',
        score: heatLevel === 'hot' ? 85 : heatLevel === 'warm' ? 60 : 30,
        reasoning: language === 'zh'
          ? `年度论文增长趋势: ${arxivData.yearlyTrend.map(y => `${y.year}:${y.count}`).join(' → ')}`
          : `Annual paper trend: ${arxivData.yearlyTrend.map(y => `${y.year}:${y.count}`).join(' → ')}`,
      },
      {
        name: language === 'zh' ? '前沿突破性' : 'Frontier Breakthrough',
        score: Math.max(25, innovationScore - 5),
        reasoning: language === 'zh'
          ? `近期 ${arxivData.recentBreakthroughs.length} 项突破性进展`
          : `${arxivData.recentBreakthroughs.length} recent breakthrough advances`,
      },
      {
        name: language === 'zh' ? '引用影响力' : 'Citation Impact',
        score: Math.min(90, Math.round(arxivData.papers.reduce((s, p) => s + p.citationEstimate, 0) / arxivData.papers.length)),
        reasoning: language === 'zh'
          ? `平均预估引用: ${Math.round(arxivData.papers.reduce((s, p) => s + p.citationEstimate, 0) / arxivData.papers.length)}`
          : `Avg estimated citations: ${Math.round(arxivData.papers.reduce((s, p) => s + p.citationEstimate, 0) / arxivData.papers.length)}`,
      },
    ]

    // 5. 关键发现
    const keyFindings = [
      language === 'zh'
        ? `arXiv 共检索到 ${arxivData.totalResults} 篇相关论文`
        : `Found ${arxivData.totalResults} related papers on arXiv`,
      language === 'zh'
        ? `学术热度: ${heatLevel === 'hot' ? '🔥 极热' : heatLevel === 'warm' ? '🌤 温和' : '❄️ 冷门'}`
        : `Academic heat: ${heatLevel}`,
      language === 'zh'
        ? `主要研究方向: ${arxivData.topCategories.slice(0, 3).map(c => c.category).join(', ')}`
        : `Main research areas: ${arxivData.topCategories.slice(0, 3).map(c => c.category).join(', ')}`,
      language === 'zh'
        ? `高引用论文: "${arxivData.papers[0].title}"（预估 ${arxivData.papers[0].citationEstimate} 次引用）`
        : `Top cited: "${arxivData.papers[0].title}" (est. ${arxivData.papers[0].citationEstimate} citations)`,
    ]

    // 6. 红旗
    const redFlags: string[] = []
    if (heatLevel === 'hot') {
      redFlags.push(
        language === 'zh'
          ? '⚠️ 学术研究密度极高，创新点可能已被广泛覆盖'
          : '⚠️ Extremely high research density, innovation may already be well-covered'
      )
    }
    const highCitePapers = arxivData.papers.filter(p => p.citationEstimate > 50)
    if (highCitePapers.length >= 2) {
      redFlags.push(
        language === 'zh'
          ? `⚠️ 存在 ${highCitePapers.length} 篇高引用论文，需仔细区分创新点与已有工作`
          : `⚠️ ${highCitePapers.length} highly-cited papers exist, need careful differentiation`
      )
    }

    // 7. 完整分析文本
    const analysis = language === 'zh'
      ? [
          `## 🔬 arXiv 学术前沿扫描报告\n`,
          `### 检索概览`,
          `- 相关论文总数: **${arxivData.totalResults}**`,
          `- 学术热度: **${heatLevel === 'hot' ? '🔥 极热' : heatLevel === 'warm' ? '🌤 温和' : '❄️ 冷门'}**`,
          `- 创新空间评分: **${innovationScore}/100**\n`,
          `### 年度趋势\n`,
          `| 年份 | 论文数 |`,
          `|------|--------|`,
          ...arxivData.yearlyTrend.map(y => `| ${y.year} | ${y.count} |`),
          `\n### 代表性论文 Top 5\n`,
          ...arxivData.papers.map((p, i) =>
            `${i + 1}. **${p.title}**\n   _${p.authors.join(', ')}_ | \`${p.arxivId}\` | 📅 ${p.publishedDate}\n   > ${p.abstract.slice(0, 100)}...`
          ),
          `\n### 研究方向分布\n`,
          ...arxivData.topCategories.map(c =>
            `- \`${c.category}\`: ${c.count} 篇 (${'█'.repeat(Math.round(c.count / arxivData.totalResults * 20))})`
          ),
          `\n### 近期突破\n`,
          ...arxivData.recentBreakthroughs.map(b => `- 💡 ${b}`),
          `\n### 创新空间洞察\n`,
          insight,
        ].join('\n')
      : [
          `## 🔬 arXiv Academic Frontier Scan\n`,
          `### Overview`,
          `- Total papers: **${arxivData.totalResults}**`,
          `- Academic heat: **${heatLevel}**`,
          `- Innovation score: **${innovationScore}/100**\n`,
          `### Top Papers\n`,
          ...arxivData.papers.map((p, i) =>
            `${i + 1}. **${p.title}** — \`${p.arxivId}\`\n   ${p.abstract.slice(0, 100)}...`
          ),
          `\n### Insight\n`,
          insight,
        ].join('\n')

    return {
      agentName: language === 'zh' ? 'arXiv 论文扫描仪' : 'arXiv Scanner',
      analysis,
      score: innovationScore,
      confidence: heatLevel === 'cold' ? 'low' : 'medium',
      confidenceReasoning: language === 'zh'
        ? `基于 arXiv ${arxivData.totalResults} 篇论文的模拟分析。接入真实 arXiv API 并结合已有 ${existingPapers} 条学术数据可提高置信度。`
        : `Based on simulated analysis of ${arxivData.totalResults} arXiv papers. Connect real arXiv API and combine with existing ${existingPapers} academic results for higher confidence.`,
      keyFindings,
      redFlags,
      evidenceSources: arxivData.papers.map(p => `arXiv:${p.arxivId} — ${p.title}`),
      reasoning: language === 'zh'
        ? `通过 arXiv 检索 ${arxivData.totalResults} 篇论文，分析年度发文趋势、引用影响力、研究方向分布，综合评估学术领域的创新空间和机会窗口。`
        : `Searched ${arxivData.totalResults} arXiv papers, analyzed annual publication trends, citation impact, and research direction distribution to assess academic innovation space.`,
      dimensionScores,
    }
  },
})
