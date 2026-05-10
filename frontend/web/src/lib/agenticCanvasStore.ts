/**
 * P10b-P1: AgenticCanvasStore — 统一画布 ViewModel
 *
 * 合成两类数据源：
 *   - 架构态：来自 agenticConfigStore（工具启用/禁用、分组、参数）
 *   - 运行态：来自 debugStore（agenticTrace、nodeCache、runHistory）
 *
 * 画布不再直接消费 localTools，而是消费本 store 产出的
 * AgenticCanvasViewModel，实现"静态架构 + 动态运行"叠加。
 */

import { create } from 'zustand'
import { useAgenticConfigStore } from './agenticConfigStore'
import { useDebugStore, type AgenticTraceStep, type NodeRunCache } from './debugStore'

// ── 阶段泳道定义 ──

export type AgenticLaneType = 'intent' | 'retrieval' | 'evaluation' | 'resolution' | 'output'

export interface AgenticLane {
  id: string
  label: string
  type: AgenticLaneType
  order: number
  collapsed: boolean
  nodes: AgenticCanvasNode[]
}

// ── 统一节点类型 ──

export type AgenticNodeKind = 'tool' | 'stage' | 'controller' | 'output' | 'condition'
export type AgenticNodeRuntimeStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped'

export interface AgenticCanvasNode {
  id: string
  kind: AgenticNodeKind
  group: string
  lane: AgenticLaneType
  label: string
  description: string
  enabled: boolean
  staticOrder: number
  runtime?: {
    called: boolean
    stepIndex?: number
    status?: AgenticNodeRuntimeStatus
    durationMs?: number
    inputTokens?: number
    outputTokens?: number
    resultPreview?: string
    errorPreview?: string
    lastRunAt?: number
  }
}

// ── 视图模式 ──

export type AgenticCanvasView = 'execution' | 'architecture' | 'compare'

// ── 活动路径 ──

export interface ActivePathEntry {
  nodeId: string
  stepIndex: number
  timestamp: number
  status: AgenticNodeRuntimeStatus
}

// ── 运行摘要 ──

export interface RunSummary {
  totalSteps: number
  totalDurationMs: number
  totalInputTokens: number
  totalOutputTokens: number
  usedTools: string[]
  skippedTools: string[]
  errorTools: string[]
}

// ── ViewModel ──

export interface AgenticCanvasViewModel {
  runId: string | null
  view: AgenticCanvasView
  lanes: AgenticLane[]
  activePath: ActivePathEntry[]
  lastRunSummary?: RunSummary
  orchestrator: {
    temperature: number
    maxIterations: number
    enabledCount: number
    totalCount: number
    systemPromptLength: number
  }
}

// ── Store State ──

interface AgenticCanvasStoreState {
  // 视图控制
  view: AgenticCanvasView
  collapsedLanes: Record<string, boolean>
  filterEnabledOnly: boolean
  filterHitOnly: boolean
  filterErrorOnly: boolean
  highlightLane: AgenticLaneType | null
  selectedNodeId: string | null

  // P3: 联动信号 — 画布点击节点时置 true，Drawer 消费后清零
  linkToDebugPanel: boolean

  // P3: 运行 ID（来自 analysisState.threadId）
  runId: string | null

  // Actions
  setView: (view: AgenticCanvasView) => void
  toggleLaneCollapsed: (laneId: string) => void
  setFilterEnabledOnly: (v: boolean) => void
  setFilterHitOnly: (v: boolean) => void
  setFilterErrorOnly: (v: boolean) => void
  setHighlightLane: (lane: AgenticLaneType | null) => void
  selectNode: (nodeId: string | null) => void
  resetFilters: () => void
  setRunId: (id: string | null) => void
  consumeLinkSignal: () => void

  // ViewModel 计算入口（由组件调用，不缓存）
  computeViewModel: () => AgenticCanvasViewModel
}

// ── 工具 → 阶段映射 ──

const TOOL_LANE_MAP: Record<string, AgenticLaneType> = {
  analyze_intent: 'intent',
  search_openalex: 'retrieval',
  search_arxiv: 'retrieval',
  search_brave: 'retrieval',
  search_github: 'retrieval',
  search_crossref: 'retrieval',
  search_patents: 'retrieval',
  score_academic_scorer: 'evaluation',
  score_industry_analyst: 'evaluation',
  score_competitor_detective: 'evaluation',
  run_debate: 'resolution',
  run_arbitration: 'resolution',
  compile_report: 'output',
}

// ── 阶段元数据 ──

const LANE_META: Array<{ id: string; type: AgenticLaneType; label: string; order: number }> = [
  { id: 'lane-intent', type: 'intent', label: '意图分析', order: 0 },
  { id: 'lane-retrieval', type: 'retrieval', label: '多源检索', order: 1 },
  { id: 'lane-evaluation', type: 'evaluation', label: '多智能体评分', order: 2 },
  { id: 'lane-resolution', type: 'resolution', label: '辩论 & 仲裁', order: 3 },
  { id: 'lane-output', type: 'output', label: '报告输出', order: 4 },
]

// ── 工具名格式化 ──

function formatToolLabel(toolId: string): string {
  return toolId
    .replace(/^(search_|score_|analyze_|run_|compile_)/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ── Store ──

export const useAgenticCanvasStore = create<AgenticCanvasStoreState>((set, get) => ({
  view: 'execution',
  collapsedLanes: {},
  filterEnabledOnly: false,
  filterHitOnly: false,
  filterErrorOnly: false,
  highlightLane: null,
  selectedNodeId: null,
  linkToDebugPanel: false,
  runId: null,

  setView: (view) => set({ view }),
  toggleLaneCollapsed: (laneId) => set(s => ({
    collapsedLanes: { ...s.collapsedLanes, [laneId]: !s.collapsedLanes[laneId] },
  })),
  setFilterEnabledOnly: (v) => set({ filterEnabledOnly: v }),
  setFilterHitOnly: (v) => set({ filterHitOnly: v }),
  setFilterErrorOnly: (v) => set({ filterErrorOnly: v }),
  setHighlightLane: (lane) => set({ highlightLane: lane }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId, linkToDebugPanel: true }),
  setRunId: (id) => set({ runId: id }),
  consumeLinkSignal: () => set({ linkToDebugPanel: false }),
  resetFilters: () => set({
    filterEnabledOnly: false,
    filterHitOnly: false,
    filterErrorOnly: false,
    highlightLane: null,
  }),

  computeViewModel: () => {
    const state = get()
    const configStore = useAgenticConfigStore.getState()
    const debugStore = useDebugStore.getState()

    const localTools = configStore.localTools
    const agenticTrace = debugStore.agenticTrace
    const nodeCache = debugStore.nodeCache

    // ── 构建运行态索引 ──

    const traceByTool: Record<string, AgenticTraceStep[]> = {}
    for (const step of agenticTrace) {
      if (step.tool) {
        if (!traceByTool[step.tool]) traceByTool[step.tool] = []
        traceByTool[step.tool].push(step)
      }
    }

    const cacheByNode: Record<string, NodeRunCache> = nodeCache

    // ── 构建活动路径 ──

    const activePath: ActivePathEntry[] = []
    for (const step of agenticTrace) {
      if (step.tool && (step.type === 'tool_call_start' || step.type === 'tool_call_done')) {
        activePath.push({
          nodeId: step.tool,
          stepIndex: step.step_index,
          timestamp: step.timestamp,
          status: step.type === 'tool_call_start' ? 'running' : (step.status === 'error' ? 'error' : 'done'),
        })
      }
    }

    // ── 构建节点 ──

    const allNodes: AgenticCanvasNode[] = localTools.map((tool, idx) => {
      const lane = TOOL_LANE_MAP[tool.id] || 'retrieval'
      const traces = traceByTool[tool.id] || []
      const cache = cacheByNode[tool.id]

      // 从 trace 中提取运行态
      const lastStart = [...traces].reverse().find(s => s.type === 'tool_call_start')
      const lastDone = [...traces].reverse().find(s => s.type === 'tool_call_done')

      let runtime: AgenticCanvasNode['runtime'] = undefined
      if (traces.length > 0 || cache) {
        const called = traces.length > 0
        const status: AgenticNodeRuntimeStatus = lastStart && !lastDone
          ? 'running'
          : lastDone?.status === 'error' ? 'error'
          : called ? 'done' : 'idle'

        runtime = {
          called,
          stepIndex: lastStart?.step_index ?? lastDone?.step_index,
          status,
          durationMs: lastDone?.duration_ms ?? cache?.duration_ms,
          inputTokens: lastDone?.input_tokens,
          outputTokens: lastDone?.output_tokens,
          resultPreview: lastDone?.resultPreview ?? (cache?.outputs ? JSON.stringify(cache.outputs).slice(0, 120) : undefined),
          errorPreview: lastDone?.status === 'error' ? lastDone.resultPreview : cache?.error,
          lastRunAt: lastDone?.timestamp ?? cache?.timestamp,
        }
      }

      return {
        id: tool.id,
        kind: tool.id.startsWith('run_') ? 'condition' : 'tool',
        group: tool.group,
        lane,
        label: formatToolLabel(tool.id),
        description: tool.description,
        enabled: tool.enabled,
        staticOrder: idx,
        runtime,
      }
    })

    // ── 补充固定节点 ──

    // Intent 入口节点
    if (!allNodes.find(n => n.id === 'analyze_intent')) {
      allNodes.push({
        id: 'analyze_intent',
        kind: 'stage',
        group: 'intent',
        lane: 'intent',
        label: '意图分析',
        description: '解析用户查询意图',
        enabled: true,
        staticOrder: -1,
      })
    }

    // Output 出口节点
    if (!allNodes.find(n => n.id === 'compile_report')) {
      allNodes.push({
        id: 'compile_report',
        kind: 'output',
        group: 'arbitration',
        lane: 'output',
        label: '报告编译',
        description: '确定性组装最终报告',
        enabled: true,
        staticOrder: 999,
      })
    }

    // ── 应用筛选 ──

    let filteredNodes = allNodes
    if (state.filterEnabledOnly) filteredNodes = filteredNodes.filter(n => n.enabled)
    if (state.filterHitOnly) filteredNodes = filteredNodes.filter(n => n.runtime?.called)
    if (state.filterErrorOnly) filteredNodes = filteredNodes.filter(n => n.runtime?.status === 'error')
    if (state.highlightLane) filteredNodes = filteredNodes.filter(n => n.lane === state.highlightLane)

    // ── 组装泳道 ──

    const lanes: AgenticLane[] = LANE_META.map(meta => ({
      id: meta.id,
      label: meta.label,
      type: meta.type,
      order: meta.order,
      collapsed: state.collapsedLanes[meta.id] ?? false,
      nodes: filteredNodes
        .filter(n => n.lane === meta.type)
        .sort((a, b) => a.staticOrder - b.staticOrder),
    }))

    // ── 运行摘要 ──

    let lastRunSummary: RunSummary | undefined = undefined
    if (agenticTrace.length > 0) {
      const toolStarts = agenticTrace.filter(s => s.type === 'tool_call_start')
      const toolDones = agenticTrace.filter(s => s.type === 'tool_call_done')
      const usedTools = [...new Set(toolStarts.map(s => s.tool!).filter(Boolean))]
      const errorTools = [...new Set(toolDones.filter(s => s.status === 'error').map(s => s.tool!).filter(Boolean))]
      const allEnabled = localTools.filter(t => t.enabled).map(t => t.id)
      const skippedTools = allEnabled.filter(id => !usedTools.includes(id))

      lastRunSummary = {
        totalSteps: agenticTrace.length,
        totalDurationMs: toolDones.reduce((sum, s) => sum + (s.duration_ms ?? 0), 0),
        totalInputTokens: toolDones.reduce((sum, s) => sum + (s.input_tokens ?? 0), 0),
        totalOutputTokens: toolDones.reduce((sum, s) => sum + (s.output_tokens ?? 0), 0),
        usedTools,
        skippedTools,
        errorTools,
      }
    }

    // ── Orchestrator 摘要 ──

    const orchestrator = {
      temperature: configStore.localTemperature,
      maxIterations: configStore.localMaxIterations,
      enabledCount: localTools.filter(t => t.enabled).length,
      totalCount: localTools.length,
      systemPromptLength: configStore.localPrompt.length,
    }

    return {
      runId: state.runId,
      view: state.view,
      lanes,
      activePath,
      lastRunSummary,
      orchestrator,
    }
  },
}))
