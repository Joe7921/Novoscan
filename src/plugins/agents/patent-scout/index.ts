/**
 * 专利侦察兵（Patent Scout）— 示范 Agent 插件
 *
 * 搜索 Google Patents 公开页面，提取前 5 条专利结果，
 * 评估用户创新点与已有专利的重叠度，返回标准 AgentOutput。
 *
 * ⚠️ 注意：Google Patents 没有官方 REST API，
 *    此示例通过构造搜索 URL 并使用 fetch 抓取页面来模拟搜索。
 *    生产环境建议替换为 Google Patents Public Datasets (BigQuery)
 *    或 Lens.org API 等正规数据源。
 */

import { defineAgent } from '@/plugins/types'
import type { AgentInput, AgentOutput, DimensionScore } from '@/agents/types'

/** 模拟的专利搜索结果 */
interface PatentResult {
  title: string
  patentNumber: string
  assignee: string
  filingDate: string
  abstract: string
  url: string
  relevanceScore: number  // 与用户创意的相关度 0-100
}

/**
 * 模拟搜索 Google Patents
 *
 * 生产环境应替换为真实 API 调用。
 * 当前实现基于关键词构造合理的模拟结果用于演示。
 */
async function searchGooglePatents(query: string): Promise<PatentResult[]> {
  // 构造 Google Patents 搜索 URL（供参考/跳转用）
  const searchUrl = `https://patents.google.com/?q=${encodeURIComponent(query)}&oq=${encodeURIComponent(query)}`

  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 500))

  // 基于用户查询生成模拟专利数据（演示用）
  const queryWords = query.split(/\s+/).filter(w => w.length > 1)
  const topicSeed = queryWords.slice(0, 3).join(' ')

  const mockPatents: PatentResult[] = [
    {
      title: `Method and system for ${topicSeed} optimization`,
      patentNumber: 'US11234567B2',
      assignee: 'Technology Corp.',
      filingDate: '2023-03-15',
      abstract: `A method for optimizing ${topicSeed} using advanced algorithms and machine learning techniques.`,
      url: `${searchUrl}#US11234567B2`,
      relevanceScore: 75,
    },
    {
      title: `Apparatus for automated ${topicSeed} processing`,
      patentNumber: 'US10987654B1',
      assignee: 'Innovation Labs Inc.',
      filingDate: '2022-08-20',
      abstract: `An apparatus that automates the processing of ${topicSeed} with improved efficiency and accuracy.`,
      url: `${searchUrl}#US10987654B1`,
      relevanceScore: 62,
    },
    {
      title: `${topicSeed} enhancement through neural networks`,
      patentNumber: 'WO2024012345A1',
      assignee: 'DeepTech Research',
      filingDate: '2024-01-10',
      abstract: `Enhancement of ${topicSeed} capabilities through the application of novel neural network architectures.`,
      url: `${searchUrl}#WO2024012345A1`,
      relevanceScore: 58,
    },
    {
      title: `Distributed system for ${topicSeed} analysis`,
      patentNumber: 'EP3456789A1',
      assignee: 'European Innovation AG',
      filingDate: '2023-11-05',
      abstract: `A distributed computing system designed for large-scale ${topicSeed} analysis and data processing.`,
      url: `${searchUrl}#EP3456789A1`,
      relevanceScore: 45,
    },
    {
      title: `Improved ${topicSeed} with edge computing`,
      patentNumber: 'CN116789012A',
      assignee: '创新科技有限公司',
      filingDate: '2023-06-30',
      abstract: `Integration of edge computing technologies for improved ${topicSeed} performance in resource-constrained environments.`,
      url: `${searchUrl}#CN116789012A`,
      relevanceScore: 38,
    },
  ]

  return mockPatents
}

/**
 * 评估创新点与专利的重叠度
 *
 * @param patents - 搜索到的专利列表
 * @returns 重叠度评分 0-100（越高越不重叠 = 越创新）
 */
function evaluateOverlap(patents: PatentResult[]): {
  overlapScore: number
  innovationScore: number
  analysis: string
} {
  if (patents.length === 0) {
    return {
      overlapScore: 0,
      innovationScore: 95,
      analysis: '未检索到相关专利，该创意在专利领域具有极高的新颖性。',
    }
  }

  // 计算平均相关度
  const avgRelevance = patents.reduce((sum, p) => sum + p.relevanceScore, 0) / patents.length
  // 高相关度专利计数
  const highRelevanceCount = patents.filter(p => p.relevanceScore >= 70).length

  // 重叠度 = 平均相关度加权
  const overlapScore = Math.round(avgRelevance * 0.7 + highRelevanceCount * 10)
  // 创新性得分 = 100 - 重叠度（钳制在 10-95 范围）
  const innovationScore = Math.max(10, Math.min(95, 100 - overlapScore))

  let analysis = `检索到 ${patents.length} 条相关专利，平均相关度 ${Math.round(avgRelevance)}%。`
  if (highRelevanceCount > 0) {
    analysis += `其中 ${highRelevanceCount} 条高度相关（≥70%），需重点关注专利规避。`
  }
  if (innovationScore >= 70) {
    analysis += ' 总体而言，该创意在专利空间中具有较好的创新性。'
  } else if (innovationScore >= 40) {
    analysis += ' 该创意存在一定专利风险，建议进行更深入的 FTO（自由实施）分析。'
  } else {
    analysis += ' 该创意与现有专利重叠度较高，建议调整技术方案或寻求差异化。'
  }

  return { overlapScore, innovationScore, analysis }
}

// ==================== 导出 Agent 定义 ====================

const patentScout = defineAgent({
  id: 'patent-scout',
  name: '专利侦察兵',
  nameEn: 'Patent Scout',
  description: '搜索全球专利数据库，评估创新点与已有专利的重叠度',
  version: '1.0.0',
  author: 'Novoscan Team',
  category: 'specialized',
  icon: '📜',

  async analyze(input: AgentInput): Promise<AgentOutput> {
    const { query, language } = input

    // 1. 搜索专利
    const patents = await searchGooglePatents(query)

    // 2. 评估重叠度
    const { innovationScore, analysis: overlapAnalysis } = evaluateOverlap(patents)

    // 3. 构建关键发现
    const keyFindings: string[] = [
      `共检索到 ${patents.length} 条相关专利`,
      ...patents.slice(0, 3).map(p =>
        `${p.patentNumber} — "${p.title}" (${p.assignee}, 相关度 ${p.relevanceScore}%)`
      ),
    ]

    // 4. 识别红旗（高风险项）
    const redFlags: string[] = patents
      .filter(p => p.relevanceScore >= 70)
      .map(p => `⚠️ 高相关专利: ${p.patentNumber} "${p.title}" (相关度 ${p.relevanceScore}%)`)

    // 5. 构建多维评分
    const dimensionScores: DimensionScore[] = [
      {
        name: language === 'zh' ? '专利空白度' : 'Patent Whitespace',
        score: innovationScore,
        reasoning: `基于 ${patents.length} 条专利的相关度分析`,
      },
      {
        name: language === 'zh' ? '技术差异化' : 'Technical Differentiation',
        score: Math.max(20, innovationScore - 5),
        reasoning: '与最相关专利的技术方案差异程度',
      },
      {
        name: language === 'zh' ? '专利规避难度' : 'Patent Circumvention',
        score: Math.max(15, 100 - patents.filter(p => p.relevanceScore >= 60).length * 20),
        reasoning: '规避现有专利所需的技术改造程度',
      },
      {
        name: language === 'zh' ? '商业自由度' : 'Freedom to Operate',
        score: Math.max(10, innovationScore - 10),
        reasoning: '基于专利布局密度的 FTO 初步评估',
      },
    ]

    // 6. 构建完整分析文本
    const fullAnalysis = [
      `## 📜 专利侦察报告`,
      '',
      overlapAnalysis,
      '',
      `### 检索结果摘要`,
      '',
      ...patents.map((p, i) => [
        `**${i + 1}. ${p.title}**`,
        `- 专利号: ${p.patentNumber}`,
        `- 申请人: ${p.assignee}`,
        `- 申请日: ${p.filingDate}`,
        `- 相关度: ${p.relevanceScore}%`,
        `- 摘要: ${p.abstract}`,
        '',
      ].join('\n')),
      '',
      `### 创新性评估`,
      '',
      `专利创新性得分: **${innovationScore}/100**`,
      '',
      innovationScore >= 70
        ? '✅ 该创意在专利空间中具有良好的创新性，专利风险较低。'
        : innovationScore >= 40
          ? '⚠️ 该创意存在一定专利风险，建议进行详细的 FTO 分析。'
          : '🚨 该创意与现有专利重叠度较高，需要重新设计技术方案。',
    ].join('\n')

    // 7. 证据来源
    const evidenceSources = patents.map(p => `${p.patentNumber}: ${p.url}`)

    return {
      agentName: language === 'zh' ? '专利侦察兵' : 'Patent Scout',
      analysis: fullAnalysis,
      score: innovationScore,
      confidence: innovationScore >= 60 ? 'medium' : 'low',
      confidenceReasoning: '基于模拟专利数据的初步分析，生产环境需接入真实专利 API 以提高置信度',
      keyFindings,
      redFlags,
      evidenceSources,
      reasoning: `通过搜索 Google Patents 获取 ${patents.length} 条相关专利，计算平均相关度并评估创新点与现有专利的重叠度，综合得出专利创新性评分。`,
      dimensionScores,
    }
  },
})

export default patentScout
