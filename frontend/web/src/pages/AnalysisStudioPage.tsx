import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical,
  Cpu,
  Loader2,
  ChevronDown,
  ChevronRight,
  Server,
  AlertCircle,
  Keyboard,
  Sparkles,
  Wrench,
  MessageSquarePlus,
  ScrollText,
  Check,
  Globe,
  BookOpen,
  Github,
  Search,
} from 'lucide-react'
import { isAgenticPaused, useAnalysis } from '@/hooks/useAnalysis'
import { fetchHealth } from '@/lib/api'
import { saveRecord } from '@/lib/historyStore'
import type { FinalReport } from '@/types/report'
import ProgressTracker from '@/components/analysis/ProgressTracker'
import IntentConfirm from '@/components/analysis/IntentConfirm'
import ResultView from '@/components/analysis/ResultView'
import AgenticPauseCard from '@/components/studio/AgenticPauseCard'

const DETECTION_TYPES = [
  { value: 'auto',       label: '自动检测' },
  { value: 'academic',   label: '学术创新' },
  { value: 'industrial', label: '产业创新' },
  { value: 'skill',      label: '技术创新' },
]

const ALL_TOOLS = [
  { id: 'search_openalex',  label: 'OpenAlex',   icon: BookOpen, color: '#E63946', desc: '学术论文' },
  { id: 'search_arxiv',     label: 'arXiv',      icon: BookOpen, color: '#B7094C', desc: '预印本' },
  { id: 'search_crossref',  label: 'CrossRef',   icon: BookOpen, color: '#2A9D8F', desc: '引用数据' },
  { id: 'search_brave',     label: 'Brave',      icon: Globe,    color: '#FB5607', desc: '网页搜索', needKey: true },
  { id: 'search_github',    label: 'GitHub',     icon: Github,   color: '#6E40C9', desc: '开源项目' },
]

export default function AnalysisStudioPage() {
  const { state, startAnalysis, resume, reset } = useAnalysis()

  // 左栏状态
  const [input, setInput] = useState('')
  const [detectionType, setDetectionType] = useState('auto')
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('mode') === 'agentic' ? 'agentic' : 'standard'
  const [mode, setMode] = useState<'standard' | 'agentic'>(initialMode)
  const [modelInfo, setModelInfo] = useState<{ provider: string; ready: boolean } | null>(null)

  // 工具链配置
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_TOOLS.map(t => [t.id, true]))
  )
  const [toolsExpanded, setToolsExpanded] = useState(false)

  // Prompt 注入
  const [extraInstructions, setExtraInstructions] = useState('')
  const [promptExpanded, setPromptExpanded] = useState(false)

  // 实时日志
  const logEndRef = useRef<HTMLDivElement>(null)

  // 历史保存
  const savedRef = useRef(false)
  const inputSnapshotRef = useRef({ input: '', detectionType: 'auto' })

  useEffect(() => {
    fetchHealth()
      .then(h => setModelInfo({ provider: h.model_provider, ready: h.model_ready }))
      .catch(() => setModelInfo(null))
  }, [])

  // 自动保存历史
  useEffect(() => {
    if (state.phase === 'completed' && !savedRef.current) {
      savedRef.current = true
      const report = state.reportJson as unknown as FinalReport | null
      saveRecord({
        userInput: inputSnapshotRef.current.input,
        detectionType: inputSnapshotRef.current.detectionType,
        mode: state.mode,
        score: state.finalScore ?? report?.report?.meta?.overallScore ?? null,
        noveltyLevel: report?.report?.meta?.noveltyLevel ?? null,
        report: report,
        agenticOutput: state.finalOutput,
      })
    }
    if (state.phase === 'idle') {
      savedRef.current = false
    }
  }, [state.phase, state.reportJson, state.finalScore, state.finalOutput, state.mode])

  // 日志自动滚动
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.toolCalls])

  const canSubmit = input.trim().length > 0 && state.phase === 'idle'
  const isRunning = state.phase === 'analyzing_intent' || state.phase === 'running'

  const enabledToolsList = ALL_TOOLS.filter(t => enabledTools[t.id]).map(t => t.id)

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    inputSnapshotRef.current = { input: input.trim(), detectionType }
    startAnalysis(input.trim(), detectionType, mode, {
      enabledTools: enabledToolsList.length === ALL_TOOLS.length ? null : enabledToolsList,
      extraInstructions: extraInstructions.trim() || undefined,
    })
  }, [canSubmit, input, detectionType, mode, startAnalysis, enabledToolsList, extraInstructions])

  const toggleTool = (id: string) => {
    setEnabledTools(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // 全局快捷键
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        setMode(prev => prev === 'standard' ? 'agentic' : 'standard')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSubmit])

  return (
    <div className="flex h-screen">
      {/* ═══ 左栏：输入区 ═══ */}
      <aside
        className="shrink-0 flex flex-col h-full overflow-y-auto"
        style={{
          width: 380,
          borderRight: '1px solid var(--novo-border-default)',
          background: 'var(--novo-bg-elevated)',
        }}
      >
        {/* 标题 */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--novo-accent-primary)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>Studio</h2>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>
            分析工作台 — 输入想法，实时观察 Agent 工作
          </p>
        </div>

        {/* 模式切换 */}
        <div className="px-5 mb-3">
          <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: 'var(--novo-bg-surface)' }}>
            <button
              onClick={() => setMode('standard')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
              style={{
                background: mode === 'standard' ? 'var(--novo-bg-elevated)' : 'transparent',
                color: mode === 'standard' ? 'var(--novo-accent-primary)' : 'var(--novo-text-muted)',
                boxShadow: mode === 'standard' ? 'var(--novo-shadow-sm)' : 'none',
              }}
            >
              <FlaskConical className="w-3 h-3" />
              Standard
            </button>
            <button
              onClick={() => setMode('agentic')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
              style={{
                background: mode === 'agentic' ? 'var(--novo-bg-elevated)' : 'transparent',
                color: mode === 'agentic' ? 'var(--novo-accent-info)' : 'var(--novo-text-muted)',
                boxShadow: mode === 'agentic' ? 'var(--novo-shadow-sm)' : 'none',
              }}
            >
              <Cpu className="w-3 h-3" />
              Agentic
            </button>
          </div>
          <p className="text-[9px] text-center mt-1.5" style={{ color: 'var(--novo-text-disabled)' }}>
            {mode === 'standard'
              ? '传统工作流 · 按预定义节点顺序执行'
              : '智能体工作流 · AI 自主决策驱动'}
          </p>
        </div>

        {/* 输入区 */}
        <div className="px-5 flex flex-col">
          <div className="novo-card p-1 flex flex-col mb-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="描述你的创新想法..."
              disabled={isRunning}
              className="w-full px-3 py-2.5 text-xs bg-transparent border-none resize-none focus:outline-none min-h-[100px]"
              style={{ color: 'var(--novo-text-primary)' }}
            />
            <div className="flex items-center justify-between px-3 py-2 border-t" style={{ borderColor: 'var(--novo-border-default)' }}>
              <div className="relative">
                <select
                  value={detectionType}
                  onChange={e => setDetectionType(e.target.value)}
                  className="text-[10px] px-2 py-1 rounded-lg appearance-none pr-5 cursor-pointer novo-input"
                >
                  {DETECTION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 pointer-events-none" style={{ color: 'var(--novo-text-muted)' }} />
              </div>

              {modelInfo && (
                <a
                  href="/settings"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-all hover:bg-[var(--novo-bg-hover)]"
                  style={{ color: 'var(--novo-text-muted)' }}
                >
                  <Server className="w-2.5 h-2.5" />
                  <span>{modelInfo.provider || '未配置'}</span>
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: modelInfo.ready ? 'var(--novo-accent-success)' : 'var(--novo-accent-danger)' }}
                  />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ── 工具链配置 ── */}
        <div className="px-5 mb-2">
          <button
            onClick={() => setToolsExpanded(p => !p)}
            className="flex items-center gap-1.5 w-full text-left py-1.5 text-[11px] font-semibold transition-all"
            style={{ color: 'var(--novo-text-secondary)' }}
          >
            <ChevronRight
              className="w-3 h-3 transition-transform"
              style={{ transform: toolsExpanded ? 'rotate(90deg)' : 'none' }}
            />
            <Wrench className="w-3 h-3" />
            搜索引擎
            <span className="ml-auto text-[9px] font-normal" style={{ color: 'var(--novo-text-muted)' }}>
              {enabledToolsList.length}/{ALL_TOOLS.length}
            </span>
          </button>
          <AnimatePresence>
            {toolsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-1 py-1.5">
                  {ALL_TOOLS.map(t => {
                    const Icon = t.icon
                    const enabled = enabledTools[t.id]
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleTool(t.id)}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[10px] transition-all"
                        style={{
                          background: enabled ? `color-mix(in srgb, ${t.color} 8%, transparent)` : 'transparent',
                          color: enabled ? 'var(--novo-text-primary)' : 'var(--novo-text-disabled)',
                        }}
                      >
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                          style={{
                            background: enabled ? t.color : 'var(--novo-bg-active)',
                            opacity: enabled ? 1 : 0.4,
                          }}
                        >
                          {enabled
                            ? <Check className="w-2.5 h-2.5 text-white" />
                            : <Icon className="w-2.5 h-2.5" style={{ color: 'var(--novo-text-disabled)' }} />
                          }
                        </div>
                        <span className="font-medium">{t.label}</span>
                        <span style={{ color: 'var(--novo-text-muted)' }}>{t.desc}</span>
                        {t.needKey && (
                          <span
                            className="ml-auto px-1 py-0.5 rounded text-[8px]"
                            style={{ background: 'var(--novo-accent-warning-light)', color: 'var(--novo-accent-warning)' }}
                          >
                            KEY
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Prompt 注入 ── */}
        <div className="px-5 mb-3">
          <button
            onClick={() => setPromptExpanded(p => !p)}
            className="flex items-center gap-1.5 w-full text-left py-1.5 text-[11px] font-semibold transition-all"
            style={{ color: 'var(--novo-text-secondary)' }}
          >
            <ChevronRight
              className="w-3 h-3 transition-transform"
              style={{ transform: promptExpanded ? 'rotate(90deg)' : 'none' }}
            />
            <MessageSquarePlus className="w-3 h-3" />
            额外指令
            {extraInstructions.trim() && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--novo-accent-primary)' }} />
            )}
          </button>
          <AnimatePresence>
            {promptExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <textarea
                  value={extraInstructions}
                  onChange={e => setExtraInstructions(e.target.value)}
                  placeholder="例如：重点关注专利数据 / 只搜索 2023 年以后的论文 / 用英文输出..."
                  rows={3}
                  className="w-full mt-1 px-3 py-2 text-[10px] rounded-lg border resize-none focus:outline-none"
                  style={{
                    background: 'var(--novo-bg-surface)',
                    borderColor: 'var(--novo-border-default)',
                    color: 'var(--novo-text-primary)',
                  }}
                />
                <p className="text-[8px] mt-0.5" style={{ color: 'var(--novo-text-disabled)' }}>
                  这些指令会追加到 Agent 的上下文中
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 提交 / 取消 */}
        <div className="px-5 pb-2">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all mb-2"
            style={{
              background: canSubmit ? 'var(--novo-accent-primary)' : 'var(--novo-bg-active)',
              color: canSubmit ? 'white' : 'var(--novo-text-disabled)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? 'var(--novo-shadow-sm)' : 'none',
            }}
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FlaskConical className="w-3.5 h-3.5" />
            )}
            {isRunning ? '分析中...' : '开始分析'}
          </button>

          {isRunning && (
            <button
              onClick={reset}
              className="w-full py-2 rounded-xl text-[11px] font-medium transition-all mb-2"
              style={{
                color: 'var(--novo-text-muted)',
                border: '1px solid var(--novo-border-default)',
              }}
            >
              取消分析
            </button>
          )}
        </div>

        {/* ── 实时日志面板 ── */}
        {(isRunning || state.phase === 'completed') && state.toolCalls.length > 0 && (
          <div
            className="px-5 py-3 flex-1 min-h-0 flex flex-col"
            style={{ borderTop: '1px solid var(--novo-border-default)' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <ScrollText className="w-3 h-3" style={{ color: 'var(--novo-text-muted)' }} />
              <span className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-secondary)' }}>
                工具调用日志
              </span>
              <span className="text-[9px] ml-auto" style={{ color: 'var(--novo-text-disabled)' }}>
                {state.toolCalls.length} 次
              </span>
            </div>
            <div
              className="flex-1 overflow-y-auto space-y-1 min-h-0"
              style={{ maxHeight: 200 }}
            >
              {state.toolCalls.map((tc, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 px-2 py-1 rounded text-[9px]"
                  style={{ background: 'var(--novo-bg-surface)' }}
                >
                  <Search className="w-2.5 h-2.5 mt-0.5 shrink-0" style={{ color: 'var(--novo-accent-info)' }} />
                  <div className="min-w-0">
                    <span className="font-semibold" style={{ color: 'var(--novo-text-primary)' }}>{tc.tool}</span>
                    {tc.argsPreview && (
                      <span className="ml-1" style={{ color: 'var(--novo-text-muted)' }}>
                        {tc.argsPreview.slice(0, 60)}{tc.argsPreview.length > 60 ? '...' : ''}
                      </span>
                    )}
                    {tc.resultPreview && (
                      <div className="mt-0.5 truncate" style={{ color: 'var(--novo-text-disabled)' }}>
                        → {tc.resultPreview.slice(0, 80)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* 底部快捷键提示 */}
        <div
          className="px-5 py-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] mt-auto shrink-0"
          style={{ color: 'var(--novo-text-disabled)', borderTop: '1px solid var(--novo-border-default)' }}
        >
          <span className="flex items-center gap-1">
            <Keyboard className="w-2.5 h-2.5" />
            <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>Ctrl+↵</kbd>
            提交
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>Ctrl+Shift+A</kbd>
            切换模式
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>Ctrl+K</kbd>
            命令面板
          </span>
        </div>
      </aside>

      {/* ═══ 右栏：实时进度/结果 ═══ */}
      <main className="flex-1 h-full overflow-y-auto px-6 py-8">
        {/* 空闲状态 */}
        {state.phase === 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex items-center justify-center"
          >
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--novo-accent-primary-light)' }}
              >
                <FlaskConical className="w-7 h-7" style={{ color: 'var(--novo-accent-primary)' }} />
              </div>
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--novo-text-primary)' }}>
                等待输入
              </h3>
              <p className="text-xs" style={{ color: 'var(--novo-text-muted)' }}>
                在左侧输入创新想法，点击开始分析
              </p>
            </div>
          </motion.div>
        )}

        {/* 进度追踪 */}
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
            currentInput={input}
            onSyncInput={setInput}
            onResume={resume}
          />
        )}

        {/* HITL 确认 */}
        {state.phase === 'awaiting_confirmation' && state.mode === 'standard' && state.analyzedIntent && (
          <IntentConfirm
            intent={state.analyzedIntent}
            onConfirm={() => resume('confirm')}
            onRevise={(fb) => resume('revise', fb)}
          />
        )}

        {/* 完成 */}
        {state.phase === 'completed' && (
          <ResultView state={state} onReset={reset} />
        )}

        {/* 错误 */}
        {state.phase === 'error' && (
          <div className="max-w-2xl mx-auto">
            <div className="novo-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5" style={{ color: 'var(--novo-accent-danger)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--novo-accent-danger)' }}>分析出错</h3>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--novo-text-secondary)' }}>
                {state.error}
              </p>
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'var(--novo-accent-primary)', color: 'white' }}
              >
                重新开始
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
