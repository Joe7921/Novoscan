/**
 * StudioBottomDrawer — VS Code 风格可拖拉底部抽屉
 *
 * Tab 面板：分析 | 进度&结果 | 运行器 | 日志
 * 三态：最小化(36px) → 默认(280px) → 最大化(50vh)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  FlaskConical,
  Cpu,
  Play,
  Square,
  Loader2,
  Terminal,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  GripHorizontal,
  Server,
  Search,
  ScrollText,
  AlertCircle,
  Wrench,
  MessageSquarePlus,
  Check,
  Globe,
  BookOpen,
  Github,
  Keyboard,
  Clock,
  Download,
  RotateCcw,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStudioStore, type StudioNodeData } from '@/lib/studioStore'
import { startAnalysisStream, fetchHealth, fetchDebugHistory } from '@/lib/api'
import { consumeSSE } from '@/lib/sse'
import { isAgenticPaused, useAnalysis } from '@/hooks/useAnalysis'
import { useDebugStore } from '@/lib/debugStore'
import { useAgenticCanvasStore } from '@/lib/agenticCanvasStore'
import ProgressTracker from '@/components/analysis/ProgressTracker'
import IntentConfirm from '@/components/analysis/IntentConfirm'
import ResultView from '@/components/analysis/ResultView'
import AgenticPauseCard from './AgenticPauseCard'
import VariableInspector from './VariableInspector'
import AgenticDebugPanel from './AgenticDebugPanel'
import { saveRecord } from '@/lib/historyStore'
import type { FinalReport } from '@/types/report'

// ── 常量 ──

const MIN_H = 36
const DEFAULT_H = 280
const MAX_H_RATIO = 0.5

const TABS = [
  { key: 'analyze', label: '分析', icon: FlaskConical },
  { key: 'progress', label: '进度 & 结果', icon: ScrollText },
  { key: 'inspector', label: '变量检查器', icon: Search },
  { key: 'agentic', label: 'Agentic 智能体调试', icon: Cpu },
  { key: 'runner', label: '运行器', icon: Terminal },
  { key: 'history', label: '运行历史', icon: Clock },
] as const

type TabKey = (typeof TABS)[number]['key']

const DETECTION_TYPES = [
  { value: 'auto', label: '自动检测' },
  { value: 'academic', label: '学术创新' },
  { value: 'industrial', label: '产业创新' },
  { value: 'skill', label: '技术创新' },
]

const ALL_TOOLS = [
  { id: 'search_openalex', label: 'OpenAlex', icon: BookOpen, color: '#E63946', desc: '学术论文' },
  { id: 'search_arxiv', label: 'arXiv', icon: BookOpen, color: '#B7094C', desc: '预印本' },
  { id: 'search_crossref', label: 'CrossRef', icon: BookOpen, color: '#2A9D8F', desc: '引用数据' },
  { id: 'search_brave', label: 'Brave', icon: Globe, color: '#FB5607', desc: '网页搜索', needKey: true },
  { id: 'search_github', label: 'GitHub', icon: Github, color: '#6E40C9', desc: '开源项目' },
]

// ── 组件 ──

export default function StudioBottomDrawer() {
  // 抽屉状态
  const [height, setHeight] = useState(() => {
    try { const v = localStorage.getItem('studio-drawer-h'); return v ? Number(v) : DEFAULT_H } catch { return DEFAULT_H }
  })
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('studio-drawer-collapsed') === 'true' } catch { return false }
  })
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    try { return (localStorage.getItem('studio-drawer-tab') as TabKey) || 'analyze' } catch { return 'analyze' }
  })

  // 分析状态（复用 useAnalysis）
  const { state: analysisState, startAnalysis, resume, reset: resetAnalysis } = useAnalysis()

  // P3: 画布→DebugPanel 联动信号
  const linkToDebugPanel = useAgenticCanvasStore(s => s.linkToDebugPanel)
  const consumeLinkSignal = useAgenticCanvasStore(s => s.consumeLinkSignal)
  useEffect(() => {
    if (linkToDebugPanel) {
      setActiveTab('agentic')
      if (collapsed) setCollapsed(false)
      consumeLinkSignal()
    }
  }, [linkToDebugPanel, consumeLinkSignal])

  // 分析输入
  const [input, setInput] = useState('')
  const [detectionType, setDetectionType] = useState('auto')
  const [mode, setMode] = useState<'standard' | 'agentic'>('standard')
  const [modelInfo, setModelInfo] = useState<{ provider: string; ready: boolean } | null>(null)
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_TOOLS.map(t => [t.id, true]))
  )
  const [toolsExpanded, setToolsExpanded] = useState(false)
  const [extraInstructions, setExtraInstructions] = useState('')
  const [promptExpanded, setPromptExpanded] = useState(false)
  const savedRef = useRef(false)
  const inputSnapshotRef = useRef({ input: '', detectionType: 'auto' })

  // 运行器状态
  const [runnerQuery, setRunnerQuery] = useState('')
  const [runnerRunning, setRunnerRunning] = useState(false)
  const [runnerLogs, setRunnerLogs] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  // 拖拽
  const dragging = useRef(false)
  const startY = useRef(0)
  const startH = useRef(0)

  // 初始化
  useEffect(() => {
    fetchHealth()
      .then(h => setModelInfo({ provider: h.model_provider, ready: h.model_ready }))
      .catch(() => setModelInfo(null))
  }, [])

  // 自动保存历史
  useEffect(() => {
    if (analysisState.phase === 'completed' && !savedRef.current) {
      savedRef.current = true
      const report = analysisState.reportJson as unknown as FinalReport | null
      saveRecord({
        userInput: inputSnapshotRef.current.input,
        detectionType: inputSnapshotRef.current.detectionType,
        mode: analysisState.mode,
        score: analysisState.finalScore ?? report?.report?.meta?.overallScore ?? null,
        noveltyLevel: report?.report?.meta?.noveltyLevel ?? null,
        report,
        agenticOutput: analysisState.finalOutput,
      })
    }
    if (analysisState.phase === 'idle') savedRef.current = false
  }, [analysisState.phase, analysisState.reportJson, analysisState.finalScore, analysisState.finalOutput, analysisState.mode])

  // 分析开始时自动切到进度 tab
  useEffect(() => {
    if (analysisState.phase === 'analyzing_intent' || analysisState.phase === 'running') {
      setActiveTab('progress')
      if (collapsed) setCollapsed(false)
    }
  }, [analysisState.phase])

  // 持久化
  useEffect(() => { try { localStorage.setItem('studio-drawer-h', String(height)) } catch {} }, [height])
  useEffect(() => { try { localStorage.setItem('studio-drawer-collapsed', String(collapsed)) } catch {} }, [collapsed])
  useEffect(() => { try { localStorage.setItem('studio-drawer-tab', activeTab) } catch {} }, [activeTab])

  // 拖拽逻辑
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startY.current = e.clientY
    startH.current = height

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const maxH = window.innerHeight * MAX_H_RATIO
      const newH = Math.min(maxH, Math.max(100, startH.current - (ev.clientY - startY.current)))
      setHeight(newH)
      if (collapsed) setCollapsed(false)
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [height, collapsed])

  const toggleCollapse = useCallback(() => {
    setCollapsed(p => !p)
  }, [])

  // ── 分析提交 ──
  const enabledToolsList = ALL_TOOLS.filter(t => enabledTools[t.id]).map(t => t.id)
  const canSubmit = input.trim().length > 0 && analysisState.phase === 'idle'
  const isAnalysisRunning = analysisState.phase === 'analyzing_intent' || analysisState.phase === 'running'

  const handleAnalysisSubmit = useCallback(() => {
    if (!canSubmit) return
    inputSnapshotRef.current = { input: input.trim(), detectionType }
    startAnalysis(input.trim(), detectionType, mode, {
      enabledTools: enabledToolsList.length === ALL_TOOLS.length ? null : enabledToolsList,
      extraInstructions: extraInstructions.trim() || undefined,
    })
  }, [canSubmit, input, detectionType, mode, startAnalysis, enabledToolsList, extraInstructions])

  // ── 运行器 ──
  const { nodes, currentFilename } = useStudioStore()

  const setNodeStatus = useCallback((nodeId: string, status: StudioNodeData['status']) => {
    useStudioStore.setState(s => ({
      nodes: s.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status } } : n),
    }))
  }, [])

  const resetNodeStatuses = useCallback(() => {
    useStudioStore.setState(s => ({
      nodes: s.nodes.map(n => ({ ...n, data: { ...n.data, status: 'idle' } })),
    }))
  }, [])

  const handleRunnerRun = useCallback(async () => {
    if (!runnerQuery.trim() || runnerRunning) return
    setRunnerRunning(true)
    setRunnerLogs([])
    resetNodeStatuses()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await startAnalysisStream({ user_raw_input: runnerQuery.trim(), detection_type: 'auto', pipeline: currentFilename || null }, ac.signal)
      if (!res.ok) { setRunnerLogs(p => [...p, `[ERROR] HTTP ${res.status}`]); setRunnerRunning(false); return }
      await consumeSSE(res, (sseEvt) => {
        const { event: type, data } = sseEvt
        if (type === 'node_enter') { setNodeStatus((data as Record<string, unknown>).node as string, 'running'); setRunnerLogs(p => [...p, `▶ 进入节点: ${(data as Record<string, unknown>).node}`]) }
        else if (type === 'node_exit' || type === 'node_done') {
          const evtData = data as Record<string, unknown>
          const nodeId = evtData.node as string
          setNodeStatus(nodeId, 'done')
          setRunnerLogs(p => [...p, `✓ 完成节点: ${nodeId}${evtData.duration_ms ? ` (${evtData.duration_ms}ms)` : ''}`])
          if (evtData.inputs || evtData.outputs) {
            useDebugStore.getState().updateNodeFromSSE(nodeId, {
              inputs: (evtData.inputs || {}) as Record<string, unknown>,
              outputs: (evtData.outputs || {}) as Record<string, unknown>,
              duration_ms: (evtData.duration_ms as number) || 0,
            })
          }
        }
        else if (type === 'tool_call') { setRunnerLogs(p => [...p, `🔧 调用工具: ${(data as Record<string, unknown>).tool_name}`]) }
        else if (type === 'tool_call_start') {
          const d = data as Record<string, unknown>
          setRunnerLogs(p => [...p, `🔧 开始调用: ${d.tool}`])
          useDebugStore.getState().addTraceStep({
            type: 'tool_call_start',
            timestamp: Date.now(),
            tool: d.tool as string,
            argsPreview: d.args_preview as string,
            step_index: useDebugStore.getState().agenticTrace.length,
          })
        }
        else if (type === 'tool_call_done') {
          const d = data as Record<string, unknown>
          setRunnerLogs(p => [...p, `✓ 工具完成: ${d.tool}`])
          useDebugStore.getState().addTraceStep({
            type: 'tool_call_done',
            timestamp: Date.now(),
            tool: d.tool as string,
            resultPreview: d.result_preview as string,
            step_index: useDebugStore.getState().agenticTrace.length,
          })
        }
        else if (type === 'agent_thinking') {
          useDebugStore.getState().addTraceStep({
            type: 'thinking',
            timestamp: Date.now(),
            step_index: useDebugStore.getState().agenticTrace.length,
          })
        }
        else if (type === 'error') { setRunnerLogs(p => [...p, `[ERROR] ${(data as Record<string, unknown>).message}`]) }
        else if (type === 'done') { setRunnerLogs(p => [...p, '✅ 运行完成']) }
      }, (err) => { setRunnerLogs(p => [...p, `[ERROR] ${err.message}`]) })
    } catch (err) { if ((err as Error).name !== 'AbortError') setRunnerLogs(p => [...p, `[ERROR] ${(err as Error).message}`]) }
    finally { setRunnerRunning(false) }
  }, [runnerQuery, runnerRunning, currentFilename, setNodeStatus, resetNodeStatuses])

  const handleRunnerStop = useCallback(() => { abortRef.current?.abort(); setRunnerRunning(false) }, [])

  // ── 渲染 ──

  const effectiveH = collapsed ? MIN_H : height

  return (
    <div
      className="flex flex-col shrink-0"
      style={{ height: effectiveH, background: 'var(--novo-bg-elevated)', borderTop: '1px solid var(--novo-border-default)' }}
    >
      {/* 拖拽手柄 + Tab 栏 */}
      <div
        className="flex items-center shrink-0 select-none"
        style={{ height: MIN_H, borderBottom: collapsed ? 'none' : '1px solid var(--novo-border-default)' }}
      >
        {/* 拖拽条 */}
        <div
          onMouseDown={onDragStart}
          className="absolute left-0 right-0 h-1 cursor-row-resize hover:bg-[var(--novo-accent-primary)] transition-colors"
          style={{ top: 0, opacity: 0.4 }}
        />

        {/* Tab 按钮 */}
        <div className="flex items-center gap-0.5 px-3 flex-1 min-w-0">
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = !collapsed && activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => {
                  if (collapsed) { setCollapsed(false); setActiveTab(tab.key) }
                  else if (activeTab === tab.key) setCollapsed(true)
                  else setActiveTab(tab.key)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-t-lg transition-colors"
                style={{
                  color: active ? 'var(--novo-accent-primary)' : 'var(--novo-text-muted)',
                  background: active ? 'var(--novo-bg-surface)' : 'transparent',
                  borderBottom: active ? '2px solid var(--novo-accent-primary)' : '2px solid transparent',
                }}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
                {tab.key === 'analyze' && isAnalysisRunning && (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ color: 'var(--novo-accent-warning)' }} />
                )}
                {tab.key === 'runner' && runnerRunning && (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ color: 'var(--novo-accent-warning)' }} />
                )}
              </button>
            )
          })}
        </div>

        {/* 折叠按钮 */}
        <button
          onClick={toggleCollapse}
          className="px-3 py-1 hover:bg-[var(--novo-bg-hover)] rounded transition-colors"
          title={collapsed ? '展开' : '收起'}
        >
          {collapsed
            ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--novo-text-muted)' }} />
            : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--novo-text-muted)' }} />
          }
        </button>
      </div>

      {/* Tab 内容区 */}
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'analyze' && (
            <AnalyzeTab
              input={input} setInput={setInput}
              detectionType={detectionType} setDetectionType={setDetectionType}
              mode={mode} setMode={setMode}
              modelInfo={modelInfo}
              enabledTools={enabledTools} setEnabledTools={setEnabledTools}
              toolsExpanded={toolsExpanded} setToolsExpanded={setToolsExpanded}
              extraInstructions={extraInstructions} setExtraInstructions={setExtraInstructions}
              promptExpanded={promptExpanded} setPromptExpanded={setPromptExpanded}
              canSubmit={canSubmit}
              isRunning={isAnalysisRunning}
              onSubmit={handleAnalysisSubmit}
              onReset={resetAnalysis}
            />
          )}
          {activeTab === 'progress' && (
            <ProgressTab
              state={analysisState}
              currentInput={input}
              onSyncInput={setInput}
              onResume={resume}
              onReset={resetAnalysis}
            />
          )}
          {activeTab === 'inspector' && (
            <VariableInspector />
          )}
          {activeTab === 'agentic' && (
            <AgenticDebugPanel analysisState={analysisState} />
          )}
          {activeTab === 'runner' && (
            <RunnerTab
              query={runnerQuery} setQuery={setRunnerQuery}
              running={runnerRunning}
              logs={runnerLogs}
              onRun={handleRunnerRun}
              onStop={handleRunnerStop}
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab />
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════
// Tab: 分析
// ══════════════════════════════════════════

interface AnalyzeTabProps {
  input: string; setInput: (v: string) => void
  detectionType: string; setDetectionType: (v: string) => void
  mode: 'standard' | 'agentic'; setMode: (v: 'standard' | 'agentic') => void
  modelInfo: { provider: string; ready: boolean } | null
  enabledTools: Record<string, boolean>; setEnabledTools: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  toolsExpanded: boolean; setToolsExpanded: (v: boolean) => void
  extraInstructions: string; setExtraInstructions: (v: string) => void
  promptExpanded: boolean; setPromptExpanded: (v: boolean) => void
  canSubmit: boolean
  isRunning: boolean
  onSubmit: () => void
  onReset: () => void
}

function AnalyzeTab(props: AnalyzeTabProps) {
  const {
    input, setInput, detectionType, setDetectionType,
    mode, setMode, modelInfo,
    enabledTools, setEnabledTools,
    toolsExpanded, setToolsExpanded,
    extraInstructions, setExtraInstructions,
    promptExpanded, setPromptExpanded,
    canSubmit, isRunning, onSubmit, onReset,
  } = props

  const enabledToolsList = ALL_TOOLS.filter(t => enabledTools[t.id])

  return (
    <div className="h-full flex overflow-hidden">
      {/* 左区：输入 + 模式 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxWidth: 480 }}>
        {/* 模式切换 */}
        <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: 'var(--novo-bg-surface)' }}>
          <button
            onClick={() => setMode('standard')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
            style={{
              background: mode === 'standard' ? 'var(--novo-bg-elevated)' : 'transparent',
              color: mode === 'standard' ? 'var(--novo-accent-primary)' : 'var(--novo-text-muted)',
              boxShadow: mode === 'standard' ? 'var(--novo-shadow-sm)' : 'none',
            }}
          >
            <FlaskConical className="w-3 h-3" /> Standard
          </button>
          <button
            onClick={() => setMode('agentic')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
            style={{
              background: mode === 'agentic' ? 'var(--novo-bg-elevated)' : 'transparent',
              color: mode === 'agentic' ? 'var(--novo-accent-info)' : 'var(--novo-text-muted)',
              boxShadow: mode === 'agentic' ? 'var(--novo-shadow-sm)' : 'none',
            }}
          >
            <Cpu className="w-3 h-3" /> Agentic
          </button>
        </div>

        {/* 输入框 */}
        <div className="novo-card p-1">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) { e.preventDefault(); onSubmit() } }}
            placeholder="描述你的创新想法..."
            disabled={isRunning}
            className="w-full px-3 py-2 text-[11px] bg-transparent border-none resize-none focus:outline-none"
            style={{ color: 'var(--novo-text-primary)', minHeight: 60 }}
            rows={3}
          />
          <div className="flex items-center justify-between px-3 py-1.5 border-t" style={{ borderColor: 'var(--novo-border-default)' }}>
            <select
              value={detectionType}
              onChange={e => setDetectionType(e.target.value)}
              className="text-[10px] px-2 py-1 rounded-lg appearance-none pr-5 cursor-pointer novo-input"
            >
              {DETECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {modelInfo && (
              <span className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--novo-text-muted)' }}>
                <Server className="w-2.5 h-2.5" />
                {modelInfo.provider || '未配置'}
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: modelInfo.ready ? 'var(--novo-accent-success)' : 'var(--novo-accent-danger)' }} />
              </span>
            )}
          </div>
        </div>

        {/* 提交 */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-semibold transition-all"
            style={{
              background: canSubmit ? 'var(--novo-accent-primary)' : 'var(--novo-bg-active)',
              color: canSubmit ? 'white' : 'var(--novo-text-disabled)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />}
            {isRunning ? '分析中...' : '开始分析'}
          </button>
          {isRunning && (
            <button onClick={onReset} className="px-3 py-2 rounded-xl text-[10px] font-medium" style={{ color: 'var(--novo-text-muted)', border: '1px solid var(--novo-border-default)' }}>
              取消
            </button>
          )}
        </div>
      </div>

      {/* 右区：工具链 + 额外指令 */}
      <div
        className="w-56 shrink-0 overflow-y-auto px-3 py-3 space-y-2"
        style={{ borderLeft: '1px solid var(--novo-border-default)' }}
      >
        {/* 工具链 */}
        <button
          onClick={() => setToolsExpanded(!toolsExpanded)}
          className="flex items-center gap-1.5 w-full text-left text-[10px] font-semibold"
          style={{ color: 'var(--novo-text-secondary)' }}
        >
          <ChevronRight className="w-3 h-3 transition-transform" style={{ transform: toolsExpanded ? 'rotate(90deg)' : 'none' }} />
          <Wrench className="w-3 h-3" />
          搜索引擎
          <span className="ml-auto text-[9px] font-normal" style={{ color: 'var(--novo-text-muted)' }}>
            {enabledToolsList.length}/{ALL_TOOLS.length}
          </span>
        </button>
        {toolsExpanded && (
          <div className="space-y-1 py-1">
            {ALL_TOOLS.map(t => {
              const Icon = t.icon
              const enabled = enabledTools[t.id]
              return (
                <button
                  key={t.id}
                  onClick={() => setEnabledTools(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                  className="flex items-center gap-2 w-full px-2 py-1 rounded-lg text-[9px] transition-all"
                  style={{
                    background: enabled ? `color-mix(in srgb, ${t.color} 8%, transparent)` : 'transparent',
                    color: enabled ? 'var(--novo-text-primary)' : 'var(--novo-text-disabled)',
                  }}
                >
                  <div className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
                    style={{ background: enabled ? t.color : 'var(--novo-bg-active)', opacity: enabled ? 1 : 0.4 }}>
                    {enabled ? <Check className="w-2 h-2 text-white" /> : <Icon className="w-2 h-2" style={{ color: 'var(--novo-text-disabled)' }} />}
                  </div>
                  <span className="font-medium">{t.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* 额外指令 */}
        <button
          onClick={() => setPromptExpanded(!promptExpanded)}
          className="flex items-center gap-1.5 w-full text-left text-[10px] font-semibold"
          style={{ color: 'var(--novo-text-secondary)' }}
        >
          <ChevronRight className="w-3 h-3 transition-transform" style={{ transform: promptExpanded ? 'rotate(90deg)' : 'none' }} />
          <MessageSquarePlus className="w-3 h-3" />
          额外指令
          {extraInstructions.trim() && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--novo-accent-primary)' }} />}
        </button>
        {promptExpanded && (
          <textarea
            value={extraInstructions}
            onChange={e => setExtraInstructions(e.target.value)}
            placeholder="例如：重点关注专利数据..."
            rows={2}
            className="w-full px-2 py-1.5 text-[9px] rounded-lg border resize-none focus:outline-none"
            style={{ background: 'var(--novo-bg-surface)', borderColor: 'var(--novo-border-default)', color: 'var(--novo-text-primary)' }}
          />
        )}

        {/* 快捷键提示 */}
        <div className="pt-2 text-[8px] space-y-0.5" style={{ color: 'var(--novo-text-disabled)' }}>
          <div className="flex items-center gap-1">
            <Keyboard className="w-2.5 h-2.5" />
            <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>Ctrl+↵</kbd>
            提交
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// Tab: 进度 & 结果
// ══════════════════════════════════════════

interface ProgressTabProps {
  state: ReturnType<typeof useAnalysis>['state']
  currentInput: string
  onSyncInput: (value: string) => void
  onResume: ReturnType<typeof useAnalysis>['resume']
  onReset: () => void
}

function ProgressTab({ state, currentInput, onSyncInput, onResume, onReset }: ProgressTabProps) {
  if (state.phase === 'idle') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FlaskConical className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--novo-text-disabled)' }} />
          <p className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>尚未开始分析，在「分析」Tab 中提交任务</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      {(state.phase === 'analyzing_intent' || state.phase === 'running') && (
        <ProgressTracker
          nodes={state.nodes}
          mode={state.mode}
          toolCalls={state.toolCalls}
          agentProgress={state.agentProgress}
          debateExchanges={state.debateExchanges}
          streamingTokens={state.streamingTokens}
        />
      )}

      {isAgenticPaused(state) && (
        <AgenticPauseCard
          state={state}
          currentInput={currentInput}
          onSyncInput={onSyncInput}
          onResume={onResume}
        />
      )}

      {state.phase === 'awaiting_confirmation' && state.analyzedIntent && (
        <IntentConfirm
          intent={state.analyzedIntent}
          onConfirm={() => onResume('confirm')}
          onRevise={(fb) => onResume('revise', fb)}
        />
      )}

      {state.phase === 'completed' && (
        <ResultView state={state} onReset={onReset} />
      )}

      {state.phase === 'error' && (
        <div className="max-w-xl mx-auto">
          <div className="novo-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4" style={{ color: 'var(--novo-accent-danger)' }} />
              <h3 className="text-xs font-bold" style={{ color: 'var(--novo-accent-danger)' }}>分析出错</h3>
            </div>
            <p className="text-[10px] mb-3" style={{ color: 'var(--novo-text-secondary)' }}>{state.error}</p>
            <button onClick={onReset} className="px-3 py-1.5 rounded-xl text-[10px] font-semibold" style={{ background: 'var(--novo-accent-primary)', color: 'white' }}>
              重新开始
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════
// Tab: 运行器
// ══════════════════════════════════════════

interface RunnerTabProps {
  query: string; setQuery: (v: string) => void
  running: boolean
  logs: string[]
  onRun: () => void
  onStop: () => void
}

function RunnerTab({ query, setQuery, running, logs, onRun, onStop }: RunnerTabProps) {
  return (
    <div className="h-full flex flex-col px-4 py-3">
      {/* 输入行 */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onRun()}
          placeholder="输入测试 query，运行当前管线..."
          disabled={running}
          className="flex-1 px-3 py-1.5 rounded-lg text-[10px] outline-none novo-input"
        />
        {running ? (
          <button onClick={onStop} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: '#EF4444', color: 'white' }}>
            <Square className="w-3 h-3" /> 停止
          </button>
        ) : (
          <button onClick={onRun} disabled={!query.trim()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-40" style={{ background: 'var(--novo-accent-primary)', color: 'white' }}>
            <Play className="w-3 h-3" /> 运行
          </button>
        )}
      </div>

      {/* 日志 */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg px-3 py-2 font-mono text-[9px] space-y-0.5"
        style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-secondary)' }}
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <span className="text-[10px]" style={{ color: 'var(--novo-text-disabled)' }}>运行管线后日志将在此显示</span>
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{ color: log.includes('[ERROR]') ? '#EF4444' : undefined }}>{log}</div>
          ))
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// Tab: 运行历史
// ══════════════════════════════════════════

function HistoryTab() {
  const { runHistory, setRunHistory, loadFromHistory } = useDebugStore()
  const [loading, setLoading] = useState(false)

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchDebugHistory(30)
      setRunHistory(data.runs)
    } catch (err) {
      console.warn('获取运行历史失败:', err)
    } finally {
      setLoading(false)
    }
  }, [setRunHistory])

  // 首次加载
  useEffect(() => { handleRefresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoad = useCallback((record: typeof runHistory[number]) => {
    loadFromHistory(record)
  }, [loadFromHistory])

  return (
    <div className="h-full flex flex-col px-4 py-3">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-primary)' }}>
          管线运行记录
        </span>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] hover:bg-[var(--novo-bg-hover)] transition-colors"
          style={{ color: 'var(--novo-text-muted)' }}
        >
          {loading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RotateCcw className="w-2.5 h-2.5" />}
          刷新
        </button>
      </div>

      {/* 列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
        {runHistory.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <span className="text-[10px]" style={{ color: 'var(--novo-text-disabled)' }}>暂无运行记录</span>
          </div>
        ) : (
          runHistory.map(record => (
            <div
              key={record.run_id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[var(--novo-bg-hover)] transition-colors"
              style={{ border: '1px solid var(--novo-border-default)' }}
              onClick={() => handleLoad(record)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-semibold truncate" style={{ color: 'var(--novo-text-primary)' }}>
                    {record.user_input}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--novo-text-muted)' }}>
                  <span>{record.pipeline}</span>
                  <span>·</span>
                  <span>{record.mode}</span>
                  <span>·</span>
                  <span>{record.node_count} 节点</span>
                  <span>·</span>
                  <span>{record.total_duration_ms}ms</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: record.status === 'completed' ? 'var(--novo-accent-success-light, rgba(22,163,74,0.1))' : 'var(--novo-accent-danger-light, rgba(239,68,68,0.1))',
                    color: record.status === 'completed' ? 'var(--novo-accent-success)' : 'var(--novo-accent-danger)',
                  }}
                >
                  {record.status === 'completed' ? '完成' : '失败'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleLoad(record) }}
                  className="p-1 rounded hover:bg-[var(--novo-bg-active)]"
                  title="加载到变量检查器"
                >
                  <Download className="w-3 h-3" style={{ color: 'var(--novo-accent-primary)' }} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
