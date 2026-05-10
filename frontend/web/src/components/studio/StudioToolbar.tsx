/**
 * C3: StudioToolbar — 画布顶部工具栏
 *
 * 管线选择、保存、自动布局、导出 JSON。
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutGrid,
  Save,
  Download,
  FolderOpen,
  Loader2,
  Bot,
  Zap,
  Workflow,
  Wand2,
  SkipForward,
  StepForward,
  Square,
  Eraser,
  RefreshCw,
} from 'lucide-react'
import PromptSyncModal from './PromptSyncModal'
import { useStudioStore } from '@/lib/studioStore'
import { useDebugStore } from '@/lib/debugStore'
import { useAgenticConfigStore } from '@/lib/agenticConfigStore'
import { fetchPipelines, fetchPipeline, savePipeline } from '@/lib/api'
import type { PipelineListItem } from '@/types/blocks'

export default function StudioToolbar() {
  const { currentFilename, isDirty, autoLayout, toPipelineJSON, markClean, loadPipeline, studioMode, setStudioMode, nodes } = useStudioStore()
  const { stepState, startStepMode, stepNext, stopStepMode, clearAll, nodeCache } = useDebugStore()
  const { dirty: agenticDirty, syncToBackend: agenticSync, fetchConfig: agenticRefresh } = useAgenticConfigStore()
  const [pipelines, setPipelines] = useState<PipelineListItem[]>([])
  const [saving, setSaving] = useState(false)
  const [agenticSaving, setAgenticSaving] = useState(false)
  const [stepping, setStepping] = useState(false)
  const [showSelector, setShowSelector] = useState(false)
  const [showPromptSync, setShowPromptSync] = useState(false)
  const [saveHint, setSaveHint] = useState<string | null>(null)
  const selectorRef = useRef<HTMLDivElement>(null)

  // S3.3: 启动逐步执行
  const handleStartStepMode = useCallback(() => {
    const nodeIds = nodes
      .filter(n => {
        const d = n.data as { label?: string }
        return d.label !== 'START' && d.label !== 'END'
      })
      .map(n => n.id)
    if (nodeIds.length === 0) return
    startStepMode(nodeIds)
  }, [nodes, startStepMode])

  const handleStepNext = useCallback(async () => {
    if (stepping) return
    setStepping(true)
    try { await stepNext() } catch { /* handled in store */ }
    finally { setStepping(false) }
  }, [stepping, stepNext])

  const cachedCount = Object.values(nodeCache).filter(c => c.status === 'done').length

  useEffect(() => {
    fetchPipelines().then(r => setPipelines(r.pipelines)).catch(() => {})
  }, [])

  // 外部点击关闭管线选择器
  useEffect(() => {
    if (!showSelector) return
    const handleClick = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setShowSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showSelector])

  const handleLoad = useCallback(async (filename: string) => {
    try {
      const p = await fetchPipeline(filename)
      loadPipeline(p, filename)
      setShowSelector(false)
    } catch (err) {
      console.error('加载管线失败:', err)
    }
  }, [loadPipeline])

  const handleSave = useCallback(async () => {
    if (!currentFilename) return
    const pipelineJSON = toPipelineJSON()
    if (!pipelineJSON) return
    setSaving(true)
    try {
      await savePipeline(currentFilename, pipelineJSON)
      markClean()
    } catch (err) {
      console.error('保存管线失败:', err)
    } finally {
      setSaving(false)
    }
  }, [currentFilename, toPipelineJSON, markClean])

  const handleExportJSON = useCallback(() => {
    const pipelineJSON = toPipelineJSON()
    if (!pipelineJSON) return
    const blob = new Blob([JSON.stringify(pipelineJSON, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = currentFilename || 'pipeline.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [toPipelineJSON, currentFilename])

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b"
      style={{ background: 'var(--novo-bg-elevated)', borderColor: 'var(--novo-border-default)' }}
    >
      {/* 管线选择器 */}
      <div className="relative" ref={selectorRef}>
        <button
          onClick={() => setShowSelector(!showSelector)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--novo-bg-hover)]"
          style={{ color: 'var(--novo-text-primary)', border: '1px solid var(--novo-border-default)' }}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          {currentFilename ? currentFilename.replace('.json', '') : '选择管线'}
          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
        </button>

        {showSelector && (
          <div
            className="absolute top-full left-0 mt-1 w-56 rounded-xl overflow-hidden z-50"
            style={{ background: 'var(--novo-bg-elevated)', border: '1px solid var(--novo-border-default)', boxShadow: 'var(--novo-shadow-lg)' }}
          >
            {pipelines.map(p => (
              <button
                key={p.filename}
                onClick={() => handleLoad(p.filename)}
                className="w-full text-left px-3 py-2.5 text-xs transition-colors hover:bg-[var(--novo-bg-hover)]"
                style={{ color: 'var(--novo-text-primary)' }}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-[9px] mt-0.5" style={{ color: 'var(--novo-text-muted)' }}>
                  {p.node_count} 节点 · {p.edge_count} 边
                  {p.is_builtin && ' · 内置'}
                </div>
              </button>
            ))}
            {pipelines.length === 0 && (
              <div className="px-3 py-4 text-center text-[10px]" style={{ color: 'var(--novo-text-disabled)' }}>
                暂无管线
              </div>
            )}
          </div>
        )}
      </div>

      {/* 模式切换: 传统工作流 / 智能体工作流 */}
      <div
        className="flex items-center rounded-lg p-0.5 ml-3"
        style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}
      >
        <button
          onClick={() => setStudioMode('standard')}
          title="Standard — 传统工作流模式"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all"
          style={{
            background: studioMode === 'standard' ? 'var(--novo-bg-elevated)' : 'transparent',
            color: studioMode === 'standard' ? '#2563EB' : 'var(--novo-text-muted)',
            boxShadow: studioMode === 'standard' ? 'var(--novo-shadow-sm)' : 'none',
          }}
        >
          <Workflow className="w-3 h-3" />
          Standard
        </button>
        <button
          onClick={() => setStudioMode('agentic')}
          title="Agentic — 智能体工作流模式"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all"
          style={{
            background: studioMode === 'agentic' ? 'var(--novo-bg-elevated)' : 'transparent',
            color: studioMode === 'agentic' ? '#7C3AED' : 'var(--novo-text-muted)',
            boxShadow: studioMode === 'agentic' ? 'var(--novo-shadow-sm)' : 'none',
          }}
        >
          <Zap className="w-3 h-3" />
          Agentic
        </button>
      </div>

      {/* T6.1: Agentic 智能体工作流专属按钮 */}
      {studioMode === 'agentic' && (
        <div className="flex items-center gap-1 ml-3">
          <button
            onClick={async () => { setAgenticSaving(true); await agenticSync(); setAgenticSaving(false) }}
            disabled={!agenticDirty || agenticSaving}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-40"
            style={{
              background: agenticDirty ? '#7C3AED' : 'var(--novo-bg-surface)',
              color: agenticDirty ? 'white' : 'var(--novo-text-muted)',
            }}
            title="保存 Agentic 智能体配置并热重载"
          >
            {agenticSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            保存配置
          </button>
          <button
            onClick={() => agenticRefresh()}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-[var(--novo-bg-hover)]"
            style={{ color: 'var(--novo-text-secondary)' }}
            title="从后端重新加载配置"
          >
            <RefreshCw className="w-3 h-3" />
            重载
          </button>
        </div>
      )}

      {/* S3.3: 调试控制区 — 仅 Standard 传统工作流模式 */}
      {studioMode !== 'agentic' && <div className="flex items-center gap-1 ml-3 px-2 py-0.5 rounded-lg" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
        {!stepState.active ? (
          <button
            onClick={handleStartStepMode}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold transition-colors hover:bg-[var(--novo-bg-hover)]"
            style={{ color: '#7C3AED' }}
            title="逐步执行管线"
          >
            <StepForward className="w-3 h-3" />
            逐步
          </button>
        ) : (
          <>
            <button
              onClick={handleStepNext}
              disabled={stepping || stepState.currentIndex >= stepState.queue.length}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold transition-colors hover:bg-[var(--novo-bg-hover)] disabled:opacity-40"
              style={{ color: '#7C3AED' }}
              title="执行下一个节点"
            >
              {stepping ? <Loader2 className="w-3 h-3 animate-spin" /> : <SkipForward className="w-3 h-3" />}
              下一步 ({stepState.currentIndex + 1}/{stepState.queue.length})
            </button>
            <button
              onClick={stopStepMode}
              className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-semibold transition-colors hover:bg-[var(--novo-bg-hover)]"
              style={{ color: '#EF4444' }}
              title="停止逐步"
            >
              <Square className="w-2.5 h-2.5" />
            </button>
          </>
        )}
        {cachedCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-medium transition-colors hover:bg-[var(--novo-bg-hover)]"
            style={{ color: 'var(--novo-text-muted)' }}
            title="清除所有调试缓存"
          >
            <Eraser className="w-2.5 h-2.5" />
            {cachedCount}
          </button>
        )}
      </div>}

      <div className="flex-1" />

      {/* 同步 Prompt — 仅 Standard 传统工作流 */}
      {studioMode !== 'agentic' && (
      <button
        onClick={() => setShowPromptSync(true)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-[var(--novo-bg-hover)]"
        style={{ color: '#0D9488' }}
        title="根据报告组件同步全体 Agent Prompt"
      >
        <Wand2 className="w-3.5 h-3.5" />
        同步 Prompt
      </button>
      )}

      <Link
        to="/studio/agent-designer"
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-[var(--novo-bg-hover)]"
        style={{ color: 'var(--novo-text-secondary)' }}
        title="Agent 设计器"
      >
        <Bot className="w-3.5 h-3.5" />
        设计器
      </Link>

      {/* 操作按钮 */}
      <button
        onClick={autoLayout}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-[var(--novo-bg-hover)]"
        style={{ color: 'var(--novo-text-secondary)' }}
        title="自动布局"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        布局
      </button>

      <button
        onClick={handleExportJSON}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-[var(--novo-bg-hover)]"
        style={{ color: 'var(--novo-text-secondary)' }}
        title="导出 JSON"
      >
        <Download className="w-3.5 h-3.5" />
        导出
      </button>

      <div className="relative">
        <button
          onClick={() => {
            if (currentFilename === 'standard.json') {
              setSaveHint('内置管线不可修改，请导出后另存为自定义管线')
              setTimeout(() => setSaveHint(null), 3000)
              return
            }
            handleSave()
          }}
          disabled={!isDirty || saving || !currentFilename}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-40"
          style={{
            background: isDirty ? 'var(--novo-accent-primary)' : 'var(--novo-bg-surface)',
            color: isDirty ? 'white' : 'var(--novo-text-muted)',
          }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          保存
        </button>
        {saveHint && (
          <div className="absolute bottom-full right-0 mb-1 px-2.5 py-1.5 rounded-lg text-[9px] font-medium whitespace-nowrap z-50"
            style={{ background: 'var(--novo-accent-warning)', color: 'white', boxShadow: 'var(--novo-shadow-sm)' }}>
            {saveHint}
          </div>
        )}
      </div>

      {/* Prompt 同步模态框 */}
      <PromptSyncModal open={showPromptSync} onClose={() => setShowPromptSync(false)} />
    </div>
  )
}
