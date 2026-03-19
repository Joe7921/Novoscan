/**
 * 学术审查员 — Agent 主入口
 *
 * 职责：深度分析学术检索数据，从 5 个维度评估技术的学术基础
 * 评分维度：技术成熟度 / 论文覆盖度 / 学术空白 / 引用密度 / 时间趋势
 *
 * @module agents/academic-reviewer
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { AgentInput, AgentOutput } from '@/types/agent';
import { buildAcademicReviewerPrompt } from './prompt';

export async function academicReviewer(input: AgentInput): Promise<AgentOutput> {
  const prompt = buildAcademicReviewerPrompt(input);

  try {
    const { text } = await callAIRaw(
      prompt,
      input.modelProvider,
      115000, // 对齐编排器 AGENT_TIMEOUT(120s)，留 5s 缓冲让编排器 abort 优先触发
      80000,
      (chunk, isReasoning) => {
        if (input.onProgress) {
          input.onProgress('agent_stream', { agentId: 'academicReviewer', chunk, isReasoning });
        }
      },
      input._abortSignal,
      16384
    );
    return parseAgentJSON<AgentOutput>(text);
  } catch (err: unknown) {
    console.error('[学术审查员] Agent 执行失败:', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
