/**
 * 竞品侦探 Agent 主入口
 *
 * 职责：深入分析竞品格局，拆解技术栈、市场策略，寻找差异化空间
 * 评分维度：竞争密度 / 技术护城河 / 差异化空间 / 进入壁垒
 *
 * 架构角色：Layer1（与学术/产业并行执行，无上游依赖）
 *
 * @module agents/competitor-detective
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { AgentInput, AgentOutput } from '@/types/agent';
import { buildCompetitorDetectivePrompt } from './prompt';

export async function competitorDetective(input: AgentInput): Promise<AgentOutput> {
  const prompt = buildCompetitorDetectivePrompt(input);

  try {
    const { text } = await callAIRaw(
      prompt,
      input.modelProvider,
      115000,
      80000,
      (chunk, isReasoning) => {
        if (input.onProgress) {
          input.onProgress('agent_stream', { agentId: 'competitorDetective', chunk, isReasoning });
        }
      },
      input._abortSignal,
      16384
    );
    return parseAgentJSON<AgentOutput>(text);
  } catch (err: unknown) {
    console.error('[竞品侦探] Agent 执行失败:', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
