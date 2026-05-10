/**
 * Phase S5: AgenticDebugPanel — Agentic 智能体工作流调试面板
 *
 * 对标 Dify 的 Agent 调试功能：
 *   - 决策轨迹可视化（Agent 思考链）
 *   - 工具链诊断（每次工具调用的输入/输出/耗时）
 *   - Token 流实时预览
 *   - 两次运行对比（变量差异高亮）
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Brain, Wrench, MessageSquare, Clock, ChevronRight, ChevronDown,
  AlertCircle, Check, Loader2, GitCompare, Trash2, BarChart3, Search, X,
} from 'lucide-react'
import { fetchAgenticRuntime, type AgenticRuntimeState } from '@/lib/api'
import { useDebugStore, type NodeRunCache } from '@/lib/debugStore'
import type { AnalysisState } from '@/hooks/useAnalysis'

// ── 类型 ──

interface AgenticStep {
  key: string
  type: 'thinking' | 'tool_call' | 'tool_result' | 'output'
  timestamp: number
  tool?: string
  node?: string
  argsPreview?: string
  resultPreview?: string
  tokens?: string
  duration_ms?: number
  status?: 'running' | 'done' | 'completed' | 'error' | 'paused'
  source?: 'stream' | 'runtime' | 'runner'
  eventType?: string
  stepIndex?: number
}

interface RuntimeEventView {
  key: string
  type: string
  data: unknown
  timestamp: number | null
  timestampMs: number | null
  dataText: string
  dataPreview: string
  summary: string
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  tool: string | null
  linkMode: 'trace' | 'tools' | null
  searchableText: string
  stepIndex?: number
}

// ── 工具诊断行 ──

function ToolDiagRow({ step, index }: { step: AgenticStep; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="border-b last:border-b-0"
      style={{ borderColor: 'var(--novo-border-default)' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[var(--novo-bg-hover)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--novo-text-muted)' }} />
          : <ChevronRight className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--novo-text-muted)' }} />
        }
        <span className="text-[9px] font-mono w-5 shrink-0" style={{ color: 'var(--novo-text-disabled)' }}>
          #{index + 1}
        </span>
        {step.type === 'thinking' && <Brain className="w-3 h-3 shrink-0" style={{ color: '#7C3AED' }} />}
        {step.type === 'tool_call' && <Wrench className="w-3 h-3 shrink-0" style={{ color: '#2563EB' }} />}
        {step.type === 'tool_result' && <Check className="w-3 h-3 shrink-0" style={{ color: '#16A34A' }} />}
        {step.type === 'output' && <MessageSquare className="w-3 h-3 shrink-0" style={{ color: '#EA580C' }} />}
        <span className="text-[10px] font-semibold truncate flex-1" style={{ color: 'var(--novo-text-primary)' }}>
          {step.type === 'thinking' && 'Agent 思考'}
          {step.type === 'tool_call' && `调用 ${step.tool}`}
          {step.type === 'tool_result' && `${step.tool} 返回`}
          {step.type === 'output' && '最终输出'}
        </span>
        {step.duration_ms !== undefined && (
          <span className="text-[9px]" style={{ color: 'var(--novo-text-muted)' }}>
            {step.duration_ms}ms
          </span>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-2 pl-8">
          {step.argsPreview && (
            <div className="mb-1">
              <div className="text-[8px] uppercase font-semibold mb-0.5" style={{ color: 'var(--novo-accent-primary)' }}>
                输入参数
              </div>
              <pre className="text-[9px] font-mono px-2 py-1 rounded max-h-[60px] overflow-auto"
                style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)' }}>
                {step.argsPreview}
              </pre>
            </div>
          )}
          {step.resultPreview && (
            <div className="mb-1">
              <div className="text-[8px] uppercase font-semibold mb-0.5" style={{ color: 'var(--novo-accent-success)' }}>
                返回结果
              </div>
              <pre className="text-[9px] font-mono px-2 py-1 rounded max-h-[80px] overflow-auto"
                style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)' }}>
                {step.resultPreview}
              </pre>
            </div>
          )}
          {step.tokens && (
            <div>
              <div className="text-[8px] uppercase font-semibold mb-0.5" style={{ color: '#7C3AED' }}>
                思考内容
              </div>
              <pre className="text-[9px] font-mono px-2 py-1 rounded max-h-[100px] overflow-auto whitespace-pre-wrap"
                style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-secondary)' }}>
                {step.tokens}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 变量差异对比 ──

function DiffView({ left, right }: { left: NodeRunCache | undefined; right: NodeRunCache | undefined }) {
  const allKeys = useMemo(() => {
    const keys = new Set<string>()
    if (left?.outputs) Object.keys(left.outputs).forEach(k => keys.add(k))
    if (right?.outputs) Object.keys(right.outputs).forEach(k => keys.add(k))
    return Array.from(keys)
  }, [left, right])

  if (allKeys.length === 0) {
    return (
      <div className="text-[9px] py-3 text-center" style={{ color: 'var(--novo-text-disabled)' }}>
        无变量数据可对比
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {allKeys.map(key => {
        const lv = left?.outputs?.[key]
        const rv = right?.outputs?.[key]
        const lStr = lv !== undefined ? (typeof lv === 'string' ? lv : JSON.stringify(lv)) : '—'
        const rStr = rv !== undefined ? (typeof rv === 'string' ? rv : JSON.stringify(rv)) : '—'
        const isDiff = lStr !== rStr

        return (
          <div key={key} className="rounded-lg px-2 py-1.5" style={{
            background: isDiff ? 'rgba(251,191,36,0.06)' : 'var(--novo-bg-surface)',
            border: isDiff ? '1px solid rgba(251,191,36,0.3)' : '1px solid var(--novo-border-default)',
          }}>
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[9px] font-mono font-semibold" style={{ color: 'var(--novo-text-secondary)' }}>{key}</span>
              {isDiff && <span className="text-[7px] px-1 py-0.5 rounded-full" style={{ background: '#FBBF24', color: '#92400E' }}>差异</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <pre className="text-[8px] font-mono max-h-[40px] overflow-auto" style={{ color: 'var(--novo-text-muted)' }}>
                {lStr.length > 80 ? lStr.slice(0, 80) + '…' : lStr}
              </pre>
              <pre className="text-[8px] font-mono max-h-[40px] overflow-auto" style={{ color: 'var(--novo-text-muted)' }}>
                {rStr.length > 80 ? rStr.slice(0, 80) + '…' : rStr}
              </pre>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 子 Tab ──

type SubTab = 'runtime' | 'trace' | 'tools' | 'tokens' | 'compare'

function formatRuntimeTimestamp(value: number | null | undefined) {
  if (value == null) return '—'
  const ms = value > 1e12 ? value : value * 1000
  return new Date(ms).toLocaleString('zh-CN', { hour12: false })
}

function stringifyRuntimeValue(value: unknown) {
  if (value == null) return '—'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function statusColor(status: string | null | undefined) {
  if (status === 'completed') return '#16A34A'
  if (status === 'paused') return '#D97706'
  if (status === 'error') return '#DC2626'
  if (status === 'running') return '#2563EB'
  return 'var(--novo-text-muted)'
}

function toRuntimeMs(value: number | null | undefined) {
  if (value == null) return null
  return value > 1e12 ? value : value * 1000
}

function compactText(value: string, max = 120) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return '—'
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized
}

function runtimeEventTone(type: string): RuntimeEventView['tone'] {
  if (type === 'error' || type === 'aborted') return 'danger'
  if (type === 'paused') return 'warning'
  if (type === 'completed' || type === 'tool_call_done') return 'success'
  if (type === 'tool_call_start' || type === 'resumed') return 'info'
  return 'neutral'
}

function runtimeEventSummary(type: string, data: unknown, fallback: string) {
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : null
  if (type === 'tool_call_start') {
    const tool = typeof record?.tool === 'string' ? record.tool : '工具'
    const argsPreview = typeof record?.args_preview === 'string' ? compactText(record.args_preview, 72) : null
    return argsPreview ? `开始调用 ${tool} · ${argsPreview}` : `开始调用 ${tool}`
  }
  if (type === 'tool_call_done') {
    const tool = typeof record?.tool === 'string' ? record.tool : '工具'
    const duration = typeof record?.duration_ms === 'number' ? `${record.duration_ms}ms` : null
    return duration ? `${tool} 已完成 · ${duration}` : `${tool} 已完成`
  }
  if (type === 'paused') {
    const target = typeof record?.pause_target === 'string' ? record.pause_target : '未知目标'
    const phase = typeof record?.pause_phase === 'string' ? record.pause_phase : 'paused'
    return `已暂停 · ${target} · ${phase}`
  }
  if (type === 'resumed') {
    const action = typeof record?.action === 'string'
      ? record.action
      : typeof record?.reason === 'string'
        ? record.reason
        : '继续执行'
    return `恢复执行 · ${action}`
  }
  if (type === 'completed') return '线程已完成'
  if (type === 'created') return '线程已创建'
  if (type === 'aborted') {
    const reason = typeof record?.reason === 'string' ? compactText(record.reason, 80) : null
    return reason ? `线程已中止 · ${reason}` : '线程已中止'
  }
  if (type === 'error') {
    const message = typeof record?.message === 'string' ? compactText(record.message, 96) : null
    return message ? `运行出错 · ${message}` : '运行出错'
  }
  return fallback
}

function runtimeToneStyle(tone: RuntimeEventView['tone']) {
  if (tone === 'danger') {
    return { background: 'rgba(220,38,38,0.10)', color: '#DC2626', border: 'rgba(220,38,38,0.22)' }
  }
  if (tone === 'warning') {
    return { background: 'rgba(217,119,6,0.10)', color: '#D97706', border: 'rgba(217,119,6,0.22)' }
  }
  if (tone === 'success') {
    return { background: 'rgba(22,163,74,0.10)', color: '#16A34A', border: 'rgba(22,163,74,0.22)' }
  }
  if (tone === 'info') {
    return { background: 'rgba(37,99,235,0.10)', color: '#2563EB', border: 'rgba(37,99,235,0.22)' }
  }
  return { background: 'var(--novo-bg-hover)', color: 'var(--novo-text-secondary)', border: 'var(--novo-border-default)' }
}

// ── 主组件 ──

export default function AgenticDebugPanel({ analysisState }: { analysisState: AnalysisState }) {
  const { nodeCache, runHistory, agenticTrace, clearTrace } = useDebugStore()
  const [subTab, setSubTab] = useState<SubTab>('runtime')
  const [compareNodeId, setCompareNodeId] = useState<string | null>(null)
  const [compareRunIdx, setCompareRunIdx] = useState(0)
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<AgenticRuntimeState | null>(null)
  const [runtimeLoading, setRuntimeLoading] = useState(false)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [runtimeEventTypeFilter, setRuntimeEventTypeFilter] = useState('all')
  const [runtimeEventQuery, setRuntimeEventQuery] = useState('')

  useEffect(() => {
    setRuntimeSnapshot(null)
    setRuntimeError(null)
    setRuntimeEventTypeFilter('all')
    setRuntimeEventQuery('')
  }, [analysisState.threadId])

  const runtimeState = useMemo(() => {
    if (!runtimeSnapshot) return analysisState.runtimeState
    if (!analysisState.runtimeState) return runtimeSnapshot
    if (runtimeSnapshot.thread_id !== analysisState.runtimeState.thread_id) return analysisState.runtimeState
    return (runtimeSnapshot.updated_at ?? 0) >= (analysisState.runtimeState.updated_at ?? 0)
      ? runtimeSnapshot
      : analysisState.runtimeState
  }, [analysisState.runtimeState, runtimeSnapshot])

  const runtimeStatus = analysisState.phase === 'error'
    ? 'error'
    : analysisState.phase === 'running'
      ? 'running'
      : runtimeState?.status ?? (analysisState.phase === 'awaiting_confirmation' ? 'paused' : analysisState.phase)
  const runtimePauseTarget = analysisState.phase === 'running'
    ? null
    : analysisState.pauseTarget ?? runtimeState?.pause_target ?? null
  const runtimePausePhase = analysisState.phase === 'running'
    ? null
    : analysisState.pausePhase ?? runtimeState?.pause_phase ?? null
  const runtimeWaitingFor = analysisState.phase === 'running'
    ? null
    : analysisState.waitingFor ?? runtimeState?.waiting_for ?? null
  const runtimeEvents = runtimeState?.events ?? []
  const runtimeErrorMessage = runtimeState?.error ?? analysisState.error ?? runtimeError
  const runtimeEventViews = useMemo<RuntimeEventView[]>(() => {
    return runtimeEvents.slice().reverse().map((event, index) => {
      const eventRecord = event as Record<string, unknown>
      const eventType = typeof eventRecord.type === 'string' ? eventRecord.type : 'unknown'
      const eventData = eventRecord.data
      const eventTimestamp = typeof eventRecord.timestamp === 'number' ? eventRecord.timestamp : null
      const tsMs = toRuntimeMs(eventTimestamp)
      const dataText = stringifyRuntimeValue(eventData)
      const dataPreview = compactText(dataText, 160)
      const tone = runtimeEventTone(eventType)
      const tool = typeof (eventData as Record<string, unknown>)?.tool === 'string'
        ? (eventData as Record<string, unknown>).tool as string
        : null
      const linkMode: RuntimeEventView['linkMode'] = (eventType === 'tool_call_start' || eventType === 'tool_call_done') ? 'trace' : null
      const summary = runtimeEventSummary(eventType, eventData, dataPreview)
      return {
        key: `${eventType}-${eventTimestamp ?? index}-${index}`,
        type: eventType,
        data: eventData,
        timestamp: eventTimestamp,
        timestampMs: tsMs,
        dataText,
        dataPreview,
        summary,
        tone,
        tool,
        linkMode,
        searchableText: `${eventType}\n${tool ?? ''}\n${summary}\n${dataText}`.toLowerCase(),
        stepIndex: index,
      }
    })
  }, [runtimeEvents])
  const runtimeEventTypeOptions = useMemo(() => {
    return Array.from(new Set(runtimeEventViews.map(event => event.type))).sort((a, b) => a.localeCompare(b))
  }, [runtimeEventViews])
  const runtimeEventQueryNormalized = runtimeEventQuery.trim().toLowerCase()
  const filteredRuntimeEvents = useMemo(() => {
    return runtimeEventViews.filter(event => {
      const typeMatched = runtimeEventTypeFilter === 'all' || event.type === runtimeEventTypeFilter
      const queryMatched = !runtimeEventQueryNormalized || event.searchableText.includes(runtimeEventQueryNormalized)
      return typeMatched && queryMatched
    })
  }, [runtimeEventQueryNormalized, runtimeEventTypeFilter, runtimeEventViews])

  const refreshRuntime = useCallback(async () => {
    if (!analysisState.threadId) return
    setRuntimeLoading(true)
    setRuntimeError(null)
    try {
      setRuntimeSnapshot(await fetchAgenticRuntime(analysisState.threadId))
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : String(err))
    } finally {
      setRuntimeLoading(false)
    }
  }, [analysisState.threadId])

  const handleClearTrace = useCallback(() => {
    clearTrace()
    setRuntimeSnapshot(null)
    setRuntimeError(null)
  }, [clearTrace])

  // ── 自动刷新策略 ──
  const autoRefreshActive = subTab === 'runtime' && !!analysisState.threadId && (runtimeStatus === 'running' || runtimeStatus === 'awaiting_confirmation')
  useEffect(() => {
    if (!autoRefreshActive) return
    let mounted = true
    const tick = async () => {
      if (!mounted) return
      await refreshRuntime()
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [autoRefreshActive, refreshRuntime, analysisState.threadId, runtimeStatus])

  // 页面可见性控制：切回前台时立即刷新一次
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden && autoRefreshActive) refreshRuntime()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [autoRefreshActive, refreshRuntime])

  // 优先使用结构化 agenticTrace，降级使用 nodeCache
  const traceSteps = useMemo<AgenticStep[]>(() => {
    if (agenticTrace.length > 0) {
      return agenticTrace.map((s, idx) => ({
        key: `trace-${s.step_index ?? idx}-${s.timestamp}`,
        type: s.type === 'tool_call_start' ? 'tool_call' as const
          : s.type === 'tool_call_done' ? 'tool_result' as const
          : s.type === 'final_output' ? 'output' as const
          : 'thinking' as const,
        timestamp: s.timestamp,
        tool: s.tool,
        node: s.node,
        argsPreview: s.argsPreview,
        resultPreview: s.resultPreview,
        duration_ms: s.duration_ms,
        status: s.status,
        source: s.source,
        eventType: s.eventType,
        stepIndex: s.step_index,
      }))
    }
    const steps: AgenticStep[] = []
    const entries = Object.entries(nodeCache).sort((a, b) => a[1].timestamp - b[1].timestamp)
    let stepIdx = 0
    for (const [nodeId, cache] of entries) {
      for (const log of cache.logs) {
        const isToolCall = log.includes('调用工具') || log.includes('🔧')
        const isError = log.includes('❌')
        steps.push({
          key: `runner-${nodeId}-${cache.timestamp}-${stepIdx}`,
          type: isToolCall ? 'tool_call' : isError ? 'output' : 'thinking',
          timestamp: cache.timestamp,
          node: nodeId,
          tokens: log,
          duration_ms: cache.duration_ms,
          stepIndex: stepIdx,
          tool: isToolCall ? nodeId : undefined,
        })
        stepIdx++
      }
    }
    return steps
  }, [nodeCache, agenticTrace])

  // 工具调用诊断
  const toolSteps = useMemo<AgenticStep[]>(() => {
    const steps: AgenticStep[] = []
    for (const [nodeId, cache] of Object.entries(nodeCache)) {
      if (cache.inputs && Object.keys(cache.inputs).length > 0) {
        steps.push({
          key: `tool-${nodeId}-${cache.timestamp}`,
          type: 'tool_call',
          timestamp: cache.timestamp,
          tool: nodeId,
          argsPreview: JSON.stringify(cache.inputs, null, 2).slice(0, 300),
          resultPreview: cache.outputs ? JSON.stringify(cache.outputs, null, 2).slice(0, 500) : undefined,
          duration_ms: cache.duration_ms,
        })
      }
    }
    return steps.sort((a, b) => a.timestamp - b.timestamp)
  }, [nodeCache])

  // ── 启发式联动跳转 ──
  // 使用最新 memo 结果，避免闭包过期
  const handleEventLink = (view: RuntimeEventView) => {
    if (!view.linkMode) return
    if (view.linkMode === 'trace') {
      const arr = traceSteps
      const target = arr.find(s => s.tool && s.tool === view.tool) ?? arr[view.stepIndex ?? 0]
      if (target) setSubTab('trace')
    }
    if (view.linkMode === 'tools') {
      const arr = toolSteps
      const target = arr.find(s => s.tool && s.tool === view.tool)
      if (target) setSubTab('tools')
    }
  }

  const nodeIds = Object.keys(nodeCache)

  // 对比：当前缓存 vs 历史某次运行的同名节点
  const compareLeft = compareNodeId ? nodeCache[compareNodeId] : undefined
  const compareRight = useMemo(() => {
    if (!compareNodeId || !runHistory[compareRunIdx]) return undefined
    return runHistory[compareRunIdx].node_cache[compareNodeId]
      ? {
          nodeId: compareNodeId,
          inputs: runHistory[compareRunIdx].node_cache[compareNodeId].inputs,
          outputs: runHistory[compareRunIdx].node_cache[compareNodeId].outputs,
          duration_ms: runHistory[compareRunIdx].node_cache[compareNodeId].duration_ms,
          timestamp: new Date(runHistory[compareRunIdx].timestamp).getTime(),
          status: 'done' as const,
          logs: [],
        }
      : undefined
  }, [compareNodeId, compareRunIdx, runHistory])

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--novo-bg-base)' }}>
      {/* 头部 + 子 Tab */}
      <div className="px-3 py-1.5 border-b shrink-0" style={{ borderColor: 'var(--novo-border-default)' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <Brain className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
          <span className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-primary)' }}>
            Agentic 智能体调试
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--novo-bg-hover)', color: 'var(--novo-text-muted)' }}>
            {nodeIds.length} 节点缓存
          </span>
          {analysisState.threadId && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono" style={{ background: 'var(--novo-bg-hover)', color: 'var(--novo-text-secondary)' }}>
              {analysisState.threadId.slice(0, 8)}…
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          <div className="px-2 py-1 rounded-lg" style={{ background: 'var(--novo-bg-surface)' }}>
            <div className="text-[8px] uppercase font-semibold" style={{ color: 'var(--novo-text-muted)' }}>thread_id</div>
            <div className="text-[9px] font-mono truncate" style={{ color: 'var(--novo-text-primary)' }}>{analysisState.threadId || '—'}</div>
          </div>
          <div className="px-2 py-1 rounded-lg" style={{ background: 'var(--novo-bg-surface)' }}>
            <div className="text-[8px] uppercase font-semibold" style={{ color: 'var(--novo-text-muted)' }}>status</div>
            <div className="text-[9px] font-semibold" style={{ color: statusColor(runtimeStatus) }}>{runtimeStatus || '—'}</div>
          </div>
          <div className="px-2 py-1 rounded-lg" style={{ background: 'var(--novo-bg-surface)' }}>
            <div className="text-[8px] uppercase font-semibold" style={{ color: 'var(--novo-text-muted)' }}>pause_phase</div>
            <div className="text-[9px] font-mono truncate" style={{ color: 'var(--novo-text-primary)' }}>{runtimePausePhase || '—'}</div>
          </div>
          <div className="px-2 py-1 rounded-lg" style={{ background: 'var(--novo-bg-surface)' }}>
            <div className="text-[8px] uppercase font-semibold" style={{ color: 'var(--novo-text-muted)' }}>events</div>
            <div className="text-[9px] font-semibold" style={{ color: 'var(--novo-text-primary)' }}>{runtimeEvents.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <button
            onClick={refreshRuntime}
            disabled={!analysisState.threadId || runtimeLoading}
            className="flex items-center gap-1 px-2 py-1 text-[8px] font-semibold rounded-md transition-colors disabled:opacity-50"
            style={{
              background: 'var(--novo-bg-surface)',
              color: 'var(--novo-text-secondary)',
              border: '1px solid var(--novo-border-default)',
            }}
          >
            {runtimeLoading
              ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
              : <Clock className="w-2.5 h-2.5" />
            }
            刷新 runtime
          </button>
          <button
            onClick={handleClearTrace}
            className="flex items-center gap-1 px-2 py-1 text-[8px] font-semibold rounded-md transition-colors"
            style={{
              background: 'var(--novo-bg-surface)',
              color: 'var(--novo-text-secondary)',
              border: '1px solid var(--novo-border-default)',
            }}
          >
            <Trash2 className="w-2.5 h-2.5" />
            清空轨迹
          </button>
          {runtimeErrorMessage && (
            <div className="min-w-0 flex items-center gap-1 text-[8px] ml-auto" style={{ color: '#DC2626' }}>
              <AlertCircle className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{runtimeErrorMessage}</span>
            </div>
          )}
        </div>
        <div className="flex gap-0.5">
          {([
            { key: 'runtime' as SubTab, label: 'Runtime', icon: Clock },
            { key: 'trace' as SubTab, label: '决策轨迹', icon: Brain },
            { key: 'tools' as SubTab, label: '工具诊断', icon: Wrench },
            { key: 'tokens' as SubTab, label: 'Tokens', icon: BarChart3 },
            { key: 'compare' as SubTab, label: '对比', icon: GitCompare },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className="flex items-center gap-1 flex-1 py-1 text-[9px] font-semibold rounded-md transition-colors justify-center"
              style={{
                background: subTab === tab.key ? 'var(--novo-bg-elevated)' : 'transparent',
                color: subTab === tab.key ? '#7C3AED' : 'var(--novo-text-muted)',
                border: subTab === tab.key ? '1px solid var(--novo-border-default)' : '1px solid transparent',
              }}
            >
              <tab.icon className="w-2.5 h-2.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {subTab === 'runtime' && (
          <div className="px-3 py-2 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg px-2 py-1.5" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
                <div className="text-[8px] uppercase font-semibold mb-0.5" style={{ color: 'var(--novo-text-muted)' }}>status</div>
                <div className="text-[9px] font-semibold" style={{ color: statusColor(runtimeStatus) }}>{runtimeStatus || '—'}</div>
              </div>
              <div className="rounded-lg px-2 py-1.5" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
                <div className="text-[8px] uppercase font-semibold mb-0.5" style={{ color: 'var(--novo-text-muted)' }}>thread_id</div>
                <div className="text-[9px] font-mono break-all" style={{ color: 'var(--novo-text-primary)' }}>{analysisState.threadId || '—'}</div>
              </div>
              <div className="rounded-lg px-2 py-1.5" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
                <div className="text-[8px] uppercase font-semibold mb-0.5" style={{ color: 'var(--novo-text-muted)' }}>pause_target</div>
                <div className="text-[9px] font-mono break-all" style={{ color: 'var(--novo-text-primary)' }}>{runtimePauseTarget || '—'}</div>
              </div>
              <div className="rounded-lg px-2 py-1.5" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
                <div className="text-[8px] uppercase font-semibold mb-0.5" style={{ color: 'var(--novo-text-muted)' }}>pause_phase</div>
                <div className="text-[9px] font-mono break-all" style={{ color: 'var(--novo-text-primary)' }}>{runtimePausePhase || '—'}</div>
              </div>
              <div className="rounded-lg px-2 py-1.5" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
                <div className="text-[8px] uppercase font-semibold mb-0.5" style={{ color: 'var(--novo-text-muted)' }}>waiting_for</div>
                <div className="text-[9px] font-mono break-all" style={{ color: 'var(--novo-text-primary)' }}>{runtimeWaitingFor || '—'}</div>
              </div>
              <div className="rounded-lg px-2 py-1.5" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
                <div className="text-[8px] uppercase font-semibold mb-0.5" style={{ color: 'var(--novo-text-muted)' }}>updated_at</div>
                <div className="text-[9px] font-mono break-all" style={{ color: 'var(--novo-text-primary)' }}>{formatRuntimeTimestamp(runtimeState?.updated_at)}</div>
              </div>
            </div>

            <div className="rounded-lg px-2 py-2" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
              <div className="text-[9px] font-semibold mb-1.5" style={{ color: 'var(--novo-text-secondary)' }}>错误 / 恢复动作</div>
              <div className="space-y-2">
                <div>
                  <div className="text-[8px] uppercase font-semibold mb-0.5" style={{ color: 'var(--novo-text-muted)' }}>error</div>
                  <pre className="text-[9px] font-mono whitespace-pre-wrap break-words" style={{ color: runtimeErrorMessage ? '#DC2626' : 'var(--novo-text-muted)' }}>
                    {runtimeErrorMessage || '—'}
                  </pre>
                </div>
                <div>
                  <div className="text-[8px] uppercase font-semibold mb-0.5" style={{ color: 'var(--novo-text-muted)' }}>resume_actions</div>
                  {(runtimeState?.resume_actions?.length ?? 0) > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {runtimeState?.resume_actions?.map((action, index) => (
                        <span
                          key={`${action.id}-${index}`}
                          className="text-[8px] px-1.5 py-0.5 rounded-full"
                          style={{ background: 'var(--novo-bg-hover)', color: 'var(--novo-text-secondary)' }}
                        >
                          {action.label || action.id}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[9px] font-mono" style={{ color: 'var(--novo-text-muted)' }}>—</div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg px-2 py-2" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[9px] font-semibold" style={{ color: 'var(--novo-text-secondary)' }}>runtime events</div>
                <div className="text-[8px]" style={{ color: 'var(--novo-text-muted)' }}>{filteredRuntimeEvents.length} / {runtimeEvents.length} 条</div>
              </div>
              {runtimeEvents.length > 0 && (
                <div className="space-y-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={runtimeEventTypeFilter}
                      onChange={e => setRuntimeEventTypeFilter(e.target.value)}
                      className="w-[108px] text-[8px] px-2 py-1 rounded-lg novo-input"
                    >
                      <option value="all">全部类型</option>
                      {runtimeEventTypeOptions.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5" style={{ color: 'var(--novo-text-disabled)' }} />
                      <input
                        type="text"
                        value={runtimeEventQuery}
                        onChange={e => setRuntimeEventQuery(e.target.value)}
                        placeholder="搜索事件类型或数据..."
                        className="w-full pl-6 pr-5 py-1 rounded-lg text-[8px] outline-none"
                        style={{
                          background: 'var(--novo-bg-base)',
                          color: 'var(--novo-text-primary)',
                          border: '1px solid var(--novo-border-default)',
                        }}
                      />
                      {runtimeEventQuery && (
                        <button
                          onClick={() => setRuntimeEventQuery('')}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                          style={{ color: 'var(--novo-text-disabled)' }}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {(runtimeEventTypeFilter !== 'all' || runtimeEventQuery) && (
                    <div className="flex items-center justify-between gap-2 text-[8px]" style={{ color: 'var(--novo-text-muted)' }}>
                      <span>已筛出 {filteredRuntimeEvents.length} 条事件</span>
                      <button
                        onClick={() => {
                          setRuntimeEventTypeFilter('all')
                          setRuntimeEventQuery('')
                        }}
                        className="px-1.5 py-0.5 rounded-md"
                        style={{ background: 'var(--novo-bg-hover)', color: 'var(--novo-text-secondary)' }}
                      >
                        清除筛选
                      </button>
                    </div>
                  )}
                </div>
              )}
              {runtimeEvents.length > 0 ? (
                filteredRuntimeEvents.length > 0 ? (
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-0.5">
                    {filteredRuntimeEvents.map(event => {
                      const toneStyle = runtimeToneStyle(event.tone)
                      return (
                        <div
                          key={event.key}
                          onClick={() => handleEventLink(event)}
                          className={`rounded-lg px-2 py-1.5 ${event.linkMode ? 'cursor-pointer hover:opacity-90' : ''}`}
                          style={{
                            background: toneStyle.background,
                            border: `1px solid ${toneStyle.border}`,
                          }}
                          title={event.linkMode ? '点击跳转到 Trace/Tools' : undefined}
                        >
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-semibold" style={{ color: toneStyle.color }}>{event.type}</span>
                              {event.tool && (
                                <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: 'var(--novo-bg-hover)', color: 'var(--novo-text-secondary)' }}>
                                  {event.tool}
                                </span>
                              )}
                            </div>
                            <span className="text-[8px] font-mono" style={{ color: 'var(--novo-text-muted)' }}>{formatRuntimeTimestamp(event.timestamp)}</span>
                          </div>
                          <div className="text-[9px] font-medium mb-0.5" style={{ color: 'var(--novo-text-primary)' }}>{event.summary}</div>
                          <pre className="text-[8px] font-mono whitespace-pre-wrap break-words" style={{ color: 'var(--novo-text-muted)' }}>
                            {event.dataPreview}
                          </pre>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-[9px]" style={{ color: 'var(--novo-text-disabled)' }}>没有匹配的 runtime events</div>
                )
              ) : (
                <div className="text-[9px]" style={{ color: 'var(--novo-text-disabled)' }}>暂无 runtime events</div>
              )}
            </div>
          </div>
        )}

        {/* 决策轨迹 */}
        {subTab === 'trace' && (
          traceSteps.length > 0 ? (
            <div>
              {traceSteps.map((step, i) => (
                <ToolDiagRow key={i} step={step} index={i} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[10px]" style={{ color: 'var(--novo-text-disabled)' }}>
              运行管线后决策轨迹将在此展示
            </div>
          )
        )}

        {/* 工具诊断 */}
        {subTab === 'tools' && (
          toolSteps.length > 0 ? (
            <div>
              {toolSteps.map((step, i) => (
                <ToolDiagRow key={i} step={step} index={i} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[10px]" style={{ color: 'var(--novo-text-disabled)' }}>
              无工具调用记录
            </div>
          )
        )}

        {/* Tokens 统计 */}
        {subTab === 'tokens' && (
          (() => {
            // 从 agenticTrace 中提取每个 tool 的调用次数
            const toolCalls = agenticTrace.filter(s => s.type === 'tool_call_start' || s.type === 'tool_call_done')
            const toolStats: Record<string, { calls: number; totalMs: number }> = {}
            for (const s of toolCalls) {
              if (!s.tool) continue
              if (!toolStats[s.tool]) toolStats[s.tool] = { calls: 0, totalMs: 0 }
              if (s.type === 'tool_call_start') toolStats[s.tool].calls++
              if (s.duration_ms) toolStats[s.tool].totalMs += s.duration_ms
            }
            const entries = Object.entries(toolStats)
            const maxCalls = Math.max(1, ...entries.map(([, v]) => v.calls))

            return entries.length > 0 ? (
              <div className="px-3 py-2 space-y-2">
                <div className="text-[9px] font-semibold" style={{ color: 'var(--novo-text-muted)' }}>
                  工具调用统计 ({agenticTrace.length} 轨迹步骤)
                </div>
                {entries.map(([tool, stats]) => (
                  <div key={tool} className="space-y-0.5">
                    <div className="flex justify-between text-[9px]">
                      <span className="font-mono font-semibold" style={{ color: 'var(--novo-text-primary)' }}>{tool}</span>
                      <span style={{ color: 'var(--novo-text-muted)' }}>{stats.calls}x</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--novo-bg-active)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(stats.calls / maxCalls) * 100}%`,
                          background: '#7C3AED',
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="text-[8px] pt-1" style={{ color: 'var(--novo-text-disabled)' }}>
                  总步骤: {agenticTrace.length} | 工具种类: {entries.length}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-[10px]" style={{ color: 'var(--novo-text-disabled)' }}>
                运行 Agentic 分析后将显示 Token 统计
              </div>
            )
          })()
        )}

        {/* 对比面板 */}
        {subTab === 'compare' && (
          <div className="px-3 py-2 space-y-3">
            {/* 历史运行选择器 */}
            <div className="flex items-center gap-2">
              <select
                value={compareRunIdx}
                onChange={e => setCompareRunIdx(Number(e.target.value))}
                className="flex-1 text-[9px] px-2 py-1 rounded-lg novo-input"
              >
                {runHistory.length === 0 && <option value={0}>无历史记录</option>}
                {runHistory.map((r, i) => (
                  <option key={r.run_id} value={i}>
                    {r.user_input.slice(0, 30)} ({r.mode})
                  </option>
                ))}
              </select>
            </div>

            {/* ── 运行概览对比 ── */}
            {(() => {
              const histRun = runHistory[compareRunIdx]
              const currentToolSeq = agenticTrace
                .filter(s => s.type === 'tool_call_start' && s.tool)
                .map(s => s.tool!)
              const histToolSeq = histRun
                ? Object.keys(histRun.node_cache)
                : []
              const currentTotalMs = agenticTrace.length > 0
                ? agenticTrace[agenticTrace.length - 1].timestamp - agenticTrace[0].timestamp
                : Object.values(nodeCache).reduce((sum, c) => sum + (c.duration_ms || 0), 0)
              const histTotalMs = histRun?.total_duration_ms || 0

              return (
                <>
                  {/* 参数/配置差异 */}
                  <div>
                    <div className="text-[9px] font-semibold mb-1.5" style={{ color: 'var(--novo-text-secondary)' }}>
                      运行概览
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[8px] font-semibold uppercase mb-1" style={{ color: 'var(--novo-text-muted)' }}>
                      <span>当前运行</span>
                      <span>历史运行</span>
                    </div>
                    <div className="space-y-1">
                      {/* 模式 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-[8px] px-2 py-1 rounded" style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-primary)' }}>
                          模式: <span className="font-semibold">Agentic</span>
                        </div>
                        <div className="text-[8px] px-2 py-1 rounded" style={{
                          background: histRun && histRun.mode !== 'agentic' ? 'rgba(251,191,36,0.08)' : 'var(--novo-bg-surface)',
                          color: 'var(--novo-text-primary)',
                          border: histRun && histRun.mode !== 'agentic' ? '1px solid rgba(251,191,36,0.3)' : 'none',
                        }}>
                          模式: <span className="font-semibold">{histRun?.mode || '—'}</span>
                          {histRun && histRun.mode !== 'agentic' && <span className="ml-1 text-[7px]" style={{ color: '#D97706' }}>不同</span>}
                        </div>
                      </div>
                      {/* 节点/步骤数 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-[8px] px-2 py-1 rounded" style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-primary)' }}>
                          步骤: <span className="font-semibold">{agenticTrace.length || nodeIds.length}</span>
                        </div>
                        <div className="text-[8px] px-2 py-1 rounded" style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-primary)' }}>
                          步骤: <span className="font-semibold">{histRun?.node_count || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── 工具调用路径对比 ── */}
                  <div>
                    <div className="text-[9px] font-semibold mb-1.5" style={{ color: 'var(--novo-text-secondary)' }}>
                      工具调用路径
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {/* 当前调用序列 */}
                      <div className="space-y-0.5">
                        {currentToolSeq.length > 0 ? currentToolSeq.map((tool, i) => {
                          const inHist = histToolSeq.includes(tool)
                          return (
                            <div key={i} className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded" style={{
                              background: inHist ? 'var(--novo-bg-surface)' : 'rgba(34,197,94,0.08)',
                              border: inHist ? 'none' : '1px solid rgba(34,197,94,0.3)',
                              color: 'var(--novo-text-primary)',
                            }}>
                              <span className="font-mono text-[7px] w-3 shrink-0" style={{ color: 'var(--novo-text-disabled)' }}>{i + 1}</span>
                              <Wrench className="w-2 h-2 shrink-0" style={{ color: inHist ? 'var(--novo-text-muted)' : '#16A34A' }} />
                              <span className="font-mono truncate">{tool}</span>
                              {!inHist && <span className="text-[6px] shrink-0" style={{ color: '#16A34A' }}>新增</span>}
                            </div>
                          )
                        }) : (
                          <div className="text-[8px] py-2 text-center" style={{ color: 'var(--novo-text-disabled)' }}>无轨迹</div>
                        )}
                      </div>
                      {/* 历史调用序列 */}
                      <div className="space-y-0.5">
                        {histToolSeq.length > 0 ? histToolSeq.map((tool, i) => {
                          const inCurrent = currentToolSeq.includes(tool)
                          return (
                            <div key={i} className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded" style={{
                              background: inCurrent ? 'var(--novo-bg-surface)' : 'rgba(239,68,68,0.08)',
                              border: inCurrent ? 'none' : '1px solid rgba(239,68,68,0.3)',
                              color: 'var(--novo-text-primary)',
                            }}>
                              <span className="font-mono text-[7px] w-3 shrink-0" style={{ color: 'var(--novo-text-disabled)' }}>{i + 1}</span>
                              <Wrench className="w-2 h-2 shrink-0" style={{ color: inCurrent ? 'var(--novo-text-muted)' : '#DC2626' }} />
                              <span className="font-mono truncate">{tool}</span>
                              {!inCurrent && <span className="text-[6px] shrink-0" style={{ color: '#DC2626' }}>缺失</span>}
                            </div>
                          )
                        }) : (
                          <div className="text-[8px] py-2 text-center" style={{ color: 'var(--novo-text-disabled)' }}>无历史</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── 耗时对比柱状图 ── */}
                  <div>
                    <div className="text-[9px] font-semibold mb-1.5" style={{ color: 'var(--novo-text-secondary)' }}>
                      耗时对比
                    </div>
                    {(() => {
                      const maxMs = Math.max(1, currentTotalMs, histTotalMs)
                      return (
                        <div className="space-y-1.5">
                          {/* 当前运行 */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[8px]">
                              <span style={{ color: 'var(--novo-text-muted)' }}>当前</span>
                              <span className="font-mono font-semibold" style={{ color: 'var(--novo-text-primary)' }}>{currentTotalMs}ms</span>
                            </div>
                            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--novo-bg-active)' }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${(currentTotalMs / maxMs) * 100}%`, background: '#7C3AED' }} />
                            </div>
                          </div>
                          {/* 历史运行 */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[8px]">
                              <span style={{ color: 'var(--novo-text-muted)' }}>历史</span>
                              <span className="font-mono font-semibold" style={{ color: 'var(--novo-text-primary)' }}>{histTotalMs}ms</span>
                            </div>
                            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--novo-bg-active)' }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${(histTotalMs / maxMs) * 100}%`, background: '#2563EB' }} />
                            </div>
                          </div>
                          {/* 差值 */}
                          {histTotalMs > 0 && (
                            <div className="text-[8px] text-center pt-0.5" style={{ color: currentTotalMs <= histTotalMs ? '#16A34A' : '#DC2626' }}>
                              {currentTotalMs <= histTotalMs ? '↓' : '↑'} {Math.abs(currentTotalMs - histTotalMs)}ms ({histTotalMs > 0 ? Math.round(Math.abs(currentTotalMs - histTotalMs) / histTotalMs * 100) : 0}%)
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  {/* ── 节点变量差异 ── */}
                  <div>
                    <div className="text-[9px] font-semibold mb-1.5" style={{ color: 'var(--novo-text-secondary)' }}>
                      变量差异
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <select
                        value={compareNodeId || ''}
                        onChange={e => setCompareNodeId(e.target.value || null)}
                        className="flex-1 text-[9px] px-2 py-1 rounded-lg novo-input"
                      >
                        <option value="">选择节点…</option>
                        {nodeIds.map(id => (
                          <option key={id} value={id}>{id}</option>
                        ))}
                      </select>
                    </div>
                    <DiffView left={compareLeft} right={compareRight} />
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
