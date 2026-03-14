/**
 * Clawscan Agent — 战略仲裁官
 *
 * 综合所有 Agent 的评估结果，给出最终评级和策略建议
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { ClawscanAgentInput, StrategicArbiterOutput, RegistryScoutOutput, CaseAnalystOutput, NoveltyAuditorOutput } from './types';

export async function strategicArbiter(
    input: ClawscanAgentInput,
    registryResult: RegistryScoutOutput,
    caseResult: CaseAnalystOutput,
    noveltyResult: NoveltyAuditorOutput,
): Promise<StrategicArbiterOutput> {
    const { parsedIdea, modelProvider, _abortSignal } = input;

    const agentName = '战略仲裁官';
    input.onProgress?.('agent_state', { agent: 'strategicArbiter', status: 'running' });
    input.onProgress?.('log', `[${agentName}] 综合 3 个 Agent 报告，生成最终裁定...`);

    const prompt = `你是 Clawscan 的战略仲裁官。你需要综合前三位分析师的全部报告，做出最终裁定。

## 用户构想
核心能力: ${parsedIdea.coreCapabilities.join(', ')}
问题: ${parsedIdea.problemStatement}
目标用户: ${parsedIdea.targetUser}

## Agent 报告汇总

### Registry 侦察员（ClawHub 重复度: ${registryResult.score}/100）
${registryResult.analysis}
高匹配 Skill: ${registryResult.skillMatches.filter(s => s.similarityPercentage >= 50).length} 个

### 实战案例分析师（案例威胁度: ${caseResult.score}/100）
${caseResult.analysis}
发现案例: ${caseResult.caseStudies.length} 个

### 创新度审计师（创新度: ${noveltyResult.score}/100）
${noveltyResult.analysis}
创新亮点: ${noveltyResult.innovationHighlights.join('; ')}
差异化要素: ${noveltyResult.differentiators.join('; ')}

## 任务
综合以上报告，给出最终评定。

请返回以下 JSON：
\`\`\`json
{
  "analysis": "300字中文最终裁定分析",
  "score": 50,
  "confidence": "high",
  "keyFindings": ["关键结论1", "关键结论2"],
  "redFlags": ["风险1"],
  "evidenceSources": ["来源1"],
  "overallScore": 50,
  "grade": "B",
  "duplicationLevel": "medium",
  "verdict": "一句话结论",
  "recommendation": {
    "type": "differentiate",
    "text": "建议标题",
    "details": "100字中文详细建议",
    "actionText": "按钮文字"
  },
  "strategicAdvice": "200字中文战略建议",
  "riskWarnings": ["风险1", "风险2"],
  "reasoning": "推理过程（放在最后，防止截断丢失关键数据）"
}
\`\`\`

规则:
1. overallScore: 综合查重分数 0-100（加权：Registry 0.35, 案例 0.35, 创新度逆向 0.30）
2. grade: S(>=85创新)/A(>=70)/B(>=50)/C(>=30)/D(<30)
3. duplicationLevel: high(score>=70)/medium(40-69)/low(15-39)/none(<15)
4. recommendation.type: 
   - "use_existing": 重复度高，建议使用现有方案
   - "differentiate": 部分重复，建议差异化
   - "build_new": 重复度低，建议自主开发
5. verdict: 15字以内一句话结论
6. 所有中文回答`;

    try {
        const { text } = await callAIRaw(prompt, modelProvider, 30000, undefined, undefined, _abortSignal);
        const parsed = parseAgentJSON<StrategicArbiterOutput>(text);

        if (parsed && parsed.recommendation) {
            parsed.agentName = agentName;
            parsed.overallScore = Math.min(100, Math.max(0, Math.round(parsed.overallScore || 50)));

            input.onProgress?.('agent_state', { agent: 'strategicArbiter', status: 'done' });
            input.onProgress?.('log', `[${agentName}] 裁定完成: ${parsed.grade} 级, 重复度=${parsed.duplicationLevel}`);
            return parsed;
        }
        throw new Error('返回格式不完整');
    } catch (err: any) {
        console.warn(`[Clawscan/${agentName}] AI 分析失败: ${err.message}`);
        input.onProgress?.('agent_state', { agent: 'strategicArbiter', status: 'fallback' });
        return createFallbackArbiter(registryResult, caseResult, noveltyResult);
    }
}

function createFallbackArbiter(
    registryResult: RegistryScoutOutput,
    caseResult: CaseAnalystOutput,
    noveltyResult: NoveltyAuditorOutput,
): StrategicArbiterOutput {
    const overallScore = Math.round(registryResult.score * 0.35 + caseResult.score * 0.35 + (100 - noveltyResult.score) * 0.30);
    const grade = overallScore >= 85 ? 'S' : overallScore >= 70 ? 'A' : overallScore >= 50 ? 'B' : overallScore >= 30 ? 'C' : 'D';
    const duplicationLevel = overallScore >= 70 ? 'high' : overallScore >= 40 ? 'medium' : overallScore >= 15 ? 'low' : 'none';

    return {
        agentName: '战略仲裁官',
        analysis: '因 AI 超时，使用加权统计降级。',
        score: overallScore,
        confidence: 'low',
        keyFindings: ['降级模式'],
        redFlags: [],
        evidenceSources: [],
        reasoning: `降级加权: Registry(${registryResult.score})*0.35 + 案例(${caseResult.score})*0.35 + 逆创新度(${100 - noveltyResult.score})*0.30 = ${overallScore}`,
        isFallback: true,
        overallScore,
        grade: grade as StrategicArbiterOutput['grade'],
        duplicationLevel: duplicationLevel as StrategicArbiterOutput['duplicationLevel'],
        verdict: `综合评分 ${overallScore} 分`,
        recommendation: {
            type: overallScore >= 70 ? 'use_existing' : overallScore >= 40 ? 'differentiate' : 'build_new',
            text: overallScore >= 70 ? '建议使用现有方案' : overallScore >= 40 ? '建议差异化开发' : '建议自主开发',
            details: '数据降级中，请参考各 Agent 的独立报告获取更多信息。',
            actionText: overallScore >= 70 ? '查看推荐方案' : overallScore >= 40 ? '差异化策略' : '开始开发',
        },
        strategicAdvice: '因评估降级，建议重新运行分析以获取完整的战略建议。',
        riskWarnings: ['评估为降级模式，数据可能不够准确'],
    };
}
