/**
 * Bizscan 创新度审计师 Agent (Layer 2)
 *
 * 职责：综合 Layer1（市场侦察员+竞品拆解师）报告，深度审计概念新颖度和模式差异化
 * 架构角色：Layer2（与可行性检验师并行，依赖全部 L1 报告）
 *
 * 与常规查重的创新评估师的区别：
 * - 不做学术文献比对，聚焦商业模式和市场层面的创新
 * - 接收竞品拆解师的详细数据进行语义对比
 * - 评分维度更聚焦：概念新颖度、组合创新度、模式差异化
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { BizscanAgentInput, BizscanAgentOutput, MarketScoutOutput, CompetitorProfilerOutput } from './types';

export async function noveltyAuditor(
  input: BizscanAgentInput,
  marketScoutReport: MarketScoutOutput,
  competitorReport: CompetitorProfilerOutput,
): Promise<BizscanAgentOutput> {
  const { parsedIdea } = input;

  // 组装上游报告摘要
  const competitorSummary = competitorReport.competitors
    .slice(0, 6)
    .map(c => `- "${c.name}" (相似度:${c.similarityScore}%, 威胁:${c.threatLevel}) — ${c.description.slice(0, 80)}; 重叠:${c.keyOverlap.join(',') || '无'}; 差异:${c.keyDifference}`)
    .join('\n') || '未发现直接竞品';

  const prompt = `
# 系统角色

你是一位严苛的创新评审专家，曾担任 TechCrunch Disrupt 和 YC Demo Day 的评审委员。
你的核心能力是：剥去商业概念的包装，识别真正的创新内核 vs 包装过的旧概念。

## 审计原则
- 你必须充当"魔鬼代言人"——质疑每一个所谓的"创新点"
- "新瓶装旧酒"必须被识别和扣分
- 组合创新（A+B=C）如果组合逻辑成立，仍可获得中等分数
- 真正的范式创新（重新定义问题/解决路径）才能获得高分

---

# 任务

审计以下商业想法的创新程度，综合市场侦察员和竞品拆解师的前期报告：

**商业想法核心**：
- 问题定义: ${parsedIdea.problemStatement}
- 解决方案: ${parsedIdea.proposedSolution}
- 价值主张: ${parsedIdea.valueProposition}
- 自述差异化: ${parsedIdea.keyDifferentiators.join(', ') || '未声明'}

**市场侦察员报告摘要** (评分: ${marketScoutReport.score}/100, 置信度: ${marketScoutReport.confidence}):
- 市场分析: ${marketScoutReport.analysis.slice(0, 200)}
- 需求信号: ${marketScoutReport.demandSignals?.join('; ') || '无'}
- 市场饱和度: ${marketScoutReport.marketInsights?.saturationLevel || '未知'}

**竞品拆解师报告摘要** (评分: ${competitorReport.score}/100, 置信度: ${competitorReport.confidence}):
- 竞品格局: ${competitorReport.analysis.slice(0, 200)}
- 竞争护城河: ${competitorReport.competitiveMoat || '未分析'}
- 发现的竞品:
${competitorSummary}

---

# 思维链

**Step 1 - 概念拆解**：将商业想法拆解为3层——问题层（P）、方案层（S）、模式层（M）
**Step 2 - 逐层查重**：
  - P层：这个问题定义是否全新？还是已被广泛讨论？
  - S层：这个解决路径是否有先例？还是技术/方法论创新？
  - M层：商业模式是否有新意？是旧模式+新场景 还是 真正的模式创新？
**Step 3 - 对标质疑**：对每个竞品，质疑"用户方案 vs 竞品方案"的本质差异
**Step 4 - 创新类型判定**：
  - A类：范式创新（重新定义问题/创造新品类）
  - B类：组合创新（现有元素的新颖组合，且组合有协同效应）
  - C类：增量创新（现有方案的改良/迭代/本地化）
  - D类：伪创新（换皮/包装/营销话术创新，本质无差异）
**Step 5 - 最终裁定**

---

# 评分标准

## 综合评分（0-100）— 语义新颖度：
| 区间 | 含义 | 创新类型 |
|------|------|----------|
| 85-100 | 范式级创新，开辟新品类 | A类 |
| 65-84 | 优秀的组合创新，有独特价值 | B类 |
| 40-64 | 增量创新，有差异化但不革命性 | C类 |
| 15-39 | 伪创新，与竞品高度同质 | D类 |
| 0-14 | 完全复制，无创新 | 无 |

## 3 个评分维度：
1. **概念新颖度** (0-100)：问题定义和解决路径的原创程度
2. **组合创新度** (0-100)：元素组合的新颖性和协同效应
3. **模式差异化** (0-100)：商业模式与竞品的差异程度

---

# 输出格式

严格按以下 JSON 格式输出：
{
  "agentName": "创新度审计师",
  "reasoning": "按 Step1-5 的完整推理过程（含魔鬼代言人质疑）...",
  "analysis": "创新度审计最终裁定（含创新类型判定）",
  "score": "<根据分析独立给出0-100整数>",
  "confidence": "high 或 medium 或 low",
  "confidenceReasoning": "基于 ${competitorReport.competitors.length} 个竞品的对标分析...",
  "dimensionScores": [
    { "name": "概念新颖度", "score": "<独立评分>", "reasoning": "..." },
    { "name": "组合创新度", "score": "<独立评分>", "reasoning": "..." },
    { "name": "模式差异化", "score": "<独立评分>", "reasoning": "..." }
  ],
  "keyFindings": ["关键发现1", "关键发现2"],
  "redFlags": ["被质疑的创新点"],
  "evidenceSources": ["竞品: XX", "市场数据: XX"]
}
`;

  try {
    const { text } = await callAIRaw(prompt, input.modelProvider, 50000, 4096, undefined, input._abortSignal);
    const parsed = parseAgentJSON<BizscanAgentOutput>(text);

    if (!parsed || typeof parsed.score !== 'number') {
      throw new Error('创新度审计师返回数据结构不完整');
    }

    parsed.agentName = '创新度审计师';
    parsed.dimensionScores = parsed.dimensionScores || [];
    parsed.keyFindings = parsed.keyFindings || [];
    parsed.redFlags = parsed.redFlags || [];
    parsed.evidenceSources = parsed.evidenceSources || [];

    return parsed;
  } catch (err: unknown) {
    console.error('[创新度审计师] Agent 执行失败:', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
