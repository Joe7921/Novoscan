import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import { AgentOutput, ArbitrationResult, DebateRecord, CrossDomainScoutOutput } from '../types';
import type { ModelProvider } from '@/types';

/**
 * 仲裁员 Agent（工业级）
 * 
 * 职责：整合四位专家意见，动态调整权重，系统性解决冲突，给出最终决策
 * 模型策略：优先使用 DeepSeek R1 深度推理模型，失败时回退到用户选择的模型
 * 核心升级：
 *   - 动态权重：根据各 Agent 置信度自动调整权重（低置信度 Agent 降权）
 *   - 冲突检测矩阵：自动识别评分差距 > 20 分的维度
 *   - Dissent 记录：保留少数派意见
 *   - 透明评分：输出完整的加权计算明细
 */
export async function arbitrator(
    academicReview: AgentOutput,
    industryAnalysis: AgentOutput,
    innovationEvaluation: AgentOutput,
    competitorAnalysis: AgentOutput,
    language: 'zh' | 'en',
    modelProvider: ModelProvider,
    onProgress?: (event: 'log' | 'progress' | 'agent_state' | 'agent_stream', data: Record<string, unknown>) => void,
    abortSignal?: AbortSignal,
    domainHint?: string,
    debateRecord?: DebateRecord,
    crossDomainResult?: CrossDomainScoutOutput
): Promise<ArbitrationResult> {
    // 工具函数：截断长文本，避免 prompt 超过模型 token 上限
    const truncate = (text: string | undefined, maxLen: number): string => {
        if (!text) return '无';
        if (text.length <= maxLen) return text;
        return text.slice(0, maxLen) + '…（已截断）';
    };

    // 预处理：计算评分统计和冲突点
    const scores = {
        academic: academicReview.score ?? 50,
        industry: industryAnalysis.score ?? 50,
        innovation: innovationEvaluation.score ?? 50,
        competitor: competitorAnalysis.score ?? 50
    };

    const allScores = Object.values(scores);
    const avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
    const stdDev = Math.round(Math.sqrt(allScores.reduce((s, v) => s + Math.pow(v - avgScore, 2), 0) / allScores.length));

    // 根据置信度计算建议权重
    const confidenceMultiplier = (c: 'high' | 'medium' | 'low') =>
        c === 'high' ? 1.0 : c === 'medium' ? 0.8 : 0.5;

    const baseWeights = { academic: 0.30, industry: 0.25, innovation: 0.35, competitor: 0.10 };
    const adjustedWeights = {
        academic: baseWeights.academic * confidenceMultiplier(academicReview.confidence),
        industry: baseWeights.industry * confidenceMultiplier(industryAnalysis.confidence),
        innovation: baseWeights.innovation * confidenceMultiplier(innovationEvaluation.confidence),
        competitor: baseWeights.competitor * confidenceMultiplier(competitorAnalysis.confidence)
    };
    // 归一化
    const totalWeight = Object.values(adjustedWeights).reduce((a, b) => a + b, 0);
    const normalizedWeights = {
        academic: Math.round(adjustedWeights.academic / totalWeight * 100) / 100,
        industry: Math.round(adjustedWeights.industry / totalWeight * 100) / 100,
        innovation: Math.round(adjustedWeights.innovation / totalWeight * 100) / 100,
        competitor: Math.round(adjustedWeights.competitor / totalWeight * 100) / 100
    };

    // 自动检测冲突（评分差距 > 20 分的对）
    const scorePairs = [
        { a: '学术审查员', b: '产业分析员', diff: Math.abs(scores.academic - scores.industry) },
        { a: '学术审查员', b: '创新评估师', diff: Math.abs(scores.academic - scores.innovation) },
        { a: '学术审查员', b: '竞品侦探', diff: Math.abs(scores.academic - scores.competitor) },
        { a: '产业分析员', b: '创新评估师', diff: Math.abs(scores.industry - scores.innovation) },
        { a: '产业分析员', b: '竞品侦探', diff: Math.abs(scores.industry - scores.competitor) },
        { a: '创新评估师', b: '竞品侦探', diff: Math.abs(scores.innovation - scores.competitor) },
    ];
    const conflicts = scorePairs.filter(p => p.diff > 20);

    // 截断各 Agent 的长文本字段，避免 prompt 超过 DeepSeek 131K token 限制
    const MAX_REASONING_LEN = 300;
    const MAX_ANALYSIS_LEN = 500;
    const MAX_FINDINGS = 3;

    const prompt = `
# 系统角色

你是一位资深的技术投资委员会主席，拥有 25 年的风险投资决策经验。
你的核心职责是：**整合四位专家的报告，识别和解决分歧，做出透明的最终决策**。

## 核心原则
1. **透明决策**：每个评分和结论都必须可追溯到具体专家的报告
2. **少数意见保护**：如果某位专家持明显不同的观点，必须记录其异议
3. **动态权重**：低置信度专家的报告自动降权，高置信度专家的报告升权
4. **⚠️ 商业现实纠偏**：如果有些专家仅因为“缺乏 GitHub 开源项目”就得出“存在产业应用空白”或处于“蓝海”的结论，你必须纠正该偏差。很多具有极高商业价值或核心壁垒的技术（如稀疏矩阵优化Transformer、底层推理加速等）通常是企业的商业机密，极不可能开源，但早就在产业界广泛应用。无开源 ≠ 产业空白。
${domainHint ? `5. **学科领域约束**：用户已指定学科领域为「${domainHint}」，你的综合裁决必须以该领域的创新标准、市场规则和学术范式为基准。如果某位专家的分析偏离了该领域的专业语境，你应在裁决中降低其权重。
` : ''}

---

# 四位专家报告

## 学术审查员（权重：${(normalizedWeights.academic * 100).toFixed(0)}%）
- 评分：${scores.academic}/100（置信度：${academicReview.confidence}）
- 核心发现：${(academicReview.keyFindings?.slice(0, MAX_FINDINGS) || []).join(' | ') || '无'}
- 风险提示：${(academicReview.redFlags?.slice(0, MAX_FINDINGS) || []).join(' | ') || '无'}
- 分析摘要：${truncate(academicReview.analysis, MAX_ANALYSIS_LEN)}
- 推理要点：${truncate(academicReview.reasoning, MAX_REASONING_LEN)}

## 产业分析员（权重：${(normalizedWeights.industry * 100).toFixed(0)}%）
- 评分：${scores.industry}/100（置信度：${industryAnalysis.confidence}）
- 核心发现：${(industryAnalysis.keyFindings?.slice(0, MAX_FINDINGS) || []).join(' | ') || '无'}
- 风险提示：${(industryAnalysis.redFlags?.slice(0, MAX_FINDINGS) || []).join(' | ') || '无'}
- 分析摘要：${truncate(industryAnalysis.analysis, MAX_ANALYSIS_LEN)}
- 推理要点：${truncate(industryAnalysis.reasoning, MAX_REASONING_LEN)}

## 创新评估师（权重：${(normalizedWeights.innovation * 100).toFixed(0)}%）
- 评分：${scores.innovation}/100（置信度：${innovationEvaluation.confidence}）
- 核心发现：${(innovationEvaluation.keyFindings?.slice(0, MAX_FINDINGS) || []).join(' | ') || '无'}
- 风险提示：${(innovationEvaluation.redFlags?.slice(0, MAX_FINDINGS) || []).join(' | ') || '无'}
- 分析摘要：${truncate(innovationEvaluation.analysis, MAX_ANALYSIS_LEN)}
- 推理要点：${truncate(innovationEvaluation.reasoning, MAX_REASONING_LEN)}

## 竞品侦探（权重：${(normalizedWeights.competitor * 100).toFixed(0)}%）
- 评分：${scores.competitor}/100（置信度：${competitorAnalysis.confidence}）
- 核心发现：${(competitorAnalysis.keyFindings?.slice(0, MAX_FINDINGS) || []).join(' | ') || '无'}
- 风险提示：${(competitorAnalysis.redFlags?.slice(0, MAX_FINDINGS) || []).join(' | ') || '无'}
- 分析摘要：${truncate(competitorAnalysis.analysis, MAX_ANALYSIS_LEN)}
- 推理要点：${truncate(competitorAnalysis.reasoning, MAX_REASONING_LEN)}

${crossDomainResult && !crossDomainResult.isFallback && crossDomainResult.bridges?.length > 0 ? `
## Cross-Domain Scout Report (need verification)
- Score: ${crossDomainResult.score}/100 (confidence: ${crossDomainResult.confidence})
- Explored domains: ${crossDomainResult.exploredDomains?.join(', ') || 'N/A'}
- Transfer summary: ${crossDomainResult.transferSummary?.slice(0, 300) || 'N/A'}
- Bridges found: ${crossDomainResult.bridges.length}
${crossDomainResult.bridges.slice(0, 3).map((b, i) => `  ${i + 1}. ${b.sourceField} -> ${b.targetField}: ${b.techPrinciple} (potential ${b.noveltyPotential}/100, ref: ${b.reference || 'none'})`).join('\n')}
- Key findings: ${crossDomainResult.keyFindings?.slice(0, 3).join(' | ') || 'N/A'}

**IMPORTANT**: You must verify the cross-domain suggestions. Check if the cited references and cases seem plausible. Flag any claims that appear fabricated or overly speculative.
` : ''}
---

## System Auto-Calculations

- **评分统计**：平均 ${avgScore}，标准差 ${stdDev}
- **建议加权评分**：${Math.round(
        scores.academic * normalizedWeights.academic +
        scores.industry * normalizedWeights.industry +
        scores.innovation * normalizedWeights.innovation +
        scores.competitor * normalizedWeights.competitor
    )}/100 ⚠️ 此值仅为机械加权参考，你必须基于自己的推理独立裁决最终分数，不要直接采用此值
- **检测到的冲突**：${conflicts.length > 0
            ? conflicts.map(c => `${c.a} vs ${c.b} 差异 ${c.diff} 分`).join('；')
            : '无显著冲突（所有评分差异 ≤ 20 分）'}
- **共识度预判**：${stdDev <= 10 ? '强共识' : stdDev <= 20 ? '中等共识' : '弱共识（分歧较大）'}

${debateRecord?.triggered && debateRecord.sessions.length > 0 ? `
---

## 🔥 NovoDebate 对抗辩论记录

以下是 Agent 之间的对抗辩论结果，你**必须**在裁决中考虑这些辩论发现：

${debateRecord.sessions.map(s => `
### ${s.proAgent} ⚔️ ${s.conAgent}（评分差异 ${s.scoreDivergence} 分）
**辩题**：${s.topic}
${s.exchanges.map(e => `- **第 ${e.round} 轮** [${e.outcome === 'challenger_wins' ? '挑战方胜' : e.outcome === 'defender_wins' ? '防守方胜' : '平局'}]：${e.outcomeReasoning}`).join('\n')}
**裁决**：${s.verdict}
**新洞察**：${s.keyInsights.join('；') || '无'}
**评分修正建议**：${s.proAgent} ${s.scoreAdjustment.proAgentDelta >= 0 ? '+' : ''}${s.scoreAdjustment.proAgentDelta}，${s.conAgent} ${s.scoreAdjustment.conAgentDelta >= 0 ? '+' : ''}${s.scoreAdjustment.conAgentDelta}
`).join('\n')}

⚠️ **重要**：辩论中的评分修正建议仅供参考，你应当基于辩论揭示的事实独立裁决。
` : ''}
---

# 思维链（请按以下步骤逐步推理）

**Step 1 - Consensus Summary**: Core conclusions all experts agree on
**Step 2 - Conflict Resolution**: Process each detected conflict with your judgement
${debateRecord?.triggered ? '**Step 2.5 - Debate Review**: What new insights did NovoDebate reveal? Are the score adjustments reasonable?\n' : ''}
${crossDomainResult && !crossDomainResult.isFallback && crossDomainResult.bridges?.length > 0 ? '**Step 2.8 - Cross-Domain Verification**: Assess the cross-domain bridges. Are the cited cases plausible? Which bridges have real transfer potential vs speculative?\n' : ''}
**Step 3 - Weight Review**: Are the system-calculated weights reasonable?
**Step 4 - Composite Score**: Calculate final score based on your independent reasoning. Do NOT simply adopt the system auto-calculated weighted score.
**Step 5 - 投资建议**：给出明确的建议等级和行动方案
**Step 6 - 撰写 Summary**：请以结论判断开头，不要逐一转述各专家的话。正确示例："**推荐（65分）**——该技术在学术创新性上有一定突破，市场存在明确需求，但竞争格局趋紧，建议优先申请专利保护后再进入市场。" 错误示例："学术审查员指出...产业分析员认为...创新评估师发现..."

---

# 评分标准

## 最终建议等级：
| 评分 | 建议 |
|------|------|
| ≥80 | 强烈推荐 |
| 65-79 | 推荐 |
| 45-64 | 谨慎考虑 |
| <45 | 不推荐 |

---

# 输出格式

⚠️ **关键要求**：以下仅为 JSON **结构**示例。"YOUR_SCORE_HERE" 必须替换为你根据推理**独立裁决**的最终分数（0-100 整数）。**严禁直接采用系统预计算的加权参考分，你必须体现自己的独立判断！**

严格按以下 JSON 格式输出，不要有任何其他内容：
{
  "summary": "⚠️ 这里必须是一段决策性结论。格式：以【推荐等级】开头（如'强烈推荐/推荐/谨慎考虑/不推荐'），然后用2-3句话说明核心判断理由和建议的行动方向。严禁逐一罗列各专家说了什么（如'学术审查员指出...'），必须将所有信息融合为一个直接的最终判断。",
  "overallScore": "YOUR_SCORE_HERE",
  "recommendation": "推荐",
  "weightedBreakdown": {
    "academic": { "raw": ${scores.academic}, "weight": ${normalizedWeights.academic}, "weighted": ${Math.round(scores.academic * normalizedWeights.academic)}, "confidence": "${academicReview.confidence}" },
    "industry": { "raw": ${scores.industry}, "weight": ${normalizedWeights.industry}, "weighted": ${Math.round(scores.industry * normalizedWeights.industry)}, "confidence": "${industryAnalysis.confidence}" },
    "innovation": { "raw": ${scores.innovation}, "weight": ${normalizedWeights.innovation}, "weighted": ${Math.round(scores.innovation * normalizedWeights.innovation)}, "confidence": "${innovationEvaluation.confidence}" },
    "competitor": { "raw": ${scores.competitor}, "weight": ${normalizedWeights.competitor}, "weighted": ${Math.round(scores.competitor * normalizedWeights.competitor)}, "confidence": "${competitorAnalysis.confidence}" }
  },
  "consensusLevel": "${stdDev <= 10 ? 'strong' : stdDev <= 20 ? 'moderate' : 'weak'}",
  "dissent": ["如果某位专家持明显不同意见，记录在此"],
  "conflictsResolved": ["conflict 1 resolution", "conflict 2 resolution"],
  "nextSteps": ["action 1", "action 2", "action 3"]${crossDomainResult && !crossDomainResult.isFallback && crossDomainResult.bridges?.length > 0 ? `,
  "crossDomainVerification": {
    "overallAssessment": "Overall assessment of cross-domain suggestions quality and plausibility",
    "verifiedBridges": ["Bridge descriptions that pass verification"],
    "questionableClaims": ["Citations or cases that seem fabricated or need more evidence"],
    "enhancedSuggestions": ["Your own additional cross-domain transfer ideas based on the analysis"]
  }` : ''}
}
`;

    console.log(`[仲裁员] Prompt 长度: ${prompt.length} chars`);

    // 直接使用 DeepSeek V3（deepseek-chat）进行仲裁
    // 注意：DeepSeek R1 (deepseek-reasoner) 在代理平台上响应时间过长（>60s），
    //       导致超时后整个仲裁层降级。改用 V3 可在 10-20s 内完成。
    try {
        const { text, usedModel } = await callAIRaw(
            prompt,
            modelProvider,
            85000, // 对齐编排器 ARBITRATOR_TIMEOUT(90s)，留 5s 缓冲让编排器 abort 优先触发
            100000,
            (chunk, isReasoning) => {
                if (onProgress) {
                    onProgress('agent_stream', { agentId: 'arbitrator', chunk, isReasoning });
                }
            },
            abortSignal,
            16384
        );
        const result = parseAgentJSON<ArbitrationResult>(text);
        result.usedModel = usedModel;
        return result;
    } catch (err: unknown) {
        console.error('[仲裁员] Agent 执行失败:', err instanceof Error ? err.message : String(err));
        throw err;
    }
}
