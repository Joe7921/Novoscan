/**
 * Clawscan Agent — 实战案例分析师
 *
 * 深度分析网络搜索到的 OpenClaw 落地实战案例
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { ClawscanAgentInput, CaseAnalystOutput } from './types';

export async function caseAnalyst(input: ClawscanAgentInput): Promise<CaseAnalystOutput> {
    const { parsedIdea, signals, modelProvider, _abortSignal } = input;

    const agentName = '实战案例分析师';
    input.onProgress?.('agent_state', { agent: 'caseAnalyst', status: 'running' });
    input.onProgress?.('log', `[${agentName}] 开始分析 ${signals.webCaseResults.length} 条网络结果 + ${signals.githubRepos.length} 个 GitHub 仓库...`);

    // 构建搜索结果摘要
    const webSummary = signals.webCaseResults.slice(0, 15).map((r, i) =>
        `[Web-${i}] "${r.title}" — ${r.snippet.slice(0, 120)} (${r.url})`
    ).join('\n');

    const ghSummary = signals.githubRepos.slice(0, 8).map((r, i) =>
        `[GH-${i}] "${r.fullName}" ⭐${r.stars} — ${(r.description || '').slice(0, 100)} (${r.url})`
    ).join('\n');

    // CaseVault 案例库已知案例
    const vaultSummary = (signals.caseVaultResults || []).slice(0, 8).map((r, i) =>
        `[Vault-${i}] "${r.title}" — ${r.snippet?.slice(0, 120) || ''} (相关度=${r.relevanceScore})`
    ).join('\n');

    const prompt = `你是 Clawscan 的实战案例分析师 Agent。你的任务是从网络搜索结果中识别和分析 OpenClaw 的落地实战案例。

## 用户的构想
核心能力点: ${parsedIdea.coreCapabilities.join(', ')}
问题描述: ${parsedIdea.problemStatement}
关键词: ${parsedIdea.searchKeywords.join(', ')}

## 网络搜索结果
${webSummary || '（无网络搜索结果）'}

## GitHub 相关仓库
${ghSummary || '（无 GitHub 结果）'}

## 案例库已知案例（高质量历史数据）
${vaultSummary || '（案例库暂无匹配）'}

## 任务
1. 识别哪些是真正的 OpenClaw 落地案例（vs 无关结果）
2. 分析每个案例的技术方案、部署规模、成熟度
3. 评估与用户构想的相关性
4. 整体评估市场上的实战情况

请返回以下 JSON：
\`\`\`json
{
  "analysis": "300字以内的中文整体分析（实战案例的总体布局、技术趋势等）",
  "score": 50,
  "confidence": "medium",
  "keyFindings": ["关键发现1", "关键发现2", "关键发现3"],
  "redFlags": ["风险1"],
  "evidenceSources": ["来源1"],
  "caseStudies": [
    {
      "title": "案例标题",
      "url": "来源URL",
      "relevanceScore": 80,
      "keyInsight": "核心洞察（一句话）",
      "technologyUsed": "使用的技术",
      "deploymentScale": "部署规模"
    }
  ],
  "reasoning": "推理过程（放在最后，防止截断丢失关键数据）"
}
\`\`\`

规则:
1. score: 已有实战案例对用户构想的威胁度（0=完全没有类似案例, 100=已有成熟方案）
2. caseStudies: 最多列出 8 个最相关的案例
3. relevanceScore: 每个案例与用户构想的相关度 0-100
4. 如果搜索结果中没有真正的 OpenClaw 案例，caseStudies 留空，score 打低
5. 所有中文回答`;

    try {
        const { text } = await callAIRaw(prompt, modelProvider, 30000, undefined, undefined, _abortSignal);
        const parsed = parseAgentJSON<CaseAnalystOutput>(text);

        if (parsed && Array.isArray(parsed.caseStudies)) {
            parsed.agentName = agentName;
            parsed.caseStudies = parsed.caseStudies.slice(0, 8).map(c => ({
                ...c,
                relevanceScore: Math.min(100, Math.max(0, Math.round(c.relevanceScore || 0))),
            }));

            input.onProgress?.('agent_state', { agent: 'caseAnalyst', status: 'done' });
            input.onProgress?.('log', `[${agentName}] 完成: ${parsed.caseStudies.length} 个案例`);
            return parsed;
        }
        throw new Error('返回格式不完整');
    } catch (err: any) {
        console.warn(`[Clawscan/${agentName}] AI 分析失败: ${err.message}`);
        input.onProgress?.('agent_state', { agent: 'caseAnalyst', status: 'fallback' });
        return {
            agentName,
            analysis: '因 AI 分析超时，无法深度分析实战案例。',
            score: 20,
            confidence: 'low',
            keyFindings: ['降级模式'],
            redFlags: [],
            evidenceSources: ['Web Search'],
            reasoning: '降级分析',
            isFallback: true,
            caseStudies: signals.webCaseResults.slice(0, 5).map(r => ({
                title: r.title,
                url: r.url,
                relevanceScore: 30,
                keyInsight: r.snippet.slice(0, 80),
            })),
        };
    }
}
