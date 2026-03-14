/**
 * Bizscan 市场侦察员 Agent (Layer 1)
 *
 * 职责：分析市场全景 — 市场规模推算、增长趋势、饱和度、需求验证信号
 * 架构角色：Layer1（与竞品拆解师并行，无上游依赖）
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { BizscanAgentInput, MarketScoutOutput } from './types';

export async function marketScout(input: BizscanAgentInput): Promise<MarketScoutOutput> {
    const { parsedIdea, marketSignals } = input;

    // 预处理：提取市场分析所需的数据摘要
    const webSummary = marketSignals.webResults
        .slice(0, 12)
        .map(r => `- [${r.source}] "${r.title}" — ${r.snippet.slice(0, 100)}`)
        .join('\n') || '无网络搜索结果';

    const phSummary = marketSignals.productHuntItems
        .slice(0, 6)
        .map(p => `- "${p.name}" — ${p.tagline.slice(0, 80)}`)
        .join('\n') || '无 Product Hunt 数据';

    const cfSummary = marketSignals.crowdfundingResults
        .slice(0, 5)
        .map(c => `- "${c.title}" — ${c.snippet.slice(0, 80)}`)
        .join('\n') || '无众筹数据';

    const prompt = `
# 系统角色

你是一位拥有 15 年经验的市场研究分析师，曾为 McKinsey、BCG 提供市场进入策略咨询。
你的核心能力是：从碎片化的公开数据中推算市场规模、判断增长趋势、评估市场饱和度。

## 专业边界
- 你专注于市场层面的宏观分析，不做竞品深度拆解或技术可行性评估
- 你必须基于提供的数据做判断，明确标注哪些是"有数据支撑的结论"、哪些是"基于经验的推测"
- 所有市场规模估算必须注明估算方法和置信区间

---

# 任务

以"市场研究报告"的标准，分析以下商业想法面临的市场机会：

**商业想法摘要**：
- 问题: ${parsedIdea.problemStatement}
- 方案: ${parsedIdea.proposedSolution}
- 目标客户: ${parsedIdea.targetCustomer}
- 价值主张: ${parsedIdea.valueProposition}
- 盈利模式: ${parsedIdea.revenueModel}
- 行业标签: ${parsedIdea.industryTags.join(', ') || '未知'}

**市场检索数据**：

网络搜索结果（${marketSignals.webResults.length} 条）：
${webSummary}

Product Hunt 已上线产品（${marketSignals.productHuntItems.length} 个）：
${phSummary}

众筹平台信号（${marketSignals.crowdfundingResults.length} 条）：
${cfSummary}

---

# 思维链（请按以下步骤逐步推理）

**Step 1 - 行业识别与分类**：判断该想法属于哪个行业/子行业
**Step 2 - TAM/SAM/SOM 推算**：基于现有数据和行业知识，推算可触达市场规模
**Step 3 - 增长趋势判断**：这个市场处于爆发期/增长期/稳定期/衰退期？
**Step 4 - 饱和度评估**：已有多少玩家？是红海还是蓝海？
**Step 5 - 需求验证**：有哪些信号表明市场对这类方案有真实需求？

---

# 评分标准

## 综合评分（0-100）— 市场机会指数：
| 区间 | 含义 |
|------|------|
| 81-100 | 巨大的蓝海市场机会，需求明确且未被满足 |
| 61-80 | 良好的市场机会，增长中且有进入空间 |
| 41-60 | 市场存在但竞争中等，需精准定位 |
| 21-40 | 市场趋于饱和，机会有限 |
| 0-20 | 市场过度饱和或需求不明确 |

## 4 个评分维度：
1. **市场规模** (0-100)：可服务市场越大分越高
2. **增长势能** (0-100)：增长越快分越高
3. **饱和度** (0-100)：越不饱和分越高
4. **需求验证** (0-100)：需求信号越强分越高

---

# 输出格式

严格按以下 JSON 格式输出，不要有任何其他内容：
{
  "agentName": "市场侦察员",
  "reasoning": "按 Step1-5 的完整推理过程...",
  "analysis": "最终市场分析结论（300字以内）",
  "score": "<根据分析独立给出0-100整数>",
  "confidence": "high 或 medium 或 low",
  "confidenceReasoning": "基于 ${marketSignals.webResults.length} 条网络数据和 ${marketSignals.productHuntItems.length} 个产品数据...",
  "dimensionScores": [
    { "name": "市场规模", "score": "<独立评分>", "reasoning": "..." },
    { "name": "增长势能", "score": "<独立评分>", "reasoning": "..." },
    { "name": "饱和度", "score": "<独立评分>", "reasoning": "..." },
    { "name": "需求验证", "score": "<独立评分>", "reasoning": "..." }
  ],
  "keyFindings": ["发现1", "发现2", "发现3"],
  "redFlags": ["风险1"],
  "evidenceSources": ["来源1", "来源2"],
  "marketInsights": {
    "marketSize": "$XX B (202X)",
    "growthTrend": "growing",
    "saturationLevel": "moderate"
  },
  "demandSignals": ["需求信号1", "需求信号2"]
}

关键规则：
- growthTrend 只能是：explosive/growing/stable/declining
- saturationLevel 只能是：oversaturated/crowded/moderate/emerging/blue-ocean
- marketSize 必须注明数据来源或估算方法
- demandSignals 列出 2-4 条具体的需求验证信号
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

        const parsed = parseAgentJSON<MarketScoutOutput>(text);

        if (!parsed || typeof parsed.score !== 'number') {
            throw new Error('市场侦察员返回数据结构不完整');
        }

        // 确保必填字段
        parsed.agentName = '市场侦察员';
        parsed.marketInsights = parsed.marketInsights || { growthTrend: 'stable', saturationLevel: 'moderate' };
        parsed.demandSignals = parsed.demandSignals || [];
        parsed.dimensionScores = parsed.dimensionScores || [];
        parsed.keyFindings = parsed.keyFindings || [];
        parsed.redFlags = parsed.redFlags || [];
        parsed.evidenceSources = parsed.evidenceSources || [];

        return parsed;
    } catch (err: unknown) {
        console.error('[市场侦察员] Agent 执行失败:', err instanceof Error ? err.message : String(err));
        throw err;
    }
}
