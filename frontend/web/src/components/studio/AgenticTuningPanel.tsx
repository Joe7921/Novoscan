/**
 * Phase T4: AgenticTuningPanel — Agentic 智能体工作流调优面板
 *
 * 右侧 272px 面板，替代 Agentic 智能体工作流模式下的 DesignAssistant。
 * 三个子 Tab：
 *   - Prompt: System Prompt 编辑器 + 版本历史
 *   - 参数:  温度滑块 + max_iterations + 模型信息
 *   - Tool:  Tool 启用/禁用矩阵（按分组）
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Save,
  Loader2,
  Check,
  AlertCircle,
  FileText,
  Sliders,
  Wrench,
  History,
  RefreshCw,
  CheckSquare,
  Square,
  Cpu,
  Thermometer,
  RotateCcw,
  ChevronDown,
} from 'lucide-react'
import { useAgenticConfigStore } from '@/lib/agenticConfigStore'
import { fetchModelConfig } from '@/lib/api'

// ── 分组颜色 ──

const GROUP_COLORS: Record<string, string> = {
  intent: '#3B82F6',
  search: '#10B981',
  scoring: '#F59E0B',
  arbitration: '#8B5CF6',
}

const GROUP_LABELS: Record<string, string> = {
  intent: '意图分析',
  search: '搜索引擎',
  scoring: '评分 Agent',
  arbitration: '辩论 & 仲裁',
}

// ── 子 Tab ──

type TuningTab = 'prompt' | 'params' | 'tools'

// ── 主组件 ──

export default function AgenticTuningPanel() {
  const {
    config,
    loading,
    error,
    dirty,
    localPrompt,
    localTemperature,
    localMaxIterations,
    localTools,
    promptVersions,
    fetchConfig,
    setLocalPrompt,
    setLocalTemperature,
    setLocalMaxIterations,
    toggleTool,
    setAllToolsEnabled,
    syncToBackend,
    savePromptVersion,
    restorePromptVersion,
  } = useAgenticConfigStore()

  const [tab, setTab] = useState<TuningTab>('prompt')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<'ok' | 'fail' | null>(null)
  const [modelInfo, setModelInfo] = useState<{ provider: string; model_name: string } | null>(null)
  const [showVersions, setShowVersions] = useState(false)

  // 初始化
  useEffect(() => {
    if (!config) fetchConfig()
    fetchModelConfig()
      .then(mc => setModelInfo({ provider: mc.primary.provider, model_name: mc.primary.model_name }))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 保存到后端
  const handleSync = useCallback(async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const ok = await syncToBackend()
      setSyncResult(ok ? 'ok' : 'fail')
      setTimeout(() => setSyncResult(null), 2000)
    } catch {
      setSyncResult('fail')
    } finally {
      setSyncing(false)
    }
  }, [syncToBackend])

  // 工具分组
  const toolGroups = useMemo(() => {
    const groups: Record<string, typeof localTools> = {}
    for (const t of localTools) {
      const g = t.group || 'other'
      if (!groups[g]) groups[g] = []
      groups[g].push(t)
    }
    return groups
  }, [localTools])

  const enabledCount = localTools.filter(t => t.enabled).length

  // 加载中
  if (loading && !config) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--novo-bg-elevated)' }}>
        <div className="text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" style={{ color: 'var(--novo-accent-primary)' }} />
          <div className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>加载 Agentic 智能体配置...</div>
        </div>
      </div>
    )
  }

  // 错误
  if (error && !config) {
    return (
      <div className="h-full flex items-center justify-center px-4" style={{ background: 'var(--novo-bg-elevated)' }}>
        <div className="text-center">
          <AlertCircle className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--novo-accent-danger)' }} />
          <div className="text-[10px] mb-2" style={{ color: 'var(--novo-text-muted)' }}>{error}</div>
          <button onClick={fetchConfig} className="text-[9px] px-2 py-1 rounded" style={{ background: 'var(--novo-accent-primary)', color: 'white' }}>
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--novo-bg-elevated)' }}>
      {/* Header */}
      <div className="px-3 py-2 border-b shrink-0" style={{ borderColor: 'var(--novo-border-default)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" style={{ color: '#8B5CF6' }} />
            <span className="text-[11px] font-bold" style={{ color: 'var(--novo-text-primary)' }}>
              Agentic 智能体调优
            </span>
          </div>
          <div className="flex items-center gap-1">
            {dirty && (
              <span className="text-[8px] px-1 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#D97706' }}>
                未保存
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing || !dirty}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold transition-all disabled:opacity-40"
              style={{
                background: dirty ? 'var(--novo-accent-primary)' : 'var(--novo-bg-surface)',
                color: dirty ? 'white' : 'var(--novo-text-muted)',
              }}
            >
              {syncing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Save className="w-2.5 h-2.5" />}
              保存
            </button>
          </div>
        </div>

        {/* 同步结果 toast */}
        {syncResult && (
          <div className="text-[9px] px-2 py-1 rounded mb-1" style={{
            background: syncResult === 'ok' ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
            color: syncResult === 'ok' ? '#16A34A' : '#EF4444',
          }}>
            {syncResult === 'ok' ? '✅ 配置已保存，Orchestrator 已热重载' : '❌ 保存失败，请重试'}
          </div>
        )}

        {/* Tab 切换 */}
        <div className="flex gap-0.5">
          {([
            { key: 'prompt' as TuningTab, label: 'Prompt', icon: FileText },
            { key: 'params' as TuningTab, label: '参数', icon: Sliders },
            { key: 'tools' as TuningTab, label: 'Tool 矩阵', icon: Wrench },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1 flex-1 py-1 text-[9px] font-semibold rounded-md transition-colors justify-center"
              style={{
                background: tab === t.key ? 'var(--novo-bg-surface)' : 'transparent',
                color: tab === t.key ? '#8B5CF6' : 'var(--novo-text-muted)',
                border: tab === t.key ? '1px solid var(--novo-border-default)' : '1px solid transparent',
              }}
            >
              <t.icon className="w-2.5 h-2.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Tab: Prompt */}
        {tab === 'prompt' && (
          <div className="flex flex-col h-full">
            {/* 版本历史下拉 */}
            <div className="px-3 pt-2 pb-1 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowVersions(!showVersions)}
                  className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded hover:bg-[var(--novo-bg-hover)]"
                  style={{ color: 'var(--novo-text-muted)' }}
                >
                  <History className="w-2.5 h-2.5" />
                  历史 ({promptVersions.length})
                  <ChevronDown className="w-2 h-2" style={{ transform: showVersions ? 'rotate(180deg)' : 'none' }} />
                </button>
                <button
                  onClick={savePromptVersion}
                  className="text-[9px] px-2 py-0.5 rounded hover:bg-[var(--novo-bg-hover)]"
                  style={{ color: 'var(--novo-text-muted)' }}
                >
                  保存版本
                </button>
              </div>
              <span className="text-[8px]" style={{ color: 'var(--novo-text-disabled)' }}>
                {localPrompt.length} 字
              </span>
            </div>

            {showVersions && promptVersions.length > 0 && (
              <div className="mx-3 mb-1 rounded-lg overflow-hidden" style={{ border: '1px solid var(--novo-border-default)' }}>
                {promptVersions.slice().reverse().slice(0, 5).map((v, i) => (
                  <button
                    key={i}
                    onClick={() => { restorePromptVersion(promptVersions.length - 1 - i); setShowVersions(false) }}
                    className="w-full text-left px-2 py-1 text-[8px] hover:bg-[var(--novo-bg-hover)] border-b last:border-b-0 transition-colors"
                    style={{ borderColor: 'var(--novo-border-default)', color: 'var(--novo-text-muted)' }}
                  >
                    <div className="font-mono">{new Date(v.timestamp).toLocaleString()}</div>
                    <div className="truncate" style={{ color: 'var(--novo-text-disabled)' }}>{v.content.slice(0, 50)}...</div>
                  </button>
                ))}
              </div>
            )}

            {/* System Prompt 编辑器 */}
            <div className="flex-1 px-3 pb-2">
              <textarea
                value={localPrompt}
                onChange={e => setLocalPrompt(e.target.value)}
                className="w-full h-full px-2 py-2 text-[10px] font-mono rounded-lg border resize-none focus:outline-none focus:ring-1"
                style={{
                  background: 'var(--novo-bg-surface)',
                  borderColor: 'var(--novo-border-default)',
                  color: 'var(--novo-text-primary)',
                  minHeight: 200,
                }}
                placeholder="Orchestrator System Prompt..."
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {/* Tab: 参数 */}
        {tab === 'params' && (
          <div className="px-3 py-3 space-y-4">
            {/* 模型信息 */}
            <div className="rounded-lg px-3 py-2" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
              <div className="text-[8px] uppercase font-semibold mb-1" style={{ color: 'var(--novo-text-disabled)' }}>当前模型</div>
              <div className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-primary)' }}>
                {modelInfo?.provider || '未配置'} / {modelInfo?.model_name || '—'}
              </div>
            </div>

            {/* 温度滑块 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1">
                  <Thermometer className="w-3 h-3" style={{ color: '#F59E0B' }} />
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-primary)' }}>温度 (Temperature)</span>
                </div>
                <span className="text-[10px] font-mono font-bold" style={{ color: '#F59E0B' }}>
                  {localTemperature.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={localTemperature}
                onChange={e => setLocalTemperature(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, #3B82F6 0%, #F59E0B ${localTemperature * 100}%, var(--novo-bg-active) ${localTemperature * 100}%)` }}
              />
              <div className="flex justify-between text-[8px] mt-0.5" style={{ color: 'var(--novo-text-disabled)' }}>
                <span>精确 0.0</span>
                <span>创意 1.0</span>
              </div>
            </div>

            {/* Max Iterations 滑块 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" style={{ color: '#8B5CF6' }} />
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-primary)' }}>最大迭代次数</span>
                </div>
                <span className="text-[10px] font-mono font-bold" style={{ color: '#8B5CF6' }}>
                  {localMaxIterations}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={localMaxIterations}
                onChange={e => setLocalMaxIterations(parseInt(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, #8B5CF6 0%, #8B5CF6 ${(localMaxIterations / 50) * 100}%, var(--novo-bg-active) ${(localMaxIterations / 50) * 100}%)` }}
              />
              <div className="flex justify-between text-[8px] mt-0.5" style={{ color: 'var(--novo-text-disabled)' }}>
                <span>1 次</span>
                <span>50 次</span>
              </div>
            </div>

            {/* 重置默认 */}
            <button
              onClick={() => { setLocalTemperature(0.3); setLocalMaxIterations(25) }}
              className="flex items-center gap-1 text-[9px] px-2 py-1 rounded hover:bg-[var(--novo-bg-hover)] transition-colors"
              style={{ color: 'var(--novo-text-muted)' }}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              重置为默认值
            </button>
          </div>
        )}

        {/* Tab: Tool 矩阵 */}
        {tab === 'tools' && (
          <div className="px-3 py-2 space-y-3">
            {/* 统计 + 快捷操作 */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-primary)' }}>
                {enabledCount}/{localTools.length} 工具启用
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setAllToolsEnabled(true)}
                  className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded hover:bg-[var(--novo-bg-hover)]"
                  style={{ color: 'var(--novo-text-muted)' }}
                >
                  <CheckSquare className="w-2.5 h-2.5" /> 全选
                </button>
                <button
                  onClick={() => setAllToolsEnabled(false)}
                  className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded hover:bg-[var(--novo-bg-hover)]"
                  style={{ color: 'var(--novo-text-muted)' }}
                >
                  <Square className="w-2.5 h-2.5" /> 全不选
                </button>
              </div>
            </div>

            {/* 分组列表 */}
            {Object.entries(toolGroups).map(([group, tools]) => (
              <div key={group}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: GROUP_COLORS[group] || '#6B7280' }} />
                  <span className="text-[9px] font-semibold uppercase" style={{ color: GROUP_COLORS[group] || 'var(--novo-text-muted)' }}>
                    {GROUP_LABELS[group] || group}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {tools.map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => toggleTool(tool.id)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left transition-all"
                      style={{
                        background: tool.enabled
                          ? `color-mix(in srgb, ${GROUP_COLORS[tool.group] || '#6B7280'} 8%, transparent)`
                          : 'transparent',
                        border: `1px solid ${tool.enabled ? 'color-mix(in srgb, ' + (GROUP_COLORS[tool.group] || '#6B7280') + ' 20%, transparent)' : 'var(--novo-border-default)'}`,
                        opacity: tool.enabled ? 1 : 0.5,
                      }}
                    >
                      {/* Toggle 指示器 */}
                      <div
                        className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
                        style={{
                          background: tool.enabled ? (GROUP_COLORS[tool.group] || '#6B7280') : 'var(--novo-bg-active)',
                        }}
                      >
                        {tool.enabled
                          ? <Check className="w-2 h-2 text-white" />
                          : <div className="w-1.5 h-1.5 rounded-sm" style={{ background: 'var(--novo-text-disabled)' }} />
                        }
                      </div>
                      {/* 名称 + 描述 */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-semibold" style={{ color: tool.enabled ? 'var(--novo-text-primary)' : 'var(--novo-text-disabled)' }}>
                          {tool.id}
                        </div>
                        <div className="text-[8px] truncate" style={{ color: 'var(--novo-text-muted)' }}>
                          {tool.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
