import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import { AgentOutput, DebateSession, DebateRecord, DebateExchange, DissentItem } from '../types';
import type { ModelProvider } from '@/types';

// ==================== NovoDebate 多调用真对抗辩论引擎 ====================
//
// 设计原则：
//   1. 对抗协议：正方/反方/裁判各自独立 AI 调用，真实模拟辩论对抗
//   2. 信息流编排：每轮反方必须看到正方论点、每轮裁判必须看到双方论点
//   3. 防循环机制：最大 3 轮 + 收敛检测 + 多级超时熔断
//
// 单场辩论执行拓扑（最多 3 轮）：
//   Round 1：Challenger AI call → Defender AI call → Judge(纯逻辑)
//   Round 2：角色互换 → Challenger AI call → Defender AI call → Judge
//   Round 3：（仅在未收敛时）→ 自由辩论 → Judge
//   ↓ 收敛检测通过 → 提前终止
//

/** 单场辩论总超时控制（55秒，为多轮真对抗留足余量） */
const DEBATE_SESSION_TIMEOUT = 55000;

/** 单次 AI 调用超时（25秒，辩论发言需要足够推理时间） */
const SINGLE_CALL_TIMEOUT = 25000;

/** 辩论触发阈值：任意两个 Agent 评分差异超过此值时触发 */
const DIVERGENCE_THRESHOLD = 15;

/** 低共识度标准差阈值 */
const LOW_CONSENSUS_STDDEV = 12;

/** 默认最大辩论轮次 */
const DEFAULT_MAX_ROUNDS = 3;

/** 每轮胜负的修正幅度 */
const ADJUST_PER_ROUND = 5;

// ==================== 辩论自定义选项 ====================

/**
 * 辩论自定义选项 — 从工作流编辑器传入
 *
 * 所有字段均可选，未传入时使用默认值。
 */
export interface DebateOptions {
    /** 最大辩论轮次（1-10，默认 3） */
    maxRounds?: number;
    /** 参与辩论的 Agent ID 列表（为空则自动从上游选取） */
    participants?: string[];
    /** 辩论模式（structured = 结构化对抗，freeform = 自由论述） */
    debateMode?: 'structured' | 'freeform';
    /** 自定义辩论规则 Prompt */
    customPrompt?: string;
    /** 是否攻防轮换（默认 true） */
    autoSwapRoles?: boolean;
    /** 是否启用收敛检测（默认 true） */
    convergenceEnabled?: boolean;
    /** 触发辩论的最小评分差异（默认 15，0 = 强制触发） */
    minScoreDivergence?: number;
}

// ==================== 辩论触发判断 ====================

/**
 * 判断是否需要触发 NovoDebate
 * 条件：任意两个 Agent 评分差 > threshold 分（共识度弱时）
 */
export function shouldTriggerDebate(agents: {
    academic: AgentOutput;
    industry: AgentOutput;
    innovation: AgentOutput;
    competitor: AgentOutput;
}, customThreshold?: number): {
    trigger: boolean;
    reason:string;
    pairs: Array<{ proAgent: string; conAgent: string; proKey: string; conKey: string; divergence: number; topic: string }>;
} {
    const scores = {
        academic: agents.academic.score ?? 50,
        industry: agents.industry.score ?? 50,
        innovation: agents.innovation.score ?? 50,
        competitor: agents.competitor.score ?? 50
    };

    const allScores = Object.values(scores);
    const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const stdDev = Math.sqrt(allScores.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / allScores.length);

    // 如果共识度很高，跳过辩论
    if (stdDev <= LOW_CONSENSUS_STDDEV) {
        return {
            trigger: false,
            reason: `专家共识度高（标准差 ${Math.round(stdDev)}），无需辩论`,
            pairs: []
        };
    }

    // 定义辩论对（按设计：学术 vs 竞品，产业 vs 创新）
    const potentialPairs = [
        {
            proAgent: agents.academic.agentName || '学术审查员',
            conAgent: agents.competitor.agentName || '竞品侦探',
            proKey: 'academic',
            conKey: 'competitor',
            divergence: Math.abs(scores.academic - scores.competitor),
            topic: '学术空白 vs 市场已有实现'
        },
        {
            proAgent: agents.industry.agentName || '产业分析员',
            conAgent: agents.innovation.agentName || '创新评估师',
            proKey: 'industry',
            conKey: 'innovation',
            divergence: Math.abs(scores.industry - scores.innovation),
            topic: '市场机会 vs 创新可行性'
        }
    ];

    // 筛选出分歧超过阈值的辩论对
    const threshold = customThreshold ?? DIVERGENCE_THRESHOLD;
    const triggeredPairs = potentialPairs.filter(p => p.divergence > threshold);

    // 动态配对：当固定对差异均不够但整体分歧大时，自动挑选分歧最大的 Agent 对
    if (triggeredPairs.length === 0) {
        const entries = Object.entries(scores) as [string, number][];
        const agentNameMap: Record<string, string> = {
            academic: agents.academic.agentName || '学术审查员',
            industry: agents.industry.agentName || '产业分析员',
            innovation: agents.innovation.agentName || '创新评估师',
            competitor: agents.competitor.agentName || '竞品侦探',
        };
        const topicMap: Record<string, string> = {
            'academic-industry': '学术基础 vs 产业落地',
            'academic-innovation': '学术空白 vs 创新评估',
            'academic-competitor': '学术空白 vs 市场已有实现',
            'industry-innovation': '市场机会 vs 创新可行性',
            'industry-competitor': '产业机会 vs 竞品压力',
            'innovation-competitor': '创新空间 vs 竞品壁垒',
        };

        let maxDivergence = 0;
        let bestPair: typeof triggeredPairs[0] | null = null;

        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                const div = Math.abs(entries[i][1] - entries[j][1]);
                if (div > maxDivergence) {
                    maxDivergence = div;
                    const key1 = entries[i][0], key2 = entries[j][0];
                    const topicKey = `${key1}-${key2}`;
                    bestPair = {
                        proAgent: agentNameMap[key1],
                        conAgent: agentNameMap[key2],
                        proKey: key1,
                        conKey: key2,
                        divergence: div,
                        topic: topicMap[topicKey] || `${agentNameMap[key1]} vs ${agentNameMap[key2]}`
                    };
                }
            }
        }

        if (bestPair && maxDivergence > threshold) {
            return {
                trigger: true,
                reason: `预设辩论对差异不足，但动态配对检测到 ${bestPair.proAgent} vs ${bestPair.conAgent} 差 ${maxDivergence} 分，触发 NovoDebate`,
                pairs: [bestPair]
            };
        }

        return {
            trigger: false,
            reason: `虽然整体标准差为 ${Math.round(stdDev)}，但所有 Agent 对的评分差异均 ≤ ${threshold} 分，无需辩论`,
            pairs: []
        };
    }

    return {
        trigger: true,
        reason: `检测到 ${triggeredPairs.length} 对专家存在显著分歧（${triggeredPairs.map(p => `${p.proAgent} vs ${p.conAgent} 差 ${p.divergence} 分`).join('；')}），触发 NovoDebate`,
        pairs: triggeredPairs
    };
}

// ==================== 工具函数 ====================

/** 截断文本避免 prompt 超限 */
function truncate(text: string | undefined, maxLen: number): string {
    if (!text) return '无';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '…（已截断）';
}

/** 收敛检测：判断辩论是否可以提前终止 */
function checkConvergence(exchanges: DebateExchange[]): { converged: boolean; reason: string } {
    if (exchanges.length < 2) return { converged: false, reason: '轮次不足' };

    // 条件1：连续两轮同一方获胜 → 一方论证明显更强，无需继续
    const lastTwo = exchanges.slice(-2);
    if (lastTwo[0].outcome === lastTwo[1].outcome && lastTwo[0].outcome !== 'draw') {
        const winner = lastTwo[0].outcome === 'challenger_wins' ? lastTwo[0].challenger : lastTwo[0].defender;
        return { converged: true, reason: `${winner} 连续两轮获胜，论证优势明确` };
    }

    // 条件2：连续两轮平局 → 分歧已稳定，继续辩论无法产生新信息
    if (lastTwo[0].outcome === 'draw' && lastTwo[1].outcome === 'draw') {
        return { converged: true, reason: '连续两轮平局，分歧已稳定' };
    }

    return { converged: false, reason: '' };
}

// ==================== 多调用真对抗：单轮执行 ====================

/**
 * 执行单轮辩论中的挑战方发言（独立 AI 调用）
 */
async function generateChallenge(
    challengerAgent: AgentOutput,
    defenderAgent: AgentOutput,
    query: string,
    round: number,
    previousExchanges: DebateExchange[],
    modelProvider: ModelProvider,
    abortSignal?: AbortSignal,
    onProgress?: (event: 'log' | 'progress' | 'agent_state' | 'agent_stream', data: Record<string, unknown> | string | number) => void,
    sessionId?: string
): Promise<{ argument: string; evidence: string[] }> {
    const prevContext = previousExchanges.length > 0
        ? `\n## 前几轮辩论记录\n${previousExchanges.map(e => `第${e.round}轮：${e.challenger}质疑"${truncate(e.challengerArgument, 100)}"，${e.defender}反驳"${truncate(e.defenderRebuttal, 100)}"，判定：${e.outcome === 'challenger_wins' ? '挑战方胜' : e.outcome === 'defender_wins' ? '防守方胜' : '平局'}`).join('\n')}`
        : '';

    const prompt = `
# 角色
你是 ${challengerAgent.agentName}，正在一场专家辩论中担任 **挑战方**。

## 你的原始报告
- 评分：${challengerAgent.score}/100（置信度：${challengerAgent.confidence}）
- 核心发现：${challengerAgent.keyFindings?.slice(0, 3).join(' | ') || '无'}
- 分析摘要：${truncate(challengerAgent.analysis, 300)}
- 推理要点：${truncate(challengerAgent.reasoning, 200)}

## 你要质疑的对手：${defenderAgent.agentName}
- 评分：${defenderAgent.score}/100（置信度：${defenderAgent.confidence}）
- 核心发现：${defenderAgent.keyFindings?.slice(0, 3).join(' | ') || '无'}
- 分析摘要：${truncate(defenderAgent.analysis, 300)}

## 被评估的创新点
${query}
${prevContext}

# 任务（第 ${round} 轮，作为挑战方）
基于你的报告数据，对 ${defenderAgent.agentName} 的结论提出**有数据支撑**的质疑。
${round > 1 ? '注意：你必须提出与之前不同的新论点，不要重复已有的质疑。' : ''}

# 输出格式（JSON）
{
  "argument": "基于你报告中的数据，对对方结论的质疑（2-3句话，引用具体数据）",
  "evidence": ["支撑你质疑的具体证据1", "证据2"]
}
`;

    // 推送角色标识头，让前端知道谁在发言
    const debateStreamId = `debate_${sessionId || 'unknown'}`;
    if (onProgress) {
        onProgress('agent_stream', { agentId: debateStreamId, chunk: `\n🗡️ **${challengerAgent.agentName}**（挑战方，第${round}轮）:\n`, isReasoning: false, debateRole: 'challenger', round });
    }

    try {
        const { text } = await callAIRaw(prompt, modelProvider, SINGLE_CALL_TIMEOUT, 20000,
            (chunk, isReasoning) => {
                if (onProgress) {
                    onProgress('agent_stream', { agentId: debateStreamId, chunk, isReasoning, debateRole: 'challenger', round });
                }
            },
            abortSignal
        );
        return parseAgentJSON<{ argument: string; evidence: string[] }>(text);
    } catch (err: unknown) {
        console.error(`[NovoDebate] 挑战方(${challengerAgent.agentName})发言失败:`, err instanceof Error ? err.message : String(err));
        return { argument: `${challengerAgent.agentName}认为对方评分存在偏差（发言生成异常）`, evidence: [] };
    }
}

/**
 * 执行单轮辩论中的防守方反驳（独立 AI 调用）
 */
async function generateRebuttal(
    defenderAgent: AgentOutput,
    challengerAgent: AgentOutput,
    challenge: { argument: string; evidence: string[] },
    query: string,
    round: number,
    modelProvider: ModelProvider,
    abortSignal?: AbortSignal,
    onProgress?: (event: 'log' | 'progress' | 'agent_state' | 'agent_stream', data: Record<string, unknown> | string | number) => void,
    sessionId?: string
): Promise<{ rebuttal: string; evidence: string[] }> {
    const prompt = `
# 角色
你是 ${defenderAgent.agentName}，正在一场专家辩论中担任 **防守方**。

## 你的原始报告
- 评分：${defenderAgent.score}/100（置信度：${defenderAgent.confidence}）
- 核心发现：${defenderAgent.keyFindings?.slice(0, 3).join(' | ') || '无'}
- 分析摘要：${truncate(defenderAgent.analysis, 300)}
- 推理要点：${truncate(defenderAgent.reasoning, 200)}

## 被评估的创新点
${query}

## 对方（${challengerAgent.agentName}）的质疑（第 ${round} 轮）
**质疑论点**：${challenge.argument}
**引用证据**：${challenge.evidence.join('；') || '无'}

# 任务
针对上述质疑进行**有理有据**的反驳。你必须：
1. 直接回应对方的论点（不要顾左右而言他）
2. 引用你报告中的数据来支撑反驳
3. 如果对方的质疑有道理，也可以承认部分观点，但给出补充解释

# 输出格式（JSON）
{
  "rebuttal": "对上述质疑的反驳（2-3句话，引用具体数据）",
  "evidence": ["支撑反驳的具体证据1", "证据2"]
}
`;

    // 推送角色标识头
    const debateStreamId = `debate_${sessionId || 'unknown'}`;
    if (onProgress) {
        onProgress('agent_stream', { agentId: debateStreamId, chunk: `\n🛡️ **${defenderAgent.agentName}**（防守方，第${round}轮）:\n`, isReasoning: false, debateRole: 'defender', round });
    }

    try {
        const { text } = await callAIRaw(prompt, modelProvider, SINGLE_CALL_TIMEOUT, 20000,
            (chunk, isReasoning) => {
                if (onProgress) {
                    onProgress('agent_stream', { agentId: debateStreamId, chunk, isReasoning, debateRole: 'defender', round });
                }
            },
            abortSignal
        );
        return parseAgentJSON<{ rebuttal: string; evidence: string[] }>(text);
    } catch (err: unknown) {
        console.error(`[NovoDebate] 防守方(${defenderAgent.agentName})反驳失败:`, err instanceof Error ? err.message : String(err));
        return { rebuttal: `${defenderAgent.agentName}坚持原有结论（反驳生成异常）`, evidence: [] };
    }
}

/**
 * 裁判判定（纯逻辑降级版，零成本零延迟）
 * 当 AI 裁判超时/失败时使用此版本
 *
 * 判定规则：
 * 1. 有证据 vs 无证据 → 有证据方胜
 * 2. 双方都有证据 → 证据数量多且更具体的一方胜
 * 3. 无法判定 → 平局
 */
function judgeRoundLogic(
    challengerName: string,
    challenge: { argument: string; evidence: string[] },
    defenderName: string,
    rebuttal: { rebuttal: string; evidence: string[] }
): { outcome: 'challenger_wins' | 'defender_wins' | 'draw'; reasoning: string } {
    const challengerEvidenceCount = challenge.evidence.filter(e => e && e.length > 5).length;
    const defenderEvidenceCount = rebuttal.evidence.filter(e => e && e.length > 5).length;

    // 论点长度也是一个信号——更具体的论证通常更长
    const challengerDepth = challenge.argument.length + challenge.evidence.join('').length;
    const defenderDepth = rebuttal.rebuttal.length + rebuttal.evidence.join('').length;

    // 规则1：一方完全无证据
    if (challengerEvidenceCount > 0 && defenderEvidenceCount === 0) {
        return { outcome: 'challenger_wins', reasoning: `${challengerName}提供了 ${challengerEvidenceCount} 条证据支撑，而${defenderName}未能引用具体证据反驳` };
    }
    if (defenderEvidenceCount > 0 && challengerEvidenceCount === 0) {
        return { outcome: 'defender_wins', reasoning: `${defenderName}提供了 ${defenderEvidenceCount} 条证据有效反驳，而${challengerName}的质疑缺乏证据` };
    }

    // 规则2：双方都有证据，比较深度
    if (challengerEvidenceCount > 0 && defenderEvidenceCount > 0) {
        const ratio = challengerDepth / (defenderDepth + 1);
        if (ratio > 1.4) {
            return { outcome: 'challenger_wins', reasoning: `双方均有证据，但${challengerName}的论证更深入详实（${challengerEvidenceCount}条证据）` };
        }
        if (ratio < 0.7) {
            return { outcome: 'defender_wins', reasoning: `双方均有证据，但${defenderName}的反驳更全面有力（${defenderEvidenceCount}条证据）` };
        }
    }

    // 规则3：无法区分
    return { outcome: 'draw', reasoning: '双方论证旗鼓相当，分歧核心在于视角差异而非数据矛盾' };
}

/** AI 裁判单次调用超时（15秒） */
const JUDGE_AI_TIMEOUT = 15000;

/**
 * AI 裁判判定（DeepSeek Chat 独立调用）
 * 让 AI 真正阅读双方论点和证据后做出裁决，而非简单的证据计数
 */
async function judgeRoundWithAI(
    challengerName: string,
    challenge: { argument: string; evidence: string[] },
    defenderName: string,
    rebuttal: { rebuttal: string; evidence: string[] },
    round: number,
    modelProvider: ModelProvider,
    abortSignal?: AbortSignal,
    onProgress?: (event: 'log' | 'progress' | 'agent_state' | 'agent_stream', data: Record<string, unknown> | string | number) => void,
    sessionId?: string
): Promise<{ outcome: 'challenger_wins' | 'defender_wins' | 'draw'; reasoning: string }> {
    const prompt = `
# 角色
你是一位公正的辩论裁判，你需要判定本轮辩论的胜负。

## 第 ${round} 轮辩论记录

### 挑战方：${challengerName}
**质疑论点**：${challenge.argument}
**引用证据**：${challenge.evidence.length > 0 ? challenge.evidence.join('；') : '无'}

### 防守方：${defenderName}
**反驳论点**：${rebuttal.rebuttal}
**引用证据**：${rebuttal.evidence.length > 0 ? rebuttal.evidence.join('；') : '无'}

# 裁判标准
1. **论点针对性**：防守方是否直接回应了挑战方的质疑？如果顾左右而言他，扣分
2. **证据质量**：不仅看数量，更看证据是否具体、可验证、直接支撑论点
3. **逻辑严密性**：论证链是否完整，有无逻辑跳跃或循环论证
4. **承认与反驳**：如果一方能承认对方合理部分并给出更深层解释，加分

# 输出格式（严格 JSON）
{
  "outcome": "challenger_wins" 或 "defender_wins" 或 "draw",
  "reasoning": "你的裁判理由（1-2句话，具体说明谁的论证更有说服力、为什么）"
}
`;

    // 推送裁判角色标识
    const debateStreamId = `debate_${sessionId || 'unknown'}`;
    if (onProgress) {
        onProgress('agent_stream', { agentId: debateStreamId, chunk: `\n⚖️ **裁判**（第${round}轮判定）:\n`, isReasoning: false, debateRole: 'judge', round });
    }

    const { text } = await callAIRaw(prompt, modelProvider, JUDGE_AI_TIMEOUT, 10000,
        (chunk, isReasoning) => {
            if (onProgress) {
                onProgress('agent_stream', { agentId: debateStreamId, chunk, isReasoning, debateRole: 'judge', round });
            }
        },
        abortSignal
    );
    const result = parseAgentJSON<{ outcome: string; reasoning: string }>(text);

    // 校验 outcome 合法性
    const validOutcomes = ['challenger_wins', 'defender_wins', 'draw'];
    if (!validOutcomes.includes(result.outcome)) {
        throw new Error(`AI 裁判返回非法 outcome: ${result.outcome}`);
    }

    return {
        outcome: result.outcome as 'challenger_wins' | 'defender_wins' | 'draw',
        reasoning: result.reasoning || '裁判未给出详细理由'
    };
}

/**
 * 安全裁判包装：优先使用 AI 裁判，失败时降级到纯逻辑版
 */
async function judgeRoundSafe(
    challengerName: string,
    challenge: { argument: string; evidence: string[] },
    defenderName: string,
    rebuttal: { rebuttal: string; evidence: string[] },
    round: number,
    modelProvider: ModelProvider,
    abortSignal?: AbortSignal,
    onProgress?: (event: 'log' | 'progress' | 'agent_state' | 'agent_stream', data: Record<string, unknown> | string | number) => void,
    sessionId?: string
): Promise<{ outcome: 'challenger_wins' | 'defender_wins' | 'draw'; reasoning: string }> {
    try {
        const aiResult = await judgeRoundWithAI(
            challengerName, challenge, defenderName, rebuttal, round, modelProvider, abortSignal, onProgress, sessionId
        );
        console.log(`[NovoDebate] ⚖️ AI 裁判判定第 ${round} 轮: ${aiResult.outcome}`);
        return aiResult;
    } catch (err: unknown) {
        console.warn(`[NovoDebate] ⚖️ AI 裁判失败（${err instanceof Error ? err.message : String(err)}），降级为逻辑裁判`);
        return judgeRoundLogic(challengerName, challenge, defenderName, rebuttal);
    }
}

// ==================== 多调用真对抗：单场辩论 ====================

/**
 * 执行单场多轮真对抗辩论
 *
 * 每轮：独立的挑战方 AI 调用 → 独立的防守方 AI 调用 → 纯逻辑裁判
 * 最多 MAX_ROUNDS 轮，带收敛检测提前终止
 */
export async function runDebateSession(
    proAgentOutput: AgentOutput,
    conAgentOutput: AgentOutput,
    topic: string,
    query: string,
    divergence: number,
    modelProvider: ModelProvider,
    onProgress?: (event: 'log' | 'progress' | 'agent_state' | 'agent_stream', data: Record<string, unknown> | string | number) => void,
    abortSignal?: AbortSignal,
    options?: DebateOptions
): Promise<DebateSession> {
    const maxRounds = Math.min(10, Math.max(1, options?.maxRounds ?? DEFAULT_MAX_ROUNDS));
    const autoSwap = options?.autoSwapRoles !== false;
    const convergenceEnabled = options?.convergenceEnabled !== false;
    const scoreAdjustmentCap = maxRounds * ADJUST_PER_ROUND;
    const sessionId = `${proAgentOutput.agentName}_vs_${conAgentOutput.agentName}`.replace(/\s+/g, '_');
    const sessionStart = Date.now();
    const exchanges: DebateExchange[] = [];
    const allInsights: string[] = [];

    // 确定首轮攻防方（评分高的先挑战）
    let currentChallenger = proAgentOutput.score >= conAgentOutput.score ? proAgentOutput : conAgentOutput;
    let currentDefender = proAgentOutput.score >= conAgentOutput.score ? conAgentOutput : proAgentOutput;

    for (let round = 1; round <= maxRounds; round++) {
        // 超时检查
        if (Date.now() - sessionStart > DEBATE_SESSION_TIMEOUT) {
            console.log(`[NovoDebate] 场次 ${sessionId} 第 ${round} 轮因超时跳过`);
            break;
        }

        if (onProgress) {
            onProgress('log', `[NovoDebate] ⚔️ ${sessionId} 第 ${round}/${maxRounds} 轮开始（${currentChallenger.agentName} → ${currentDefender.agentName}）`);
        }

        // Step 1: 挑战方发言（独立 AI 调用，流式推送）
        const challenge = await generateChallenge(
            currentChallenger, currentDefender, query, round, exchanges, modelProvider, abortSignal, onProgress, sessionId
        );

        // Step 2: 防守方反驳（独立 AI 调用，流式推送）
        const defense = await generateRebuttal(
            currentDefender, currentChallenger, challenge, query, round, modelProvider, abortSignal, onProgress, sessionId
        );

        // Step 3: 裁判判定（AI 裁判，流式推送，失败降级为纯逻辑）
        const judgment = await judgeRoundSafe(
            currentChallenger.agentName,
            challenge,
            currentDefender.agentName,
            defense,
            round,
            modelProvider,
            abortSignal,
            onProgress,
            sessionId
        );

        const exchange: DebateExchange = {
            round,
            challenger: currentChallenger.agentName,
            challengerArgument: challenge.argument,
            challengerEvidence: challenge.evidence,
            defender: currentDefender.agentName,
            defenderRebuttal: defense.rebuttal,
            defenderEvidence: defense.evidence,
            outcome: judgment.outcome,
            outcomeReasoning: judgment.reasoning
        };

        exchanges.push(exchange);

        if (onProgress) {
            const icon = judgment.outcome === 'challenger_wins' ? '🏆' :
                judgment.outcome === 'defender_wins' ? '🛡️' : '🤝';
            onProgress('log', `[NovoDebate] ${icon} 第 ${round} 轮判定: ${judgment.reasoning}`);
            // 推送实时辩论交锋数据给前端
            onProgress('agent_stream', {
                agentId: `debate_${sessionId}`,
                debateExchange: exchange,
                round,
                sessionId
            });
        }

        // Step 4: 收敛检测 — 是否可以提前终止
        if (convergenceEnabled) {
            const convergence = checkConvergence(exchanges);
            if (convergence.converged) {
                console.log(`[NovoDebate] 场次 ${sessionId} 在第 ${round} 轮收敛: ${convergence.reason}`);
                allInsights.push(`辩论在第 ${round} 轮收敛：${convergence.reason}`);
                break;
            }
        }

        // Step 5: 角色轮换（可配置）
        if (autoSwap) {
            [currentChallenger, currentDefender] = [currentDefender, currentChallenger];
        }
    }

    // 计算评分修正（基于辩论结果，封顶与轮次联动）
    const scoreAdjustment = calculateScoreAdjustment(exchanges, proAgentOutput.agentName, conAgentOutput.agentName, maxRounds);

    // 生成辩论结论
    const verdict = generateVerdict(exchanges, proAgentOutput.agentName, conAgentOutput.agentName);

    return {
        sessionId,
        topic,
        proAgent: proAgentOutput.agentName,
        conAgent: conAgentOutput.agentName,
        scoreDivergence: divergence,
        exchanges,
        verdict,
        keyInsights: allInsights,
        scoreAdjustment
    };
}

// ==================== 辩论结论与评分修正 ====================

/** 基于辩论交锋结果计算评分修正（封顶值与轮次联动） */
export function calculateScoreAdjustment(
    exchanges: DebateExchange[],
    proAgentName: string,
    conAgentName: string,
    maxRounds: number = DEFAULT_MAX_ROUNDS
): { proAgentDelta: number; conAgentDelta: number } {
    const scoreAdjustmentCap = maxRounds * ADJUST_PER_ROUND;
    if (exchanges.length === 0) return { proAgentDelta: 0, conAgentDelta: 0 };

    let proDelta = 0;
    let conDelta = 0;

    for (const exchange of exchanges) {
        const winnerIsChallenger = exchange.outcome === 'challenger_wins';
        const winnerIsDefender = exchange.outcome === 'defender_wins';

        if (winnerIsChallenger) {
            if (exchange.challenger === proAgentName) { proDelta += ADJUST_PER_ROUND; conDelta -= ADJUST_PER_ROUND; }
            else { conDelta += ADJUST_PER_ROUND; proDelta -= ADJUST_PER_ROUND; }
        } else if (winnerIsDefender) {
            if (exchange.defender === proAgentName) { proDelta += ADJUST_PER_ROUND; conDelta -= ADJUST_PER_ROUND; }
            else { conDelta += ADJUST_PER_ROUND; proDelta -= ADJUST_PER_ROUND; }
        }
        // 平局不修正
    }

    // 评分修正封顶值与轮次联动
    return {
        proAgentDelta: Math.max(-scoreAdjustmentCap, Math.min(scoreAdjustmentCap, proDelta)),
        conAgentDelta: Math.max(-scoreAdjustmentCap, Math.min(scoreAdjustmentCap, conDelta))
    };
}

/** 基于交锋结果生成辩论结论文本 */
function generateVerdict(exchanges: DebateExchange[], proAgent: string, conAgent: string): string {
    if (exchanges.length === 0) return '辩论未能完成。';

    const proWins = exchanges.filter(e =>
        (e.outcome === 'challenger_wins' && e.challenger === proAgent) ||
        (e.outcome === 'defender_wins' && e.defender === proAgent)
    ).length;
    const conWins = exchanges.filter(e =>
        (e.outcome === 'challenger_wins' && e.challenger === conAgent) ||
        (e.outcome === 'defender_wins' && e.defender === conAgent)
    ).length;
    const draws = exchanges.filter(e => e.outcome === 'draw').length;

    if (proWins > conWins) {
        return `经过 ${exchanges.length} 轮对抗辩论，${proAgent}的论证更具说服力（${proWins}胜${conWins}负${draws}平），其基于数据的分析在交叉质疑中得到了更有力的支撑。建议仲裁员给予${proAgent}的观点更高权重。`;
    } else if (conWins > proWins) {
        return `经过 ${exchanges.length} 轮对抗辩论，${conAgent}的论证更具说服力（${conWins}胜${proWins}负${draws}平），其反驳有效揭示了对方分析中的薄弱环节。建议仲裁员给予${conAgent}的观点更高权重。`;
    } else {
        return `经过 ${exchanges.length} 轮对抗辩论，双方旗鼓相当（${proWins}胜${conWins}负${draws}平），核心分歧在于评估视角的差异而非数据矛盾。建议仲裁员综合考虑双方观点。`;
    }
}

// ==================== 强制辩论配对 ====================

/** 辩论对信息 */
interface DebatePair {
    proAgent: string;
    conAgent: string;
    proKey: string;
    conKey: string;
    divergence: number;
    topic: string;
}

/**
 * 构建强制辩论的配对列表
 * - 若指定了 participants，只用指定的 Agent 两两配对
 * - 若未指定，使用默认的四个 Agent 两两配对
 */
function buildForcedPairs(
    agents: { academic: AgentOutput; industry: AgentOutput; innovation: AgentOutput; competitor: AgentOutput },
    participants?: string[]
): DebatePair[] {
    const agentMap: Record<string, { output: AgentOutput; name: string }> = {
        'academic-reviewer': { output: agents.academic, name: agents.academic.agentName || '学术审查员' },
        'industry-analyst': { output: agents.industry, name: agents.industry.agentName || '产业分析员' },
        'innovation-evaluator': { output: agents.innovation, name: agents.innovation.agentName || '创新评估师' },
        'competitor-detective': { output: agents.competitor, name: agents.competitor.agentName || '竞品侦探' },
    };
    // 确定参与者 keys
    const keys = participants && participants.length >= 2
        ? participants.filter(p => p in agentMap)
        : ['academic-reviewer', 'industry-analyst', 'innovation-evaluator', 'competitor-detective'];

    // 两两配对
    const pairs: DebatePair[] = [];
    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            const a = agentMap[keys[i]], b = agentMap[keys[j]];
            if (!a || !b) continue;
            const scoreA = a.output.score ?? 50;
            const scoreB = b.output.score ?? 50;
            pairs.push({
                proAgent: a.name,
                conAgent: b.name,
                proKey: keys[i].replace(/-/g, '').replace('reviewer', '').replace('analyst', '').replace('detective', '').replace('evaluator', '') || keys[i],
                conKey: keys[j].replace(/-/g, '').replace('reviewer', '').replace('analyst', '').replace('detective', '').replace('evaluator', '') || keys[j],
                divergence: Math.abs(scoreA - scoreB),
                topic: `${a.name} vs ${b.name}`,
            });
        }
    }
    // 至少保证一对
    if (pairs.length === 0) {
        const k = Object.keys(agentMap);
        const a = agentMap[k[0]], b = agentMap[k[1]];
        pairs.push({
            proAgent: a.name, conAgent: b.name,
            proKey: 'academic', conKey: 'industry',
            divergence: 0, topic: `${a.name} vs ${b.name}`,
        });
    }
    return pairs;
}

// ==================== NovoDebate 编排入口 ======================================

/**
 * NovoDebate 编排入口
 * 并行执行多场辩论，汇总生成 DebateRecord
 */
export async function executeNovoDebate(
    agents: {
        academic: AgentOutput;
        industry: AgentOutput;
        innovation: AgentOutput;
        competitor: AgentOutput;
    },
    query: string,
    modelProvider: ModelProvider,
    onProgress?: (event: 'log' | 'progress' | 'agent_state' | 'agent_stream', data: Record<string, unknown> | string | number) => void,
    abortSignal?: AbortSignal,
    remainingTimeMs?: number,
    options?: DebateOptions
): Promise<DebateRecord> {
    const startTime = Date.now();

    // 1. 判断是否需要触发辩论（支持自定义阈值 + 强制触发）
    const customThreshold = options?.minScoreDivergence;
    const forceDebate = customThreshold === 0;
    const { trigger, reason, pairs } = forceDebate
        ? { trigger: true, reason: '强制触发辩论（minScoreDivergence = 0）', pairs: buildForcedPairs(agents, options?.participants) }
        : shouldTriggerDebate(agents, customThreshold);

    if (!trigger) {
        console.log(`[NovoDebate] 跳过辩论: ${reason}`);
        return {
            triggered: false,
            triggerReason: reason,
            sessions: [],
            totalDurationMs: Date.now() - startTime,
            dissentReport: [],
            dissentReportText: ''
        };
    }

    console.log(`[NovoDebate] 🔥 触发多调用真对抗辩论: ${reason}`);
    if (onProgress) onProgress('log', `[NovoDebate] 🔥 ${reason}`);

    // 2. 构建 Agent 映射
    const agentMap: Record<string, AgentOutput> = {
        academic: agents.academic,
        industry: agents.industry,
        innovation: agents.innovation,
        competitor: agents.competitor
    };

    // 3. 并行执行所有辩论场次
    const abortController = new AbortController();
    const effectiveTimeout = Math.min(
        DEBATE_SESSION_TIMEOUT + 5000,
        remainingTimeMs ? Math.max(10000, remainingTimeMs - 5000) : DEBATE_SESSION_TIMEOUT + 5000
    );

    const combinedSignal = abortSignal
        ? AbortSignal.any([abortSignal, abortController.signal])
        : abortController.signal;

    const timer = setTimeout(() => abortController.abort(), effectiveTimeout);

    const sessionPromises = pairs.map((pair: DebatePair) => {
        if (onProgress) {
            onProgress('agent_state', {
                agentId: `debate_${pair.proKey}_vs_${pair.conKey}`,
                update: { status: 'running', startTime: Date.now() }
            });
        }

        return runDebateSession(
            agentMap[pair.proKey],
            agentMap[pair.conKey],
            pair.topic,
            query,
            pair.divergence,
            modelProvider,
            onProgress,
            combinedSignal,
            options
        ).then(session => {
            if (onProgress) {
                onProgress('agent_state', {
                    agentId: `debate_${pair.proKey}_vs_${pair.conKey}`,
                    update: { status: 'completed', endTime: Date.now() }
                });
            }
            return session;
        });
    });

    let sessions: DebateSession[];
    try {
        sessions = await Promise.all(sessionPromises);
    } catch (err: unknown) {
        console.error('[NovoDebate] 辩论执行异常:', err instanceof Error ? err.message : String(err));
        sessions = [];
    } finally {
        clearTimeout(timer);
    }

    // 4. 汇总分歧报告（结构化 + 文本版）
    const dissentReport = generateStructuredDissentReport(sessions);
    const dissentReportText = formatDissentReportText(sessions);

    const totalDurationMs = Date.now() - startTime;
    console.log(`[NovoDebate] ✅ 多调用真对抗辩论完成，${sessions.length} 场，共 ${sessions.reduce((s, ss) => s + ss.exchanges.length, 0)} 轮交锋，耗时 ${totalDurationMs}ms`);

    return {
        triggered: true,
        triggerReason: reason,
        sessions,
        totalDurationMs,
        dissentReport,
        dissentReportText
    };
}

// ==================== 分歧报告生成 ====================

// ==================== 分歧报告生成（结构化） ====================

/** 生成结构化分歧报告 */
function generateStructuredDissentReport(sessions: DebateSession[]): DissentItem[] {
    if (sessions.length === 0) return [];

    return sessions.map(session => {
        // 计算双方胜场
        const proWins = session.exchanges.filter(e =>
            (e.outcome === 'challenger_wins' && e.challenger === session.proAgent) ||
            (e.outcome === 'defender_wins' && e.defender === session.proAgent)
        ).length;
        const conWins = session.exchanges.filter(e =>
            (e.outcome === 'challenger_wins' && e.challenger === session.conAgent) ||
            (e.outcome === 'defender_wins' && e.defender === session.conAgent)
        ).length;

        // 从交锋记录中提取双方立场摘要
        const proPositions = session.exchanges
            .map(e => e.challenger === session.proAgent ? e.challengerArgument : e.defenderRebuttal)
            .filter(Boolean);
        const conPositions = session.exchanges
            .map(e => e.challenger === session.conAgent ? e.challengerArgument : e.defenderRebuttal)
            .filter(Boolean);

        // 评估分歧严重程度
        const severity: 'high' | 'medium' | 'low' =
            session.scoreDivergence > 25 ? 'high' :
                session.scoreDivergence > 15 ? 'medium' : 'low';

        const winner: 'pro' | 'con' | 'draw' =
            proWins > conWins ? 'pro' :
                conWins > proWins ? 'con' : 'draw';

        return {
            dimension: session.topic,
            proAgent: session.proAgent,
            proPosition: proPositions[0] || '未能生成立场',
            conAgent: session.conAgent,
            conPosition: conPositions[0] || '未能生成立场',
            severity,
            resolution: session.verdict,
            roundsDebated: session.exchanges.length,
            winner
        };
    });
}

/** 将结构化分歧数据格式化为 markdown 文本（供仲裁员 prompt 使用） */
function formatDissentReportText(sessions: DebateSession[]): string {
    if (sessions.length === 0) return '辩论未能完成，无分歧报告。';

    const parts: string[] = ['## NovoDebate 分歧报告\n'];

    for (const session of sessions) {
        parts.push(`### 🔥 ${session.proAgent} vs ${session.conAgent}`);
        parts.push(`**辩题**：${session.topic}（评分差异 ${session.scoreDivergence} 分）\n`);

        for (const exchange of session.exchanges) {
            const icon = exchange.outcome === 'challenger_wins' ? '🏆' :
                exchange.outcome === 'defender_wins' ? '🛡️' : '🤝';
            parts.push(`**第 ${exchange.round} 轮** ${icon} ${exchange.outcomeReasoning}`);
        }

        parts.push(`\n**裁决**：${session.verdict}`);

        if (session.keyInsights.length > 0) {
            parts.push(`\n**辩论新洞察**：`);
            session.keyInsights.forEach(insight => parts.push(`- ${insight}`));
        }

        const adj = session.scoreAdjustment;
        if (adj.proAgentDelta !== 0 || adj.conAgentDelta !== 0) {
            parts.push(`\n**评分修正建议**：${session.proAgent} ${adj.proAgentDelta >= 0 ? '+' : ''}${adj.proAgentDelta}，${session.conAgent} ${adj.conAgentDelta >= 0 ? '+' : ''}${adj.conAgentDelta}`);
        }
        parts.push('');
    }

    return parts.join('\n');
}

// ==================== Fallback 生成 ====================

export function createFallbackDebateRecord(reason: string = '辩论层超时'): DebateRecord {
    return {
        triggered: true,
        triggerReason: `${reason}，已降级跳过`,
        sessions: [],
        totalDurationMs: 0,
        dissentReport: [],
        dissentReportText: '辩论因超时未能完成。'
    };
}
