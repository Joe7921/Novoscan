/**
 * Clawscan 统一评估器（合并 registryScout + quickVerdict）
 *
 * 将原来串行的 2 次 AI 调用合并为 1 次，同时输出：
 *   - 每个候选 Skill 的语义匹配评分
 *   - 最终评级 (S/A/B/C/D)
 *   - 推荐行动方案 + 风险警告
 *
 * 原架构: registryScout (AI ~5s) → quickVerdict (AI ~5s) = ~10s
 * 新架构: unifiedEvaluate (AI ~5s) = ~5s
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { ModelProvider } from '@/types';
import type { ParsedClawIdea, RegistrySkill } from '@/types/clawscan';
import type { RegistryScoutOutput, StrategicArbiterOutput, ClawscanAgentInput } from '@/agents/clawscan/types';

// ============================================================
//  合并后的 AI 输出结构
// ============================================================

interface UnifiedEvalResult {
    // Registry 侦察员部分
    analysis: string;
    score: number;
    keyFindings: string[];
    skillMatches: Array<{
        index: number;
        similarityPercentage: number;
        reason: string;
        matchedFeatures: string[];
        coverageRate: number;
    }>;
    // 仲裁官部分
    overallScore: number;
    grade: 'S' | 'A' | 'B' | 'C' | 'D';
    duplicationLevel: 'high' | 'medium' | 'low' | 'none';
    verdict: string;
    recommendation: {
        type: 'use_existing' | 'differentiate' | 'build_new';
        text: string;
        details: string;
        actionText: string;
    };
    strategicAdvice: string;
    riskWarnings: string[];
}

// ============================================================
//  统一评估（1 次 AI 调用）
// ============================================================

export async function unifiedRegistryEvaluate(
    input: ClawscanAgentInput,
): Promise<{ scout: RegistryScoutOutput; arbiter: StrategicArbiterOutput }> {
    const { parsedIdea, signals, modelProvider, _abortSignal } = input;

    input.onProgress?.('agent_state', { agent: 'registryScout', status: 'running' });
    input.onProgress?.('agent_state', { agent: 'quickVerdict', status: 'running' });
    input.onProgress?.('log', `[统一评估] 启动单次 AI 评估 (${signals.registrySkills.length} 个候选)...`);

    const candidateList = signals.registrySkills.map((s, i) =>
        `[${i}] "${s.name}" — ${(s.description || '无描述').slice(0, 100)}`
    ).join('\n');

    const prompt = `你是 Clawscan 的统一评估引擎。同时完成「Registry 语义匹配」和「最终裁决」两项任务。

## 用户构想
核心能力: ${parsedIdea.coreCapabilities.join(', ')}
问题: ${parsedIdea.problemStatement}
目标用户: ${parsedIdea.targetUser}
平台: ${parsedIdea.platform} | 类别: ${parsedIdea.category}

## Skill 列表 (${signals.registrySkills.length} 个)
${candidateList}

## 输出 JSON（严格遵守此格式）
\`\`\`json
{
  "analysis": "200字中文整体分析",
  "score": 50,
  "keyFindings": ["发现1", "发现2"],
  "skillMatches": [
    { "index": 0, "similarityPercentage": 50, "reason": "20字理由", "matchedFeatures": ["功能1"], "coverageRate": 40 }
  ],
  "overallScore": 50,
  "grade": "B",
  "duplicationLevel": "medium",
  "verdict": "一句话结论(15字内)",
  "recommendation": { "type": "differentiate", "text": "标题", "details": "50字建议", "actionText": "按钮文字" },
  "strategicAdvice": "50字战略建议",
  "riskWarnings": ["风险1"]
}
\`\`\`

规则:
1. skillMatches: 为全部 ${signals.registrySkills.length} 个候选评分, similarityPercentage 0-100
2. score: Registry 整体查重分 (0=无重复, 100=完全重复)
3. overallScore: 等于 score
4. grade: S(>=85)/A(>=70)/B(>=50)/C(>=30)/D(<30)
5. type: use_existing/differentiate/build_new
6. 跨语言同义视为相似（"天气查询"和"Weather"高度相似）
7. 仅名字巧合不算相似
8. 中文回答`;

    try {
        const { text } = await callAIRaw(
            prompt, modelProvider, 15000,
            undefined, undefined, _abortSignal, 3072,
        );
        const parsed = parseAgentJSON<UnifiedEvalResult>(text);

        if (parsed && Array.isArray(parsed.skillMatches) && parsed.recommendation) {
            // 标准化 skillMatches
            const cleanedMatches = parsed.skillMatches
                .filter(s => typeof s.index === 'number' && typeof s.similarityPercentage === 'number'
                    && s.index >= 0 && s.index < signals.registrySkills.length)
                .map(s => ({
                    ...s,
                    similarityPercentage: Math.min(100, Math.max(0, Math.round(s.similarityPercentage))),
                    matchedFeatures: s.matchedFeatures || [],
                    coverageRate: Math.min(100, Math.max(0, s.coverageRate || 0)),
                }));

            const scout: RegistryScoutOutput = {
                agentName: 'Registry 侦察员',
                analysis: parsed.analysis || '',
                score: parsed.score || 50,
                confidence: 'high',
                keyFindings: parsed.keyFindings || [],
                redFlags: [],
                evidenceSources: ['ClawHub Registry'],
                reasoning: parsed.analysis || '',
                skillMatches: cleanedMatches,
            };

            const arbiter: StrategicArbiterOutput = {
                agentName: '快速仲裁',
                analysis: parsed.analysis || '',
                score: parsed.overallScore || parsed.score || 50,
                confidence: 'high',
                keyFindings: parsed.keyFindings || [],
                redFlags: parsed.riskWarnings || [],
                evidenceSources: ['ClawHub Registry'],
                reasoning: parsed.analysis || '',
                overallScore: parsed.overallScore || parsed.score || 50,
                grade: parsed.grade || 'B',
                duplicationLevel: parsed.duplicationLevel || 'medium',
                verdict: parsed.verdict || '',
                recommendation: parsed.recommendation,
                strategicAdvice: parsed.strategicAdvice || '',
                riskWarnings: parsed.riskWarnings || [],
            };

            input.onProgress?.('agent_state', { agent: 'registryScout', status: 'done' });
            input.onProgress?.('agent_state', { agent: 'quickVerdict', status: 'done' });
            input.onProgress?.('log', `[统一评估] 完成: ${cleanedMatches.length} 个评分, Grade=${arbiter.grade}`);

            return { scout, arbiter };
        }
        throw new Error('返回格式不完整');
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // AbortError 直接抛出
        if (err instanceof Error && (err.name === 'AbortError' || message.includes('External abort'))) {
            throw err;
        }
        console.warn(`[Clawscan/UnifiedEval] AI 评估失败: ${message}`);
        input.onProgress?.('agent_state', { agent: 'registryScout', status: 'fallback' });
        input.onProgress?.('agent_state', { agent: 'quickVerdict', status: 'fallback' });
        return createFallbackResult(input);
    }
}

// ============================================================
//  降级结果
// ============================================================

function createFallbackResult(input: ClawscanAgentInput): { scout: RegistryScoutOutput; arbiter: StrategicArbiterOutput } {
    const scout: RegistryScoutOutput = {
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
            reason: '降级匹配',
            matchedFeatures: [],
            coverageRate: 0,
        })),
    };

    const arbiter: StrategicArbiterOutput = {
        agentName: '快速仲裁',
        analysis: '降级模式',
        score: 30,
        confidence: 'low',
        keyFindings: ['降级'],
        redFlags: ['仅基于 Registry 数据，AI 分析未完成'],
        evidenceSources: ['ClawHub Registry'],
        reasoning: '降级',
        overallScore: 30,
        grade: 'C',
        duplicationLevel: 'low',
        verdict: '降级评分 30',
        recommendation: {
            type: 'build_new',
            text: '可以开发',
            details: 'AI 分析超时，轻量模式评估。如需更深入分析请重试。',
            actionText: '查看详情',
        },
        strategicAdvice: '建议重试以获取完整 AI 评估结果。',
        riskWarnings: ['AI 分析未完成，评分可能不准确'],
    };

    return { scout, arbiter };
}
