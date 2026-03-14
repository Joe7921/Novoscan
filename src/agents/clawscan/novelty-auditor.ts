/**
 * Clawscan Agent — 创新度审计师
 *
 * 综合 Registry 侦察员和实战案例分析师的结果，做交叉验证
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { ClawscanAgentInput, NoveltyAuditorOutput, RegistryScoutOutput, CaseAnalystOutput } from './types';

export async function noveltyAuditor(
    input: ClawscanAgentInput,
    registryResult: RegistryScoutOutput,
    caseResult: CaseAnalystOutput,
): Promise<NoveltyAuditorOutput> {
    const { parsedIdea, modelProvider, _abortSignal } = input;

    const agentName = '创新度审计师';
    input.onProgress?.('agent_state', { agent: 'noveltyAuditor', status: 'running' });
    input.onProgress?.('log', `[${agentName}] 交叉验证 Registry 和实战案例数据...`);

    const prompt = `你是 Clawscan 的创新度审计师 Agent。你需要综合前两位分析师的结论进行交叉验证。

## 用户构想
核心能力: ${parsedIdea.coreCapabilities.join(', ')}
问题: ${parsedIdea.problemStatement}

## Registry 侦察员报告
评分: ${registryResult.score}/100
分析: ${registryResult.analysis}
关键发现: ${registryResult.keyFindings.join('; ')}
高相似 Skill 数: ${registryResult.skillMatches.filter(s => s.similarityPercentage >= 50).length}

## 实战案例分析师报告
评分: ${caseResult.score}/100
分析: ${caseResult.analysis}
关键发现: ${caseResult.keyFindings.join('; ')}
案例数: ${caseResult.caseStudies.length}

## 任务
1. 交叉验证两份报告是否存在矛盾
2. 综合评估用户构想的创新度
3. 找出差异化亮点和创新空白
4. 给出创新度评分

请返回以下 JSON：
\`\`\`json
{
  "analysis": "200字中文综合分析",
  "score": 50,
  "confidence": "medium",
  "keyFindings": ["发现1", "发现2"],
  "redFlags": ["风险1"],
  "evidenceSources": ["来源1"],
  "innovationHighlights": ["创新亮点1", "创新亮点2"],
  "differentiators": ["差异化要素1", "差异化要素2"],
  "gapAnalysis": "市场空白分析（50字）",
  "reasoning": "推理过程（放在最后，防止截断丢失关键数据）"
}
\`\`\`

规则:
1. score: 创新度评分（0=完全无创新/已有成熟方案, 100=全新开创性构想）
2. 如果 Registry 分高（重复多）但案例分低（落地少），说明有 Skill 但没人用，可能有机会
3. 如果两者都高，说明已有成熟方案
4. 如果两者都低，说明是蓝海领域
5. 所有中文回答`;

    try {
        const { text } = await callAIRaw(prompt, modelProvider, 25000, undefined, undefined, _abortSignal);
        const parsed = parseAgentJSON<NoveltyAuditorOutput>(text);

        if (parsed) {
            parsed.agentName = agentName;
            input.onProgress?.('agent_state', { agent: 'noveltyAuditor', status: 'done' });
            input.onProgress?.('log', `[${agentName}] 完成: 创新度 ${parsed.score}/100`);
            return parsed;
        }
        throw new Error('返回格式不完整');
    } catch (err: any) {
        console.warn(`[Clawscan/${agentName}] AI 分析失败: ${err.message}`);
        input.onProgress?.('agent_state', { agent: 'noveltyAuditor', status: 'fallback' });
        return {
            agentName,
            analysis: '因 AI 分析超时，使用统计降级评估。',
            score: Math.round(100 - (registryResult.score + caseResult.score) / 2),
            confidence: 'low',
            keyFindings: ['降级模式'],
            redFlags: [],
            evidenceSources: [],
            reasoning: '降级分析：创新度 = 100 - (Registry重复度 + 案例重复度) / 2',
            isFallback: true,
            innovationHighlights: [],
            differentiators: [],
            gapAnalysis: '数据不足，无法进行详细的空白分析',
        };
    }
}
