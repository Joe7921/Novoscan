/**
 * Phase S2: VariableInspector — 变量检查面板（对标 Dify Variable Inspect Panel）
 *
 * 画布底部全局面板，展示所有节点的 inputs/outputs 变量：
 *   - 表格/树形展示每个节点的变量列表
 *   - 变量值可展开查看（JSON 格式化）、可直接编辑
 *   - 高亮「已缓存/未运行/出错/过期」状态
 *   - 与画布联动：点击行定位节点、选中节点高亮行
 */

import { useState, useMemo, useCallback } from 'react'
import {
  ChevronRight, ChevronDown, Circle, Edit3, Check, X,
  AlertCircle, Clock, Trash2, Play, RotateCcw,
} from 'lucide-react'
import { useDebugStore, type NodeDebugStatus, type NodeRunCache } from '@/lib/debugStore'
import { useStudioStore } from '@/lib/studioStore'

// ── 状态颜色 ──
const STATUS_CONFIG: Record<NodeDebugStatus, { color: string; label: string }> = {
  idle:    { color: 'var(--novo-text-muted)',          label: '未运行' },
  running: { color: 'var(--novo-accent-primary)',      label: '运行中' },
  done:    { color: 'var(--novo-accent-success)',      label: '已完成' },
  error:   { color: 'var(--novo-accent-danger)',       label: '出错' },
  stale:   { color: 'var(--novo-accent-warning, #F59E0B)', label: '已过期' },
}

// ── 单个变量值渲染 ──
function VariableValue({
  value,
  nodeId,
  section,
  varKey,
  editable,
}: {
  value: unknown
  nodeId: string
  section: 'inputs' | 'outputs'
  varKey: string
  editable: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const { editVariable } = useDebugStore()

  const displayValue = useMemo(() => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'string') return value.length > 120 ? value.slice(0, 120) + '…' : value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return JSON.stringify(value, null, 2)
  }, [value])

  const isComplex = typeof value === 'object' && value !== null

  const handleStartEdit = useCallback(() => {
    setEditValue(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
    setEditing(true)
  }, [value])

  const handleSave = useCallback(() => {
    try {
      const parsed = JSON.parse(editValue)
      editVariable(nodeId, section, varKey, parsed)
    } catch {
      editVariable(nodeId, section, varKey, editValue)
    }
    setEditing(false)
  }, [editValue, nodeId, section, varKey, editVariable])

  if (editing) {
    return (
      <div className="flex items-start gap-1 flex-1">
        <textarea
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          className="flex-1 rounded px-1.5 py-1 text-[10px] font-mono resize-y min-h-[24px] max-h-[120px]"
          style={{
            background: 'var(--novo-bg-base)',
            border: '1px solid var(--novo-accent-primary)',
            color: 'var(--novo-text-primary)',
          }}
          autoFocus
        />
        <button onClick={handleSave} className="p-0.5 hover:opacity-70" style={{ color: 'var(--novo-accent-success)' }}>
          <Check className="w-3 h-3" />
        </button>
        <button onClick={() => setEditing(false)} className="p-0.5 hover:opacity-70" style={{ color: 'var(--novo-accent-danger)' }}>
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-1 flex-1 min-w-0">
      <pre
        className={`text-[10px] font-mono whitespace-pre-wrap break-all flex-1 ${isComplex ? 'max-h-[80px] overflow-auto' : ''}`}
        style={{ color: 'var(--novo-text-secondary)' }}
      >
        {displayValue}
      </pre>
      {editable && (
        <button onClick={handleStartEdit} className="p-0.5 opacity-0 group-hover/row:opacity-60 hover:!opacity-100 shrink-0">
          <Edit3 className="w-2.5 h-2.5" style={{ color: 'var(--novo-text-muted)' }} />
        </button>
      )}
    </div>
  )
}

// ── 单个节点行 ──
function NodeRow({ nodeId, cache }: { nodeId: string; cache: NodeRunCache | undefined }) {
  const [expanded, setExpanded] = useState(false)
  const { selectNode, nodes } = useStudioStore()
  const { setInspectorHighlight, inspectorHighlightNodeId, runNode, resetNode } = useDebugStore()

  const status: NodeDebugStatus = cache?.status || 'idle'
  const cfg = STATUS_CONFIG[status]

  // 从 studioStore 获取节点名称
  const studioNode = nodes.find(n => n.id === nodeId)
  const nodeName = (studioNode?.data as { label?: string } | undefined)?.label || nodeId

  const isHighlighted = inspectorHighlightNodeId === nodeId

  const handleClick = useCallback(() => {
    setExpanded(!expanded)
    selectNode(nodeId)
    setInspectorHighlight(nodeId)
  }, [expanded, nodeId, selectNode, setInspectorHighlight])

  const handleRunNode = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await runNode(nodeId, cache?.inputs || {})
    } catch { /* 错误已在 store 中处理 */ }
  }, [nodeId, cache, runNode])

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    resetNode(nodeId)
  }, [nodeId, resetNode])

  const vars = useMemo(() => {
    if (!cache) return { inputs: {}, outputs: {} }
    return { inputs: cache.inputs || {}, outputs: cache.outputs || {} }
  }, [cache])

  const inputCount = Object.keys(vars.inputs).length
  const outputCount = Object.keys(vars.outputs).length

  return (
    <div
      className="border-b last:border-b-0"
      style={{
        borderColor: 'var(--novo-border-default)',
        background: isHighlighted ? 'var(--novo-accent-primary-light, rgba(37,99,235,0.06))' : undefined,
      }}
    >
      {/* 节点头 */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[var(--novo-bg-hover)] transition-colors"
        onClick={handleClick}
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--novo-text-muted)' }} />
          : <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--novo-text-muted)' }} />
        }
        <Circle className="w-2 h-2 shrink-0" style={{ color: cfg.color, fill: cfg.color }} />
        <span className="text-[10px] font-semibold truncate" style={{ color: 'var(--novo-text-primary)' }}>
          {nodeName}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--novo-bg-hover)', color: cfg.color }}>
          {cfg.label}
        </span>
        {cache && (
          <span className="text-[9px] ml-auto" style={{ color: 'var(--novo-text-muted)' }}>
            {cache.duration_ms}ms · {inputCount}入 {outputCount}出
          </span>
        )}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={handleRunNode}
            className="p-0.5 rounded hover:bg-[var(--novo-bg-hover)]"
            title="运行此节点"
          >
            <Play className="w-2.5 h-2.5" style={{ color: 'var(--novo-accent-primary)' }} />
          </button>
          {cache && (
            <button
              onClick={handleReset}
              className="p-0.5 rounded hover:bg-[var(--novo-bg-hover)]"
              title="重置缓存"
            >
              <RotateCcw className="w-2.5 h-2.5" style={{ color: 'var(--novo-text-muted)' }} />
            </button>
          )}
        </div>
      </div>

      {/* 展开的变量列表 */}
      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          {/* Inputs */}
          {inputCount > 0 && (
            <div>
              <div className="text-[9px] font-semibold mb-0.5 uppercase tracking-wider" style={{ color: 'var(--novo-accent-primary)' }}>
                Inputs
              </div>
              {Object.entries(vars.inputs).map(([key, val]) => (
                <div key={key} className="flex items-start gap-2 py-0.5 group/row">
                  <span className="text-[10px] font-mono shrink-0 w-[100px] truncate" style={{ color: 'var(--novo-text-secondary)' }}>
                    {key}
                  </span>
                  <VariableValue value={val} nodeId={nodeId} section="inputs" varKey={key} editable />
                </div>
              ))}
            </div>
          )}

          {/* Outputs */}
          {outputCount > 0 && (
            <div>
              <div className="text-[9px] font-semibold mb-0.5 uppercase tracking-wider" style={{ color: 'var(--novo-accent-success)' }}>
                Outputs
              </div>
              {Object.entries(vars.outputs).map(([key, val]) => (
                <div key={key} className="flex items-start gap-2 py-0.5 group/row">
                  <span className="text-[10px] font-mono shrink-0 w-[100px] truncate" style={{ color: 'var(--novo-text-secondary)' }}>
                    {key}
                  </span>
                  <VariableValue value={val} nodeId={nodeId} section="outputs" varKey={key} editable={false} />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {cache?.error && (
            <div className="flex items-start gap-1 py-0.5">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--novo-accent-danger)' }} />
              <span className="text-[10px]" style={{ color: 'var(--novo-accent-danger)' }}>{cache.error}</span>
            </div>
          )}

          {/* Logs */}
          {cache?.logs && cache.logs.length > 0 && (
            <div className="mt-1">
              <div className="text-[9px] font-semibold mb-0.5 uppercase tracking-wider" style={{ color: 'var(--novo-text-muted)' }}>
                Logs
              </div>
              {cache.logs.map((log, i) => (
                <div key={i} className="text-[9px] font-mono" style={{ color: 'var(--novo-text-muted)' }}>{log}</div>
              ))}
            </div>
          )}

          {/* 无缓存 */}
          {!cache && (
            <div className="text-[9px] py-1" style={{ color: 'var(--novo-text-muted)' }}>
              尚未运行 — 点击 ▶ 执行此节点
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 主组件 ──
export default function VariableInspector() {
  const { nodeCache, clearAll, stepState } = useDebugStore()
  const { nodes } = useStudioStore()

  // 按画布节点顺序排列
  const orderedNodeIds = useMemo(() => {
    return nodes.map(n => n.id)
  }, [nodes])

  const cachedCount = Object.values(nodeCache).filter(c => c.status === 'done').length
  const totalNodes = orderedNodeIds.length

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--novo-bg-base)' }}>
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b shrink-0"
        style={{ borderColor: 'var(--novo-border-default)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-primary)' }}>
            变量检查器
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--novo-bg-hover)', color: 'var(--novo-text-muted)' }}>
            {cachedCount}/{totalNodes} 已缓存
          </span>
          {stepState.active && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--novo-accent-primary-light)', color: 'var(--novo-accent-primary)' }}>
              逐步模式 {stepState.currentIndex + 1}/{stepState.queue.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] hover:bg-[var(--novo-bg-hover)] transition-colors"
            style={{ color: 'var(--novo-text-muted)' }}
            title="清空所有缓存"
          >
            <Trash2 className="w-2.5 h-2.5" /> 清空
          </button>
        </div>
      </div>

      {/* 节点列表 */}
      <div className="flex-1 overflow-y-auto">
        {orderedNodeIds.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>
            画布为空 — 请先添加节点
          </div>
        ) : (
          orderedNodeIds.map(nodeId => (
            <NodeRow key={nodeId} nodeId={nodeId} cache={nodeCache[nodeId]} />
          ))
        )}
      </div>
    </div>
  )
}
