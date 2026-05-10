/**
 * P10b: AgenticCanvas — Execution-First 分层泳道画布
 *
 * 废弃星型拓扑，改为左到右阶段泳道布局：
 *   - 顶部: 总控条（Orchestrator 参数摘要）
 *   - 主体: 5 条阶段泳道（Intent → Retrieval → Evaluation → Resolution → Output）
 *   - 节点: 工具卡片，叠加运行态（status/duration/tokens）
 *   - 连线: 阶段间流转 + 条件分支
 *
 * 数据源: agenticCanvasStore（统一 ViewModel）
 * 视图: Execution（默认）/ Architecture / Compare
 */

import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import {
  Cpu,
  Search,
  Brain,
  Gavel,
  Target,
  Check,
  X,
  Thermometer,
  ChevronRight,
  ChevronDown,
  Play,
  LayoutGrid,
  GitCompare,
  Filter,
  Clock,
  Zap,
  AlertTriangle,
  SkipForward,
  FileOutput,
  Timer,
  Hash,
} from 'lucide-react'
import { useAgenticConfigStore } from '@/lib/agenticConfigStore'
import { useAgenticCanvasStore, type AgenticCanvasNode, type AgenticLaneType, type AgenticCanvasView } from '@/lib/agenticCanvasStore'
import { useDebugStore } from '@/lib/debugStore'
import { useAnalysis } from '@/hooks/useAnalysis'

// ── 阶段配色 ──

const LANE_COLORS: Record<AgenticLaneType, string> = {
  intent: '#3B82F6',
  retrieval: '#10B981',
  evaluation: '#F59E0B',
  resolution: '#8B5CF6',
  output: '#6366F1',
}

const LANE_ICONS: Record<AgenticLaneType, typeof Cpu> = {
  intent: Target,
  retrieval: Search,
  evaluation: Brain,
  resolution: Gavel,
  output: FileOutput,
}

const LANE_LABELS: Record<AgenticLaneType, string> = {
  intent: '意图分析',
  retrieval: '多源检索',
  evaluation: '多智能体评分',
  resolution: '辩论 & 仲裁',
  output: '报告输出',
}

const LANE_ORDER: AgenticLaneType[] = ['intent', 'retrieval', 'evaluation', 'resolution', 'output']

// ── 运行态状态色 ──

function runtimeStatusColor(status?: string): string {
  if (status === 'running') return '#3B82F6'
  if (status === 'done') return '#10B981'
  if (status === 'error') return '#DC2626'
  if (status === 'skipped') return '#9CA3AF'
  return 'var(--novo-text-muted)'
}

function runtimeStatusIcon(status?: string) {
  if (status === 'running') return Clock
  if (status === 'done') return Check
  if (status === 'error') return AlertTriangle
  if (status === 'skipped') return SkipForward
  return null
}

// ── 工具卡片 ──

function ToolCard({ node, selected, onClick }: { node: AgenticCanvasNode; selected: boolean; onClick: () => void }) {
  const toggleTool = useAgenticConfigStore(s => s.toggleTool)
  const laneColor = LANE_COLORS[node.lane]
  const LaneIcon = LANE_ICONS[node.lane]
  const StatusIcon = runtimeStatusIcon(node.runtime?.status)
  const isRunning = node.runtime?.status === 'running'

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (node.kind === 'tool') toggleTool(node.id)
  }, [node.id, node.kind, toggleTool])

  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={`rounded-lg px-2.5 py-2 transition-all cursor-pointer ${isRunning ? 'animate-pulse' : ''}`}
      style={{
        width: 150,
        background: selected
          ? `color-mix(in srgb, ${laneColor} 15%, var(--novo-bg-elevated))`
          : node.enabled
            ? 'var(--novo-bg-elevated)'
            : 'var(--novo-bg-surface)',
        border: `1.5px solid ${
          selected ? laneColor
          : node.runtime?.status === 'error' ? '#DC2626'
          : node.enabled ? `color-mix(in srgb, ${laneColor} 40%, var(--novo-border-default))`
          : 'var(--novo-border-default)'
        }`,
        opacity: node.enabled ? 1 : 0.4,
        boxShadow: selected ? `0 0 0 2px color-mix(in srgb, ${laneColor} 25%, transparent)` : 'none',
      }}
    >
      {/* 标题行 */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <div
          className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
          style={{ background: node.enabled ? laneColor : 'var(--novo-bg-active)' }}
        >
          {node.enabled
            ? <LaneIcon className="w-2 h-2 text-white" />
            : <X className="w-2 h-2" style={{ color: 'var(--novo-text-disabled)' }} />
          }
        </div>
        <span className="text-[9px] font-bold truncate" style={{ color: node.enabled ? 'var(--novo-text-primary)' : 'var(--novo-text-disabled)' }}>
          {node.label}
        </span>
        {/* 运行态徽章 */}
        {StatusIcon && (
          <StatusIcon className="w-2.5 h-2.5 ml-auto shrink-0" style={{ color: runtimeStatusColor(node.runtime?.status) }} />
        )}
        {node.kind === 'condition' && node.enabled && (
          <Zap className="w-2.5 h-2.5 ml-0.5 shrink-0" style={{ color: '#F59E0B' }} />
        )}
      </div>

      {/* 描述 */}
      <div className="text-[7px] truncate mb-1" style={{ color: 'var(--novo-text-muted)' }}>
        {node.description}
      </div>

      {/* 运行态信息 */}
      {node.runtime?.called && (
        <div className="flex items-center gap-2 text-[7px]" style={{ color: 'var(--novo-text-secondary)' }}>
          {node.runtime.durationMs != null && (
            <span className="flex items-center gap-0.5">
              <Timer className="w-2 h-2" />
              {node.runtime.durationMs >= 1000 ? `${(node.runtime.durationMs / 1000).toFixed(1)}s` : `${node.runtime.durationMs}ms`}
            </span>
          )}
          {node.runtime.stepIndex != null && (
            <span className="flex items-center gap-0.5">
              <Hash className="w-2 h-2" />
              #{node.runtime.stepIndex}
            </span>
          )}
          {node.runtime.errorPreview && (
            <span className="truncate" style={{ color: '#DC2626' }}>{node.runtime.errorPreview}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── 泳道 ──

function LaneView({
  laneType,
  nodes,
  collapsed,
  onToggleCollapse,
  selectedNodeId,
  onSelectNode,
  isActive,
  isPast,
  isFuture,
}: {
  laneType: AgenticLaneType
  nodes: AgenticCanvasNode[]
  collapsed: boolean
  onToggleCollapse: () => void
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
  isActive?: boolean
  isPast?: boolean
  isFuture?: boolean
}) {
  const color = LANE_COLORS[laneType]
  const Icon = LANE_ICONS[laneType]
  const label = LANE_LABELS[laneType]
  const runningCount = nodes.filter(n => n.runtime?.status === 'running').length
  const doneCount = nodes.filter(n => n.runtime?.status === 'done').length
  const errorCount = nodes.filter(n => n.runtime?.status === 'error').length

  return (
    <div className="flex flex-col" style={{ minWidth: collapsed ? 48 : 170 }}>
      {/* 泳道头 */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-t-lg shrink-0 transition-all"
        style={{
          background: isActive
            ? `color-mix(in srgb, ${color} 15%, var(--novo-bg-base))`
            : `color-mix(in srgb, ${color} 8%, var(--novo-bg-base))`,
          borderBottom: `2px solid ${color}`,
          boxShadow: isActive ? `0 2px 8px color-mix(in srgb, ${color} 20%, transparent)` : 'none',
        }}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" style={{ color }} />
        ) : (
          <ChevronDown className="w-3 h-3" style={{ color }} />
        )}
        <Icon className="w-3 h-3" style={{ color }} />
        {!collapsed && (
          <>
            <span className="text-[9px] font-bold" style={{ color }}>{label}</span>
            <span className="text-[7px] ml-auto" style={{ color: 'var(--novo-text-muted)' }}>
              {nodes.length} 节点
              {runningCount > 0 && <span style={{ color: '#3B82F6' }}> · {runningCount} 运行</span>}
              {errorCount > 0 && <span style={{ color: '#DC2626' }}> · {errorCount} 异常</span>}
            </span>
          </>
        )}
      </button>

      {/* 节点列表 */}
      {!collapsed && (
        <div
          className="flex-1 px-1.5 py-2 space-y-1.5 overflow-y-auto transition-opacity"
          style={{
            background: `color-mix(in srgb, ${color} 3%, var(--novo-bg-base))`,
            opacity: isFuture ? 0.45 : 1,
          }}
        >
          {nodes.length === 0 ? (
            <div className="text-[8px] text-center py-4" style={{ color: 'var(--novo-text-disabled)' }}>—</div>
          ) : (
            nodes.map(node => (
              <ToolCard
                key={node.id}
                node={node}
                selected={selectedNodeId === node.id}
                onClick={() => onSelectNode(node.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── 总控条 ──

function ControlRail() {
  const vm = useAgenticCanvasStore(s => s.computeViewModel())
  const orch = vm.orchestrator

  return (
    <div
      className="flex items-center gap-3 px-3 py-1.5 shrink-0"
      style={{ background: 'var(--novo-bg-elevated)', borderBottom: '1px solid var(--novo-border-default)' }}
    >
      <div className="flex items-center gap-1.5">
        <Cpu className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
        <span className="text-[10px] font-bold" style={{ color: 'var(--novo-text-primary)' }}>Orchestrator</span>
      </div>
      <div className="flex items-center gap-1">
        <Thermometer className="w-2.5 h-2.5" style={{ color: 'var(--novo-text-muted)' }} />
        <span className="text-[8px] font-mono" style={{ color: 'var(--novo-text-secondary)' }}>{orch.temperature}</span>
      </div>
      <div className="text-[8px]" style={{ color: 'var(--novo-text-muted)' }}>
        {orch.enabledCount}/{orch.totalCount} 启用
      </div>
      {vm.lastRunSummary && (
        <>
          <div className="w-px h-3" style={{ background: 'var(--novo-border-default)' }} />
          <div className="text-[8px]" style={{ color: 'var(--novo-text-secondary)' }}>
            {vm.lastRunSummary.totalSteps} 步 · {(vm.lastRunSummary.totalDurationMs / 1000).toFixed(1)}s
          </div>
          {vm.lastRunSummary.errorTools.length > 0 && (
            <div className="text-[8px]" style={{ color: '#DC2626' }}>
              {vm.lastRunSummary.errorTools.length} 异常
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── 视图切换工具栏 ──

function CanvasToolbar() {
  const { view, setView, filterEnabledOnly, setFilterEnabledOnly, filterHitOnly, setFilterHitOnly, filterErrorOnly, setFilterErrorOnly, resetFilters } = useAgenticCanvasStore()

  const views: Array<{ key: AgenticCanvasView; label: string; icon: typeof Cpu }> = [
    { key: 'execution', label: '执行流', icon: Play },
    { key: 'architecture', label: '架构', icon: LayoutGrid },
    { key: 'compare', label: '对比', icon: GitCompare },
  ]

  const hasFilter = filterEnabledOnly || filterHitOnly || filterErrorOnly

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1 shrink-0"
      style={{ background: 'var(--novo-bg-elevated)', borderBottom: '1px solid var(--novo-border-default)' }}
    >
      {views.map(v => (
        <button
          key={v.key}
          onClick={() => setView(v.key)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold transition-colors"
          style={{
            background: view === v.key ? 'var(--novo-bg-hover)' : 'transparent',
            color: view === v.key ? '#7C3AED' : 'var(--novo-text-muted)',
          }}
        >
          <v.icon className="w-3 h-3" />
          {v.label}
        </button>
      ))}

      <div className="w-px h-4 mx-1" style={{ background: 'var(--novo-border-default)' }} />

      {/* 筛选器 */}
      <button
        onClick={() => setFilterEnabledOnly(!filterEnabledOnly)}
        className="px-1.5 py-0.5 rounded text-[8px]"
        style={{ background: filterEnabledOnly ? 'var(--novo-bg-hover)' : 'transparent', color: filterEnabledOnly ? '#10B981' : 'var(--novo-text-muted)' }}
      >
        仅启用
      </button>
      <button
        onClick={() => setFilterHitOnly(!filterHitOnly)}
        className="px-1.5 py-0.5 rounded text-[8px]"
        style={{ background: filterHitOnly ? 'var(--novo-bg-hover)' : 'transparent', color: filterHitOnly ? '#3B82F6' : 'var(--novo-text-muted)' }}
      >
        仅命中
      </button>
      <button
        onClick={() => setFilterErrorOnly(!filterErrorOnly)}
        className="px-1.5 py-0.5 rounded text-[8px]"
        style={{ background: filterErrorOnly ? 'var(--novo-bg-hover)' : 'transparent', color: filterErrorOnly ? '#DC2626' : 'var(--novo-text-muted)' }}
      >
        仅异常
      </button>
      {hasFilter && (
        <button onClick={resetFilters} className="px-1.5 py-0.5 rounded text-[8px]" style={{ color: 'var(--novo-text-secondary)' }}>
          清除
        </button>
      )}
    </div>
  )
}

// ── 计算活动泳道（当前执行路径中最靠后的阶段） ──

function computeActiveLane(vm: { activePath: Array<{ nodeId: string; status: string }> }): AgenticLaneType | null {
  if (vm.activePath.length === 0) return null
  // 从活动路径中找出最靠后的 lane
  const lastActive = vm.activePath[vm.activePath.length - 1]
  const toolLaneMap: Record<string, AgenticLaneType> = {
    analyze_intent: 'intent',
    search_openalex: 'retrieval', search_arxiv: 'retrieval', search_brave: 'retrieval',
    search_github: 'retrieval', search_crossref: 'retrieval', search_patents: 'retrieval',
    score_academic_scorer: 'evaluation', score_industry_analyst: 'evaluation', score_competitor_detective: 'evaluation',
    run_debate: 'resolution', run_arbitration: 'resolution',
    compile_report: 'output',
  }
  return toolLaneMap[lastActive.nodeId] ?? null
}

// ── 主组件 ──

export default function AgenticCanvas() {
  const configStore = useAgenticConfigStore()
  const canvasStore = useAgenticCanvasStore()
  const debugStore = useDebugStore()
  const { state: analysisState } = useAnalysis()

  // 订阅 debugStore 变化以触发重渲染
  const traceLen = debugStore.agenticTrace.length
  const cacheLen = Object.keys(debugStore.nodeCache).length

  const { view, collapsedLanes, selectedNodeId, toggleLaneCollapsed, selectNode, setRunId } = canvasStore

  // 计算 ViewModel
  const vm = useMemo(() => canvasStore.computeViewModel(), [
    configStore.localTools,
    configStore.localTemperature,
    configStore.localMaxIterations,
    traceLen,
    cacheLen,
    view,
    collapsedLanes,
    canvasStore.filterEnabledOnly,
    canvasStore.filterHitOnly,
    canvasStore.filterErrorOnly,
    canvasStore.highlightLane,
    selectedNodeId,
  ])

  // P3: 同步 threadId → runId
  useEffect(() => {
    setRunId(analysisState.threadId)
  }, [analysisState.threadId, setRunId])

  // P3: 计算活动泳道
  const activeLane = useMemo(() => computeActiveLane(vm), [vm.activePath])

  // 初始化配置
  useEffect(() => {
    if (!configStore.config && !configStore.loading) configStore.fetchConfig()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (configStore.loading && configStore.localTools.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--novo-bg-base)' }}>
        <div className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>加载 Agentic 智能体配置...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--novo-bg-base)' }}>
      {/* 总控条 */}
      <ControlRail />

      {/* 视图切换 + 筛选 */}
      <CanvasToolbar />

      {/* 泳道主体 */}
      <div className="flex-1 flex overflow-x-auto">
        {vm.lanes.map((lane, idx) => {
          const isActive = activeLane === lane.type
          const isBeforeActive = activeLane != null && LANE_ORDER.indexOf(lane.type) < LANE_ORDER.indexOf(activeLane)
          const isAfterActive = activeLane != null && LANE_ORDER.indexOf(lane.type) > LANE_ORDER.indexOf(activeLane)

          return (
            <div key={lane.id} className="flex">
              <LaneView
                laneType={lane.type}
                nodes={lane.nodes}
                collapsed={lane.collapsed}
                onToggleCollapse={() => toggleLaneCollapsed(lane.id)}
                selectedNodeId={selectedNodeId}
                onSelectNode={selectNode}
                isActive={isActive}
                isPast={isBeforeActive}
                isFuture={isAfterActive}
              />
              {/* 阶段间连线指示 — 活动路径高亮 */}
              {idx < vm.lanes.length - 1 && (
                <div className="flex items-center px-0.5">
                  <ChevronRight
                    className="w-3 h-3 transition-colors"
                    style={{
                      color: isBeforeActive ? LANE_COLORS[activeLane!] : 'var(--novo-text-disabled)',
                      opacity: isBeforeActive ? 0.7 : 0.3,
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 底部图例 */}
      <div
        className="flex items-center gap-3 px-3 py-1 shrink-0"
        style={{ background: 'var(--novo-bg-elevated)', borderTop: '1px solid var(--novo-border-default)' }}
      >
        {Object.entries(LANE_COLORS).map(([lane, color]) => (
          <div key={lane} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[8px]" style={{ color: 'var(--novo-text-muted)' }}>
              {LANE_LABELS[lane as AgenticLaneType]}
            </span>
          </div>
        ))}
        <div className="w-px h-3" style={{ background: 'var(--novo-border-default)' }} />
        <div className="text-[8px]" style={{ color: 'var(--novo-text-disabled)' }}>
          右键切换启用 · 点击选中
        </div>
      </div>
    </div>
  )
}
