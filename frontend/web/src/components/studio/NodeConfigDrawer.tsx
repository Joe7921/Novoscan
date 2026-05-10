/**
 * C4: NodeConfigDrawer — 节点配置侧边抽屉
 *
 * 点击节点后在右侧展开，根据 config_schema 自动渲染配置表单。
 * 支持条件边编辑。
 */

import { useCallback, useMemo, useState, useEffect } from 'react'
import {
  X, Bot, MousePointerClick, FileText, Cog, Trash2, Link2,
  RefreshCw, Layers, MessageSquare, Play, Loader2, Clock,
  AlertCircle, Circle,
} from 'lucide-react'
import { useStudioStore, type StudioNodeData } from '@/lib/studioStore'
import { useDebugStore, type NodeDebugStatus } from '@/lib/debugStore'
import type { ConfigField, ReportBlockMeta, AgentBlockMeta } from '@/types/blocks'

type DrawerTab = 'config' | 'input' | 'output' | 'logs'

const DRAWER_TABS: { key: DrawerTab; label: string }[] = [
  { key: 'config', label: '配置' },
  { key: 'input', label: '输入' },
  { key: 'output', label: '输出' },
  { key: 'logs', label: '日志' },
]

const STATUS_COLORS: Record<NodeDebugStatus, string> = {
  idle: 'var(--novo-text-muted)',
  running: 'var(--novo-accent-primary)',
  done: 'var(--novo-accent-success)',
  error: 'var(--novo-accent-danger)',
  stale: '#F59E0B',
}

const TYPE_ICONS: Record<string, typeof Bot> = {
  agent: Bot,
  interaction: MousePointerClick,
  report: FileText,
  logic: Cog,
}

function getNodeIcon(d: StudioNodeData) {
  if (d.blockType === 'agent' && (d.meta as AgentBlockMeta | undefined)?.role_type === 'filter') return RefreshCw
  return TYPE_ICONS[d.blockType] || Cog
}

export default function NodeConfigDrawer() {
  const { nodes, edges, selectedNodeId, selectNode, updateNodeConfig, updateNodeNotes, updateEdgeCondition, removeNode } = useStudioStore()
  const { nodeCache, runNode } = useDebugStore()
  const node = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId])
  const d = node ? (node.data as unknown as StudioNodeData) : null

  // Tab 状态
  const [activeTab, setActiveTab] = useState<DrawerTab>('config')

  // 找到此节点相关的边（含条件）
  const relatedEdges = useMemo(() => {
    if (!selectedNodeId) return []
    return edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
  }, [edges, selectedNodeId])

  const outEdges = relatedEdges.filter(e => e.source === selectedNodeId)

  // 缓冲模式：本地 state → 应用按钮
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({})
  const [configDirty, setConfigDirty] = useState(false)
  const [nodeRunning, setNodeRunning] = useState(false)

  // 当前节点的调试缓存
  const cache = selectedNodeId ? nodeCache[selectedNodeId] : undefined

  useEffect(() => {
    if (d?.config) {
      setLocalConfig({ ...d.config })
      setConfigDirty(false)
    }
  }, [selectedNodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 切换节点时重置 tab
  useEffect(() => { setActiveTab('config') }, [selectedNodeId])

  const handleConfigChange = useCallback((key: string, value: unknown) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }))
    setConfigDirty(true)
  }, [])

  const handleApplyConfig = useCallback(() => {
    if (!selectedNodeId || !configDirty) return
    updateNodeConfig(selectedNodeId, localConfig)
    setConfigDirty(false)
  }, [selectedNodeId, configDirty, localConfig, updateNodeConfig])

  // S3.1: 运行当前节点
  const handleRunNode = useCallback(async () => {
    if (!selectedNodeId || nodeRunning) return
    setNodeRunning(true)
    try {
      // 自动收集上游节点的输出作为输入
      const upstreamInputs: Record<string, unknown> = {}
      const incomingEdges = edges.filter(e => e.target === selectedNodeId)
      for (const edge of incomingEdges) {
        const srcCache = nodeCache[edge.source]
        if (srcCache?.outputs) {
          Object.assign(upstreamInputs, srcCache.outputs)
        }
      }
      // 合并用户编辑的输入
      if (cache?.inputs) {
        Object.assign(upstreamInputs, cache.inputs)
      }
      await runNode(selectedNodeId, upstreamInputs)
      setActiveTab('output')
    } catch { /* 错误已在 store 中处理 */ }
    finally { setNodeRunning(false) }
  }, [selectedNodeId, nodeRunning, edges, nodeCache, cache, runNode])

  if (!node || !d) return null

  const isTerminal = d.label === 'START' || d.label === 'END'
  const configSchema = d.meta?.config_schema || {}
  const Icon = getNodeIcon(d)

  // Report 专属数据
  const reportMeta = d.blockType === 'report' ? (d.meta as ReportBlockMeta | undefined) : undefined
  const debugStatus: NodeDebugStatus = cache?.status || 'idle'

  return (
    <div
      className="flex flex-col w-full h-full overflow-hidden"
      style={{ background: 'var(--novo-bg-base)' }}
    >
      {/* 头部 */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--novo-border-default)' }}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: 'var(--novo-accent-primary)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: 'var(--novo-text-primary)' }}>{d.label}</div>
            <div className="text-[9px]" style={{ color: 'var(--novo-text-muted)' }}>{d.blockType} · {d.blockId || node.id}</div>
          </div>
          {/* S3.1: 运行按钮 */}
          {!isTerminal && (
            <button
              onClick={handleRunNode}
              disabled={nodeRunning}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold transition-colors"
              style={{ background: 'var(--novo-accent-primary)', color: 'white', opacity: nodeRunning ? 0.6 : 1 }}
              title="运行此节点"
            >
              {nodeRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              运行
            </button>
          )}
          <button onClick={() => selectNode(null)} className="p-1 rounded-lg hover:bg-[var(--novo-bg-hover)]">
            <X className="w-3.5 h-3.5" style={{ color: 'var(--novo-text-disabled)' }} />
          </button>
        </div>

        {/* S4.2: Last Run 摘要卡 */}
        {cache && (
          <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg text-[9px]" style={{ background: 'var(--novo-bg-surface)' }}>
            <Circle className="w-2 h-2 shrink-0" style={{ color: STATUS_COLORS[debugStatus], fill: STATUS_COLORS[debugStatus] }} />
            <span style={{ color: 'var(--novo-text-secondary)' }}>
              {cache.duration_ms}ms
            </span>
            <span style={{ color: 'var(--novo-text-muted)' }}>·</span>
            <Clock className="w-2.5 h-2.5" style={{ color: 'var(--novo-text-muted)' }} />
            <span style={{ color: 'var(--novo-text-muted)' }}>
              {new Date(cache.timestamp).toLocaleTimeString()}
            </span>
            {cache.error && (
              <>
                <span style={{ color: 'var(--novo-text-muted)' }}>·</span>
                <AlertCircle className="w-2.5 h-2.5" style={{ color: 'var(--novo-accent-danger)' }} />
                <span className="truncate" style={{ color: 'var(--novo-accent-danger)' }}>{cache.error}</span>
              </>
            )}
          </div>
        )}

        {/* Tab 切换 */}
        <div className="flex gap-0.5 mt-2">
          {DRAWER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 py-1 text-[9px] font-semibold rounded-md transition-colors"
              style={{
                background: activeTab === tab.key ? 'var(--novo-bg-elevated)' : 'transparent',
                color: activeTab === tab.key ? 'var(--novo-accent-primary)' : 'var(--novo-text-muted)',
                border: activeTab === tab.key ? '1px solid var(--novo-border-default)' : '1px solid transparent',
              }}
            >
              {tab.label}
              {tab.key === 'output' && cache?.outputs && Object.keys(cache.outputs).length > 0 && (
                <span className="ml-0.5 w-1.5 h-1.5 inline-block rounded-full" style={{ background: 'var(--novo-accent-success)' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── Config Tab ── */}
        {activeTab === 'config' && (<>
        {/* 注释 */}
        {!isTerminal && (
          <div>
            <div className="flex items-center gap-1 text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-muted)' }}>
              <MessageSquare className="w-3 h-3" />
              注释
            </div>
            <textarea
              value={d.notes || ''}
              onChange={e => updateNodeNotes(node.id, e.target.value)}
              placeholder="添加注释…"
              rows={2}
              className="w-full px-2.5 py-1.5 rounded-lg text-[10px] leading-relaxed outline-none resize-y novo-input"
              style={{ minHeight: 36 }}
            />
          </div>
        )}

        {/* 描述 */}
        {d.description && (
          <div>
            <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-muted)' }}>描述</div>
            <div className="text-[10px] leading-relaxed" style={{ color: 'var(--novo-text-secondary)' }}>{d.description}</div>
          </div>
        )}

        {/* 输入/输出 */}
        {d.meta && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-muted)' }}>输入</div>
              {d.meta.inputs.length > 0 ? (
                d.meta.inputs.map(inp => (
                  <span key={inp} className="inline-block text-[9px] px-1.5 py-0.5 rounded mr-1 mb-1"
                    style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-secondary)' }}>
                    {inp}
                  </span>
                ))
              ) : (
                <span className="text-[9px]" style={{ color: 'var(--novo-text-disabled)' }}>—</span>
              )}
            </div>
            <div>
              <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-muted)' }}>输出</div>
              {d.meta.outputs.length > 0 ? (
                d.meta.outputs.map(out => (
                  <span key={out} className="inline-block text-[9px] px-1.5 py-0.5 rounded mr-1 mb-1"
                    style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-secondary)' }}>
                    {out}
                  </span>
                ))
              ) : (
                <span className="text-[9px]" style={{ color: 'var(--novo-text-disabled)' }}>—</span>
              )}
            </div>
          </div>
        )}

        {/* Report 专属配置区 */}
        {reportMeta && (
          <div className="space-y-3">
            {/* Sections 预览 */}
            {reportMeta.sections && reportMeta.sections.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'var(--novo-text-muted)' }}>
                  <Layers className="w-3 h-3" />
                  报告组件 ({reportMeta.sections.length})
                </div>
                <div className="space-y-1">
                  {reportMeta.sections.map(sec => (
                    <div key={sec.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                      style={{ background: 'var(--novo-bg-surface)' }}>
                      <span className="text-[9px] font-mono font-semibold" style={{ color: '#16A34A' }}>{sec.type}</span>
                      <span className="text-[9px] truncate flex-1" style={{ color: 'var(--novo-text-secondary)' }}>{sec.id}</span>
                      {sec.source && (
                        <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: 'var(--novo-bg-active)', color: 'var(--novo-text-muted)' }}>
                          {sec.source}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 依赖的上游 Agent */}
            {reportMeta.requires && reportMeta.requires.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-muted)' }}>依赖 Agent</div>
                <div className="flex flex-wrap gap-1">
                  {reportMeta.requires.map(req => (
                    <span key={req} className="inline-block text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(37,99,235,0.08)', color: '#2563EB' }}>
                      {req}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Config Schema 表单 */}
        {Object.keys(configSchema).length > 0 && (
          <div>
            <div className="text-[10px] font-semibold mb-2" style={{ color: 'var(--novo-text-muted)' }}>配置参数</div>
            <div className="space-y-3">
              {Object.entries(configSchema).map(([key, field]) => (
                <ConfigFieldInput
                  key={key}
                  fieldKey={key}
                  field={field}
                  value={localConfig[key] ?? d.config?.[key] ?? field.default}
                  onChange={val => handleConfigChange(key, val)}
                />
              ))}
            </div>
            {configDirty && (
              <button
                onClick={handleApplyConfig}
                className="mt-2 w-full py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
                style={{ background: 'var(--novo-accent-primary)', color: 'white' }}
              >
                应用配置
              </button>
            )}
          </div>
        )}

        {/* 条件边编辑（C4 增强） */}
        {outEdges.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--novo-text-muted)' }}>
              <Link2 className="w-3 h-3" />
              出边条件
            </div>
            <div className="space-y-2">
              {outEdges.map(edge => (
                <div key={edge.id} className="flex items-center gap-2">
                  <span className="text-[9px] shrink-0" style={{ color: 'var(--novo-text-disabled)' }}>
                    → {edge.target}
                  </span>
                  <input
                    type="text"
                    placeholder="无条件"
                    value={((edge.data as Record<string, unknown>)?.condition as string) || ''}
                    onChange={e => updateEdgeCondition(edge.id, e.target.value)}
                    className="flex-1 px-2 py-1 rounded text-[10px] outline-none"
                    style={{
                      background: 'var(--novo-bg-surface)',
                      color: 'var(--novo-text-primary)',
                      border: '1px solid var(--novo-border-default)',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        </>)}

        {/* ── Input Tab ── */}
        {activeTab === 'input' && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold" style={{ color: 'var(--novo-accent-primary)' }}>节点输入变量</div>
            {cache?.inputs && Object.keys(cache.inputs).length > 0 ? (
              Object.entries(cache.inputs).map(([key, val]) => (
                <div key={key} className="space-y-0.5">
                  <div className="text-[9px] font-mono font-semibold" style={{ color: 'var(--novo-text-secondary)' }}>{key}</div>
                  <pre
                    className="text-[9px] font-mono px-2 py-1.5 rounded-lg whitespace-pre-wrap break-all max-h-[100px] overflow-auto"
                    style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)' }}
                  >
                    {typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
                  </pre>
                </div>
              ))
            ) : (
              <div className="text-[9px] py-4 text-center" style={{ color: 'var(--novo-text-disabled)' }}>
                尚无输入数据 — 先运行管线或此节点
              </div>
            )}
          </div>
        )}

        {/* ── Output Tab ── */}
        {activeTab === 'output' && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold" style={{ color: 'var(--novo-accent-success)' }}>节点输出变量</div>
            {cache?.outputs && Object.keys(cache.outputs).length > 0 ? (
              Object.entries(cache.outputs).map(([key, val]) => (
                <div key={key} className="space-y-0.5">
                  <div className="text-[9px] font-mono font-semibold" style={{ color: 'var(--novo-text-secondary)' }}>{key}</div>
                  <pre
                    className="text-[9px] font-mono px-2 py-1.5 rounded-lg whitespace-pre-wrap break-all max-h-[150px] overflow-auto"
                    style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)' }}
                  >
                    {typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
                  </pre>
                </div>
              ))
            ) : (
              <div className="text-[9px] py-4 text-center" style={{ color: 'var(--novo-text-disabled)' }}>
                尚无输出数据 — 先运行此节点
              </div>
            )}
          </div>
        )}

        {/* ── Logs Tab ── */}
        {activeTab === 'logs' && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-muted)' }}>运行日志</div>
            {cache?.logs && cache.logs.length > 0 ? (
              <div
                className="rounded-lg px-2.5 py-2 font-mono text-[9px] space-y-0.5 max-h-[300px] overflow-auto"
                style={{ background: 'var(--novo-bg-surface)' }}
              >
                {cache.logs.map((log, i) => (
                  <div
                    key={i}
                    style={{ color: log.includes('❌') ? 'var(--novo-accent-danger)' : 'var(--novo-text-muted)' }}
                  >
                    {log}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[9px] py-4 text-center" style={{ color: 'var(--novo-text-disabled)' }}>
                暂无日志
              </div>
            )}
            {cache && (
              <div className="flex items-center gap-3 text-[9px] pt-1" style={{ color: 'var(--novo-text-muted)' }}>
                <span>耗时: {cache.duration_ms}ms</span>
                <span>时间: {new Date(cache.timestamp).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部操作 */}
      {!isTerminal && (
        <div className="p-3 border-t" style={{ borderColor: 'var(--novo-border-default)' }}>
          <button
            onClick={() => removeNode(node.id)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium transition-colors hover:bg-red-50"
            style={{ color: '#EF4444', border: '1px solid #FCA5A533' }}
          >
            <Trash2 className="w-3 h-3" />
            删除节点
          </button>
        </div>
      )}
    </div>
  )
}

// ── 配置字段渲染器 ──

function ConfigFieldInput({
  fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string
  field: ConfigField
  value: unknown
  onChange: (val: unknown) => void
}) {
  const inputStyle = {
    background: 'var(--novo-bg-surface)',
    color: 'var(--novo-text-primary)',
    border: '1px solid var(--novo-border-default)',
  }

  return (
    <div>
      <label className="text-[9px] font-medium mb-0.5 block" style={{ color: 'var(--novo-text-secondary)' }}>
        {fieldKey}
        {field.description && (
          <span className="ml-1 font-normal" style={{ color: 'var(--novo-text-disabled)' }}>
            — {field.description}
          </span>
        )}
      </label>

      {field.type === 'text' && (
        <textarea
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 rounded-lg text-[10px] resize-y outline-none"
          style={inputStyle}
        />
      )}

      {field.type === 'float' && (
        <input
          type="number"
          step="0.1"
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          value={(value as number) ?? field.default ?? 0}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-full px-2 py-1.5 rounded-lg text-[10px] outline-none"
          style={inputStyle}
        />
      )}

      {field.type === 'integer' && (
        <input
          type="number"
          step="1"
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          value={(value as number) ?? field.default ?? 0}
          onChange={e => onChange(parseInt(e.target.value))}
          className="w-full px-2 py-1.5 rounded-lg text-[10px] outline-none"
          style={inputStyle}
        />
      )}

      {field.type === 'boolean' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            className="rounded"
          />
          <span className="text-[10px]" style={{ color: 'var(--novo-text-secondary)' }}>
            {value ? '启用' : '禁用'}
          </span>
        </label>
      )}

      {field.type === 'select' && field.options && (
        <select
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg text-[10px] outline-none"
          style={inputStyle}
        >
          {field.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
    </div>
  )
}
