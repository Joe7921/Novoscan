/**
 * Bizscan 竞品拆解师 Agent (Layer 1)
 *
 * 职责：深度拆解竞品格局 — 竞品矩阵、技术栈分析、融资态势、进入壁垒
 * 架构角色：Layer1（与市场侦察员并行，无上游依赖）
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { BizscanAgentInput, CompetitorProfilerOutput } from './types';

export async function competitorProfiler(input: BizscanAgentInput): Promise<CompetitorProfilerOutput> {
  const { parsedIdea, marketSignals } = input;

  // 预处理：提取竞品分析数据
  const webCompetitors = marketSignals.webResults
    .slice(0, 15)
    .map(r => `- [${r.source}] "${r.title}" (${r.url}) — ${r.snippet.slice(0, 100)}`)
    .join('\n') || '无';

  const phProducts = marketSignals.productHuntItems
    .slice(0, 8)
    .map(p => `- "${p.name}" — ${p.tagline.slice(0, 80)} (${p.url})`)
    .join('\n') || '无';

  const ghAlternatives = marketSignals.githubAlternatives
    .slice(0, 8)
    .map(g => `- ${g.fullName} (⭐${g.stars}, ${g.language}) — ${g.description.slice(0, 80)}`)
    .join('\n') || '无';

  const prompt = `
# 系统角色

你是一位拥有 15 年经验的竞争情报分析师，曾为 Y Combinator、a16z 提供竞品情报服务。
你的核心能力是：从公开数据中精准识别竞争格局、拆解竞品技术栈、评估进入壁垒。

## 专业边界
- 你专注于竞品层面的深度拆解，不做宏观市场规模估算
- 你必须基于提供的数据做判断，"推测"内容必须明确标注
- 竞品识别要避免误判——仅当产品解决相似问题时才算竞品

---

# 任务

以"竞品情报报告"的标准，深度分析以下商业想法面临的竞争格局：

**商业想法摘要**：
- 问题: ${parsedIdea.problemStatement}
- 方案: ${parsedIdea.proposedSolution}
- 目标客户: ${parsedIdea.targetCustomer}
- 差异化亮点: ${parsedIdea.keyDifferentiators.join(', ') || '未声明'}
- 涉及技术: ${parsedIdea.technologyStack.join(', ') || '未声明'}

**竞品检索数据**：

网络搜索发现（${marketSignals.webResults.length} 条）：
${webCompetitors}

Product Hunt 已上线产品（${marketSignals.productHuntItems.length} 个）：
${phProducts}

GitHub 开源替代方案（${marketSignals.githubAlternatives.length} 个）：
${ghAlternatives}

---

# 思维链

**Step 1 - 竞品全景扫描**：从搜索数据中识别所有潜在竞品
**Step 2 - 竞品分层**：
  - 直接竞品（解决相同问题，面向相同用户）
  - 间接竞品（解决相似问题，或不同方式）
  - 潜在威胁（大公司可能进入，通用平台覆盖）
**Step 3 - 核心竞品深度拆解**：Top 3-5 直接竞品详细分析（技术栈、生态、商业模式）
**Step 4 - 竞争护城河分析**：识别现有竞品的护城河类型（品牌/网络效应/数据/技术）
**Step 5 - 进入壁垒与差异化突破口**：总结进入壁垒和突破策略

---

# 评分标准

## 综合评分（0-100）— 竞争优势指数（用户视角，越高越有利）：
| 区间 | 含义 |
|------|------|
| 81-100 | 几乎无直接竞品，蓝海赛道 |
| 61-80 | 竞品少或弱，明显差异化空间 |
| 41-60 | 中等竞争，需精准差异化 |
| 21-40 | 竞品成熟，差异化空间有限 |
| 0-20 | 巨头垄断，进入极困难 |

## 4 个评分维度：
1. **竞争密度** (0-100)：竞品越少分越高
2. **技术护城河** (0-100)：现有竞品技术壁垒越低，用户越有机会（分越高）
3. **差异化空间** (0-100)：与现有竞品的差异化程度
4. **进入壁垒** (0-100)：进入该领域越容易分越高

---

# 输出格式

严格按以下 JSON 格式输出：
{
  "agentName": "竞品拆解师",
  "analysis": "最终竞品格局结论（300字以内）",
  "score": "<根据分析独立给出0-100整数>",
  "confidence": "high 或 medium 或 low",
  "confidenceReasoning": "基于 ${marketSignals.webResults.length + marketSignals.productHuntItems.length + marketSignals.githubAlternatives.length} 条竞品数据...",
  "dimensionScores": [
    { "name": "竞争密度", "score": "<独立评分>", "reasoning": "..." },
    { "name": "技术护城河", "score": "<独立评分>", "reasoning": "..." },
    { "name": "差异化空间", "score": "<独立评分>", "reasoning": "..." },
    { "name": "进入壁垒", "score": "<独立评分>", "reasoning": "..." }
  ],
  "keyFindings": ["发现1（引用具体竞品名）", "发现2"],
  "redFlags": ["已有大公司布局"],
  "evidenceSources": ["ProductHunt: 产品名", "GitHub: 项目名"],
  "competitors": [
    {
      "name": "竞品名",
      "description": "一句话描述",
      "url": "https://...",
      "fundingStage": "Series A",
      "estimatedFunding": "$10M",
      "similarityScore": "<0-100语义相似度>",
      "keyOverlap": ["重叠能力1"],
      "keyDifference": "核心差异",
      "source": "ProductHunt",
      "threatLevel": "high"
    }
  ],
  "competitiveMoat": "现有竞品的主要护城河类型总结",
  "entryBarriers": ["壁垒1", "壁垒2"],
  "reasoning": "按 Step1-5 的完整推理过程...（放在最后，防止截断丢失关键数据）"
}

关键规则：
- competitors 数组必须 3-8 个，按 threatLevel 降序排列
- threatLevel 只能是：high/medium/low
- similarityScore 为 0-100 语义相似度
- fundingStage/estimatedFunding 如无法判断可省略
`;

  try {
    const { text } = await callAIRaw(
      prompt,
      input.modelProvider,
      50000,
      4096,
      undefined,
      input._abortSignal,
    );

    const parsed = parseAgentJSON<CompetitorProfilerOutput>(text);

    if (!parsed || typeof parsed.score !== 'number') {
      throw new Error('竞品拆解师返回数据结构不完整');
    }

    parsed.agentName = '竞品拆解师';
    parsed.competitors = Array.isArray(parsed.competitors) ? parsed.competitors : [];
    parsed.competitiveMoat = parsed.competitiveMoat || '';
    parsed.entryBarriers = parsed.entryBarriers || [];
    parsed.dimensionScores = parsed.dimensionScores || [];
    parsed.keyFindings = parsed.keyFindings || [];
    parsed.redFlags = parsed.redFlags || [];
    parsed.evidenceSources = parsed.evidenceSources || [];

    return parsed;
  } catch (err: unknown) {
    console.error('[竞品拆解师] Agent 执行失败:', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
