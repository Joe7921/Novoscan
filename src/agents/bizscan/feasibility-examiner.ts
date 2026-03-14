/**
 * Bizscan 可行性检验师 Agent (Layer 2)
 *
 * 职责：基于 L1 报告评估技术可行性、成本合理性、MVP 速度和团队门槛
 * 架构角色：Layer2（与创新度审计师并行，依赖全部 L1 报告）
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { BizscanAgentInput, BizscanAgentOutput, MarketScoutOutput, CompetitorProfilerOutput } from './types';

export async function feasibilityExaminer(
    input: BizscanAgentInput,
    marketScoutReport: MarketScoutOutput,
    competitorReport: CompetitorProfilerOutput,
): Promise<BizscanAgentOutput> {
    const { parsedIdea, marketSignals } = input;

    const ghSummary = marketSignals.githubAlternatives
        .slice(0, 6)
        .map(g => `- ${g.fullName} (⭐${g.stars}, ${g.language}) — ${g.description.slice(0, 80)}`)
        .join('\n') || '无开源数据';

    const competitorTech = competitorReport.competitors
        .slice(0, 5)
        .map(c => `- "${c.name}" (${c.fundingStage || '未知'}, ${c.estimatedFunding || '未知'})`)
        .join('\n') || '无竞品数据';

    const prompt = `
# 系统角色

你是一位资深 CTO 兼技术投资顾问，拥有 20 年创业和技术评估经验。
你的核心能力是：评估一个商业想法从技术到产品的可行性，包括技术成熟度、成本结构和执行难度。

## 评估原则
- 务实主义：关注"能不能做"和"做得快不快"，不做理论性讨论
- 成本敏感：初创公司预算有限，高成本方案要严格扣分
- MVP 导向：能快速验证的方案加分
- 技术债警示：短期可行但长期有技术债的方案要标注风险

---

# 任务

评估以下商业想法的可行性：

**商业想法技术摘要**：
- 方案: ${parsedIdea.proposedSolution}
- 涉及技术: ${parsedIdea.technologyStack.join(', ') || '未声明'}
- 盈利模式: ${parsedIdea.revenueModel}
- 目标客户: ${parsedIdea.targetCustomer}

**市场侦察员报告** (评分: ${marketScoutReport.score}/100):
- 市场规模: ${marketScoutReport.marketInsights?.marketSize || '未估算'}
- 增长趋势: ${marketScoutReport.marketInsights?.growthTrend || '未知'}

**竞品技术态势**：
${competitorTech}

**相关开源技术栈**：
${ghSummary}

**竞品进入壁垒**：
${(competitorReport.entryBarriers || []).join('\n- ') || '未分析'}

---

# 思维链

**Step 1 - 技术栈评估**：所需技术是否成熟？有无开源基础？
**Step 2 - 成本结构估算**：
  - 开发成本：人力×时间
  - 基础设施成本：服务器/GPU/API 费用
  - 获客成本：预估 CAC
**Step 3 - MVP 时间线**：最小可行产品需要多久？人力门槛？
**Step 4 - 规模化难度**：从 MVP 到规模化的技术挑战
**Step 5 - 风险清单**：关键技术风险和缓解策略

---

# 评分标准

## 综合评分（0-100）— 可行性指数：
| 区间 | 含义 |
|------|------|
| 81-100 | 技术成熟，低成本，可快速 MVP |
| 61-80 | 技术可行，成本可控，3-6月 MVP |
| 41-60 | 有技术挑战但可攻克，6-12月 MVP |
| 21-40 | 技术门槛高，需大量资源 |
| 0-20 | 依赖不成熟技术，极高风险 |

## 4 个评分维度：
1. **技术成熟度** (0-100)：所需技术的当前成熟程度
2. **成本合理性** (0-100)：初创预算能否支撑
3. **MVP 速度** (0-100)：能多快验证假设
4. **团队门槛** (0-100)：所需团队专业性门槛（越低分越高）

---

# 输出格式

严格按以下 JSON 格式输出：
{
  "agentName": "可行性检验师",
  "reasoning": "按 Step1-5 的完整推理过程...",
  "analysis": "可行性检验结论",
  "score": "<根据分析独立给出0-100整数>",
  "confidence": "high 或 medium 或 low",
  "confidenceReasoning": "基于技术栈分析和开源数据...",
  "dimensionScores": [
    { "name": "技术成熟度", "score": "<独立评分>", "reasoning": "..." },
    { "name": "成本合理性", "score": "<独立评分>", "reasoning": "..." },
    { "name": "MVP速度", "score": "<独立评分>", "reasoning": "..." },
    { "name": "团队门槛", "score": "<独立评分>", "reasoning": "..." }
  ],
  "keyFindings": ["关键发现1", "关键发现2"],
  "redFlags": ["技术风险1"],
  "evidenceSources": ["GitHub: XX", "竞品: XX"]
}
`;

    try {
        const { text } = await callAIRaw(prompt, input.modelProvider, 50000, 4096, undefined, input._abortSignal);
        const parsed = parseAgentJSON<BizscanAgentOutput>(text);

        if (!parsed || typeof parsed.score !== 'number') {
            throw new Error('可行性检验师返回数据结构不完整');
        }

        parsed.agentName = '可行性检验师';
        parsed.dimensionScores = parsed.dimensionScores || [];
        parsed.keyFindings = parsed.keyFindings || [];
        parsed.redFlags = parsed.redFlags || [];
        parsed.evidenceSources = parsed.evidenceSources || [];

        return parsed;
    } catch (err: unknown) {
        console.error('[可行性检验师] Agent 执行失败:', err instanceof Error ? err.message : String(err));
        throw err;
    }
}
