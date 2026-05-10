/**
 * Phase S2: debugStore — Studio 调试状态管理（对标 Dify Variable Inspector）
 *
 * 管理：
 *   - 每个节点的 Last Run 缓存（inputs/outputs/duration/timestamp）
 *   - 节点运行状态（idle/running/done/error/stale）
 *   - 管线级运行历史
 *   - Variable Inspector 的变量编辑
 *   - 逐步执行状态
 */

import { create } from 'zustand'
import { debugNode as apiDebugNode } from '@/lib/api'
import type { DebugNodeResponse, DebugRunRecord } from '@/lib/api'

// ── 类型 ──

export type NodeDebugStatus = 'idle' | 'running' | 'done' | 'error' | 'stale'

export interface NodeRunCache {
  nodeId: string
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  duration_ms: number
  timestamp: number        // Date.now()
  status: NodeDebugStatus
  logs: string[]
  error?: string
}

export interface StepState {
  active: boolean            // 逐步执行是否激活
  queue: string[]            // 待执行节点队列（拓扑序）
  currentIndex: number       // 当前位置
  paused: boolean            // 暂停等待用户确认
}

/** T5: Agentic 结构化执行轨迹步骤 */
export interface AgenticTraceStep {
  type: 'thinking' | 'tool_call_start' | 'tool_call_done' | 'final_output'
  timestamp: number
  source?: 'stream' | 'runtime' | 'runner'
  tool?: string
  node?: string
  argsPreview?: string
  resultPreview?: string
  status?: 'running' | 'done' | 'completed' | 'error' | 'paused'
  eventType?: string
  duration_ms?: number
  input_tokens?: number
  output_tokens?: number
  step_index: number
}

interface DebugStoreState {
  // ── 节点缓存 ──
  nodeCache: Record<string, NodeRunCache>

  // ── 运行历史 ──
  runHistory: DebugRunRecord[]

  // ── 逐步执行 ──
  stepState: StepState

  // ── Agentic 执行轨迹 ──
  agenticTrace: AgenticTraceStep[]

  // ── 高亮联动 ──
  inspectorHighlightNodeId: string | null

  // ── 操作 ──
  /** 单节点执行 */
  runNode: (nodeId: string, inputs: Record<string, unknown>) => Promise<DebugNodeResponse>
  /** 从 SSE node_done 事件更新缓存 */
  updateNodeFromSSE: (nodeId: string, data: {
    inputs: Record<string, unknown>
    outputs: Record<string, unknown>
    duration_ms: number
  }) => void
  /** 手动编辑变量值 */
  editVariable: (nodeId: string, section: 'inputs' | 'outputs', key: string, value: unknown) => void
  /** 标记下游节点为过期 */
  markDownstreamStale: (nodeId: string, downstreamIds: string[]) => void
  /** 从运行历史加载节点缓存 */
  loadFromHistory: (record: DebugRunRecord) => void
  /** 清空所有缓存 */
  clearAll: () => void
  /** 重置单个节点 */
  resetNode: (nodeId: string) => void
  /** 设置 Inspector 高亮 */
  setInspectorHighlight: (nodeId: string | null) => void
  /** 更新运行历史 */
  setRunHistory: (runs: DebugRunRecord[]) => void
  /** 逐步执行控制 */
  startStepMode: (orderedNodeIds: string[]) => void
  stepNext: () => Promise<DebugNodeResponse | null>
  stopStepMode: () => void
  /** Agentic 轨迹 */
  addTraceStep: (step: AgenticTraceStep) => void
  clearTrace: () => void
}

const EMPTY_STEP: StepState = {
  active: false,
  queue: [],
  currentIndex: -1,
  paused: false,
}

export const useDebugStore = create<DebugStoreState>((set, get) => ({
  nodeCache: {},
  runHistory: [],
  stepState: { ...EMPTY_STEP },
  agenticTrace: [],
  inspectorHighlightNodeId: null,

  // ── 单节点执行 ──
  runNode: async (nodeId, inputs) => {
    // 标记 running
    set(s => ({
      nodeCache: {
        ...s.nodeCache,
        [nodeId]: {
          ...(s.nodeCache[nodeId] || { nodeId, inputs: {}, outputs: {}, duration_ms: 0, timestamp: 0, logs: [] }),
          nodeId,
          status: 'running',
          inputs,
          error: undefined,
        },
      },
    }))

    try {
      const result = await apiDebugNode({ node_id: nodeId, inputs })

      const cache: NodeRunCache = {
        nodeId,
        inputs: (result.inputs_echo || inputs) as Record<string, unknown>,
        outputs: (result.outputs || {}) as Record<string, unknown>,
        duration_ms: result.duration_ms,
        timestamp: Date.now(),
        status: result.status === 'ok' ? 'done' : 'error',
        logs: result.logs,
        error: result.error,
      }

      set(s => ({
        nodeCache: { ...s.nodeCache, [nodeId]: cache },
      }))

      return result
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      set(s => ({
        nodeCache: {
          ...s.nodeCache,
          [nodeId]: {
            ...(s.nodeCache[nodeId] || { nodeId, inputs, outputs: {}, duration_ms: 0, timestamp: 0, logs: [] }),
            status: 'error',
            error: errMsg,
            logs: [`❌ ${errMsg}`],
          },
        },
      }))
      throw err
    }
  },

  // ── SSE 更新 ──
  updateNodeFromSSE: (nodeId, data) => {
    const cache: NodeRunCache = {
      nodeId,
      inputs: data.inputs,
      outputs: data.outputs,
      duration_ms: data.duration_ms,
      timestamp: Date.now(),
      status: 'done',
      logs: [`✅ ${nodeId} (${data.duration_ms}ms)`],
    }
    set(s => ({
      nodeCache: { ...s.nodeCache, [nodeId]: cache },
    }))
  },

  // ── 编辑变量 ──
  editVariable: (nodeId, section, key, value) => {
    set(s => {
      const existing = s.nodeCache[nodeId]
      if (!existing) return s
      return {
        nodeCache: {
          ...s.nodeCache,
          [nodeId]: {
            ...existing,
            [section]: { ...existing[section], [key]: value },
          },
        },
      }
    })
  },

  // ── 标记下游过期 ──
  markDownstreamStale: (_nodeId, downstreamIds) => {
    set(s => {
      const updated = { ...s.nodeCache }
      for (const id of downstreamIds) {
        if (updated[id]) {
          updated[id] = { ...updated[id], status: 'stale' }
        }
      }
      return { nodeCache: updated }
    })
  },

  // ── 从历史加载 ──
  loadFromHistory: (record) => {
    const cache: Record<string, NodeRunCache> = {}
    for (const [nodeId, data] of Object.entries(record.node_cache)) {
      cache[nodeId] = {
        nodeId,
        inputs: data.inputs,
        outputs: data.outputs,
        duration_ms: data.duration_ms,
        timestamp: new Date(record.timestamp).getTime(),
        status: 'done',
        logs: [`✅ (from history ${record.run_id.slice(0, 8)})`],
      }
    }
    set({ nodeCache: cache })
  },

  // ── 清空 ──
  clearAll: () => set({ nodeCache: {}, stepState: { ...EMPTY_STEP } }),

  // ── 重置单节点 ──
  resetNode: (nodeId) => {
    set(s => {
      const updated = { ...s.nodeCache }
      delete updated[nodeId]
      return { nodeCache: updated }
    })
  },

  // ── Inspector 高亮 ──
  setInspectorHighlight: (nodeId) => set({ inspectorHighlightNodeId: nodeId }),

  // ── 运行历史 ──
  setRunHistory: (runs) => set({ runHistory: runs }),

  // ── 逐步执行 ──
  startStepMode: (orderedNodeIds) => {
    set({
      stepState: {
        active: true,
        queue: orderedNodeIds,
        currentIndex: 0,
        paused: true,
      },
    })
  },

  stepNext: async () => {
    const { stepState, nodeCache } = get()
    if (!stepState.active || stepState.currentIndex >= stepState.queue.length) {
      get().stopStepMode()
      return null
    }

    const nodeId = stepState.queue[stepState.currentIndex]

    // 收集上游节点输出作为输入
    const upstreamInputs: Record<string, unknown> = {}
    for (let i = 0; i < stepState.currentIndex; i++) {
      const prevId = stepState.queue[i]
      const prevCache = nodeCache[prevId]
      if (prevCache?.outputs) {
        Object.assign(upstreamInputs, prevCache.outputs)
      }
    }

    set(s => ({
      stepState: { ...s.stepState, paused: false },
    }))

    try {
      const result = await get().runNode(nodeId, upstreamInputs)

      set(s => ({
        stepState: {
          ...s.stepState,
          currentIndex: s.stepState.currentIndex + 1,
          paused: true,
        },
      }))

      return result
    } catch {
      set(s => ({
        stepState: { ...s.stepState, paused: true },
      }))
      return null
    }
  },

  stopStepMode: () => set({ stepState: { ...EMPTY_STEP } }),

  // ── Agentic 轨迹 ──
  addTraceStep: (step) => set(s => ({ agenticTrace: [...s.agenticTrace, step] })),
  clearTrace: () => set({ agenticTrace: [] }),
}))
