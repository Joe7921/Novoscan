/**
 * 产业分析员 Agent 主入口
 *
 * 职责：深度分析产业检索数据，评估市场成熟度与商业化可行性
 * 评分维度：市场验证度 / 竞争烈度 / 商业化可行性 / 时机评估
 *
 * 架构角色：Layer1（与学术/竞品并行执行，无上游依赖）
 *
 * @module agents/industry-analyst
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { AgentInput, AgentOutput } from '@/types/agent';
import { buildIndustryAnalystPrompt } from './prompt';

export async function industryAnalyst(input: AgentInput): Promise<AgentOutput> {
  const prompt = buildIndustryAnalystPrompt(input);

  try {
    const { text } = await callAIRaw(
      prompt,
      input.modelProvider,
      115000,
      80000,
      (chunk, isReasoning) => {
        if (input.onProgress) {
          input.onProgress('agent_stream', { agentId: 'industryAnalyst', chunk, isReasoning });
        }
      },
      input._abortSignal,
      16384
    );
    return parseAgentJSON<AgentOutput>(text);
  } catch (err: unknown) {
    console.error('[产业分析员] Agent 执行失败:', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
