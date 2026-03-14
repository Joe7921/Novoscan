/**
 * Clawscan Agent — Registry 侦察员
 *
 * 分析 ClawHub Registry 中的已有 Skill 并与用户构想做语义评分
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { ClawscanAgentInput, RegistryScoutOutput } from './types';

export async function registryScout(input: ClawscanAgentInput): Promise<RegistryScoutOutput> {
    const { parsedIdea, signals, modelProvider, _abortSignal } = input;

    const agentName = 'Registry 侦察员';
    input.onProgress?.('agent_state', { agent: 'registryScout', status: 'running' });
    input.onProgress?.('log', `[${agentName}] 开始分析 ${signals.registrySkills.length} 个候选 Skill...`);

    const candidateList = signals.registrySkills.map((s, i) =>
        `[${i}] "${s.name}" — ${(s.description || '无描述').slice(0, 100)}`
    ).join('\n');

    const prompt = `你是 Clawscan 的 Registry 侦察员 Agent。你的任务是将用户的 OpenClaw 应用构想与 ClawHub 上的现有 Skill 做语义相似度评分。

## 用户的构想
核心能力点: ${parsedIdea.coreCapabilities.join(', ')}
问题描述: ${parsedIdea.problemStatement}
目标用户: ${parsedIdea.targetUser}
平台: ${parsedIdea.platform}
类别: ${parsedIdea.category}

## 现有 Skill 列表
${candidateList}

## 任务
1. 为每个候选 Skill 评一个 0-100 的语义相似度分数
2. 分析哪些核心能力点被现有方案覆盖
3. 给出整体评估

请返回以下 JSON：
\`\`\`json
{
  "analysis": "200字以内的中文整体评估",
  "score": 50,
  "confidence": "high",
  "keyFindings": ["发现1", "发现2"],
  "redFlags": ["风险1"],
  "evidenceSources": ["来源1"],
  "skillMatches": [
    { "index": 0, "similarityPercentage": 85, "reason": "20字中文理由", "matchedFeatures": ["功能1"], "coverageRate": 60 }
  ],
  "reasoning": "推理过程（放在最后，防止截断丢失关键数据）"
}
\`\`\`

规则:
1. score: 整体评估分（0=完全无重复, 100=完全重复）
2. skillMatches: 为全部 ${signals.registrySkills.length} 个候选评分
3. 跨语言同义视为相似（"天气查询"和"Weather"高度相似）
4. 仅名字巧合不算相似
5. matchedFeatures: 列出该 Skill 覆盖了用户的哪些核心能力点
6. coverageRate: 该 Skill 覆盖用户需求的百分比
7. 所有中文回答`;

    try {
        const { text } = await callAIRaw(prompt, modelProvider, 30000, undefined, undefined, _abortSignal);
        const parsed = parseAgentJSON<RegistryScoutOutput>(text);

        if (parsed && Array.isArray(parsed.skillMatches)) {
            parsed.agentName = agentName;
            parsed.skillMatches = parsed.skillMatches
                .filter(s => typeof s.index === 'number' && typeof s.similarityPercentage === 'number'
                    && s.index >= 0 && s.index < signals.registrySkills.length)
                .map(s => ({
                    ...s,
                    similarityPercentage: Math.min(100, Math.max(0, Math.round(s.similarityPercentage))),
                    matchedFeatures: s.matchedFeatures || [],
                    coverageRate: Math.min(100, Math.max(0, s.coverageRate || 0)),
                }));

            input.onProgress?.('agent_state', { agent: 'registryScout', status: 'done' });
            input.onProgress?.('log', `[${agentName}] 完成: ${parsed.skillMatches.length} 个评分`);
            return parsed;
        }
        throw new Error('返回格式不完整');
    } catch (err: any) {
        console.warn(`[Clawscan/${agentName}] AI 分析失败: ${err.message}`);
        input.onProgress?.('agent_state', { agent: 'registryScout', status: 'fallback' });
        return createFallbackRegistryScout(input);
    }
}

function createFallbackRegistryScout(input: ClawscanAgentInput): RegistryScoutOutput {
    return {
        agentName: 'Registry 侦察员',
        analysis: '因 AI 分析超时，使用关键词匹配降级。',
        score: 30,
        confidence: 'low',
        keyFindings: ['降级模式：基于关键词匹配'],
        redFlags: [],
        evidenceSources: ['ClawHub Registry'],
        reasoning: '降级分析',
        isFallback: true,
        skillMatches: input.signals.registrySkills.map((_, index) => ({
            index,
            similarityPercentage: 10,
            reason: '关键词匹配降级',
            matchedFeatures: [],
            coverageRate: 0,
        })),
    };
}
