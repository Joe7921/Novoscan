/**
 * useAnalysis — 分析流程状态机 Hook
 *
 * 状态流转：
 *   idle → analyzing_intent → awaiting_confirmation → running → completed / error
 *
 * Standard（传统工作流）：SSE 流 + HITL 中断
 * Agentic（智能体工作流）：SSE 流一次性跑完
 */

import { useState, useCallback, useRef } from 'react'
import {
  startAnalysisStream,
  resumeStream,
  startAgenticStream,
  resumeAgenticStream,
  type ResumeRequest,
  type AgenticResumeRequest,
  type AgenticRuntimeState,
} from '@/lib/api'
import { useDebugStore, type AgenticTraceStep } from '@/lib/debugStore'
import { consumeSSE, type SSEEvent } from '@/lib/sse'

export type AnalysisPhase =
  | 'idle'
  | 'analyzing_intent'
  | 'awaiting_confirmation'
  | 'running'
  | 'completed'
  | 'error'

export interface NodeToolCall {
  tool: string
  status: 'running' | 'done'
  argsPreview?: string
  resultPreview?: string
}

export interface NodeProgress {
  name: string
  status: 'pending' | 'running' | 'done'
  summary?: Record<string, unknown>
  startedAt?: number
  completedAt?: number
  nodeToolCalls?: NodeToolCall[]
}

export interface ToolCallRecord {
  tool: string
  argsPreview?: string
  resultPreview?: string
}

export interface AgentProgressItem {
  agentName: string
  score: number
  confidence: string
  isFallback: boolean
}

export interface DebateExchangeItem {
  round: number
  proAgent: string
  conAgent: string
  proPreview: string
  conPreview: string
  outcome: string
  outcomeReasoning?: string
}

// P4: 执行路径和阶段跟踪
export interface ExecutionPathEntry {
  stage: string
  tool: string
  step: number
}

export interface StageInfo {
  id: string
  label: string
  startedAt?: number
  completedAt?: number
  durationMs?: number
}

export interface AnalysisState {
  phase: AnalysisPhase
  mode: 'standard' | 'agentic'
  threadId: string | null
  error: string | null
  // Standard 模式
  analyzedIntent: Record<string, unknown> | null
  nodes: NodeProgress[]
  // 最终结果
  evaluationResults: Record<string, unknown>[]
  finalScore: number | null
  finalJudgment: string | null
  reportJson: Record<string, unknown> | null
  debateHistory: (string | Record<string, unknown>)[]
  debateRound: number
  // Agentic 模式
  toolCalls: ToolCallRecord[]
  finalOutput: string | null
  runtimeState: AgenticRuntimeState | null
  pauseTarget: string | null
  pausePhase: string | null
  waitingFor: string | null
  pendingFinalScore: number | null
  pendingToolCallsCount: number | null
  // 流式思考过程
  agentProgress: AgentProgressItem[]
  debateExchanges: DebateExchangeItem[]
  streamingTokens: string
  // P4: 阶段跟踪
  currentStage?: StageInfo
  executionPath: ExecutionPathEntry[]
  stageDurations: Record<string, number>
}

const STANDARD_NODES = [
  'intent_analyzer', 'retrieval', 'scoring',
  'debate', 'arbitration', 'quality_gate', 'report_assembly',
]

function initialState(): AnalysisState {
  return {
    phase: 'idle',
    mode: 'standard',
    threadId: null,
    error: null,
    analyzedIntent: null,
    nodes: STANDARD_NODES.map(n => ({ name: n, status: 'pending' })),
    evaluationResults: [],
    finalScore: null,
    finalJudgment: null,
    reportJson: null,
    debateHistory: [],
    debateRound: 0,
    toolCalls: [],
    finalOutput: null,
    runtimeState: null,
    pauseTarget: null,
    pausePhase: null,
    waitingFor: null,
    pendingFinalScore: null,
    pendingToolCallsCount: null,
    agentProgress: [],
    debateExchanges: [],
    streamingTokens: '',
    executionPath: [],
    stageDurations: {},
  }
}

export function isAgenticPaused(state: AnalysisState): boolean {
  return state.phase === 'awaiting_confirmation' && state.mode === 'agentic' && Boolean(state.pauseTarget || state.runtimeState?.status === 'paused')
}

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>(initialState())
  const abortRef = useRef<AbortController | null>(null)
  const modeRef = useRef<'standard' | 'agentic'>('standard')

  const update = useCallback((patch: Partial<AnalysisState>) => {
    setState(prev => ({ ...prev, ...patch }))
  }, [])

  const appendAgenticTrace = useCallback((step: Omit<AgenticTraceStep, 'step_index'>) => {
    const store = useDebugStore.getState()
    store.addTraceStep({
      ...step,
      step_index: store.agenticTrace.length,
    })
  }, [])

  const clearAgenticTrace = useCallback(() => {
    useDebugStore.getState().clearTrace()
  }, [])

  const updateNode = useCallback((name: string, status: NodeProgress['status'], extra?: Partial<NodeProgress>) => {
    setState(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.name === name ? { ...n, status, ...(extra || {}) } : n
      ),
    }))
  }, [])

  // SSE 事件处理器
  const handleEvent = useCallback((evt: SSEEvent) => {
    const d = evt.data
    if (evt.event !== 'llm_token') {
      console.log('[SSE]', evt.event, d)
    }

    switch (evt.event) {
      case 'stream_start':
        update({
          threadId: d.thread_id as string,
          runtimeState: (d.runtime_state as AgenticRuntimeState) ?? null,
        })
        break

      case 'node_start':
        updateNode(d.node as string, 'running', { startedAt: Date.now() })
        update({ phase: 'running', streamingTokens: '' })
        break

      case 'node_done':
        updateNode(d.node as string, 'done', {
          summary: d.summary as Record<string, unknown>,
          completedAt: Date.now(),
        })
        break

      case 'hitl_interrupt':
        if (state.mode === 'agentic' || d.runtime_state != null) {
          const runtimeState = (d.runtime_state as AgenticRuntimeState | null) ?? null
          const pendingResult = (d.pending_result as Record<string, unknown> | null) ?? null
          update({
            phase: 'awaiting_confirmation',
            analyzedIntent: null,
            runtimeState,
            pauseTarget: (d.pause_target as string | null) ?? runtimeState?.pause_target ?? null,
            pausePhase: runtimeState?.pause_phase ?? null,
            waitingFor: (d.waiting_for as string | null) ?? null,
            pendingFinalScore: (pendingResult?.final_score as number | null | undefined) ?? null,
            pendingToolCallsCount: (pendingResult?.tool_calls_count as number | null | undefined) ?? null,
          })
          break
        }
        update({
          phase: 'awaiting_confirmation',
          analyzedIntent: d.analyzed_intent as Record<string, unknown>,
        })
        break

      case 'resume_start':
        update({
          phase: 'running',
          runtimeState: (d.runtime_state as AgenticRuntimeState | null | undefined) ?? null,
          pauseTarget: null,
          pausePhase: null,
          waitingFor: null,
          pendingFinalScore: null,
          pendingToolCallsCount: null,
        })
        break

      case 'tool_call_start': {
        const node = d.node as string | undefined
        const tc: ToolCallRecord = {
          tool: d.tool as string,
          argsPreview: d.args_preview as string,
        }
        setState(prev => {
          const newToolCalls = [...prev.toolCalls, tc]
          // Standard 模式：追加到对应节点的 nodeToolCalls
          const newNodes = node
            ? prev.nodes.map(n =>
                n.name === node
                  ? {
                      ...n,
                      nodeToolCalls: [
                        ...(n.nodeToolCalls || []),
                        { tool: tc.tool, status: 'running' as const, argsPreview: tc.argsPreview },
                      ],
                    }
                  : n
              )
            : prev.nodes
          return { ...prev, toolCalls: newToolCalls, nodes: newNodes }
        })
        if (modeRef.current === 'agentic') {
          appendAgenticTrace({
            type: 'tool_call_start',
            timestamp: Date.now(),
            source: 'stream',
            tool: tc.tool,
            node,
            argsPreview: tc.argsPreview,
            status: 'running',
            eventType: 'tool_call_start',
          })
        }
        break
      }

      case 'tool_call_done': {
        const node = d.node as string | undefined
        const toolName = d.tool as string
        const preview = d.result_preview as string
        setState(prev => {
          const newToolCalls = prev.toolCalls.map((tc, i) =>
            i === prev.toolCalls.length - 1
              ? { ...tc, resultPreview: preview }
              : tc
          )
          const newNodes = node
            ? prev.nodes.map(n => {
                if (n.name !== node) return n
                const updated = (n.nodeToolCalls || []).map(ntc =>
                  ntc.tool === toolName && ntc.status === 'running'
                    ? { ...ntc, status: 'done' as const, resultPreview: preview }
                    : ntc
                )
                return { ...n, nodeToolCalls: updated }
              })
            : prev.nodes
          return { ...prev, toolCalls: newToolCalls, nodes: newNodes }
        })
        if (modeRef.current === 'agentic') {
          appendAgenticTrace({
            type: 'tool_call_done',
            timestamp: Date.now(),
            source: 'stream',
            tool: toolName,
            node,
            resultPreview: preview,
            duration_ms: (d.duration_ms as number | undefined) ?? undefined,
            status: 'done',
            eventType: 'tool_call_done',
          })
        }
        break
      }

      case 'agent_progress':
        setState(prev => ({
          ...prev,
          agentProgress: [
            ...prev.agentProgress,
            {
              agentName: d.agent_name as string,
              score: d.score as number,
              confidence: d.confidence as string,
              isFallback: d.is_fallback as boolean,
            },
          ],
        }))
        break

      case 'debate_exchange':
        setState(prev => ({
          ...prev,
          debateExchanges: [
            ...prev.debateExchanges,
            {
              round: d.round as number,
              proAgent: d.pro_agent as string,
              conAgent: d.con_agent as string,
              proPreview: d.pro_argument_preview as string,
              conPreview: d.con_argument_preview as string,
              outcome: d.outcome as string,
              outcomeReasoning: d.outcome_reasoning as string | undefined,
            },
          ],
        }))
        break

      // P4: 阶段跟踪事件
      case 'stage_start':
        setState(prev => ({
          ...prev,
          currentStage: {
            id: d.stage as string,
            label: d.stage_label as string,
            startedAt: Date.now(),
          },
        }))
        break

      case 'stage_done':
        setState(prev => ({
          ...prev,
          currentStage: undefined,
          stageDurations: {
            ...prev.stageDurations,
            [d.stage as string]: d.duration_ms as number,
          },
        }))
        break

      case 'path_update':
        setState(prev => ({
          ...prev,
          executionPath: d.path as ExecutionPathEntry[],
        }))
        break

      case 'run_summary':
        setState(prev => ({
          ...prev,
          executionPath: d.execution_path as ExecutionPathEntry[],
          stageDurations: d.stage_durations as Record<string, number>,
        }))
        break

      case 'llm_token':
        setState(prev => ({
          ...prev,
          streamingTokens: prev.streamingTokens + (d.token as string),
        }))
        break

      case 'agent_thinking':
        update({ phase: 'running', streamingTokens: '' })
        if (modeRef.current === 'agentic') {
          appendAgenticTrace({
            type: 'thinking',
            timestamp: Date.now(),
            source: 'stream',
            status: 'running',
            eventType: 'agent_thinking',
          })
        }
        break

      case 'stream_complete':
        update({
          phase: d.status === 'aborted' ? 'idle' : 'completed',
          finalScore: d.status === 'aborted' ? null : (d.final_score as number) ?? null,
          finalJudgment: d.status === 'aborted' ? null : (d.final_judgment as string) ?? null,
          reportJson: d.status === 'aborted' ? null : (d.report_json as Record<string, unknown>) ?? null,
          evaluationResults: d.status === 'aborted' ? [] : (d.evaluation_results as Record<string, unknown>[]) ?? [],
          debateHistory: d.status === 'aborted' ? [] : (d.debate_history as (string | Record<string, unknown>)[]) ?? [],
          debateRound: d.status === 'aborted' ? 0 : (d.debate_round as number) ?? 0,
          finalOutput: d.status === 'aborted' ? null : (d.final_output as string) ?? null,
          runtimeState: (d.runtime_state as AgenticRuntimeState) ?? null,
          pauseTarget: null,
          pausePhase: null,
          waitingFor: null,
          pendingFinalScore: null,
          pendingToolCallsCount: null,
          error: null,
        })
        if (modeRef.current === 'agentic' && d.status !== 'aborted' && typeof d.final_output === 'string' && d.final_output) {
          appendAgenticTrace({
            type: 'final_output',
            timestamp: Date.now(),
            source: 'stream',
            resultPreview: d.final_output as string,
            status: 'completed',
            eventType: 'stream_complete',
          })
        }
        break

      case 'error': {
        const runtimeState = (d.runtime_state as AgenticRuntimeState | null | undefined) ?? null
        update({
          phase: 'error',
          error: d.message as string,
          runtimeState: runtimeState ?? null,
          pauseTarget: runtimeState?.pause_target ?? null,
          pausePhase: runtimeState?.pause_phase ?? null,
          waitingFor: (d.waiting_for as string | null | undefined) ?? runtimeState?.waiting_for ?? null,
        })
        if (modeRef.current === 'agentic') {
          appendAgenticTrace({
            type: 'final_output',
            timestamp: Date.now(),
            source: 'stream',
            resultPreview: d.message as string,
            status: 'error',
            eventType: 'error',
          })
        }
        break
      }
    }
  }, [appendAgenticTrace, update, updateNode])

  // 启动分析
  const startAnalysis = useCallback(async (
    input: string,
    detectionType: string,
    mode: 'standard' | 'agentic',
    opts?: { enabledTools?: string[] | null; extraInstructions?: string; pipeline?: string | null },
  ) => {
    modeRef.current = mode
    clearAgenticTrace()
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    const fresh = initialState()
    fresh.mode = mode
    fresh.phase = 'analyzing_intent'
    setState(fresh)

    const req = {
      user_raw_input: input,
      detection_type: detectionType,
      enabled_tools: opts?.enabledTools ?? null,
      extra_instructions: opts?.extraInstructions ?? '',
      pipeline: opts?.pipeline ?? null,
    }

    try {
      const res = mode === 'standard'
        ? await startAnalysisStream(req, ac.signal)
        : await startAgenticStream(req, ac.signal)

      if (!res.ok) {
        update({ phase: 'error', error: `HTTP ${res.status}: ${res.statusText}` })
        return
      }

      await consumeSSE(res, handleEvent, (err) => {
        update({ phase: 'error', error: err.message })
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        update({ phase: 'error', error: (err as Error).message })
      }
    }
  }, [clearAgenticTrace, handleEvent, update])

  // HITL 恢复
  const resume = useCallback(async (
    action: ResumeRequest['action'] | AgenticResumeRequest['action'],
    feedback = '',
    revisedUserInput = '',
    enabledTools?: string[] | null,
  ) => {
    if (!state.threadId) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    update({ phase: 'running' })

    try {
      const res = state.mode === 'agentic'
        ? await resumeAgenticStream(
            state.threadId,
            {
              action: action === 'confirm'
                ? 'approve_and_continue'
                : action === 'revise'
                  ? 'revise_inputs'
                  : action,
              feedback: feedback || undefined,
              revised_user_input: revisedUserInput || undefined,
              enabled_tools: enabledTools ?? null,
            },
            ac.signal,
          )
        : await resumeStream(
            state.threadId,
            { action: action as ResumeRequest['action'], feedback },
            ac.signal,
          )
      if (!res.ok) {
        update({ phase: 'error', error: `Resume failed: ${res.status}` })
        return
      }
      await consumeSSE(res, handleEvent, (err) => {
        update({ phase: 'error', error: err.message })
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        update({ phase: 'error', error: (err as Error).message })
      }
    }
  }, [state.threadId, state.mode, handleEvent, update])

  // 重置
  const reset = useCallback(() => {
    abortRef.current?.abort()
    modeRef.current = 'standard'
    clearAgenticTrace()
    setState(initialState())
  }, [clearAgenticTrace])

  return { state, startAnalysis, resume, reset }
}
